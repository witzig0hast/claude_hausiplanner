import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AgentBusMessage(Base):
    """Local log of every OwnAI Agent Bus message this project has seen or sent - doubles as the
    dedup record for inbound polling, since GET /agent-bus/inbox always returns the agent's full
    history (no "unread"/"pending" filter, nothing is popped), so without this table every poll
    would reprocess every message again."""

    __tablename__ = "agent_bus_messages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    # The message id assigned by OwnAI - unique across both inbound and outbound rows, since an
    # outbound send's response is also recorded here under its own remote id.
    remote_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    direction: Mapped[str] = mapped_column(String(10))  # "inbound" | "outbound"
    peer_label: Mapped[str] = mapped_column(String(64))  # from_label (inbound) or to_label (outbound)
    kind: Mapped[str] = mapped_column(String(10))  # "text" | "task"
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    task_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(16))  # sent | pending | in_progress | completed | failed
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
