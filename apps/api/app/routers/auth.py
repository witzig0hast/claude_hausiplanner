from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.school_class import SchoolClass
from app.models.subject import Subject
from app.models.user import User
from app.schemas.auth import (
    JoinClassRequest,
    LoginRequest,
    RegisterRequest,
    SetAgentToneRequest,
    SetEmailRemindersRequest,
    TokenResponse,
    UserOut,
)
from app.security import create_access_token, hash_password, verify_password
from app.services.defaults import DEFAULT_SUBJECTS

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    school_class = None
    is_admin = False
    if payload.invite_code:
        school_class = db.query(SchoolClass).filter(SchoolClass.invite_code == payload.invite_code).first()
        if school_class is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid invite code")
    else:
        # First user with no invite code creates their own class and becomes its admin.
        class_name = (payload.class_name or "").strip() or f"{payload.display_name}'s Klasse"
        school_class = SchoolClass(name=class_name)
        db.add(school_class)
        db.flush()
        is_admin = True
        for name, color, icon in DEFAULT_SUBJECTS:
            db.add(Subject(name=name, color=color, icon=icon, school_class_id=school_class.id))

    user = User(
        email=payload.email,
        display_name=payload.display_name,
        password_hash=hash_password(payload.password),
        school_class_id=school_class.id,
        is_class_admin=is_admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/join-class", response_model=UserOut)
def join_class(
    payload: JoinClassRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    school_class = db.query(SchoolClass).filter(SchoolClass.invite_code == payload.invite_code).first()
    if school_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid invite code")
    user.school_class_id = school_class.id
    db.commit()
    db.refresh(user)
    return user


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.put("/me/tone", response_model=UserOut)
def set_agent_tone(
    payload: SetAgentToneRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.tone not in ("locker", "streng"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "tone must be 'locker' or 'streng'")
    user.agent_tone = payload.tone
    db.commit()
    db.refresh(user)
    return user


@router.put("/me/email-reminders", response_model=UserOut)
def set_email_reminders(
    payload: SetEmailRemindersRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    user.email_reminders_enabled = payload.enabled
    db.commit()
    db.refresh(user)
    return user
