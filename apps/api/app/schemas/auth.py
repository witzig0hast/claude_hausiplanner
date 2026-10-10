import uuid

from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    display_name: str
    password: str
    invite_code: str | None = None
    class_name: str | None = None  # only used when invite_code is absent (new class)
    # Shown to the user at signup as an opt-out checkbox next to the deadline-email disclaimer -
    # defaults to on (matching the User model's own default) so anyone registering through a
    # client that doesn't send this field yet keeps today's behavior.
    email_reminders_enabled: bool = True


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
    digest_enabled: bool
    deadline_push_enabled: bool
    priorities_enabled: bool
    sso_connected: bool

    class Config:
        from_attributes = True


class SetAgentToneRequest(BaseModel):
    tone: str  # "locker" | "streng"


class SetEmailRemindersRequest(BaseModel):
    enabled: bool


class SetNotificationPrefsRequest(BaseModel):
    digest_enabled: bool
    deadline_push_enabled: bool


class SetPrioritiesEnabledRequest(BaseModel):
    enabled: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class SsoStatusOut(BaseModel):
    enabled: bool


class SsoCompleteRequest(BaseModel):
    """Finishes account creation for a brand-new SSO login - the provider already verified the
    person's identity, this only still needs to know which class they belong to."""

    pending_token: str
    display_name: str
    invite_code: str | None = None
    class_name: str | None = None
    email_reminders_enabled: bool = True
