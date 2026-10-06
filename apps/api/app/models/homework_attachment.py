import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class HomeworkAttachment(Base):
    """A material file (PDF, image, office doc, ...) attached to a homework item, visible to the
    whole class. The actual bytes live on disk under settings.uploads_dir, named by this row's
    id - `filename` only holds the original name for display/download, never used as a path
    (avoids any path-traversal risk from a user-controlled filename)."""

    __tablename__ = "homework_attachments"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    homework_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("homework.id"))
    uploaded_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    homework: Mapped["Homework"] = relationship(back_populates="attachments")
