from datetime import datetime, timedelta

import httpx
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.models.homework import Homework
from app.models.user import User

PROMPT_TEMPLATE = """Du bist ein freundlicher Lernassistent. Fasse dem Schüler kurz und locker
zusammen, was an Hausaufgaben ansteht. Nenne Fach, Deadline und ob es eng wird.
Halte es unter 80 Wörtern, auf Deutsch, ohne Alarmismus - ein entspannter Hinweis, kein Alarm.

Offene Hausaufgaben von {name}:
{items}
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


async def generate_summary_for_user(db: Session, user: User) -> str:
    items = (
        db.query(Homework)
        .options(joinedload(Homework.subject), joinedload(Homework.completions))
        .filter(
            Homework.school_class_id == user.school_class_id,
            Homework.due_at >= datetime.utcnow() - timedelta(days=1),
        )
        .order_by(Homework.due_at.asc())
        .all()
    )
    prompt = PROMPT_TEMPLATE.format(name=user.display_name, items=_format_items(items, user.id))

    async with httpx.AsyncClient(base_url=settings.ollama_base_url, timeout=60.0) as client:
        try:
            response = await client.post(
                "/api/generate",
                json={"model": settings.ollama_model, "prompt": prompt, "stream": False},
            )
            response.raise_for_status()
            return response.json().get("response", "").strip()
        except httpx.HTTPError:
            # Ollama not reachable (e.g. not running locally yet) - fall back to a plain list
            return _format_items(items, user.id)
