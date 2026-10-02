import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PendingHomeworkSuggestion(Base):
    """An eingesprochene Hausaufgabe, noch nicht bestaetigt - genau eine pro Nutzer.

    Lives independently of any open browser tab: if the user dictates a note and
    closes the page, this row survives so the next visit (even hours later, on a
    different device) can still offer "so speichern?"."""

    __tablename__ = "pending_homework_suggestions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), unique=True)

    raw_transcript: Mapped[str] = mapped_column(Text)
    subject_guess: Mapped[str | None] = mapped_column(String(120), nullable=True)
    subject_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("subjects.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_date_guess: Mapped[str | None] = mapped_column(String(10), nullable=True)  # "JJJJ-MM-TT"
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    subject: Mapped["Subject"] = relationship()
