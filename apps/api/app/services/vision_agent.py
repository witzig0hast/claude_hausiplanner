"""Photo -> structured suggestion, via a local Ollama vision model (e.g. llava).

Never writes to the database itself - it only proposes a Homework/timetable entry
that the app then shows the user to confirm or edit before saving.
"""

import base64
import json
import re

import httpx

from app.config import settings
from app.services.subject_matching import resolve_subject_name

HOMEWORK_PROMPT = """Du bist ein OCR-Assistent. Lies zuerst jedes sichtbare Wort auf dem Foto
(Tafel, Aufgabenblatt oder Heft) sorgfältig, bevor du antwortest. Rate nichts, das du nicht
tatsächlich auf dem Bild erkennen kannst - wenn ein Feld nicht lesbar ist, setze es auf null.

Gib ausschließlich das folgende JSON-Objekt zurück, ohne Fließtext davor oder danach:
{{"subject_guess": "<tatsächlich erkanntes Schulfach oder null>", "title": "<kurzer Titel der Aufgabe>", "description": "<Details, oder null>", "due_date_guess": "<Datum im Format JJJJ-MM-TT falls erkennbar, sonst null>"}}

Beispiel-Antwort: {{"subject_guess": "Mathematik", "title": "S. 42, Aufgabe 3-5", "description": "Schriftlich rechnen", "due_date_guess": null}}

Bekannte Fächer dieser Klasse (bevorzuge diese, falls passend): {subjects}
"""

_TIMETABLE_CELL_INSTRUCTIONS = """WICHTIG: In Stundenplänen wie WebUntis stehen in jeder Zelle mehrere Zeilen übereinander,
typischerweise in dieser Reihenfolge:
1. Name der Lehrkraft (ein Nachname, z.B. "Binder", "Hammerl", "Fechter")
2. Fach-Kürzel (ein kurzes Kürzel, z.B. "D", "E", "Ma", "Ph", "Geo", "Inf", "Ku", "Mu", "Sm")
3. Raumnummer (eine Zahl oder Zahl+Buchstabe, z.B. "066", "224", "U02")
Nimm für "subject_guess" NIEMALS den Lehrernamen (Zeile 1) oder die Raumnummer (Zeile 3) -
sondern ausschließlich das Fach-Kürzel aus Zeile 2 dieser Zelle. Übernimm das Kürzel exakt so,
wie es dort steht - erfinde oder wiederhole niemals ein Wort, das du nicht in dieser Zelle siehst."""

# With a known period grid: the model only has to pick a weekday + period number per lesson -
# never asked to read or invent a time itself, so it can no longer get the time wrong.
TIMETABLE_PROMPT_WITH_PERIODS = """Du bist ein OCR-Assistent. Du siehst ein Foto eines Wochen-Stundenplans
(eine Tabelle mit Wochentagen als Spalten oder Zeilen). Gehe systematisch Spalte für Spalte
(Wochentag für Wochentag) von oben nach unten durch und erfasse JEDE belegte Unterrichtsstunde,
die du siehst - überspringe keine Stunde und höre nicht vorzeitig auf, auch wenn es viele sind.
Lässt sich eine einzelne Zelle nicht lesen, lasse nur diese eine Zelle weg statt zu raten, aber
brich die Erfassung dadurch nicht ab.

{cell_instructions}

Diese Schule hat folgenden festen Stunden-Raster. Ordne jede erkannte Unterrichtsstunde anhand
ihrer Position in der Tabelle (von oben nach unten) genau einer dieser Nummern zu - erfinde oder
schätze NIEMALS selbst eine Uhrzeit, gib ausschließlich die Nummer aus dieser Liste zurück:
{periods}

Gib ausschließlich das folgende JSON-Objekt zurück, ohne Fließtext davor oder danach:
{{"entries": [{{"subject_guess": "<Fach-Kürzel aus Zeile 2 der Zelle, nicht der Lehrername>", "weekday_guess": "<Montag|Dienstag|Mittwoch|Donnerstag|Freitag>", "period_number": <Nummer aus dem Stunden-Raster oben, als Zahl>}}]}}

Beispiel-Antwort: {{"entries": [{{"subject_guess": "E", "weekday_guess": "Montag", "period_number": 1}}]}}

Bekannte Fächer dieser Klasse, falls hilfreich zur Zuordnung von Kürzeln (bevorzuge diese bei Übereinstimmung): {subjects}
"""

