import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_class_admin, require_class_member
from app.models.calendar_event import CalendarEvent
from app.models.homework import Homework, HomeworkCompletion
from app.models.homework_attachment import HomeworkAttachment
from app.models.school_class import SchoolClass
from app.models.subject import Subject
from app.models.user import User
from app.schemas.homework import HomeworkCreate, HomeworkOut
from app.schemas.vision import HomeworkSuggestion
from app.services.attachment_storage import (
    AttachmentTooLargeError,
    AttachmentTypeNotAllowedError,
    delete_attachment,
    read_attachment,
    save_attachment,
)
from app.services.scheduling import next_occurrence
from app.services.vision_agent import VisionUnavailableError, extract_homework_from_image

router = APIRouter(tags=["homework"])

MAX_IMAGE_BYTES = 8 * 1024 * 1024

_ATTACHMENT_OPTIONS = (joinedload(Homework.subject), joinedload(Homework.completions), joinedload(Homework.attachments))


def _serialize(hw: Homework, viewer_id: uuid.UUID | None) -> HomeworkOut:
    out = HomeworkOut.model_validate(hw)
    out.completed_count = len(hw.completions)
    out.completed_by_me = viewer_id is not None and any(c.user_id == viewer_id for c in hw.completions)
    return out


@router.get("/public/classes/{class_id}/homework", response_model=list[HomeworkOut])
def public_homework(class_id: uuid.UUID, db: Session = Depends(get_db)):
    """No login required - anyone with the class link can see what's due."""
    school_class = db.get(SchoolClass, class_id)
    if school_class is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Class not found")
    items = (
        db.query(Homework)
        .options(*_ATTACHMENT_OPTIONS)
        .filter(Homework.school_class_id == class_id)
        .order_by(Homework.due_at.asc())
        .all()
    )
    return [_serialize(hw, viewer_id=None) for hw in items]


