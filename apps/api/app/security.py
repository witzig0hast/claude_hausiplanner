import base64
import hashlib
import uuid
from datetime import datetime, timedelta, timezone

import jwt
from cryptography.exceptions import InvalidSignature
from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from cryptography.hazmat.primitives.serialization import load_pem_public_key
from passlib.context import CryptContext

from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _fernet() -> Fernet:
    # Fernet needs a 32-byte urlsafe-base64 key - derive one from the configured secret so
    # settings.secret_encryption_key can stay a plain string like every other secret here.
    key = hashlib.sha256(settings.secret_encryption_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt_secret(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("ascii")


def decrypt_secret(ciphertext: str) -> str | None:
    try:
        return _fernet().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        return None


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(user_id: uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> uuid.UUID | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def create_superadmin_token(admin_id: uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.superadmin_token_expire_minutes)
    payload = {"sub": str(admin_id), "role": "superadmin", "exp": expire}
    return jwt.encode(payload, settings.superadmin_jwt_secret, algorithm=settings.jwt_algorithm)


def decode_superadmin_token(token: str) -> uuid.UUID | None:
    try:
        payload = jwt.decode(token, settings.superadmin_jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("role") != "superadmin":
            return None
        return uuid.UUID(payload["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def create_sso_state_token(next_path: str, link_user_id: str | None = None) -> str:
    """Self-contained CSRF/anti-replay state for the OIDC authorize request - avoids needing
    server-side session storage for a single redirect round-trip. link_user_id, when set, means
    this round-trip isn't a login - it's an already-logged-in user explicitly attaching their
    SSO identity to their existing (password) account from Settings."""
    payload = {
        "next": next_path,
        "typ": "sso_state",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=10),
    }
    if link_user_id:
        payload["link_user_id"] = link_user_id
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_sso_state_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("typ") != "sso_state":
            return None
        return payload
    except jwt.PyJWTError:
        return None


def create_sso_pending_token(subject: str, email: str, name: str) -> str:
    """Identifies a brand-new SSO login that still needs an invite code/class before an account
    can be created - handed to the web app, which collects that and posts it back to
    POST /auth/sso/complete."""
    payload = {
        "oidc_sub": subject,
        "email": email,
        "name": name,
        "typ": "sso_pending",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_sso_pending_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        if payload.get("typ") != "sso_pending":
            return None
        return payload
    except jwt.PyJWTError:
        return None


def verify_challenge_signature(public_key_pem: str, nonce_b64: str, signature_b64: str) -> bool:
    """Verifies an Ed25519 signature over a login nonce - the private key that
    produced it never leaves the user's machine."""
    try:
        public_key = load_pem_public_key(public_key_pem.encode("utf-8"))
        if not isinstance(public_key, Ed25519PublicKey):
            return False
        public_key.verify(base64.b64decode(signature_b64), base64.b64decode(nonce_b64))
        return True
    except (InvalidSignature, ValueError, TypeError):
        return False
