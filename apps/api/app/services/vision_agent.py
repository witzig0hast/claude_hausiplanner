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
_JSON_ARRAY_BLOCK = re.compile(r"\[.*\]", re.DOTALL)

HOMEWORK_PROMPT = """Du siehst ein Foto einer Hausaufgabe (Tafel, Aufgabenblatt oder Heft).
Extrahiere die Hausaufgabe und antworte NUR mit einem JSON-Objekt, ohne weitere Erklärung,
in exakt diesem Format:
{{"subject_guess": "<vermutetes Schulfach oder null>", "title": "<kurzer Titel der Aufgabe>", "description": "<Details, oder null>", "due_date_guess": "<Datum im Format JJJJ-MM-TT falls erkennbar, sonst null>"}}

Bekannte Fächer dieser Klasse (bevorzuge diese, falls passend): {subjects}
"""

TIMETABLE_PROMPT = """Du siehst ein Foto eines Stundenplans. Extrahiere alle erkennbaren Stunden
und antworte NUR mit einem JSON-Objekt in exakt diesem Format, ohne weitere Erklärung:
{{"entries": [{{"subject_guess": "<Fach>", "weekday_guess": "<Montag|Dienstag|Mittwoch|Donnerstag|Freitag>", "starts_at_guess": "<HH:MM>", "ends_at_guess": "<HH:MM>"}}]}}
"""

FLASHCARDS_VISION_PROMPT = """Du siehst ein Foto von Lernstoff (Heftseite, Buchseite oder Tafel).
Lies den Inhalt und erzeuge daraus 5-8 Karteikarten (Frage/Antwort) zum Üben.
Antworte NUR mit einem JSON-Array in exakt diesem Format, ohne weitere Erklärung:
[{{"question": "<Frage>", "answer": "<kurze Antwort>"}}, ...]
"""


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
    parsed["raw_model_output"] = raw
    return parsed


async def extract_flashcards_from_image(image_bytes: bytes) -> list[dict]:
    raw = await _call_vision_model(image_bytes, FLASHCARDS_VISION_PROMPT)
    match = _JSON_ARRAY_BLOCK.search(raw)
    if not match:
        return []
    try:
        cards = json.loads(match.group(0))
    except json.JSONDecodeError:
        return []
    return [c for c in cards if isinstance(c, dict) and "question" in c and "answer" in c]