@router.get("/homework", response_model=list[HomeworkOut])
def list_homework(
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    items = (
        db.query(Homework)
        .options(*_ATTACHMENT_OPTIONS)
        .filter(Homework.school_class_id == user.school_class_id)
        .order_by(Homework.due_at.asc())
        .all()
    )
    return [_serialize(hw, viewer_id=user.id) for hw in items]


@router.post("/homework/extract-from-image", response_model=HomeworkSuggestion)
async def extract_from_image(
    file: UploadFile = File(...),
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    """Foto der Tafel/des Aufgabenblatts -> Vorschlag für Fach/Titel/Deadline.
    Erstellt NICHTS automatisch - der Nutzer bestätigt/bearbeitet den Vorschlag im Add-Formular."""
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/heic"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Nur Bilddateien werden unterstützt")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Bild zu groß (max. 8MB)")

    subject_names = [
        s.name for s in db.query(Subject).filter(Subject.school_class_id == user.school_class_id).all()
    ]
    try:
        suggestion = await extract_homework_from_image(image_bytes, subject_names)
    except VisionUnavailableError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    return HomeworkSuggestion(**suggestion)


@router.post("/homework", response_model=HomeworkOut)
def create_homework(
    payload: HomeworkCreate,
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    data = payload.model_dump()
    repeat_weeks = data.pop("repeat_weeks", None) or 0
    if data.get("priority") not in (None, "niedrig", "normal", "hoch"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "priority must be 'niedrig', 'normal' or 'hoch'")

    hw = Homework(**data, school_class_id=user.school_class_id, created_by_id=user.id)
    db.add(hw)

    # Recurring homework (e.g. weekly vocab) - simple weekly-spaced copies, no
    # separate "template" concept to keep this a one-shot creation.
    for week in range(1, repeat_weeks + 1):
        db.add(
            Homework(
                **{**data, "due_at": data["due_at"] + timedelta(weeks=week)},
                school_class_id=user.school_class_id,
                created_by_id=user.id,
            )
        )

    db.commit()
    db.refresh(hw)
    return _serialize(hw, viewer_id=user.id)


@router.get("/homework/export.ics")
def export_ics(user: User = Depends(require_class_member), db: Session = Depends(get_db)):
    """Offene Hausaufgaben als .ics - importierbar in Apple/Google/Outlook Kalender."""
    items = (
        db.query(Homework)
        .options(*_ATTACHMENT_OPTIONS)
        .filter(Homework.school_class_id == user.school_class_id)
        .order_by(Homework.due_at.asc())
        .all()
    )
    open_items = [hw for hw in items if not any(c.user_id == user.id for c in hw.completions)]

    def fmt(dt):
        return dt.strftime("%Y%m%dT%H%M%SZ")

    lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hausaufgabenplaner//DE"]
    for hw in open_items:
        lines += [
            "BEGIN:VEVENT",
            f"UID:{hw.id}@hausiplanner",
            f"DTSTAMP:{fmt(hw.created_at)}",
            f"DTSTART:{fmt(hw.due_at)}",
            f"SUMMARY:{hw.subject.name}: {hw.title}",
            f"DESCRIPTION:{(hw.description or '').replace(chr(10), ' ')}",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    ics_content = "\r\n".join(lines)
    return Response(
        content=ics_content,
        media_type="text/calendar",
        headers={"Content-Disposition": "attachment; filename=hausaufgaben.ics"},
    )


@router.delete("/homework/{homework_id}", status_code=204)
def delete_homework(
    homework_id: uuid.UUID,
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    hw = db.get(Homework, homework_id)
    if hw is None or hw.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Homework not found")
    if hw.created_by_id != user.id and not user.is_class_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the creator or an admin can delete this")
    attachment_ids = [a.id for a in hw.attachments]
    db.delete(hw)
    db.commit()
    for attachment_id in attachment_ids:
        delete_attachment(attachment_id)


@router.post("/homework/{homework_id}/postpone-to-next-lesson", response_model=HomeworkOut)
def postpone_to_next_lesson(
    homework_id: uuid.UUID,
    user: User = Depends(require_class_admin),
    db: Session = Depends(get_db),
):
    """Fällt die Stunde aus? Admin kann die Deadline auf die nächste Stunde dieses
    Fachs laut Stundenplan verschieben, statt sie manuell neu zu berechnen."""
    hw = db.get(Homework, homework_id)
    if hw is None or hw.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Homework not found")

    lessons = (
        db.query(CalendarEvent)
        .filter(
            CalendarEvent.school_class_id == user.school_class_id,
            CalendarEvent.subject_id == hw.subject_id,
            CalendarEvent.is_recurring_weekly.is_(True),
            CalendarEvent.weekday.isnot(None),
        )
        .all()
    )
    if not lessons:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Kein wiederkehrender Stundenplan-Eintrag für dieses Fach hinterlegt",
        )

    candidates = [next_occurrence(hw.due_at, lesson.weekday, lesson.starts_at.time()) for lesson in lessons]
    hw.due_at = min(candidates)
    db.commit()
    db.refresh(hw)
    return _serialize(hw, viewer_id=user.id)


@router.post("/homework/{homework_id}/complete", response_model=HomeworkOut)
def complete_homework(
    homework_id: uuid.UUID,
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    """Marks the task done for the current user only - never affects classmates."""
    hw = db.get(Homework, homework_id)
    if hw is None or hw.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Homework not found")

    exists = (
        db.query(HomeworkCompletion)
        .filter(HomeworkCompletion.homework_id == homework_id, HomeworkCompletion.user_id == user.id)
        .first()
    )
    if not exists:
        db.add(HomeworkCompletion(homework_id=homework_id, user_id=user.id))
        db.commit()
    db.refresh(hw)
    return _serialize(hw, viewer_id=user.id)


@router.delete("/homework/{homework_id}/complete", response_model=HomeworkOut)
def uncomplete_homework(
    homework_id: uuid.UUID,
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    hw = db.get(Homework, homework_id)
    if hw is None or hw.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Homework not found")

    db.query(HomeworkCompletion).filter(
        HomeworkCompletion.homework_id == homework_id, HomeworkCompletion.user_id == user.id
    ).delete()
    db.commit()
    db.refresh(hw)
    return _serialize(hw, viewer_id=user.id)


@router.post("/homework/{homework_id}/attachments", response_model=HomeworkOut)
async def upload_attachment(
    homework_id: uuid.UUID,
    file: UploadFile = File(...),
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    """Material (PDF, Foto, Office-Dokument, ...) zu einer Hausaufgabe hochladen - sichtbar für
    die ganze Klasse, nicht nur den Hochladenden."""
    hw = db.get(Homework, homework_id)
    if hw is None or hw.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Homework not found")

    data = await file.read()
    attachment = HomeworkAttachment(
        homework_id=hw.id,
        uploaded_by_id=user.id,
        filename=file.filename or "Datei",
        content_type=file.content_type or "application/octet-stream",
        size_bytes=len(data),
    )
    db.add(attachment)
    db.flush()  # assigns attachment.id without committing yet

    try:
        save_attachment(attachment.id, attachment.content_type, data)
    except AttachmentTypeNotAllowedError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, str(exc)) from exc
    except AttachmentTooLargeError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, str(exc)) from exc

    db.commit()
    db.refresh(hw)
    return _serialize(hw, viewer_id=user.id)


@router.get("/homework/{homework_id}/attachments/{attachment_id}/download")
def download_attachment(
    homework_id: uuid.UUID,
    attachment_id: uuid.UUID,
    db: Session = Depends(get_db),
):
    """Kein Login nötig - Materialien sind so sichtbar wie die Hausaufgabe selbst (auch über den
    öffentlichen Klassen-Link), nicht strenger geschützt als /public/classes/{id}/homework."""
    attachment = db.get(HomeworkAttachment, attachment_id)
    if attachment is None or attachment.homework_id != homework_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment not found")
    data = read_attachment(attachment.id)
    if data is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Datei nicht mehr auf dem Server vorhanden")
    return StreamingResponse(
        iter([data]),
        media_type=attachment.content_type,
        headers={"Content-Disposition": f'attachment; filename="{attachment.filename}"'},
    )


@router.delete("/homework/{homework_id}/attachments/{attachment_id}", status_code=204)
def delete_homework_attachment(
    homework_id: uuid.UUID,
    attachment_id: uuid.UUID,
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    attachment = db.get(HomeworkAttachment, attachment_id)
    if attachment is None or attachment.homework_id != homework_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment not found")
    hw = db.get(Homework, homework_id)
    if hw is None or hw.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Homework not found")
    if attachment.uploaded_by_id != user.id and not user.is_class_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only the uploader or an admin can delete this")
    db.delete(attachment)
    db.commit()
    delete_attachment(attachment_id)
