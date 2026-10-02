"""Deadline-reminder emails via a single, globally configured SMTP server (.env only -
never per-class). Mirrors the push service: never crashes the scheduler on failure."""

import smtplib
from email.mime.text import MIMEText

from app.config import settings


class EmailUnavailableError(Exception):
    """SMTP isn't configured, or sending failed."""


def is_configured() -> bool:
    return bool(settings.smtp_host and settings.smtp_from_email)


def send_email(to: str, subject: str, body: str) -> None:
    if not is_configured():
        raise EmailUnavailableError("SMTP ist nicht konfiguriert (HOMEWORK_SMTP_HOST/SMTP_FROM_EMAIL fehlen)")

    msg = MIMEText(body, "plain", "utf-8")
    msg["Subject"] = subject
    msg["From"] = settings.smtp_from_email
    msg["To"] = to

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_username and settings.smtp_password:
                server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        raise EmailUnavailableError(f"E-Mail-Versand fehlgeschlagen: {exc}") from exc
