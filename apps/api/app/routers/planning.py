from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_class_member
from app.models.user import User
from app.schemas.planning import PlanningOut
from app.services.planner import build_plan

router = APIRouter(prefix="/planning", tags=["planning"])


@router.get("", response_model=PlanningOut)
def get_plan(
    days_ahead: int = Query(7, ge=1, le=21),
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    """Freie Zeit zwischen den Kalendereinträgen + Vorschlag, wann welche
    Hausaufgabe reinpasst (früheste Deadline zuerst)."""
    return build_plan(db, user, days_ahead)
