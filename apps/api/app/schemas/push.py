from pydantic import BaseModel


class RegisterPushTokenRequest(BaseModel):
    token: str
    platform: str  # "ios" | "android"


class AgentSummaryOut(BaseModel):
    summary: str
    generated_at: str
