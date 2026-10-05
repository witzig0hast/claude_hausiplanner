from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models.agent_bus_message import AgentBusMessage
from app.models.user import User
from app.schemas.agent_bus import (
    AgentBusLogEntryOut,
    AgentBusStatusOut,
    ConnectAgentBusRequest,
    SetAgentBusEnabledRequest,
)
from app.security import encrypt_secret

router = APIRouter(prefix="/agent-bus", tags=["agent-bus"])


@router.get("/status", response_model=AgentBusStatusOut)
def agent_bus_status(user: User = Depends(get_current_user)):
    return AgentBusStatusOut(
        connected=bool(user.ownai_agent_bus_key_encrypted),
        enabled=user.ownai_agent_bus_enabled,
        base_url=user.ownai_agent_bus_base_url or settings.ownai_agent_bus_base_url,
    )


@router.put("/connect", response_model=AgentBusStatusOut)
def connect_agent_bus(
    payload: ConnectAgentBusRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Stores this user's own OwnAI Agent Bus API key, encrypted at rest - never returned by any
    API response once set, only overwritten by connecting again or cleared via DELETE."""
    user.ownai_agent_bus_key_encrypted = encrypt_secret(payload.api_key)
    user.ownai_agent_bus_base_url = payload.base_url
    user.ownai_agent_bus_enabled = True
    db.commit()
    db.refresh(user)
    return AgentBusStatusOut(
        connected=True,
        enabled=user.ownai_agent_bus_enabled,
        base_url=user.ownai_agent_bus_base_url or settings.ownai_agent_bus_base_url,
    )


@router.delete("/connect", response_model=AgentBusStatusOut)
def disconnect_agent_bus(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user.ownai_agent_bus_key_encrypted = None
    user.ownai_agent_bus_base_url = None
    db.commit()
    db.refresh(user)
    return AgentBusStatusOut(connected=False, enabled=user.ownai_agent_bus_enabled, base_url=settings.ownai_agent_bus_base_url)


@router.put("/enabled", response_model=AgentBusStatusOut)
def set_agent_bus_enabled(
    payload: SetAgentBusEnabledRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Pause/resume polling without having to re-enter the API key."""
    user.ownai_agent_bus_enabled = payload.enabled
    db.commit()
    db.refresh(user)
    return AgentBusStatusOut(
        connected=bool(user.ownai_agent_bus_key_encrypted),
        enabled=user.ownai_agent_bus_enabled,
        base_url=user.ownai_agent_bus_base_url or settings.ownai_agent_bus_base_url,
    )


@router.get("/log", response_model=list[AgentBusLogEntryOut])
def agent_bus_log(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = (
        db.execute(
            select(AgentBusMessage)
            .where(AgentBusMessage.user_id == user.id)
            .order_by(AgentBusMessage.created_at.desc())
            .limit(50)
        )
        .scalars()
        .all()
    )
    return rows
