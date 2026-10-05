import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AgentBusStatusOut(BaseModel):
    connected: bool
    enabled: bool
    base_url: str  # the effective URL (user override, or the server default)


class ConnectAgentBusRequest(BaseModel):
    api_key: str
    base_url: str | None = None  # None clears any per-user override, falls back to the server default


class SetAgentBusEnabledRequest(BaseModel):
    enabled: bool


class AgentBusLogEntryOut(BaseModel):
    id: uuid.UUID
    remote_id: str
    direction: str
    peer_label: str
    kind: str
    content: str | None
    task_type: str | None
    payload: dict[str, Any] | None
    status: str
    result: dict[str, Any] | None
    created_at: datetime

    class Config:
        from_attributes = True
