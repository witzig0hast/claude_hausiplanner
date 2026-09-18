import uuid
from datetime import datetime

from pydantic import BaseModel


class FreeSlotOut(BaseModel):
    start: datetime
    end: datetime


class StudySuggestionOut(BaseModel):
    homework_id: uuid.UUID
    title: str
    subject_name: str
    start: datetime
    end: datetime
    minutes: int


class PlanningOut(BaseModel):
    free_slots: list[FreeSlotOut]
    suggestions: list[StudySuggestionOut]
    unscheduled: list[str]  # titles that didn't fit anywhere before their deadline
