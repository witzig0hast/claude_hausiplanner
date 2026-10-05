"""task_type handlers for inbound Agent Bus tasks. The bus contract deliberately leaves
task_type/payload shapes to whatever the two projects agree on - this is the Hausiplanner side of
that agreement. Add a new task_type by adding a function here and registering it in HANDLERS.

Every handler acts on behalf of whichever Hausiplanner user owns the OwnAI connection the task
arrived on - the poller resolves that from the connection itself (one OwnAI account per user,
each with their own key), so handlers just take that user directly."""

from typing import Any, Awaitable, Callable

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.homework import Homework
from app.models.user import User

HandlerResult = dict[str, Any]
Handler = Callable[[Session, User, dict[str, Any] | None], Awaitable[HandlerResult]]


class TaskHandlerError(Exception):
    """Raised by a handler for an expected failure (bad payload, user not in a class, ...) -
    reported back as status="failed" with this message, instead of crashing the poller."""


async def list_open_homework(db: Session, user: User, payload: dict[str, Any] | None) -> HandlerResult:
    """payload: none required. Returns every not-yet-completed homework item for the requesting
    user's class, soonest due first."""
    if user.school_class_id is None:
        raise TaskHandlerError(f"{user.email} ist aktuell keiner Klasse zugeordnet.")

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
