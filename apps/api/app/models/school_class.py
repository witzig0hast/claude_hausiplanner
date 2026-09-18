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

    # cascade: deleting a class (e.g. via the hidden superadmin surface) removes
    # everything that only makes sense within it - including its members.
    members: Mapped[list["User"]] = relationship(back_populates="school_class", cascade="all, delete-orphan")
    subjects: Mapped[list["Subject"]] = relationship(back_populates="school_class", cascade="all, delete-orphan")
    homework_items: Mapped[list["Homework"]] = relationship(
        back_populates="school_class", cascade="all, delete-orphan"
    )
    calendar_events: Mapped[list["CalendarEvent"]] = relationship(
        back_populates="school_class", cascade="all, delete-orphan"
    )
