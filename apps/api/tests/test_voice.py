import uuid

from tests.conftest import auth_headers


def register(client, email="admin@example.com", display_name="Admin"):
    return client.post(
        "/auth/register",
        json={"email": email, "password": "secret123", "display_name": display_name},
    ).json()


def test_capture_returns_503_without_ffmpeg_or_whisper(client):
    admin = register(client)
    resp = client.post(
        "/voice/capture",
        headers=auth_headers(admin["access_token"]),
        files={"file": ("note.webm", b"not-real-audio-bytes", "audio/webm")},
    )
    assert resp.status_code == 503


def test_pending_suggestion_404_when_none(client):
    admin = register(client)
    resp = client.get("/voice/pending-suggestion", headers=auth_headers(admin["access_token"]))
    assert resp.status_code == 404


def test_apply_and_dismiss_pending_suggestion(client):
    # Can't actually run Whisper/Ollama here, so seed a suggestion directly via the DB
    # to exercise the apply/dismiss flow in isolation - mirrors the flashcards test pattern.
    from app.database import SessionLocal
    from app.models.subject import Subject
    from app.models.voice_suggestion import PendingHomeworkSuggestion

    admin = register(client)
    token = admin["access_token"]

    db = SessionLocal()
    try:
        subject = (
            db.query(Subject)
            .filter(Subject.school_class_id == uuid.UUID(admin["user"]["school_class_id"]))
            .first()
        )
        suggestion = PendingHomeworkSuggestion(
            user_id=uuid.UUID(admin["user"]["id"]),
            raw_transcript="Mathe Seite 42 Aufgabe 3 bis morgen",
            subject_guess=subject.name,
            subject_id=subject.id,
            title="Seite 42 Aufgabe 3",
            description=None,
            due_date_guess="2030-01-01",
        )
        db.add(suggestion)
        db.commit()
        subject_id = str(subject.id)
    finally:
        db.close()

    # Dismissing clears it without creating a homework entry.
    dismissed = client.delete("/voice/pending-suggestion", headers=auth_headers(token))
    assert dismissed.status_code == 204
    assert client.get("/voice/pending-suggestion", headers=auth_headers(token)).status_code == 404

    # Re-seed to test the apply path too.
    db = SessionLocal()
    try:
        db.add(
            PendingHomeworkSuggestion(
                user_id=uuid.UUID(admin["user"]["id"]),
                raw_transcript="Mathe Seite 42 Aufgabe 3 bis morgen",
                subject_guess=None,
                subject_id=None,
                title="Seite 42 Aufgabe 3",
                description=None,
                due_date_guess="2030-01-01",
            )
        )
        db.commit()
    finally:
        db.close()

    detail = client.get("/voice/pending-suggestion", headers=auth_headers(token)).json()
    assert detail["title"] == "Seite 42 Aufgabe 3"

    apply_resp = client.post(
        "/voice/pending-suggestion/apply",
        headers=auth_headers(token),
        json={
            "title": "Seite 42 Aufgabe 3",
            "due_at": "2030-01-01T18:00:00",
            "subject_id": subject_id,
        },
    )
    assert apply_resp.status_code == 200
    assert apply_resp.json()["title"] == "Seite 42 Aufgabe 3"

    # Applying clears the pending suggestion.
    assert client.get("/voice/pending-suggestion", headers=auth_headers(token)).status_code == 404

    homework = client.get("/homework", headers=auth_headers(token)).json()
    assert any(hw["title"] == "Seite 42 Aufgabe 3" for hw in homework)
