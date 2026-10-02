from tests.conftest import auth_headers


def register(client, email="admin@example.com", display_name="Admin"):
    return client.post(
        "/auth/register",
        json={"email": email, "password": "secret123", "display_name": display_name},
    ).json()


def test_summary_and_chat_gracefully_degrade_without_ollama(client):
    admin = register(client)
    token = admin["access_token"]

    summary = client.get("/agent/summary", headers=auth_headers(token))
    assert summary.status_code == 200
    assert "summary" in summary.json()

    chat = client.post("/agent/chat", headers=auth_headers(token), json={"question": "Was steht an?"})
    assert chat.status_code == 200
    assert "answer" in chat.json()


def test_workload_endpoint_shape_and_levels(client):
    admin = register(client)
    token = admin["access_token"]

    empty = client.get("/agent/workload", headers=auth_headers(token))
    assert empty.status_code == 200
    assert empty.json()["level"] == "green"
    assert empty.json()["minutes_needed"] == 0


def test_agent_tone_can_be_changed(client):
    admin = register(client)
    token = admin["access_token"]
    assert admin["user"]["agent_tone"] == "locker"

    resp = client.put("/auth/me/tone", headers=auth_headers(token), json={"tone": "streng"})
    assert resp.status_code == 200
    assert resp.json()["agent_tone"] == "streng"

    invalid = client.put("/auth/me/tone", headers=auth_headers(token), json={"tone": "wütend"})
    assert invalid.status_code == 422
