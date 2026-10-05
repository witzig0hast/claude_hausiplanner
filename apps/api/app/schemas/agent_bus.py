import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class AgentBusStatusOut(BaseModel):
    configured: bool
    user_email: str | None


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
