import uuid
from datetime import datetime

from pydantic import BaseModel


class SchoolClassCreate(BaseModel):
    name: str


class SchoolClassOut(BaseModel):
    id: uuid.UUID
    name: str
    invite_code: str
    created_at: datetime

    class Config:
        from_attributes = True


class SubjectCreate(BaseModel):
    name: str
    color: str = "#3B82F6"
    icon: str = "book"


class SubjectOut(BaseModel):
    id: uuid.UUID
    name: str
    color: str
    icon: str

    class Config:
        from_attributes = True


class ClassInviteOut(BaseModel):
    invite_code: str
    join_url: str
    public_view_url: str


class MemberOut(BaseModel):
    id: uuid.UUID
    display_name: str
    email: str
    is_class_admin: bool

    class Config:
        from_attributes = True


class SubjectStatOut(BaseModel):
    subject_id: uuid.UUID
    subject_name: str
    subject_color: str
    homework_count: int
    avg_completion_rate: float  # 0..1, average across that subject's homework items
