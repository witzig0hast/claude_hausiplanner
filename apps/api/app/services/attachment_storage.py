"""Disk storage for homework material uploads. Files are never named after user input - only by
the attachment's own id - so a crafted filename can't escape settings.uploads_dir or collide with
another file; the original name is kept purely as a DB column for display/download."""

import os
import uuid

from app.config import settings

# "PDFs und so" - common material types a class actually shares: documents, slides, images, and
# plain text/markdown notes. Deliberately not open to arbitrary types (no executables, archives).
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/heic",
    "text/plain",
}


class AttachmentTooLargeError(Exception):
    pass


class AttachmentTypeNotAllowedError(Exception):
    pass


def _path_for(attachment_id: uuid.UUID) -> str:
    return os.path.join(settings.uploads_dir, str(attachment_id))


def save_attachment(attachment_id: uuid.UUID, content_type: str, data: bytes) -> None:
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise AttachmentTypeNotAllowedError(f"Dateityp nicht erlaubt: {content_type}")
    if len(data) > settings.max_attachment_bytes:
        raise AttachmentTooLargeError(
            f"Datei zu groß (max. {settings.max_attachment_bytes // (1024 * 1024)}MB)"
        )
    os.makedirs(settings.uploads_dir, exist_ok=True)
    with open(_path_for(attachment_id), "wb") as f:
        f.write(data)


def read_attachment(attachment_id: uuid.UUID) -> bytes | None:
    try:
        with open(_path_for(attachment_id), "rb") as f:
            return f.read()
    except FileNotFoundError:
        return None


def delete_attachment(attachment_id: uuid.UUID) -> None:
    try:
        os.remove(_path_for(attachment_id))
    except FileNotFoundError:
        pass
