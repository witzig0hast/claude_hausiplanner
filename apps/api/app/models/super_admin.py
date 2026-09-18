import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SuperAdmin(Base):
    """Deliberately NOT a `User` row: never appears in any class, membership list,
    or `UserOut` response. Authenticates via an Ed25519 keypair (challenge/response)
    instead of email+password - the private key never touches the server."""

    __tablename__ = "super_admins"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    label: Mapped[str] = mapped_column(String(120))  # for your own bookkeeping only
    public_key_pem: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class SuperAdminChallenge(Base):
    """Short-lived login nonce. Deleted once used or expired."""

    __tablename__ = "super_admin_challenges"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    nonce_b64: Mapped[str] = mapped_column(String(64))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
