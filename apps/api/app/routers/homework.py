import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_class_member
from app.models.homework import Homework, HomeworkCompletion
from app.models.school_class import SchoolClass
from app.models.user import User
from app.schemas.homework import HomeworkCreate, HomeworkOut

router = APIRouter(tags=["homework"])


def _serialize(hw: Homework, viewer_id: uuid.UUID | None) -> HomeworkOut:
    out = HomeworkOut.model_validate(hw)
    out.completed_count = len(hw.completions)
    out.completed_by_me = viewer_id is not None and any(c.user_id == viewer_id for c in hw.completions)
    return out


@router.get("/public/classes/{class_id}/homework", response_model=list[HomeworkOut])
def public_homework(class_id: uuid.UUID, db: Session = Depends(get_db)):
    """No login required - anyone with the class link can see what's due."""
    school_class = db.get(SchoolClass, class_id)
    if school_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    items = (
        db.query(Homework)
        .options(joinedload(Homework.subject), joinedload(Homework.completions))
        .filter(Homework.school_class_id == class_id)
        .order_by(Homework.due_at.asc())
        .all()
    )
    return [_serialize(hw, viewer_id=None) for hw in items]


@router.get("/homework", response_model=list[HomeworkOut])
def list_homework(
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    items = (
        db.query(Homework)
        .options(joinedload(Homework.subject), joinedload(Homework.completions))
        .filter(Homework.school_class_id == user.school_class_id)
        .order_by(Homework.due_at.asc())
        .all()
    )
    return [_serialize(hw, viewer_id=user.id) for hw in items]


@router.post("/homework", response_model=HomeworkOut)
def create_homework(
    payload: HomeworkCreate,
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    hw = Homework(
        **payload.model_dump(),
        school_class_id=user.school_class_id,
        created_by_id=user.id,
    )
    db.add(hw)
    db.commit()
    db.refresh(hw)
    return _serialize(hw, viewer_id=user.id)


@router.delete("/homework/{homework_id}", status_code=204)
def delete_homework(
    homework_id: uuid.UUID,
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    hw = db.get(Homework, homework_id)
    if hw is None or hw.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Homework not found")
    if hw.created_by_id != user.id and not user.is_class_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the creator or an admin can delete this")
    db.delete(hw)
    db.commit()


@router.post("/homework/{homework_id}/complete", response_model=HomeworkOut)
def complete_homework(
    homework_id: uuid.UUID,
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    """Marks the task done for the current user only - never affects classmates."""
    hw = db.get(Homework, homework_id)
    if hw is None or hw.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Homework not found")

    exists = (
        db.query(HomeworkCompletion)
        .filter(HomeworkCompletion.homework_id == homework_id, HomeworkCompletion.user_id == user.id)
        .first()
    )
    if not exists:
        db.add(HomeworkCompletion(homework_id=homework_id, user_id=user.id))
        db.commit()
    db.refresh(hw)
    return _serialize(hw, viewer_id=user.id)


@router.delete("/homework/{homework_id}/complete", response_model=HomeworkOut)
def uncomplete_homework(
    homework_id: uuid.UUID,
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    hw = db.get(Homework, homework_id)
    if hw is None or hw.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Homework not found")

    db.query(HomeworkCompletion).filter(
        HomeworkCompletion.homework_id == homework_id, HomeworkCompletion.user_id == user.id
    ).delete()
    db.commit()
    db.refresh(hw)
    return _serialize(hw, viewer_id=user.id)
