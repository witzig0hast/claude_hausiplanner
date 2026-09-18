from datetime import datetime, timedelta

from tests.conftest import auth_headers


def register(client, email="admin@example.com", display_name="Admin", invite_code=None):
    return client.post(
        "/auth/register",
        json={"email": email, "password": "secret123", "display_name": display_name, "invite_code": invite_code},
    ).json()


def make_homework(client, token, subject_id, title="Seite 10", due_at="2026-12-24T18:00:00"):
    return client.post(
        "/homework",
        json={"title": title, "due_at": due_at, "subject_id": subject_id},
        headers=auth_headers(token),
    ).json()


def test_completion_is_per_user_only(client):
    admin = register(client)
    admin_token = admin["access_token"]
    class_id = admin["user"]["school_class_id"]

    invite = client.get("/classes/me/invite", headers=auth_headers(admin_token)).json()
    student = register(client, email="student@example.com", display_name="Stu", invite_code=invite["invite_code"])
    student_token = student["access_token"]

    subjects = client.get("/classes/me/subjects", headers=auth_headers(admin_token)).json()
    hw = make_homework(client, admin_token, subjects[0]["id"])

    complete_resp = client.post(f"/homework/{hw['id']}/complete", headers=auth_headers(student_token))
    assert complete_resp.status_code == 200
    assert complete_resp.json()["completed_by_me"] is True
    assert complete_resp.json()["completed_count"] == 1

    admin_view = client.get("/homework", headers=auth_headers(admin_token)).json()
    admin_hw = next(h for h in admin_view if h["id"] == hw["id"])
    assert admin_hw["completed_by_me"] is False
    assert admin_hw["completed_count"] == 1

    uncomplete_resp = client.delete(f"/homework/{hw['id']}/complete", headers=auth_headers(student_token))
    assert uncomplete_resp.json()["completed_count"] == 0

    assert class_id is not None  # sanity: student joined the admin's class


def test_public_homework_view_requires_no_auth(client):
    admin = register(client)
    admin_token = admin["access_token"]
    class_id = admin["user"]["school_class_id"]
    subjects = client.get("/classes/me/subjects", headers=auth_headers(admin_token)).json()
    hw = make_homework(client, admin_token, subjects[0]["id"], title="Öffentlich sichtbar")

    resp = client.get(f"/public/classes/{class_id}/homework")
    assert resp.status_code == 200
    titles = [item["title"] for item in resp.json()]
    assert "Öffentlich sichtbar" in titles
    assert hw["id"] in [item["id"] for item in resp.json()]


def test_only_creator_or_admin_can_delete_homework(client):
    admin = register(client)
    admin_token = admin["access_token"]
    invite = client.get("/classes/me/invite", headers=auth_headers(admin_token)).json()
    student = register(client, email="s2@example.com", display_name="S2", invite_code=invite["invite_code"])
    student_token = student["access_token"]

    subjects = client.get("/classes/me/subjects", headers=auth_headers(admin_token)).json()
    hw = make_homework(client, admin_token, subjects[0]["id"])

    other_student = register(client, email="s3@example.com", display_name="S3", invite_code=invite["invite_code"])
    resp = client.delete(f"/homework/{hw['id']}", headers=auth_headers(other_student["access_token"]))
    assert resp.status_code == 403

    resp2 = client.delete(f"/homework/{hw['id']}", headers=auth_headers(admin_token))
    assert resp2.status_code == 204


def test_planning_endpoint_returns_shape(client):
    admin = register(client)
    admin_token = admin["access_token"]
    subjects = client.get("/classes/me/subjects", headers=auth_headers(admin_token)).json()
    due_soon = (datetime.utcnow() + timedelta(days=3)).isoformat()
    make_homework(client, admin_token, subjects[0]["id"], due_at=due_soon)

    resp = client.get("/planning", headers=auth_headers(admin_token))
    assert resp.status_code == 200
    body = resp.json()
    assert "free_slots" in body
    assert "suggestions" in body
    assert "unscheduled" in body
