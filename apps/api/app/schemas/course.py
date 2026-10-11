import uuid

from pydantic import BaseModel


class CourseCreate(BaseModel):
    name: str
    subject_id: uuid.UUID | None = None


class CourseOut(BaseModel):
    id: uuid.UUID
    name: str
    subject_id: uuid.UUID | None
    member_count: int
    is_member: bool
