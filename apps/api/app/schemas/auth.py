import uuid

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    display_name: str
    password: str
    invite_code: str | None = None
    class_name: str | None = None  # only used when invite_code is absent (new class)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class JoinClassRequest(BaseModel):
    invite_code: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    display_name: str
    is_class_admin: bool
    school_class_id: uuid.UUID | None
    agent_tone: str
    email_reminders_enabled: bool

    class Config:
        from_attributes = True


class SetAgentToneRequest(BaseModel):
    tone: str  # "locker" | "streng"


class SetEmailRemindersRequest(BaseModel):
    enabled: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
