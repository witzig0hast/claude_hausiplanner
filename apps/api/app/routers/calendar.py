import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_class_admin, require_class_member
from app.models.calendar_event import CalendarEvent
from app.models.user import User
from app.schemas.calendar_event import CalendarEventCreate, CalendarEventOut
from app.schemas.vision import TimetableSuggestion
from app.services.vision_agent import extract_timetable_from_image

router = APIRouter(prefix="/calendar", tags=["calendar"])

MAX_IMAGE_BYTES = 8 * 1024 * 1024


@router.get("", response_model=list[CalendarEventOut])
def list_events(user: User = Depends(require_class_member), db: Session = Depends(get_db)):
    return (
        db.query(CalendarEvent)
        .filter(CalendarEvent.school_class_id == user.school_class_id)
        .order_by(CalendarEvent.starts_at.asc())
        .all()
    )


@router.post("/extract-from-image", response_model=TimetableSuggestion)
async def extract_timetable(
    file: UploadFile = File(...),
    user: User = Depends(require_class_admin),
):
    """Einmaliges Einscannen des Stundenplans -> Vorschläge, die der Admin vor dem
    Speichern noch prüft/korrigiert (kein automatischer WebUntis-Sync möglich)."""
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/heic"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Nur Bilddateien werden unterstützt")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Bild zu groß (max. 8MB)")

    suggestion = await extract_timetable_from_image(image_bytes)
    return TimetableSuggestion(**suggestion)


@router.post("", response_model=CalendarEventOut)
def create_event(
    payload: CalendarEventCreate,
    user: User = Depends(require_class_admin),
    db: Session = Depends(get_db),
):
    """Only the class admin maintains the timetable/calendar (WebUntis API is locked, so this
    replaces an automatic sync)."""
    event = CalendarEvent(
        **payload.model_dump(),
        school_class_id=user.school_class_id,
        created_by_id=user.id,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.put("/{event_id}", response_model=CalendarEventOut)
def update_event(
    event_id: uuid.UUID,
    payload: CalendarEventCreate,
    user: User = Depends(require_class_admin),
    db: Session = Depends(get_db),
):
    event = db.get(CalendarEvent, event_id)
    if event is None or event.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    for field, value in payload.model_dump().items():
        setattr(event, field, value)
    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=204)
def delete_event(
    event_id: uuid.UUID,
    user: User = Depends(require_class_admin),
    db: Session = Depends(get_db),
):
    event = db.get(CalendarEvent, event_id)
    if event is None or event.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    db.delete(event)
    db.commit()
