"""Photo -> structured suggestion, via a local Ollama vision model (e.g. llava).

Never writes to the database itself - it only proposes a Homework/timetable entry
that the app then shows the user to confirm or edit before saving.
"""

import base64
import json
import re

import httpx

from app.config import settings

_JSON_BLOCK = re.compile(r"\{.*\}", re.DOTALL)

HOMEWORK_PROMPT = """Du bist ein OCR-Assistent. Lies zuerst jedes sichtbare Wort auf dem Foto
(Tafel, Aufgabenblatt oder Heft) sorgfältig, bevor du antwortest. Rate nichts, das du nicht
tatsächlich auf dem Bild erkennen kannst - wenn ein Feld nicht lesbar ist, setze es auf null.

Gib ausschließlich das folgende JSON-Objekt zurück, ohne Fließtext davor oder danach:
{{"subject_guess": "<tatsächlich erkanntes Schulfach oder null>", "title": "<kurzer Titel der Aufgabe>", "description": "<Details, oder null>", "due_date_guess": "<Datum im Format JJJJ-MM-TT falls erkennbar, sonst null>"}}

Beispiel-Antwort: {{"subject_guess": "Mathematik", "title": "S. 42, Aufgabe 3-5", "description": "Schriftlich rechnen", "due_date_guess": null}}

Bekannte Fächer dieser Klasse (bevorzuge diese, falls passend): {subjects}
"""

TIMETABLE_PROMPT = """Du bist ein OCR-Assistent. Du siehst ein Foto eines Wochen-Stundenplans
(eine Tabelle mit Wochentagen als Spalten oder Zeilen und Uhrzeiten). Lies jede Zelle einzeln
und sorgfältig. Übernimm für jedes Fach genau den Text, der in der jeweiligen Zelle steht -
erfinde oder wiederhole niemals ein Wort, das du nicht in dieser Zelle siehst. Lässt sich eine
Zelle nicht lesen, lasse sie weg statt zu raten.

Gib ausschließlich das folgende JSON-Objekt zurück, ohne Fließtext davor oder danach:
{{"entries": [{{"subject_guess": "<tatsächlich in der Zelle erkanntes Fach>", "weekday_guess": "<Montag|Dienstag|Mittwoch|Donnerstag|Freitag>", "starts_at_guess": "<HH:MM>", "ends_at_guess": "<HH:MM>"}}]}}

Beispiel-Antwort: {{"entries": [{{"subject_guess": "Englisch", "weekday_guess": "Montag", "starts_at_guess": "08:00", "ends_at_guess": "08:45"}}]}}
"""

# Words the vision model sometimes echoes from the instructions themselves (a known llava
# failure mode) instead of actually reading the image - never plausible subject names.
_HALLUCINATION_MARKERS = {"nur", "ja", "nein", "kein", "keine", "unbekannt", "fach", "leer"}


def _extract_json(text: str) -> dict:
    match = _JSON_BLOCK.search(text)
    if not match:
        raise ValueError("Model returned no JSON")
    return json.loads(match.group(0))


class VisionUnavailableError(Exception):
    """Ollama (or the configured vision model) could not be reached."""


async def _call_vision_model(image_bytes: bytes, prompt: str) -> str:
    image_b64 = base64.b64encode(image_bytes).decode("utf-8")
    try:
        async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=120.0) as client:
            response = await client.post(
                "/api/generate",
                json={
                    "model": settings.ollama_vision_model,
                    "prompt": prompt,
                    "images": [image_b64],
                    "stream": False,
                    "options": {"temperature": 0},
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


async def extract_timetable_from_image(image_bytes: bytes) -> dict:
    raw = await _call_vision_model(image_bytes, TIMETABLE_PROMPT)
    try:
        parsed = _extract_json(raw)
        parsed.setdefault("entries", [])
    except (ValueError, json.JSONDecodeError):
        parsed = {"entries": []}

    entries = parsed.get("entries") or []
    # Drop entries whose "subject" is actually a leaked instruction word - a known failure
    # mode of small vision models that lets them echo the prompt instead of reading the image.
    cleaned = [
        entry
        for entry in entries
        if (entry.get("subject_guess") or "").strip().lower() not in _HALLUCINATION_MARKERS
    ]
    all_same_subject = len({(e.get("subject_guess") or "").strip().lower() for e in entries}) == 1
    if cleaned != entries or (len(entries) > 1 and all_same_subject):
        parsed["entries"] = cleaned
        parsed["low_confidence"] = True
    else:
        parsed["entries"] = cleaned

    parsed["raw_model_output"] = raw
    return parsed
