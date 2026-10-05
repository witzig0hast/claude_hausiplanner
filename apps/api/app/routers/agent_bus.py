from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends

from app.config import settings
from app.database import get_db
from app.deps import require_class_admin
from app.models.agent_bus_message import AgentBusMessage
from app.models.user import User
from app.schemas.agent_bus import AgentBusLogEntryOut, AgentBusStatusOut

router = APIRouter(prefix="/agent-bus", tags=["agent-bus"])


def _is_bus_owner(user: User) -> bool:
    """The bus is configured for exactly one OwnAI account (one API key per deployment) - only
    the admin whose email matches gets to see its log, even on a multi-class deployment."""
    return bool(settings.ownai_agent_bus_key) and user.email == settings.ownai_agent_bus_user_email


@router.get("/status", response_model=AgentBusStatusOut)
def agent_bus_status(user: User = Depends(require_class_admin)):
    return AgentBusStatusOut(
        configured=_is_bus_owner(user),
        user_email=settings.ownai_agent_bus_user_email if _is_bus_owner(user) else None,
    )


@router.get("/log", response_model=list[AgentBusLogEntryOut])
def agent_bus_log(user: User = Depends(require_class_admin), db: Session = Depends(get_db)):
    if not _is_bus_owner(user):
        return []
    rows = (
        db.execute(select(AgentBusMessage).order_by(AgentBusMessage.created_at.desc()).limit(50))
        .scalars()
        .all()
    )
    return rows