TIMETABLE_PROMPT = """Du bist ein OCR-Assistent. Du siehst ein Foto eines Wochen-Stundenplans
(eine Tabelle mit Wochentagen als Spalten oder Zeilen und Uhrzeiten). Gehe systematisch
Spalte für Spalte (Wochentag für Wochentag) von oben nach unten durch und erfasse JEDE
belegte Unterrichtsstunde, die du siehst - überspringe keine Stunde und höre nicht vorzeitig
auf, auch wenn es viele sind. Lässt sich eine einzelne Zelle nicht lesen, lasse nur diese eine
Zelle weg statt zu raten, aber brich die Erfassung dadurch nicht ab.

{cell_instructions}

Gib ausschließlich das folgende JSON-Objekt zurück, ohne Fließtext davor oder danach:
{{"entries": [{{"subject_guess": "<Fach-Kürzel aus Zeile 2 der Zelle, nicht der Lehrername>", "weekday_guess": "<Montag|Dienstag|Mittwoch|Donnerstag|Freitag>", "starts_at_guess": "<HH:MM>", "ends_at_guess": "<HH:MM>"}}]}}

Beispiel-Antwort: {{"entries": [{{"subject_guess": "E", "weekday_guess": "Montag", "starts_at_guess": "08:00", "ends_at_guess": "08:45"}}]}}

Bekannte Fächer dieser Klasse, falls hilfreich zur Zuordnung von Kürzeln (bevorzuge diese bei Übereinstimmung): {subjects}
"""

# Mapping every lesson's weekday AND period in one pass over the full week table asks a local
# vision model to track a 2D grid position - in practice this is where most of its mistakes
# come from, not the subject OCR. Scanning one weekday column at a time turns that into a
# much easier 1D "read top to bottom" task - the weekday is given, never guessed by the model.
SINGLE_DAY_TIMETABLE_PROMPT_WITH_PERIODS = """Du bist ein OCR-Assistent. Du siehst ein Foto des Stundenplans für
GENAU EINEN Wochentag: {weekday}. Das Bild zeigt nur diese eine Spalte/diesen einen Tag -
gehe von der ersten (frühesten) bis zur letzten (spätesten) Unterrichtsstunde von oben nach
unten durch und erfasse JEDE belegte Stunde, die du siehst - überspringe keine, höre nicht
vorzeitig auf. Lässt sich eine einzelne Zelle nicht lesen, lasse nur diese eine weg statt zu
raten, aber brich die Erfassung dadurch nicht ab.

{cell_instructions}

Diese Schule hat folgenden festen Stunden-Raster. Ordne jede erkannte Stunde anhand ihrer
Position von oben (früh) nach unten (spät) genau einer dieser Nummern zu - erfinde oder
schätze NIEMALS selbst eine Uhrzeit, gib ausschließlich die Nummer aus dieser Liste zurück:
{periods}

Gib ausschließlich das folgende JSON-Objekt zurück, ohne Fließtext davor oder danach:
{{"entries": [{{"subject_guess": "<Fach-Kürzel aus Zeile 2 der Zelle, nicht der Lehrername>", "period_number": <Nummer aus dem Stunden-Raster oben, als Zahl>}}]}}

Beispiel-Antwort: {{"entries": [{{"subject_guess": "E", "period_number": 1}}]}}

Bekannte Fächer dieser Klasse, falls hilfreich zur Zuordnung von Kürzeln (bevorzuge diese bei Übereinstimmung): {subjects}
"""

