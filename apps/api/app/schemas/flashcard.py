import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class FlashcardOut(BaseModel):
    id: uuid.UUID
    question: str
    answer: str
    box: int
    next_review_at: datetime
    due: bool

    class Config:
        from_attributes = True


class DeckSummaryOut(BaseModel):
    id: uuid.UUID
    title: str
    created_at: datetime
    card_count: int
    due_count: int

    class Config:
        from_attributes = True


class DeckDetailOut(DeckSummaryOut):
    cards: list[FlashcardOut]


class ReviewRequest(BaseModel):
    result: Literal["know", "again"]


class CreateCardRequest(BaseModel):
    question: str
    answer: str
