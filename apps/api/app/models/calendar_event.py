import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CalendarEvent(Base):
    """Admin-maintained persistent timetable/calendar entry (lessons, exams, trips, etc.).

    WebUntis can't be synced (API disabled by the school), so the class admin
    maintains this manually instead of relying on a live feed.
    """

    __tablename__ = "calendar_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200))
    starts_at: Mapped[datetime] = mapped_column(DateTime)
    ends_at: Mapped[datetime] = mapped_column(DateTime)
    is_recurring_weekly: Mapped[bool] = mapped_column(Boolean, default=False)
    weekday: Mapped[int | None] = mapped_column(Integer, nullable=True)  # 0=Mon..6=Sun, for recurring lessons

    school_class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_classes.id"))
    school_class: Mapped["SchoolClass"] = relationship(back_populates="calendar_events")

    subject_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("subjects.id"), nullable=True)
    subject: Mapped["Subject"] = relationship(back_populates="calendar_events")

    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
