import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    is_class_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    agent_tone: Mapped[str] = mapped_column(String(16), default="locker")  # "locker" | "streng"
    email_reminders_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # Which message types the agent is allowed to send this user - independent of whether a
    # push token or SMTP is even configured, so a user can mute one channel without affecting
    # the other (email_reminders_enabled above is channel-specific, these are message-type).
    digest_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    deadline_push_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    # Opt-in: shows a priority field on homework and a badge on cards. Off by default so the
    # UI doesn't gain a field most classes never asked for.
    priorities_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    school_class_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("school_classes.id"), nullable=True
    )
    school_class: Mapped["SchoolClass"] = relationship(back_populates="members")

    completions: Mapped[list["HomeworkCompletion"]] = relationship(back_populates="user")
    push_tokens: Mapped[list["PushToken"]] = relationship(back_populates="user")