SINGLE_DAY_TIMETABLE_PROMPT = """Du bist ein OCR-Assistent. Du siehst ein Foto des Stundenplans für
GENAU EINEN Wochentag: {weekday}. Das Bild zeigt nur diese eine Spalte/diesen einen Tag -
gehe von der ersten (frühesten) bis zur letzten (spätesten) Unterrichtsstunde von oben nach
unten durch und erfasse JEDE belegte Stunde, die du siehst - überspringe keine, höre nicht
vorzeitig auf. Lässt sich eine einzelne Zelle nicht lesen, lasse nur diese eine weg statt zu
raten, aber brich die Erfassung dadurch nicht ab.

{cell_instructions}

Gib ausschließlich das folgende JSON-Objekt zurück, ohne Fließtext davor oder danach:
{{"entries": [{{"subject_guess": "<Fach-Kürzel aus Zeile 2 der Zelle, nicht der Lehrername>", "starts_at_guess": "<HH:MM>", "ends_at_guess": "<HH:MM>"}}]}}

Beispiel-Antwort: {{"entries": [{{"subject_guess": "E", "starts_at_guess": "08:00", "ends_at_guess": "08:45"}}]}}

Bekannte Fächer dieser Klasse, falls hilfreich zur Zuordnung von Kürzeln (bevorzuge diese bei Übereinstimmung): {subjects}
"""

# Words the vision model sometimes echoes from the instructions themselves (a known llava
# failure mode) instead of actually reading the image - never plausible subject names.
_HALLUCINATION_MARKERS = {"nur", "ja", "nein", "kein", "keine", "unbekannt", "fach", "leer"}

def _extract_json(text: str) -> dict:
    """Find the JSON object in the model's response, ignoring any explanatory text or
    markdown fences the model adds around it despite being told not to. A naive greedy
    regex from the first "{" to the last "}" breaks as soon as such surrounding text
    contains its own brace (e.g. a "{...}" mentioned while explaining the format), so
    instead decode every JSON object the text contains and keep the last one - the model's
    actual answer, since any example or aside it echoes from the prompt comes first."""
    decoder = json.JSONDecoder()
    result = None
    start = text.find("{")
    while start != -1:
        try:
            obj, end = decoder.raw_decode(text, start)
            result = obj
            start = text.find("{", max(end, start + 1))
        except json.JSONDecodeError:
            start = text.find("{", start + 1)
    if result is None:
        raise ValueError("Model returned no JSON")
    return result


_FLAT_ENTRY_OBJECT = re.compile(r"\{[^{}]*\}")


def _extract_partial_entries(text: str) -> list[dict]:
    """Best-effort recovery for a timetable response that got cut off mid-array (e.g. the
    model's context window was too small to finish) - pull out every complete, flat
    {...} entry object instead of discarding the whole response over one dangling,
    incomplete object at the end."""
    entries = []
    for match in _FLAT_ENTRY_OBJECT.finditer(text):
        try:
            entries.append(json.loads(match.group(0)))
        except json.JSONDecodeError:
            continue
    return entries


class VisionUnavailableError(Exception):
    """Ollama (or the configured vision model) could not be reached."""


async def _call_vision_model(image_bytes: bytes, prompt: str) -> str:
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    try:
        async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=240.0) as client:
            response = await client.post(
                "/api/generate",
                json={
                    "model": settings.ollama_vision_model,
                    "prompt": prompt,
                    "images": [image_b64],
                    "stream": False,
                    # Forces valid JSON (no markdown fences/explanations) and gives the
                    # model enough output budget for a full week of entries - a timetable
                    # with ~30+ lessons was otherwise getting cut off mid-array. num_ctx also
                    # has to grow: the image itself consumes a large share of a small default
                    # context window, leaving too little room for a long JSON response even
                    # with num_predict raised, which cut answers off mid-object.
                    "format": "json",
                    "options": {"temperature": 0, "num_predict": 4096, "num_ctx": 8192},
                },
            )
            response.raise_for_status()
            return response.json().get("response", "").strip()
    except httpx.HTTPError as exc:
        raise VisionUnavailableError(
            f"Ollama ({settings.ollama_base_url}, Modell '{settings.ollama_vision_model}') nicht erreichbar"
        ) from exc


async def extract_homework_from_image(image_bytes: bytes, known_subjects: list[str]) -> dict:
    prompt = HOMEWORK_PROMPT.format(subjects=", ".join(known_subjects) or "keine hinterlegt")
    raw = await _call_vision_model(image_bytes, prompt)
    try:
        parsed = _extract_json(raw)
    except (ValueError, json.JSONDecodeError):
        parsed = {"subject_guess": None, "title": "Konnte nicht automatisch erkannt werden", "description": None, "due_date_guess": None}
    parsed["raw_model_output"] = raw
    parsed.setdefault("title", "Hausaufgabe")
    return parsed


