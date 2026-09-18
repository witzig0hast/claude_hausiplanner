from pydantic import BaseModel


class HomeworkSuggestion(BaseModel):
    subject_guess: str | None = None
    title: str
    description: str | None = None
    due_date_guess: str | None = None  # ISO date string if the model could read one, else null
    raw_model_output: str


class TimetableEntrySuggestion(BaseModel):
    subject_guess: str
    weekday_guess: str  # e.g. "Montag" - the client maps this to an actual date
    starts_at_guess: str  # "HH:MM"
    ends_at_guess: str  # "HH:MM"


class TimetableSuggestion(BaseModel):
    entries: list[TimetableEntrySuggestion]
    raw_model_output: str
