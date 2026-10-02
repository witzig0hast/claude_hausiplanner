from app.services.defaults import DEFAULT_SUBJECTS
from tests.conftest import auth_headers


def register(client, email="admin@example.com", display_name="Admin", invite_code=None):
    return client.post(
        "/auth/register",
        json={"email": email, "password": "secret123", "display_name": display_name, "invite_code": invite_code},
    )


def test_register_without_invite_creates_class_and_seeds_subjects(client):
    resp = register(client)
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["is_class_admin"] is True
    assert data["user"]["school_class_id"] is not None

    subjects = client.get("/classes/me/subjects", headers=auth_headers(data["access_token"]))
    assert subjects.status_code == 200
    assert len(subjects.json()) == len(DEFAULT_SUBJECTS)


def test_register_with_custom_class_name(client):
    resp = client.post(
        "/auth/register",
        json={
            "email": "admin@example.com",
            "password": "secret123",
            "display_name": "Admin",
            "class_name": "8b Gymnasium Musterstadt",
        },
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    school_class = client.get("/classes/me", headers=auth_headers(token))
    assert school_class.json()["name"] == "8b Gymnasium Musterstadt"


def test_register_without_class_name_falls_back_to_default(client):
    resp = register(client)
    token = resp.json()["access_token"]
    school_class = client.get("/classes/me", headers=auth_headers(token))
    assert school_class.json()["name"] == "Admin's Klasse"


def test_login_with_wrong_password_fails(client):
    register(client)
    resp = client.post("/auth/login", json={"email": "admin@example.com", "password": "wrong"})
    assert resp.status_code == 401


def test_duplicate_email_registration_rejected(client):
    register(client)
    resp = register(client)
    assert resp.status_code == 409


def test_join_class_via_invite_code(client):
    admin = register(client).json()
    invite = client.get("/classes/me/invite", headers=auth_headers(admin["access_token"])).json()

    student = register(client, email="student@example.com", display_name="Stu", invite_code=invite["invite_code"])
    assert student.status_code == 200
    student_data = student.json()
    assert student_data["user"]["is_class_admin"] is False
    assert student_data["user"]["school_class_id"] == admin["user"]["school_class_id"]


def test_invalid_invite_code_rejected(client):
    resp = register(client, email="lost@example.com", invite_code="does-not-exist")
    assert resp.status_code == 404


def test_only_admin_can_create_subjects_and_calendar_events(client):
    admin = register(client).json()
    invite = client.get("/classes/me/invite", headers=auth_headers(admin["access_token"])).json()
    student = register(
        client, email="student2@example.com", display_name="Stu2", invite_code=invite["invite_code"]
    ).json()

    resp = client.post(
        "/classes/me/subjects",
        json={"name": "Extra"},
        headers=auth_headers(student["access_token"]),
    )
    assert resp.status_code == 403

    resp2 = client.post(
        "/calendar",
        json={
            "title": "Mathe",
            "starts_at": "2026-01-05T08:00:00",
            "ends_at": "2026-01-05T08:45:00",
            "is_recurring_weekly": True,
            "weekday": 0,
        },
        headers=auth_headers(student["access_token"]),
    )
    assert resp2.status_code == 403

    resp3 = client.post(
        "/calendar",
        json={
            "title": "Mathe",
            "starts_at": "2026-01-05T08:00:00",
            "ends_at": "2026-01-05T08:45:00",
            "is_recurring_weekly": True,
            "weekday": 0,
        },
        headers=auth_headers(admin["access_token"]),
    )
    assert resp3.status_code == 200
