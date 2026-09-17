from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_class_member
from app.models.push_token import PushToken
from app.models.user import User
from app.schemas.push import AgentSummaryOut, RegisterPushTokenRequest
from app.services.ollama_agent import generate_summary_for_user

router = APIRouter(tags=["agent"])


@router.get("/agent/summary", response_model=AgentSummaryOut)
async def agent_summary(user: User = Depends(require_class_member), db: Session = Depends(get_db)):
    summary = await generate_summary_for_user(db, user)
    return AgentSummaryOut(summary=summary, generated_at=datetime.now(timezone.utc).isoformat())


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
