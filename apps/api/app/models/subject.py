import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Subject(Base):
    __tablename__ = "subjects"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(80))
    color: Mapped[str] = mapped_column(String(16), default="#3B82F6")
    icon: Mapped[str] = mapped_column(String(32), default="book")

    school_class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_classes.id"))
    school_class: Mapped["SchoolClass"] = relationship(back_populates="subjects")

    homework_items: Mapped[list["Homework"]] = relationship(back_populates="subject")
    calendar_events: Mapped[list["CalendarEvent"]] = relationship(back_populates="subject")
