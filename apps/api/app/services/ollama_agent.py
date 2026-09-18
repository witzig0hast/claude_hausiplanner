import json
import re
from datetime import datetime, timedelta

import httpx
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models.calendar_event import CalendarEvent
from app.models.homework import Homework
from app.models.user import User

_JSON_ARRAY = re.compile(r"\[.*\]", re.DOTALL)

FLASHCARDS_PROMPT_TEMPLATE = """Erzeuge aus folgendem Lernstoff 5-8 Karteikarten (Frage/Antwort) zum Üben.
Antworte NUR mit einem JSON-Array in exakt diesem Format, ohne weitere Erklärung:
[{{"question": "<Frage>", "answer": "<kurze Antwort>"}}, ...]

Lernstoff:
{text}
"""

TONE_INSTRUCTIONS = {
    "locker": "Locker, freundlich, wie ein entspannter älterer Freund. Kein Alarmismus, kein erhobener Zeigefinger.",
    "streng": "Direkt und bestimmt, wie eine strenge aber faire Lehrkraft. Klar sagen, was ansteht, ohne unhöflich zu werden.",
}

SUMMARY_PROMPT_TEMPLATE = """Du bist ein Lernassistent für Schüler. Tonfall: {tone}
Fasse kurz zusammen, was an Hausaufgaben ansteht. Nenne Fach, Deadline und ob es eng wird.
Halte es unter 80 Wörtern, auf Deutsch. Das ist ein entspannter Hinweis, kein Alarm.

Offene Hausaufgaben von {name}:
{items}
"""

CHAT_PROMPT_TEMPLATE = """Du bist ein Lernassistent für Schüler. Tonfall: {tone}
Antworte kurz und konkret auf Deutsch (max. 100 Wörter), basierend auf diesem Kontext.
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


async def _call_text_model(prompt: str) -> str | None:
    """Returns None (instead of raising) when Ollama is unreachable, so every
    caller can fall back to something useful instead of a 500."""
    async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=60.0) as client:
        try:
            response = await client.post(
                "/api/generate",
                json={"model": settings.ollama_model, "prompt": prompt, "stream": False},
            )
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


async def generate_flashcards(text: str) -> list[dict]:
    prompt = FLASHCARDS_PROMPT_TEMPLATE.format(text=text[:4000])
    result = await _call_text_model(prompt)
    if result is None:
        raise AgentUnavailableError(f"Ollama ({settings.ollama_base_url}) nicht erreichbar")
    match = _JSON_ARRAY.search(result)
    if not match:
        return []
    try:
        cards = json.loads(match.group(0))
    except json.JSONDecodeError:
        return []
    return [c for c in cards if isinstance(c, dict) and "question" in c and "answer" in c]
