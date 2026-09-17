from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_class_admin, require_class_member
from app.models.subject import Subject
from app.models.user import User
from app.schemas.school_class import SchoolClassOut, SubjectCreate, SubjectOut

router = APIRouter(prefix="/classes", tags=["classes"])


@router.get("/me", response_model=SchoolClassOut)
def my_class(user: User = Depends(require_class_member)):
    return user.school_class


@router.get("/me/subjects", response_model=list[SubjectOut])
def list_subjects(user: User = Depends(require_class_member), db: Session = Depends(get_db)):
    return db.query(Subject).filter(Subject.school_class_id == user.school_class_id).all()


@router.post("/me/subjects", response_model=SubjectOut)
def create_subject(
    payload: SubjectCreate,
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    subject = Subject(**payload.model_dump(), school_class_id=user.school_class_id)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


@router.delete("/me/subjects/{subject_id}", status_code=204)
def delete_subject(
    subject_id: str,
    user: User = Depends(require_class_admin),
    db: Session = Depends(get_db),
):
    db.query(Subject).filter(
        Subject.id == subject_id, Subject.school_class_id == user.school_class_id
    ).delete()
    db.commit()
