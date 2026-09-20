import uuid
from datetime import datetime, timedelta

from tests.conftest import auth_headers


def register(client, email="admin@example.com", display_name="Admin", invite_code=None):
    return client.post(
        "/auth/register",
        json={"email": email, "password": "secret123", "display_name": display_name, "invite_code": invite_code},
    ).json()


def test_deck_creation_fails_without_text_or_file(client):
    admin = register(client)
    resp = client.post("/flashcards/decks", headers=auth_headers(admin["access_token"]), data={})
    assert resp.status_code == 422


def test_review_flow_is_per_user_and_advances_box(client):
    # Can't actually generate cards without Ollama, so seed one directly via the DB
    # to exercise the review/spaced-repetition logic in isolation.
    from app.database import SessionLocal
    from app.models.flashcard import Flashcard, FlashcardDeck

    admin = register(client)
    admin_token = admin["access_token"]
    invite = client.get("/classes/me/invite", headers=auth_headers(admin_token)).json()
    student = register(client, email="student@example.com", display_name="Stu", invite_code=invite["invite_code"])
    student_token = student["access_token"]

    db = SessionLocal()
    try:
        deck = FlashcardDeck(
            title="Test-Deck",
            school_class_id=uuid.UUID(admin["user"]["school_class_id"]),
            created_by_id=uuid.UUID(admin["user"]["id"]),
        )
        db.add(deck)
        db.flush()
        card = Flashcard(deck_id=deck.id, question="1+1?", answer="2")
        db.add(card)
        db.commit()
        card_id = str(card.id)
        deck_id = str(deck.id)
    finally:
        db.close()

    # New card has no progress yet -> due for everyone by default.
    detail = client.get(f"/flashcards/decks/{deck_id}", headers=auth_headers(admin_token)).json()
    assert detail["due_count"] == 1
    assert detail["cards"][0]["box"] == 1

    review = client.post(
        f"/flashcards/cards/{card_id}/review", headers=auth_headers(admin_token), json={"result": "know"}
    )
    assert review.status_code == 200
    assert review.json()["box"] == 2
    assert not review.json()["due"]  # box 2 is scheduled a day out

    # Student's own progress on the same shared card is untouched by the admin's review.
    student_detail = client.get(f"/flashcards/decks/{deck_id}", headers=auth_headers(student_token)).json()
    assert student_detail["cards"][0]["box"] == 1
    assert student_detail["due_count"] == 1

    wrong = client.post(
        f"/flashcards/cards/{card_id}/review", headers=auth_headers(admin_token), json={"result": "again"}
    )
    assert wrong.json()["box"] == 1
    assert wrong.json()["due"] is True


def test_only_creator_or_admin_can_delete_deck(client):
    from app.database import SessionLocal
    from app.models.flashcard import FlashcardDeck

    admin = register(client)
    invite = client.get("/classes/me/invite", headers=auth_headers(admin["access_token"])).json()
    student = register(client, email="s2@example.com", display_name="S2", invite_code=invite["invite_code"])

    db = SessionLocal()
    try:
        deck = FlashcardDeck(
            title="Admin-Deck",
            school_class_id=uuid.UUID(admin["user"]["school_class_id"]),
            created_by_id=uuid.UUID(admin["user"]["id"]),
        )
        db.add(deck)
        db.commit()
        deck_id = str(deck.id)
    finally:
        db.close()

    forbidden = client.delete(f"/flashcards/decks/{deck_id}", headers=auth_headers(student["access_token"]))
    assert forbidden.status_code == 403

    allowed = client.delete(f"/flashcards/decks/{deck_id}", headers=auth_headers(admin["access_token"]))
    assert allowed.status_code == 204
