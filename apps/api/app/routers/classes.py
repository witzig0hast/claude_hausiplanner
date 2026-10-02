import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.deps import require_class_admin, require_class_member
from app.models.homework import Homework
from app.models.lesson_period import LessonPeriod
from app.models.subject import Subject
from app.models.user import User
from app.schemas.school_class import (
    ClassInviteOut,
    LessonPeriodCreate,
    LessonPeriodOut,
    MemberOut,
    SchoolClassOut,
    SubjectCreate,
    SubjectOut,
    SubjectStatOut,
)

router = APIRouter(prefix="/classes", tags=["classes"])


@router.get("/me", response_model=SchoolClassOut)
def my_class(user: User = Depends(require_class_member)):
    return user.school_class


@router.get("/me/invite", response_model=ClassInviteOut)
def my_class_invite(user: User = Depends(require_class_member)):
    """Sharelink für Mitschüler: der Invite-Code zum Registrieren + der öffentliche
    Lese-Link ohne Login."""
    code = user.school_class.invite_code
    return ClassInviteOut(
        invite_code=code,
        join_url=f"{settings.web_base_url}/login?invite={code}",
        public_view_url=f"{settings.web_base_url}/class/{user.school_class_id}",
    )


@router.get("/me/subjects", response_model=list[SubjectOut])
def list_subjects(user: User = Depends(require_class_member), db: Session = Depends(get_db)):
    return db.query(Subject).filter(Subject.school_class_id == user.school_class_id).all()


@router.post("/me/subjects", response_model=SubjectOut)
def create_subject(
    payload: SubjectCreate,
    user: User = Depends(require_class_admin),
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


@router.get("/me/periods", response_model=list[LessonPeriodOut])
def list_periods(user: User = Depends(require_class_member), db: Session = Depends(get_db)):
    return (
        db.query(LessonPeriod)
        .filter(LessonPeriod.school_class_id == user.school_class_id)
        .order_by(LessonPeriod.number.asc())
        .all()
    )


@router.post("/me/periods", response_model=LessonPeriodOut)
def create_period(
    payload: LessonPeriodCreate,
    user: User = Depends(require_class_admin),
    db: Session = Depends(get_db),
):
    """Festlegen, wie die Unterrichtsstunden dieser Klasse tatsächlich liegen (z.B. "1.
    Stunde: 08:00-08:45") - die Stundenplan-Fotoerkennung ordnet jede erkannte Stunde nur
    noch einer dieser Nummern zu, statt selbst eine Uhrzeit zu erraten."""
    period = LessonPeriod(**payload.model_dump(), school_class_id=user.school_class_id)
    db.add(period)
    db.commit()
    db.refresh(period)
    return period


@router.delete("/me/periods/{period_id}", status_code=204)
def delete_period(
    period_id: str,
    user: User = Depends(require_class_admin),
    db: Session = Depends(get_db),
):
    db.query(LessonPeriod).filter(
        LessonPeriod.id == period_id, LessonPeriod.school_class_id == user.school_class_id
    ).delete()
    db.commit()


@router.get("/me/members", response_model=list[MemberOut])
def list_members(user: User = Depends(require_class_member), db: Session = Depends(get_db)):
    return (
        db.query(User)
        .filter(User.school_class_id == user.school_class_id)
        .order_by(User.display_name.asc())
        .all()
    )


@router.put("/me/members/{user_id}/promote", response_model=MemberOut)
def promote_member(
    user_id: uuid.UUID,
    admin: User = Depends(require_class_admin),
    db: Session = Depends(get_db),
):
    """Mehrere Admins pro Klasse sind erlaubt - z.B. bei Krankheit/Urlaub."""
    member = db.get(User, user_id)
    if member is None or member.school_class_id != admin.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mitglied nicht gefunden")
    member.is_class_admin = True
    db.commit()
    db.refresh(member)
    return member


@router.put("/me/members/{user_id}/demote", response_model=MemberOut)
def demote_member(
    user_id: uuid.UUID,
    admin: User = Depends(require_class_admin),
    db: Session = Depends(get_db),
):
    member = db.get(User, user_id)
    if member is None or member.school_class_id != admin.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Mitglied nicht gefunden")
    other_admins = (
        db.query(User)
        .filter(User.school_class_id == admin.school_class_id, User.is_class_admin.is_(True), User.id != member.id)
        .count()
    )
    if other_admins == 0:
        raise HTTPException(status.HTTP_409_CONFLICT, "Es muss mindestens ein Admin übrig bleiben")
    member.is_class_admin = False
    db.commit()
    db.refresh(member)
    return member


@router.get("/me/stats", response_model=list[SubjectStatOut])
def class_stats(user: User = Depends(require_class_admin), db: Session = Depends(get_db)):
    member_count = max(
        1, db.query(User).filter(User.school_class_id == user.school_class_id).count()
    )
    subjects = db.query(Subject).filter(Subject.school_class_id == user.school_class_id).all()
    homework_items = (
        db.query(Homework)
        .options(joinedload(Homework.completions))
        .filter(Homework.school_class_id == user.school_class_id)
        .all()
    )

    stats: list[SubjectStatOut] = []
    for subject in subjects:
        subject_items = [hw for hw in homework_items if hw.subject_id == subject.id]
        if not subject_items:
            stats.append(
                SubjectStatOut(
                    subject_id=subject.id,
                    subject_name=subject.name,
                    subject_color=subject.color,
                    homework_count=0,
                    avg_completion_rate=0.0,
                )
            )
            continue
        rates = [len(hw.completions) / member_count for hw in subject_items]
        stats.append(
            SubjectStatOut(
                subject_id=subject.id,
                subject_name=subject.name,
                subject_color=subject.color,
                homework_count=len(subject_items),
                avg_completion_rate=min(1.0, sum(rates) / len(rates)),
            )
        )
    return stats
