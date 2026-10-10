import secrets
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
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
    SetNotificationPrefsRequest,
    SetPrioritiesEnabledRequest,
    SsoCompleteRequest,
    SsoStatusOut,
    TokenResponse,
    UserOut,
)
from app.security import (
    create_access_token,
    create_sso_pending_token,
    create_sso_state_token,
    decode_sso_pending_token,
    decode_sso_state_token,
    hash_password,
    verify_password,
)
from app.services import oidc
from app.services.defaults import DEFAULT_SUBJECTS
from app.services.email import EmailUnavailableError, is_configured as email_is_configured, send_email

router = APIRouter(prefix="/auth", tags=["auth"])


def _redirect_uri(request: Request) -> str:
    return settings.oidc_redirect_uri or str(request.base_url).rstrip("/") + "/auth/sso/callback"


def _create_or_link_class_for_new_user(
    db: Session, *, display_name: str, invite_code: str | None, class_name: str | None
) -> tuple["SchoolClass", bool]:
    """Shared by /auth/register and /auth/sso/complete: with an invite code, join that class; without one, create a new class and become its admin."""
    if invite_code:
        school_class = db.query(SchoolClass).filter(SchoolClass.invite_code == invite_code).first()
        if school_class is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Invalid invite code")
        return school_class, False

    school_class = SchoolClass(name=(class_name or "").strip() or f"{display_name}'s Klasse")
    db.add(school_class)
    db.flush()
    for name, color, icon in DEFAULT_SUBJECTS:
        db.add(Subject(name=name, color=color, icon=icon, school_class_id=school_class.id))
    return school_class, True


@router.post("/register", response_model=TokenResponse)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Email already registered")

    school_class, is_admin = _create_or_link_class_for_new_user(
        db, display_name=payload.display_name, invite_code=payload.invite_code, class_name=payload.class_name
    )

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


@router.put("/me/notifications", response_model=UserOut)
def set_notification_prefs(
    payload: SetNotificationPrefsRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    user.digest_enabled = payload.digest_enabled
    user.deadline_push_enabled = payload.deadline_push_enabled
    db.commit()
    db.refresh(user)
    return user


@router.put("/me/priorities", response_model=UserOut)
def set_priorities_enabled(
    payload: SetPrioritiesEnabledRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    user.priorities_enabled = payload.enabled
    db.commit()
    db.refresh(user)
    return user


@router.post("/me/test-email", status_code=status.HTTP_204_NO_CONTENT)
def send_test_email(user: User = Depends(get_current_user)):
    if not email_is_configured():
        # Names exactly which .env variable the container is missing, rather than a generic
        # "not configured" - a value that's actually set in .env but never reached the running
        # container (not rebuilt/recreated after editing .env, typo'd variable name, wrong file
        # looked at) looks identical to "never configured" from here, so be specific.
        missing = []
        if not settings.smtp_host:
            missing.append("SMTP_HOST")
        if not settings.smtp_from_email:
            missing.append("SMTP_FROM_EMAIL")
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "SMTP ist auf dem Server nicht konfiguriert - es fehlt: " + ", ".join(missing) + ". "
            "Falls das in der .env bereits gesetzt ist: Container mit 'docker compose up -d' neu "
            "erstellen (ein reiner Neustart liest keine geänderte .env ein).",
        )
    try:
        send_email(
            user.email,
            "Test-E-Mail vom Hausaufgabenplaner",
            f"Hi {user.display_name},\n\ndiese Test-E-Mail bestätigt, dass E-Mail-Erinnerungen bei dir ankommen.\n\nDein Hausaufgabenplaner",
        )
    except EmailUnavailableError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc


@router.get("/sso/status", response_model=SsoStatusOut)
def sso_status():
    """Public (no login) - lets the web login page decide whether to show an SSO button at all."""
    return SsoStatusOut(enabled=oidc.is_configured())


@router.get("/sso/login")
async def sso_login(request: Request, next: str = "/dashboard"):
    if not oidc.is_configured():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "SSO ist auf diesem Server nicht konfiguriert")
    state = create_sso_state_token(next)
    try:
        url = await oidc.build_authorize_url(_redirect_uri(request), state)
    except oidc.OidcError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, str(exc)) from exc
    return RedirectResponse(url)


@router.get("/sso/callback")
async def sso_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    """Always redirects back into the web app - this is a top-level browser navigation from the
    provider, not an API call the frontend can read a JSON error from."""

    def fail(reason: str) -> RedirectResponse:
        return RedirectResponse(f"{settings.web_base_url}/login?sso_error={quote(reason)}")

    if error:
        return fail(error)
    if not code or not state:
        return fail("missing_code")
    next_path = decode_sso_state_token(state)
    if next_path is None:
        return fail("invalid_state")

    try:
        tokens = await oidc.exchange_code(code, _redirect_uri(request))
        userinfo = await oidc.fetch_userinfo(tokens["access_token"])
    except oidc.OidcError as exc:
        return fail(str(exc))

    sub = userinfo.get("sub")
    email = userinfo.get("email")
    name = userinfo.get("name") or userinfo.get("preferred_username") or email
    if not sub or not email:
        return fail("incomplete_profile")

    user = db.query(User).filter(User.sso_subject == sub).first()
    if user is None:
        # First SSO login for this provider account - if the email matches an existing
        # password-based account, link them instead of creating a duplicate.
        user = db.query(User).filter(User.email == email).first()
        if user is not None:
            user.sso_subject = sub
            db.commit()

    if user is not None:
        token = create_access_token(user.id)
        return RedirectResponse(f"{settings.web_base_url}/sso/callback#token={token}&next={quote(next_path)}")

    # Genuinely new person - needs to join/create a class before an account can exist, same as
    # the password registration form asks for. Hand that off to the web app.
    pending = create_sso_pending_token(sub, email, name or email)
    return RedirectResponse(f"{settings.web_base_url}/sso/complete-signup?pending={quote(pending)}")


@router.post("/sso/complete", response_model=TokenResponse)
def sso_complete(payload: SsoCompleteRequest, db: Session = Depends(get_db)):
    claims = decode_sso_pending_token(payload.pending_token)
    if claims is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Dieser Registrierungslink ist abgelaufen oder ungültig - bitte erneut über SSO anmelden.",
        )
    email = claims["email"]
    sub = claims["oidc_sub"]

    existing = db.query(User).filter(User.email == email).first()
    if existing is not None:
        # Someone else already created this account (password registration, or another SSO
        # round-trip) while this link was open - link it and log in rather than erroring.
        existing.sso_subject = sub
        db.commit()
        db.refresh(existing)
        token = create_access_token(existing.id)
        return TokenResponse(access_token=token, user=UserOut.model_validate(existing))

    school_class, is_admin = _create_or_link_class_for_new_user(
        db, display_name=payload.display_name, invite_code=payload.invite_code, class_name=payload.class_name
    )

    user = User(
        email=email,
        display_name=payload.display_name,
        # Unusable random password - this account only ever logs in via SSO. Simpler than making
        # password_hash nullable for the one login method that doesn't need it.
        password_hash=hash_password(secrets.token_urlsafe(32)),
        sso_subject=sub,
        school_class_id=school_class.id,
        is_class_admin=is_admin,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))
