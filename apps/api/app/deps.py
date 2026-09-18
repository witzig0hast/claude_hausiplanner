import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.super_admin import SuperAdmin
from app.models.user import User
from app.security import decode_access_token, decode_superadmin_token

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


def require_class_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_class_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Admin rights required")
    return user


def require_class_member(user: User = Depends(get_current_user)) -> User:
    if user.school_class_id is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Join a class first")
    return user


def require_superadmin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> SuperAdmin:
    """Separate identity, separate token secret, separate signing scheme from
    normal users - a compromised user account or its JWT secret grants no path here."""
    if credentials is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)  # 404, not 401 - don't reveal this exists
    admin_id = decode_superadmin_token(credentials.credentials)
    if admin_id is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    admin = db.get(SuperAdmin, admin_id)
    if admin is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND)
    return admin
