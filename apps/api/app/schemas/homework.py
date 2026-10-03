import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.school_class import SubjectOut


class HomeworkCreate(BaseModel):
    title: str
    description: str | None = None
    due_at: datetime
    subject_id: uuid.UUID
    estimated_minutes: int | None = None
    repeat_weeks: int | None = None  # if set, also creates this many weekly-spaced follow-up copies
    priority: str | None = None  # "niedrig" | "normal" | "hoch" - only used if the creator opted in


class HomeworkOut(BaseModel):
    id: uuid.UUID
    title: str
    description: str | None
    due_at: datetime
    estimated_minutes: int | None
    priority: str | None
    created_at: datetime
    subject: SubjectOut
    completed_by_me: bool = False
    completed_count: int = 0

    class Config:
        from_attributes = True
