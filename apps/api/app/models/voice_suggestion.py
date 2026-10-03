import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
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
    # Set only when the transcript said "bis zur nächsten Stunde" and the class's own
    # timetable could resolve a precise lesson time - never guessed by the model itself.
    due_time_guess: Mapped[str | None] = mapped_column(String(5), nullable=True)  # "HH:MM"
    # True when "bis zur nächsten Stunde" could NOT be resolved from a real timetable entry
    # (unknown subject or no lesson configured yet) and due_date/time_guess are therefore a
    # rough placeholder ("morgen Abend"), not a real lesson time - shown to the admin as such.
    due_is_estimated: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    subject: Mapped["Subject"] = relationship()
