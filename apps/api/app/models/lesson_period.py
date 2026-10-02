import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class LessonPeriod(Base):
    """A class's fixed lesson-time grid (e.g. "1. Stunde: 08:00-08:45"), set up once by the
    admin. The timetable photo scan maps each recognized lesson to one of these instead of
    letting the vision model guess times itself - it can misread a subject abbreviation,
    but it can no longer invent a wrong time for a real lesson slot."""

    __tablename__ = "lesson_periods"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    number: Mapped[int] = mapped_column(Integer)
    start_time: Mapped[str] = mapped_column(String(5))  # "HH:MM"
    end_time: Mapped[str] = mapped_column(String(5))  # "HH:MM"

    school_class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_classes.id"))
    school_class: Mapped["SchoolClass"] = relationship(back_populates="lesson_periods")
