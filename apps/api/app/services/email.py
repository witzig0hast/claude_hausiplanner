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
        # Port 465 is implicit TLS (SMTPS) - the server expects a TLS handshake from the very
        # first byte. Opening a plain SMTP() connection and calling starttls() on it (fine for
        # 587) makes a 465 server either hang until our timeout or drop the connection the
        # moment it receives a plaintext EHLO instead of a TLS ClientHello - exactly the
        # "unexpected connection closed"/timeout symptom. SMTP_SSL establishes TLS immediately
        # instead, matching what a working client (e.g. nodemailer's secure:true) does for 465.
        if settings.smtp_port == 465:
            with smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10) as server:
                if settings.smtp_username and settings.smtp_password:
                    server.login(settings.smtp_username, settings.smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
                if settings.smtp_use_tls:
                    server.starttls()
                if settings.smtp_username and settings.smtp_password:
                    server.login(settings.smtp_username, settings.smtp_password)
                server.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        raise EmailUnavailableError(f"E-Mail-Versand fehlgeschlagen: {exc}") from exc
