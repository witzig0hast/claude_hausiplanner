import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_class_admin, require_class_member
from app.models.calendar_event import CalendarEvent
from app.models.lesson_period import LessonPeriod
from app.models.subject import Subject
from app.models.user import User
from app.schemas.calendar_event import CalendarEventCreate, CalendarEventOut
from app.schemas.vision import TimetableSuggestion
from app.services.vision_agent import VisionUnavailableError, extract_timetable_from_image

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


_VALID_WEEKDAYS = {"Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"}


@router.post("/extract-from-image", response_model=TimetableSuggestion)
async def extract_timetable(
    file: UploadFile = File(...),
    weekday: str | None = Form(None),
    user: User = Depends(require_class_admin),
    db: Session = Depends(get_db),
):
    """Einmaliges Einscannen des Stundenplans -> Vorschläge, die der Admin vor dem
    Speichern noch prüft/korrigiert (kein automatischer WebUntis-Sync möglich).

    weekday, wenn gesetzt, sagt dem Modell, dass das Foto nur einen einzelnen Wochentag
    zeigt - das Zuordnen von Wochentag UND Stunde gleichzeitig über eine ganze Wochentabelle
    hinweg ist für lokale Vision-Modelle fehleranfällig, ein einzelner Tag von oben nach
    unten zu lesen deutlich weniger."""
    if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/heic"):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Nur Bilddateien werden unterstützt")
    if weekday is not None and weekday not in _VALID_WEEKDAYS:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Ungültiger Wochentag")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Bild zu groß (max. 8MB)")

    subject_names = [
        s.name for s in db.query(Subject).filter(Subject.school_class_id == user.school_class_id).all()
    ]
    periods = [
        {"number": p.number, "start_time": p.start_time, "end_time": p.end_time}
        for p in db.query(LessonPeriod).filter(LessonPeriod.school_class_id == user.school_class_id).all()
    ]
    try:
        suggestion = await extract_timetable_from_image(image_bytes, subject_names, periods, weekday)
    except VisionUnavailableError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
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
