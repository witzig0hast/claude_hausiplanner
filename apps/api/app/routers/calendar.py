import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_class_admin, require_class_member
from app.models.calendar_event import CalendarEvent
from app.models.user import User
from app.schemas.calendar_event import CalendarEventCreate, CalendarEventOut

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("", response_model=list[CalendarEventOut])
def list_events(user: User = Depends(require_class_member), db: Session = Depends(get_db)):
    return (
        db.query(CalendarEvent)
        .filter(CalendarEvent.school_class_id == user.school_class_id)
        .order_by(CalendarEvent.starts_at.asc())
        .all()
    )


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
