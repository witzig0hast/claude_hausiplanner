import json
import re
from datetime import datetime, timedelta

import httpx
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models.calendar_event import CalendarEvent
from app.models.homework import Homework
from app.models.user import User

_JSON_OBJECT = re.compile(r"\{.*\}", re.DOTALL)

WEEKDAYS_DE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]

VOICE_HOMEWORK_PROMPT_TEMPLATE = """Ein Schüler hat eine Hausaufgabe eingesprochen, hier die Transkription:
"{transcript}"

Heutiges Datum: {today} ({weekday})

Deine einzige Aufgabe ist es, diese Transkription in Felder aufzuteilen - du erfindest nichts
Neues, du gibst nur in anderer Form wieder, was dort wortwörtlich steht. Der "title" muss aus
Wörtern bestehen, die tatsächlich in der Transkription vorkommen (z.B. das genannte Fach und
die genannte Aufgabe) - niemals ein Thema, das dort nicht erwähnt wird.

Antworte NUR mit einem JSON-Objekt, ohne weitere Erklärung, in exakt diesem Format:
{{"subject_guess": "<im Transkript genanntes Schulfach oder null>", "title": "<kurzer Titel, nur aus Wörtern der Transkription>", "description": "<Details aus der Transkription, oder null>", "due_date_guess": "<Datum im Format JJJJ-MM-TT falls erkennbar (auch aus relativen Angaben wie \\"morgen\\" oder \\"nächsten Montag\\" ausgehend vom heutigen Datum), sonst null>"}}

Beispiel: Transkript "Mathe, Seite 42 Aufgabe 3, bis morgen" -> {{"subject_guess": "Mathematik", "title": "Seite 42, Aufgabe 3", "description": null, "due_date_guess": "<morgiges Datum>"}}

Bekannte Fächer dieser Klasse (bevorzuge diese, falls passend): {subjects}
"""

TONE_INSTRUCTIONS = {
    "locker": "Locker, freundlich, wie ein entspannter älterer Freund. Kein Alarmismus, kein erhobener Zeigefinger.",
    "streng": "Direkt und bestimmt, wie eine strenge aber faire Lehrkraft. Klar sagen, was ansteht, ohne unhöflich zu werden.",
}

SUMMARY_PROMPT_TEMPLATE = """Du bist ein Lernassistent für Schüler. Tonfall: {tone}
Fasse in maximal 2 kurzen Sätzen (unter 35 Wörtern) zusammen, was an Hausaufgaben ansteht.
Nutze AUSSCHLIESSLICH die unten gelisteten Hausaufgaben - erfinde keine zusätzlichen Fächer,
Aufgaben, Zahlen oder Fristen, die dort nicht stehen. Wenn die Liste leer ist, sag das auch so.
Auf Deutsch, ein entspannter Hinweis, kein Alarm.

Offene Hausaufgaben von {name}:
{items}
"""

CHAT_PROMPT_TEMPLATE = """Du bist ein Lernassistent für Schüler. Tonfall: {tone}
Antworte kurz und konkret auf Deutsch (max. 100 Wörter), basierend NUR auf dem Kontext unten -
erfinde keine Hausaufgaben, Fächer oder Termine, die dort nicht auftauchen.
Wenn die Frage nichts mit Hausaufgaben/Zeitplanung zu tun hat, beantworte sie trotzdem freundlich.

Offene Hausaufgaben von {name}:
{items}

Kommende Termine:
{events}

Frage von {name}: {question}
"""


