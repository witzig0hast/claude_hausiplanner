import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FlashcardDeck(Base):
    __tablename__ = "flashcard_decks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(200))
    source_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    school_class_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("school_classes.id"))
    school_class: Mapped["SchoolClass"] = relationship(back_populates="flashcard_decks")

    created_by_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))

    cards: Mapped[list["Flashcard"]] = relationship(back_populates="deck", cascade="all, delete-orphan")


class Flashcard(Base):
    __tablename__ = "flashcards"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    deck_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("flashcard_decks.id"))
    deck: Mapped["FlashcardDeck"] = relationship(back_populates="cards")

    progress: Mapped[list["FlashcardProgress"]] = relationship(
        back_populates="card", cascade="all, delete-orphan"
    )


class FlashcardProgress(Base):
    """Per-user Leitner-style spaced repetition state - never shared between
    classmates, same isolation principle as HomeworkCompletion."""

    __tablename__ = "flashcard_progress"
    __table_args__ = (UniqueConstraint("flashcard_id", "user_id", name="uq_progress_flashcard_user"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    flashcard_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("flashcards.id"))
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    box: Mapped[int] = mapped_column(Integer, default=1)
    next_review_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    card: Mapped["Flashcard"] = relationship(back_populates="progress")
