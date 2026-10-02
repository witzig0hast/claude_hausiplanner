from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_class_member
from app.models.homework import Homework
from app.models.subject import Subject
from app.models.user import User
from app.models.voice_suggestion import PendingHomeworkSuggestion
from app.schemas.homework import HomeworkOut
from app.schemas.voice import ApplySuggestionRequest, PendingSuggestionOut
from app.services.ollama_agent import AgentUnavailableError, extract_homework_from_voice
from app.services.speech_agent import SpeechUnavailableError, transcribe_audio

router = APIRouter(prefix="/voice", tags=["voice"])

MAX_AUDIO_BYTES = 15 * 1024 * 1024


def _serialize_homework(hw: Homework, viewer_id) -> HomeworkOut:
    out = HomeworkOut.model_validate(hw)
    out.completed_count = len(hw.completions)
    out.completed_by_me = any(c.user_id == viewer_id for c in hw.completions)
    return out


@router.post("/capture", response_model=PendingSuggestionOut)
async def capture_voice_note(
    file: UploadFile = File(...),
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    """Audio einsprechen -> Transkript -> Hausaufgaben-Vorschlag. Erstellt NICHTS
    automatisch - der Vorschlag wird pro Nutzer zwischengespeichert, bis er bestätigt
    oder verworfen wird (überlebt auch ein geschlossenes Browser-Tab)."""
    audio_bytes = await file.read()
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Aufnahme zu groß (max. 15MB)")

    try:
        transcript = await transcribe_audio(audio_bytes)
    except SpeechUnavailableError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    if not transcript:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Konnte nichts aus der Aufnahme verstehen")

    subjects = db.query(Subject).filter(Subject.school_class_id == user.school_class_id).all()
    try:
        suggestion = await extract_homework_from_voice(transcript, [s.name for s in subjects])
    except AgentUnavailableError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc

    subject_guess = suggestion.get("subject_guess")
    matched_subject = None
    if subject_guess:
        matched_subject = next((s for s in subjects if s.name.lower() == subject_guess.lower()), None)

    existing = db.query(PendingHomeworkSuggestion).filter(PendingHomeworkSuggestion.user_id == user.id).first()
    if existing:
        db.delete(existing)
        db.flush()

    row = PendingHomeworkSuggestion(
        user_id=user.id,
        raw_transcript=transcript,
        subject_guess=subject_guess,
        subject_id=matched_subject.id if matched_subject else None,
        title=suggestion.get("title") or transcript[:200],
        description=suggestion.get("description"),
        due_date_guess=suggestion.get("due_date_guess"),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/pending-suggestion", response_model=PendingSuggestionOut)
def get_pending_suggestion(user: User = Depends(require_class_member), db: Session = Depends(get_db)):
    row = (
        db.query(PendingHomeworkSuggestion)
        .options(joinedload(PendingHomeworkSuggestion.subject))
        .filter(PendingHomeworkSuggestion.user_id == user.id)
        .first()
    )
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kein offener Vorschlag")
    return row


@router.post("/pending-suggestion/apply", response_model=HomeworkOut)
def apply_pending_suggestion(
    payload: ApplySuggestionRequest,
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    row = db.query(PendingHomeworkSuggestion).filter(PendingHomeworkSuggestion.user_id == user.id).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Kein offener Vorschlag")

    subject = db.get(Subject, payload.subject_id)
    if subject is None or subject.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Fach nicht gefunden")

    hw = Homework(
        title=payload.title,
        description=payload.description,
        due_at=payload.due_at,
        subject_id=payload.subject_id,
        estimated_minutes=payload.estimated_minutes,
        school_class_id=user.school_class_id,
        created_by_id=user.id,
    )
    db.add(hw)
    db.delete(row)
    db.commit()
    db.refresh(hw)
    return _serialize_homework(hw, user.id)


@router.delete("/pending-suggestion", status_code=204)
def dismiss_pending_suggestion(user: User = Depends(require_class_member), db: Session = Depends(get_db)):
    db.query(PendingHomeworkSuggestion).filter(PendingHomeworkSuggestion.user_id == user.id).delete()
    db.commit()
