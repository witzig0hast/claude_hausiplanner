import uuid
from datetime import datetime

from pydantic import BaseModel


class ChallengeOut(BaseModel):
    challenge_id: uuid.UUID
    nonce_b64: str
    expires_at: datetime


class SuperAdminLoginRequest(BaseModel):
    challenge_id: uuid.UUID
    signature_b64: str


class SuperAdminTokenOut(BaseModel):
    access_token: str
    expires_in_minutes: int


class ClassSummaryOut(BaseModel):
    id: uuid.UUID
    name: str
    invite_code: str
    member_count: int
    homework_count: int
    created_at: datetime


class UserSummaryOut(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    is_class_admin: bool
    school_class_id: uuid.UUID | None
    school_class_name: str | None
    created_at: datetime


class HomeworkSummaryOut(BaseModel):
    id: uuid.UUID
    title: str
    due_at: datetime
    school_class_id: uuid.UUID
    school_class_name: str
    subject_name: str
    completed_count: int


class SystemStatsOut(BaseModel):
    class_count: int
    user_count: int
    homework_count: int
    open_homework_count: int
