"""Background poller for the OwnAI Agent Bus - see app/services/agent_bus_client.py for the
endpoint contract. GET /agent-bus/inbox returns an agent's entire message history on every call
(no "unread" filter, nothing is popped server-side), so every message is deduped locally against
AgentBusMessage.(user_id, remote_id) before being acted on.

Runs once per poll tick for every user who has connected their own OwnAI account (own api key,
own optional base_url override) - not a single global connection."""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models.agent_bus_message import AgentBusMessage
from app.models.user import User
from app.security import decrypt_secret
from app.services import agent_bus_client
from app.services.agent_bus_client import AgentBusUnavailableError
from app.services.agent_bus_handlers import HANDLERS, TaskHandlerError

logger = logging.getLogger(__name__)


def _already_seen(db: Session, user_id, remote_id: str) -> bool:
    return (
        db.execute(
            select(AgentBusMessage.id).where(
                AgentBusMessage.user_id == user_id, AgentBusMessage.remote_id == remote_id
            )
        ).first()
        is not None
    )


async def _handle_text(db: Session, user: User, message: dict) -> None:
    """No result to report for kind="text" - just keep a local record so it isn't reprocessed
    and so it shows up in the user's own Agent Bus log."""
    db.add(
        AgentBusMessage(
            user_id=user.id,
            remote_id=message["id"],
            direction="inbound",
            peer_label=message["from_label"],
            kind="text",
            content=message.get("content"),
            status=message["status"],
        )
    )
    db.commit()


async def _handle_task(db: Session, user: User, base_url: str, api_key: str, message: dict) -> None:
    task_type = message.get("task_type")
    handler = HANDLERS.get(task_type or "")
    try:
        if handler is None:
            raise TaskHandlerError(f"Unbekannter task_type: {task_type!r}")
        result = await handler(db, user, message.get("payload"))
        status = "completed"
    except TaskHandlerError as exc:
        result = {"error": str(exc)}
        status = "failed"
    except Exception as exc:  # noqa: BLE001 - any handler bug must still report back, not hang the task
        logger.exception("Agent Bus task handler failed for task_type=%s", task_type)
        result = {"error": f"Interner Fehler: {exc}"}
        status = "failed"

    try:
        await agent_bus_client.submit_result(base_url, api_key, message["id"], status, result)
    except AgentBusUnavailableError:
        logger.warning("Could not report Agent Bus result for message %s - will retry next poll", message["id"])
        return  # don't record locally - next poll will see it as unseen and retry

    db.add(
        AgentBusMessage(
            user_id=user.id,
            remote_id=message["id"],
            direction="inbound",
            peer_label=message["from_label"],
            kind="task",
            task_type=task_type,
            payload=message.get("payload"),
            status=status,
            result=result,
        )
    )
    db.commit()


async def _poll_for_user(db: Session, user: User) -> None:
    api_key = decrypt_secret(user.ownai_agent_bus_key_encrypted or "")
    if not api_key:
        logger.warning("Agent Bus key for %s could not be decrypted - skipping", user.email)
        return
    base_url = user.ownai_agent_bus_base_url or settings.ownai_agent_bus_base_url

    try:
        messages = await agent_bus_client.fetch_inbox(base_url, api_key)
    except AgentBusUnavailableError:
        logger.warning("Agent Bus inbox unreachable for %s - will retry next poll", user.email)
        return

    for message in messages:
        if _already_seen(db, user.id, message["id"]):
            continue
        if message["kind"] == "text":
            await _handle_text(db, user, message)
        elif message["kind"] == "task" and message["status"] == "pending":
            await _handle_task(db, user, base_url, api_key, message)
        # kind="task" with a non-pending status (e.g. already completed by an older poll that
        # crashed before the local record was written) - leave it; nothing to redo.


async def poll_agent_bus() -> None:
    db = SessionLocal()
    try:
        users = (
            db.execute(
                select(User).where(
                    User.ownai_agent_bus_enabled.is_(True),
                    User.ownai_agent_bus_key_encrypted.isnot(None),
                )
            )
            .scalars()
            .all()
        )
        for user in users:
            await _poll_for_user(db, user)
    finally:
        db.close()
