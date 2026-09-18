from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_class_member
from app.models.push_token import PushToken
from app.models.user import User
from app.schemas.push import (
    AgentSummaryOut,
    ChatRequest,
    ChatResponse,
    Flashcard,
    FlashcardsRequest,
    FlashcardsResponse,
    RegisterPushTokenRequest,
    WorkloadOut,
)
from app.services.ollama_agent import AgentUnavailableError, answer_question, generate_flashcards, generate_summary_for_user
from app.services.planner import compute_workload

router = APIRouter(tags=["agent"])


@router.get("/agent/summary", response_model=AgentSummaryOut)
async def agent_summary(user: User = Depends(require_class_member), db: Session = Depends(get_db)):
    summary = await generate_summary_for_user(db, user)
    return AgentSummaryOut(summary=summary, generated_at=datetime.now(timezone.utc).isoformat())


@router.post("/agent/chat", response_model=ChatResponse)
async def agent_chat(
    payload: ChatRequest,
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    answer = await answer_question(db, user, payload.question)
    return ChatResponse(answer=answer)


@router.get("/agent/workload", response_model=WorkloadOut)
def agent_workload(user: User = Depends(require_class_member), db: Session = Depends(get_db)):
    return WorkloadOut(**compute_workload(db, user))


@router.post("/agent/flashcards", response_model=FlashcardsResponse)
async def agent_flashcards(payload: FlashcardsRequest, user: User = Depends(require_class_member)):
    try:
        cards = await generate_flashcards(payload.text)
    except AgentUnavailableError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    return FlashcardsResponse(cards=[Flashcard(**c) for c in cards])


@router.post("/push/register-token", status_code=204)
def register_push_token(
    payload: RegisterPushTokenRequest,
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    existing = db.query(PushToken).filter(PushToken.token == payload.token).first()
    if existing:
        existing.user_id = user.id
        existing.platform = payload.platform
    else:
        db.add(PushToken(user_id=user.id, token=payload.token, platform=payload.platform))
    db.commit()