async def extract_timetable_from_image(
    image_bytes: bytes,
    known_subjects: list[str] | None = None,
    known_periods: list[dict] | None = None,
    known_weekday: str | None = None,
) -> dict:
    """known_periods, if the admin has set up the class's lesson-time grid, is a list of
    {"number": int, "start_time": "HH:MM", "end_time": "HH:MM"}. When present, the model is
    asked for a period number instead of a time - the time itself then always comes from
    this admin-entered grid, never from the model, so it can't be misread.

    known_weekday, if the photo shows only a single day's column (recommended), fixes the
    weekday server-side instead of asking the model to classify it: a full week table makes
    the model track both weekday AND period for every cell, a 2D position it frequently gets
    wrong, while a single day only needs a 1D top-to-bottom read."""
    periods_by_number = {p["number"]: p for p in (known_periods or [])}
    subjects_text = ", ".join(known_subjects or []) or "keine hinterlegt"
    periods_text = "\n".join(
        f"{p['number']}. Stunde: {p['start_time']}–{p['end_time']}"
        for p in sorted(periods_by_number.values(), key=lambda p: p["number"])
    )

    if known_weekday and periods_by_number:
        prompt = SINGLE_DAY_TIMETABLE_PROMPT_WITH_PERIODS.format(
            cell_instructions=_TIMETABLE_CELL_INSTRUCTIONS,
            periods=periods_text,
            subjects=subjects_text,
            weekday=known_weekday,
        )
    elif known_weekday:
        prompt = SINGLE_DAY_TIMETABLE_PROMPT.format(
            cell_instructions=_TIMETABLE_CELL_INSTRUCTIONS, subjects=subjects_text, weekday=known_weekday
        )
    elif periods_by_number:
        prompt = TIMETABLE_PROMPT_WITH_PERIODS.format(
            cell_instructions=_TIMETABLE_CELL_INSTRUCTIONS, periods=periods_text, subjects=subjects_text
        )
    else:
        prompt = TIMETABLE_PROMPT.format(cell_instructions=_TIMETABLE_CELL_INSTRUCTIONS, subjects=subjects_text)

    raw = await _call_vision_model(image_bytes, prompt)
    try:
        parsed = _extract_json(raw)
        parsed.setdefault("entries", [])
    except (ValueError, json.JSONDecodeError):
        # The response likely got cut off mid-array (e.g. context window too small for a
        # full week) - salvage whatever complete entries we can instead of showing nothing.
        parsed = {"entries": _extract_partial_entries(raw)}

    raw_entries = parsed.get("entries") or []
    if known_weekday:
        # The model was never asked for a weekday in single-day mode - set it here instead
        # of trusting anything it might have added on its own.
        raw_entries = [{**entry, "weekday_guess": known_weekday} for entry in raw_entries]
    if periods_by_number:
        # Resolve each lesson's time from the admin-entered grid by its period number -
        # the model never gets to invent or misread a time on its own. An out-of-range or
        # missing period number means the lesson is dropped rather than given a fake time.
        resolved = []
        for entry in raw_entries:
            period = periods_by_number.get(entry.get("period_number"))
            if period is None:
                continue
            resolved.append({**entry, "starts_at_guess": period["start_time"], "ends_at_guess": period["end_time"]})
        raw_entries = resolved

    required_keys = {"subject_guess", "weekday_guess", "starts_at_guess", "ends_at_guess"}
    entries = [e for e in raw_entries if required_keys.issubset(e) and all(e[k] for k in required_keys)]
    # Drop entries whose "subject" is actually a leaked instruction word - a known failure
    # mode of small vision models that lets them echo the prompt instead of reading the image.
    cleaned = [
        entry
        for entry in entries
        if (entry.get("subject_guess") or "").strip().lower() not in _HALLUCINATION_MARKERS
    ]
    all_same_subject = len({(e.get("subject_guess") or "").strip().lower() for e in entries}) == 1
    low_confidence = cleaned != entries or (len(entries) > 1 and all_same_subject)

    for entry in cleaned:
        raw_subject = (entry.get("subject_guess") or "").strip()
        entry["subject_raw"] = raw_subject
        entry["subject_guess"] = resolve_subject_name(raw_subject, known_subjects or [])

    parsed["entries"] = cleaned
    parsed["low_confidence"] = low_confidence
    parsed["raw_model_output"] = raw
    return parsed
