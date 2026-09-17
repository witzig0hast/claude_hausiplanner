import secrets
import uuid
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def generate_invite_code() -> str:
    return secrets.token_urlsafe(6)


class SchoolClass(Base):
    __tablename__ = "school_classes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(120))
    invite_code: Mapped[str] = mapped_column(
        String(32), unique=True, default=generate_invite_code, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    members: Mapped[list["User"]] = relationship(back_populates="school_class")
    subjects: Mapped[list["Subject"]] = relationship(back_populates="school_class")
    homework_items: Mapped[list["Homework"]] = relationship(back_populates="school_class")
    calendar_events: Mapped[list["CalendarEvent"]] = relationship(back_populates="school_class")