def _format_items(items: list[Homework], user_id) -> str:
    if not items:
        return "Keine offenen Hausaufgaben. Alles erledigt!"
    lines = []
    for hw in items:
        done = any(c.user_id == user_id for c in hw.completions)
        if done:
            continue
        remaining = hw.due_at - datetime.utcnow()
        hours_left = max(0, int(remaining.total_seconds() // 3600))
        lines.append(f"- {hw.subject.name}: \"{hw.title}\" (fällig in ca. {hours_left}h)")
    return "\n".join(lines) if lines else "Keine offenen Hausaufgaben. Alles erledigt!"


def _format_events(events: list[CalendarEvent]) -> str:
    if not events:
        return "Keine besonderen Termine hinterlegt."
    lines = [f"- {e.title} am {e.starts_at.strftime('%a %d.%m. %H:%M')}" for e in events[:10]]
    return "\n".join(lines)


async def _call_text_model(
    prompt: str,
    model: str | None = None,
    json_mode: bool = False,
    num_predict: int | None = None,
) -> str | None:
    """Returns None (instead of raising) when Ollama is unreachable, so every
    caller can fall back to something useful instead of a 500.

    json_mode constrains Ollama to emit only JSON (no chatty filler before/after),
    and num_predict caps how many tokens it's allowed to generate - both cut
    response time for short, structured answers like the voice/flashcards extraction."""
    payload: dict = {"model": model or settings.ollama_model, "prompt": prompt, "stream": False}
    if json_mode:
        payload["format"] = "json"
    options: dict = {"temperature": 0}
    if num_predict is not None:
        options["num_predict"] = num_predict
    payload["options"] = options
    async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=60.0) as client:
        try:
            response = await client.post("/api/generate", json=payload)
            response.raise_for_status()
            return response.json().get("response", "").strip()
        except httpx.HTTPError:
            return None


def _open_homework_query(db: Session, user: User):
    return (
        db.query(Homework)
        .options(joinedload(Homework.subject), joinedload(Homework.completions))
        .filter(
            Homework.school_class_id == user.school_class_id,
            Homework.due_at >= datetime.utcnow() - timedelta(days=1),
        )
        .order_by(Homework.due_at.asc())
        .all()
    )


async def generate_summary_for_user(db: Session, user: User) -> str:
    items = _open_homework_query(db, user)
    prompt = SUMMARY_PROMPT_TEMPLATE.format(
        tone=TONE_INSTRUCTIONS.get(user.agent_tone, TONE_INSTRUCTIONS["locker"]),
        name=user.display_name,
        items=_format_items(items, user.id),
    )
    result = await _call_text_model(prompt)
    return result if result is not None else _format_items(items, user.id)


async def answer_question(db: Session, user: User, question: str) -> str:
    items = _open_homework_query(db, user)
    events = (
        db.query(CalendarEvent)
        .filter(CalendarEvent.school_class_id == user.school_class_id)
        .order_by(CalendarEvent.starts_at.asc())
        .limit(10)
        .all()
    )
    prompt = CHAT_PROMPT_TEMPLATE.format(
        tone=TONE_INSTRUCTIONS.get(user.agent_tone, TONE_INSTRUCTIONS["locker"]),
        name=user.display_name,
        items=_format_items(items, user.id),
        events=_format_events(events),
        question=question,
    )
    result = await _call_text_model(prompt)
    if result is not None:
        return result
    return (
        "Der KI-Agent (Ollama) ist gerade nicht erreichbar. Hier trotzdem deine offenen "
        f"Hausaufgaben:\n{_format_items(items, user.id)}"
    )


class AgentUnavailableError(Exception):
    pass


_STOPWORDS_DE = {
    "der", "die", "das", "und", "oder", "für", "von", "mit", "auf", "aus", "ist", "sind",
    "ein", "eine", "einen", "einem", "einer", "wir", "ich", "müssen", "muss", "dass", "auch",
}


def _shares_no_words_with(text: str, transcript: str) -> bool:
    """Catches a model inventing an unrelated topic (e.g. transcript about a math exercise,
    title about something else entirely) regardless of which model produced it - a cheap,
    model-agnostic safety net alongside the prompt instructions."""
    text_words = {w for w in re.findall(r"\w{4,}", text.lower())} - _STOPWORDS_DE
    if not text_words:
        return False
    transcript_words = {w for w in re.findall(r"\w{4,}", transcript.lower())} - _STOPWORDS_DE
    return text_words.isdisjoint(transcript_words)


async def extract_homework_from_voice(transcript: str, known_subjects: list[str]) -> dict:
    """Turns a dictated voice note transcript into a homework suggestion - same shape as
    the photo-based extraction (vision_agent.extract_homework_from_image)."""
    today = datetime.utcnow()
    prompt = VOICE_HOMEWORK_PROMPT_TEMPLATE.format(
        transcript=transcript[:2000],
        today=today.strftime("%Y-%m-%d"),
        weekday=WEEKDAYS_DE[today.weekday()],
        subjects=", ".join(known_subjects) or "keine hinterlegt",
    )
    raw = await _call_text_model(
        prompt,
        model=settings.ollama_voice_model,
        json_mode=True,
        num_predict=250,
    )
    if raw is None:
        raise AgentUnavailableError(f"Ollama ({settings.ollama_base_url}) nicht erreichbar")
    match = _JSON_OBJECT.search(raw)
    if not match:
        parsed = {"subject_guess": None, "title": transcript[:200], "description": None, "due_date_guess": None}
    else:
        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError:
            parsed = {"subject_guess": None, "title": transcript[:200], "description": None, "due_date_guess": None}
    parsed.setdefault("title", transcript[:200] or "Hausaufgabe")
    parsed.setdefault("subject_guess", None)
    parsed.setdefault("description", None)
    parsed.setdefault("due_date_guess", None)

    # The model invented a title/description with zero words from the actual transcript -
    # a telltale hallucination. Fall back to the transcript itself rather than keep nonsense.
    if _shares_no_words_with(parsed.get("title") or "", transcript):
        parsed["title"] = transcript[:200] or "Hausaufgabe"
    if parsed.get("description") and _shares_no_words_with(parsed["description"], transcript):
        parsed["description"] = None

    return parsed
