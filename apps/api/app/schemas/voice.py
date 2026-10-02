import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.school_class import SubjectOut


class PendingSuggestionOut(BaseModel):
    id: uuid.UUID
    raw_transcript: str
    subject_guess: str | None
    subject: SubjectOut | None
    title: str
    description: str | None
    due_date_guess: str | None
    due_time_guess: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class ApplySuggestionRequest(BaseModel):
    title: str
    description: str | None = None
    due_at: datetime
    subject_id: uuid.UUID
    estimated_minutes: int | None = None
