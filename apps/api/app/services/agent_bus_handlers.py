"""task_type handlers for inbound Agent Bus tasks. The bus contract deliberately leaves
task_type/payload shapes to whatever the two projects agree on - this is the Hausiplanner side of
that agreement. Add a new task_type by adding a function here and registering it in HANDLERS.

Every handler acts on behalf of settings.ownai_agent_bus_user_email - the bus has no concept of
"which member of this class", only one OwnAI account per API key, so that account must map to one
specific Hausiplanner user."""

from typing import Any, Awaitable, Callable

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.homework import Homework
from app.models.user import User

HandlerResult = dict[str, Any]
Handler = Callable[[Session, dict[str, Any] | None], Awaitable[HandlerResult]]


class TaskHandlerError(Exception):
    """Raised by a handler for an expected failure (bad payload, no configured user, ...) -
    reported back as status="failed" with this message, instead of crashing the poller."""


def _configured_user(db: Session) -> User:
    from app.config import settings

    if not settings.ownai_agent_bus_user_email:
        raise TaskHandlerError(
            "OWNAI_AGENT_BUS_USER_EMAIL ist auf diesem Server nicht gesetzt - unklar, fuer wen die Anfrage gilt."
        )
    user = db.execute(select(User).where(User.email == settings.ownai_agent_bus_user_email)).scalar_one_or_none()
    if user is None:
        raise TaskHandlerError(f"Kein Nutzer mit E-Mail {settings.ownai_agent_bus_user_email} gefunden.")
    return user


async def list_open_homework(db: Session, payload: dict[str, Any] | None) -> HandlerResult:
    """payload: none required. Returns every not-yet-completed homework item for the configured
    user's class, soonest due first."""
    user = _configured_user(db)
    items = (
        db.execute(
            select(Homework)
            .options(joinedload(Homework.subject), joinedload(Homework.completions))
            .where(Homework.school_class_id == user.school_class_id)
            .order_by(Homework.due_at.asc())
        )
        .unique()
        .scalars()
        .all()
    )
    open_items = [hw for hw in items if not any(c.user_id == user.id for c in hw.completions)]
    return {
        "count": len(open_items),
        "items": [
            {
                "subject": hw.subject.name,
                "title": hw.title,
                "due_at": hw.due_at.isoformat(),
                "priority": hw.priority,
            }
            for hw in open_items
        ],
    }


HANDLERS: dict[str, Handler] = {
    "list_open_homework": list_open_homework,
}
