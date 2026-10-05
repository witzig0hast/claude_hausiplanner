import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AgentBusMessage(Base):
    """Local log of every OwnAI Agent Bus message a user has seen or sent - doubles as the dedup
    record for inbound polling, since GET /agent-bus/inbox always returns that agent's full
    history (no "unread"/"pending" filter, nothing is popped), so without this table every poll
    would reprocess every message again. Each user connects their own OwnAI account, so every
    row belongs to exactly one user."""

    __tablename__ = "agent_bus_messages"
    __table_args__ = (UniqueConstraint("user_id", "remote_id", name="uq_agent_bus_message_user_remote"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    # The message id assigned by OwnAI - unique per user across both inbound and outbound rows,
    # since an outbound send's response is also recorded here under its own remote id.
    remote_id: Mapped[str] = mapped_column(String(64))
    direction: Mapped[str] = mapped_column(String(10))  # "inbound" | "outbound"
    peer_label: Mapped[str] = mapped_column(String(64))  # from_label (inbound) or to_label (outbound)
    kind: Mapped[str] = mapped_column(String(10))  # "text" | "task"
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    task_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(16))  # sent | pending | in_progress | completed | failed
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
