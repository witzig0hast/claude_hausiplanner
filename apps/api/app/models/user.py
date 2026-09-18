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
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    school_class_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("school_classes.id"), nullable=True
    )
    school_class: Mapped["SchoolClass"] = relationship(back_populates="members")

    completions: Mapped[list["HomeworkCompletion"]] = relationship(back_populates="user")
    push_tokens: Mapped[list["PushToken"]] = relationship(back_populates="user")
