import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_class_member
from app.models.flashcard import Flashcard, FlashcardDeck, FlashcardProgress
from app.models.user import User
from app.schemas.flashcard import CreateCardRequest, DeckDetailOut, DeckSummaryOut, FlashcardOut, ReviewRequest
from app.services.ollama_agent import AgentUnavailableError, generate_flashcards
from app.services.spaced_repetition import apply_review
from app.services.vision_agent import VisionUnavailableError, extract_flashcards_from_image

router = APIRouter(prefix="/flashcards", tags=["flashcards"])

MAX_IMAGE_BYTES = 8 * 1024 * 1024


def _progress_map(db: Session, card_ids: list[uuid.UUID], user_id: uuid.UUID) -> dict:
    if not card_ids:
        return {}
    rows = (
        db.query(FlashcardProgress)
        .filter(FlashcardProgress.flashcard_id.in_(card_ids), FlashcardProgress.user_id == user_id)
        .all()
    )
    return {row.flashcard_id: row for row in rows}


def _serialize_card(card: Flashcard, progress: FlashcardProgress | None) -> FlashcardOut:
    box = progress.box if progress else 1
    next_review_at = progress.next_review_at if progress else datetime.utcnow()
    return FlashcardOut(
        id=card.id,
        question=card.question,
        answer=card.answer,
        box=box,
        next_review_at=next_review_at,
        due=next_review_at <= datetime.utcnow(),
    )


def _deck_summary(db: Session, deck: FlashcardDeck, user_id: uuid.UUID) -> DeckSummaryOut:
    progress = _progress_map(db, [c.id for c in deck.cards], user_id)
    cards_out = [_serialize_card(c, progress.get(c.id)) for c in deck.cards]
    return DeckSummaryOut(
        id=deck.id,
        title=deck.title,
        created_at=deck.created_at,
        card_count=len(cards_out),
        due_count=sum(1 for c in cards_out if c.due),
    )


async def _generate_cards(text: str | None, file: UploadFile | None) -> list[dict]:
    if file is not None:
        if file.content_type not in ("image/jpeg", "image/png", "image/webp", "image/heic"):
            raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Nur Bilddateien werden unterstützt")
        image_bytes = await file.read()
        if len(image_bytes) > MAX_IMAGE_BYTES:
            raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Bild zu groß (max. 8MB)")
        try:
            return await extract_flashcards_from_image(image_bytes)
        except VisionUnavailableError as exc:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    if text:
        try:
            return await generate_flashcards(text)
        except AgentUnavailableError as exc:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc)) from exc
    raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Entweder Text oder Foto angeben")


@router.get("/decks", response_model=list[DeckSummaryOut])
def list_decks(user: User = Depends(require_class_member), db: Session = Depends(get_db)):
    decks = (
        db.query(FlashcardDeck)
        .options(joinedload(FlashcardDeck.cards))
        .filter(FlashcardDeck.school_class_id == user.school_class_id)
        .order_by(FlashcardDeck.created_at.desc())
        .all()
    )
    return [_deck_summary(db, d, user.id) for d in decks]


@router.post("/decks", response_model=DeckDetailOut)
async def create_deck(
    title: str | None = Form(None),
    text: str | None = Form(None),
    file: UploadFile | None = File(None),
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    """Ein Aufruf: Deck anlegen UND aus Text ODER Foto Karten generieren."""
    generated = await _generate_cards(text, file)
    deck_title = title or (text[:60] if text else "Karteikarten vom Foto")

    deck = FlashcardDeck(
        title=deck_title,
        source_text=text,
        school_class_id=user.school_class_id,
        created_by_id=user.id,
    )
    db.add(deck)
    db.flush()
    for card in generated:
        db.add(Flashcard(deck_id=deck.id, question=card["question"], answer=card["answer"]))
    db.commit()
    db.refresh(deck)
    return DeckDetailOut(**_deck_summary(db, deck, user.id).model_dump(), cards=[
        _serialize_card(c, None) for c in deck.cards
    ])


@router.get("/decks/{deck_id}", response_model=DeckDetailOut)
def get_deck(deck_id: uuid.UUID, user: User = Depends(require_class_member), db: Session = Depends(get_db)):
    deck = db.get(FlashcardDeck, deck_id)
    if deck is None or deck.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Deck not found")
    progress = _progress_map(db, [c.id for c in deck.cards], user.id)
    cards = [_serialize_card(c, progress.get(c.id)) for c in deck.cards]
    summary = _deck_summary(db, deck, user.id)
    return DeckDetailOut(**summary.model_dump(), cards=cards)


@router.post("/decks/{deck_id}/cards/generate", response_model=DeckDetailOut)
async def add_generated_cards(
    deck_id: uuid.UUID,
    text: str | None = Form(None),
    file: UploadFile | None = File(None),
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    deck = db.get(FlashcardDeck, deck_id)
    if deck is None or deck.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Deck not found")
    generated = await _generate_cards(text, file)
    for card in generated:
        db.add(Flashcard(deck_id=deck.id, question=card["question"], answer=card["answer"]))
    db.commit()
    db.refresh(deck)
    progress = _progress_map(db, [c.id for c in deck.cards], user.id)
    cards = [_serialize_card(c, progress.get(c.id)) for c in deck.cards]
    summary = _deck_summary(db, deck, user.id)
    return DeckDetailOut(**summary.model_dump(), cards=cards)


@router.post("/decks/{deck_id}/cards", response_model=FlashcardOut)
def add_card_manually(
    deck_id: uuid.UUID,
    payload: CreateCardRequest,
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    deck = db.get(FlashcardDeck, deck_id)
    if deck is None or deck.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Deck not found")
    card = Flashcard(deck_id=deck.id, question=payload.question, answer=payload.answer)
    db.add(card)
    db.commit()
    db.refresh(card)
    return _serialize_card(card, None)


@router.delete("/decks/{deck_id}", status_code=204)
def delete_deck(deck_id: uuid.UUID, user: User = Depends(require_class_member), db: Session = Depends(get_db)):
    deck = db.get(FlashcardDeck, deck_id)
    if deck is None or deck.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Deck not found")
    if deck.created_by_id != user.id and not user.is_class_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Nur Ersteller oder Admin dürfen löschen")
    db.delete(deck)
    db.commit()


@router.delete("/cards/{card_id}", status_code=204)
def delete_card(card_id: uuid.UUID, user: User = Depends(require_class_member), db: Session = Depends(get_db)):
    card = db.get(Flashcard, card_id)
    if card is None or card.deck.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Card not found")
    db.delete(card)
    db.commit()


@router.post("/cards/{card_id}/review", response_model=FlashcardOut)
def review_card(
    card_id: uuid.UUID,
    payload: ReviewRequest,
    user: User = Depends(require_class_member),
    db: Session = Depends(get_db),
):
    """Per-Nutzer Lernfortschritt - betrifft nie die Klassenkameraden."""
    card = db.get(Flashcard, card_id)
    if card is None or card.deck.school_class_id != user.school_class_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Card not found")

    progress = (
        db.query(FlashcardProgress)
        .filter(FlashcardProgress.flashcard_id == card_id, FlashcardProgress.user_id == user.id)
        .first()
    )
    current_box = progress.box if progress else 1
    new_box, next_review_at = apply_review(current_box, payload.result)

    if progress is None:
        progress = FlashcardProgress(flashcard_id=card_id, user_id=user.id, box=new_box, next_review_at=next_review_at)
        db.add(progress)
    else:
        progress.box = new_box
        progress.next_review_at = next_review_at
    db.commit()
    return _serialize_card(card, progress)
