import uuid
from datetime import datetime

from pydantic import BaseModel


class CalendarEventCreate(BaseModel):
    title: str
    starts_at: datetime
    ends_at: datetime
    is_recurring_weekly: bool = False
    weekday: int | None = None
    subject_id: uuid.UUID | None = None
    event_type: str = "lesson"  # "lesson" | "exam" | "other"
    course_id: uuid.UUID | None = None  # set for one of several parallel timetable tracks


class CalendarEventOut(BaseModel):
    id: uuid.UUID
    title: str
    starts_at: datetime
    ends_at: datetime
    is_recurring_weekly: bool
    weekday: int | None
    subject_id: uuid.UUID | None
    event_type: str
    course_id: uuid.UUID | None

    class Config:
        from_attributes = True
