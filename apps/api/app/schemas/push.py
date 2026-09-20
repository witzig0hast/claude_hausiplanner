from pydantic import BaseModel


class RegisterPushTokenRequest(BaseModel):
    token: str
    platform: str  # "ios" | "android"


class AgentSummaryOut(BaseModel):
    summary: str
    generated_at: str


class ChatRequest(BaseModel):
    question: str


class ChatResponse(BaseModel):
    answer: str


class WorkloadOut(BaseModel):
    level: str  # "green" | "yellow" | "red"
    minutes_needed: int
    minutes_available: int
    message: str
