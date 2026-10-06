import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Homework(Base):
    __tablename__ = "homework"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_at: Mapped[datetime] = mapped_column(DateTime)
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Only meaningful when the creator's "priorities_enabled" setting is on - "niedrig" |
    # "normal" | "hoch", or null if never set (treated the same as "normal").
    priority: Mapped[str | None] = mapped_column(String(10), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    school_class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_classes.id"))
    school_class: Mapped["SchoolClass"] = relationship(back_populates="homework_items")

    subject_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("subjects.id"))
    subject: Mapped["Subject"] = relationship(back_populates="homework_items")

    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    completions: Mapped[list["HomeworkCompletion"]] = relationship(
        back_populates="homework", cascade="all, delete-orphan"
    )
    attachments: Mapped[list["HomeworkAttachment"]] = relationship(
        back_populates="homework", cascade="all, delete-orphan"
    )


class HomeworkCompletion(Base):
    """Per-user 'done' state - completing a task only affects the current user."""

    __tablename__ = "homework_completions"
    __table_args__ = (UniqueConstraint("homework_id", "user_id", name="uq_homework_user"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    homework_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("homework.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    completed_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    homework: Mapped["Homework"] = relationship(back_populates="completions")
    user: Mapped["User"] = relationship(back_populates="completions")
