"""Hidden operator surface: not linked from any UI, excluded from the OpenAPI
schema (`include_in_schema=False`), and authenticated by an Ed25519 keypair
instead of the normal email+password/JWT flow. See scripts/create_superadmin.py
and scripts/superadmin_login.py for how a human actually uses this.

Failed/unknown auth returns 404 everywhere, never 401/403, so an unauthenticated
caller can't even tell this surface exists.
"""

import base64
import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.deps import require_superadmin
from app.models.homework import Homework
from app.models.school_class import SchoolClass
from app.models.super_admin import SuperAdmin, SuperAdminChallenge
from app.models.user import User
from app.schemas.sys_admin import (
    ChallengeOut,
    ClassSummaryOut,
    HomeworkSummaryOut,
    SuperAdminLoginRequest,
    SuperAdminTokenOut,
    SystemStatsOut,
    UserSummaryOut,
)
from app.security import create_superadmin_token, verify_challenge_signature

router = APIRouter(prefix="/__sys", tags=["sys"], include_in_schema=False)


@router.post("/challenge", response_model=ChallengeOut)
def create_challenge(db: Session = Depends(get_db)):
    nonce = secrets.token_bytes(32)
    challenge = SuperAdminChallenge(
        nonce_b64=base64.b64encode(nonce).decode("utf-8"),
        expires_at=datetime.utcnow() + timedelta(seconds=settings.superadmin_challenge_expire_seconds),
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)
    return ChallengeOut(challenge_id=challenge.id, nonce_b64=challenge.nonce_b64, expires_at=challenge.expires_at)


@router.post("/login", response_model=SuperAdminTokenOut)
def login(payload: SuperAdminLoginRequest, db: Session = Depends(get_db)):
    challenge = db.get(SuperAdminChallenge, payload.challenge_id)
    if challenge is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    # One-time use regardless of outcome - prevents replay/brute-force against the same nonce.
    db.delete(challenge)
    db.commit()

    if challenge.expires_at < datetime.utcnow():
        raise HTTPException(status.HTTP_404_NOT_FOUND)

    for admin in db.query(SuperAdmin).all():
        if verify_challenge_signature(admin.public_key_pem, challenge.nonce_b64, payload.signature_b64):
            token = create_superadmin_token(admin.id)
            return SuperAdminTokenOut(access_token=token, expires_in_minutes=settings.superadmin_token_expire_minutes)

    raise HTTPException(status.HTTP_404_NOT_FOUND)


@router.get("/stats", response_model=SystemStatsOut)
def stats(db: Session = Depends(get_db), _admin: SuperAdmin = Depends(require_superadmin)):
    homework_items = db.query(Homework).options(joinedload(Homework.completions)).all()
    open_count = sum(1 for hw in homework_items if len(hw.completions) == 0)
    return SystemStatsOut(
        class_count=db.query(SchoolClass).count(),
        user_count=db.query(User).count(),
        homework_count=len(homework_items),
        open_homework_count=open_count,
    )


@router.get("/classes", response_model=list[ClassSummaryOut])
def list_classes(db: Session = Depends(get_db), _admin: SuperAdmin = Depends(require_superadmin)):
    classes = db.query(SchoolClass).options(joinedload(SchoolClass.members), joinedload(SchoolClass.homework_items)).all()
    return [
        ClassSummaryOut(
            id=c.id,
            name=c.name,
            invite_code=c.invite_code,
            member_count=len(c.members),
            homework_count=len(c.homework_items),
            created_at=c.created_at,
        )
        for c in classes
    ]


@router.delete("/classes/{class_id}", status_code=204)
def delete_class(class_id: uuid.UUID, db: Session = Depends(get_db), _admin: SuperAdmin = Depends(require_superadmin)):
    school_class = db.get(SchoolClass, class_id)
    if school_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    db.delete(school_class)
    db.commit()


@router.get("/users", response_model=list[UserSummaryOut])
def list_users(db: Session = Depends(get_db), _admin: SuperAdmin = Depends(require_superadmin)):
    users = db.query(User).options(joinedload(User.school_class)).all()
    return [
        UserSummaryOut(
            id=u.id,
            email=u.email,
            display_name=u.display_name,
            is_class_admin=u.is_class_admin,
            school_class_id=u.school_class_id,
            school_class_name=u.school_class.name if u.school_class else None,
            created_at=u.created_at,
        )
        for u in users
    ]


@router.delete("/users/{user_id}", status_code=204)
def delete_user(user_id: uuid.UUID, db: Session = Depends(get_db), _admin: SuperAdmin = Depends(require_superadmin)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    db.delete(user)
    db.commit()


@router.get("/homework", response_model=list[HomeworkSummaryOut])
def list_homework(db: Session = Depends(get_db), _admin: SuperAdmin = Depends(require_superadmin)):
    items = (
        db.query(Homework)
        .options(joinedload(Homework.subject), joinedload(Homework.school_class), joinedload(Homework.completions))
        .order_by(Homework.due_at.desc())
        .all()
    )
    return [
        HomeworkSummaryOut(
            id=hw.id,
            title=hw.title,
            due_at=hw.due_at,
            school_class_id=hw.school_class_id,
            school_class_name=hw.school_class.name,
            subject_name=hw.subject.name,
            completed_count=len(hw.completions),
        )
        for hw in items
    ]


@router.delete("/homework/{homework_id}", status_code=204)
def delete_homework(
    homework_id: uuid.UUID, db: Session = Depends(get_db), _admin: SuperAdmin = Depends(require_superadmin)
):
    hw = db.get(Homework, homework_id)
    if hw is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    db.delete(hw)
    db.commit()
