import base64

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.database import SessionLocal
from app.models.super_admin import SuperAdmin
from tests.conftest import auth_headers


def _make_superadmin(label="Test"):
    private_key = Ed25519PrivateKey.generate()
    public_pem = private_key.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")

    db = SessionLocal()
    try:
        admin = SuperAdmin(label=label, public_key_pem=public_pem)
        db.add(admin)
        db.commit()
        db.refresh(admin)
        admin_id = admin.id
    finally:
        db.close()
    return private_key, admin_id


def _sign_challenge(client, private_key):
    challenge = client.post("/__sys/challenge").json()
    nonce = base64.b64decode(challenge["nonce_b64"])
    signature = base64.b64encode(private_key.sign(nonce)).decode()
    return challenge["challenge_id"], signature


def test_hidden_router_not_in_openapi_schema(client):
    schema = client.get("/openapi.json").json()
    assert all("__sys" not in path for path in schema["paths"])


def test_correct_signature_logs_in_and_grants_access(client):
    private_key, _ = _make_superadmin()
    challenge_id, signature = _sign_challenge(client, private_key)

    login = client.post("/__sys/login", json={"challenge_id": challenge_id, "signature_b64": signature})
    assert login.status_code == 200
    token = login.json()["access_token"]

    stats = client.get("/__sys/stats", headers=auth_headers(token))
    assert stats.status_code == 200
    assert "class_count" in stats.json()


def test_wrong_signature_rejected_with_404(client):
    _make_superadmin()
    unrelated_key = Ed25519PrivateKey.generate()
    challenge_id, signature = _sign_challenge(client, unrelated_key)

    login = client.post("/__sys/login", json={"challenge_id": challenge_id, "signature_b64": signature})
    assert login.status_code == 404


def test_challenge_is_single_use(client):
    private_key, _ = _make_superadmin()
    challenge_id, signature = _sign_challenge(client, private_key)

    first = client.post("/__sys/login", json={"challenge_id": challenge_id, "signature_b64": signature})
    assert first.status_code == 200

    replay = client.post("/__sys/login", json={"challenge_id": challenge_id, "signature_b64": signature})
    assert replay.status_code == 404


def test_normal_user_token_cannot_access_superadmin_routes(client):
    _make_superadmin()
    user = client.post(
        "/auth/register",
        json={"email": "notadmin@example.com", "password": "secret123", "display_name": "Normal"},
    ).json()

    resp = client.get("/__sys/stats", headers=auth_headers(user["access_token"]))
    assert resp.status_code == 404


def test_superadmin_can_list_and_delete_across_classes(client):
    private_key, _ = _make_superadmin()
    admin = client.post(
        "/auth/register",
        json={"email": "classadmin@example.com", "password": "secret123", "display_name": "ClassAdmin"},
    ).json()

    challenge_id, signature = _sign_challenge(client, private_key)
    token = client.post(
        "/__sys/login", json={"challenge_id": challenge_id, "signature_b64": signature}
    ).json()["access_token"]

    classes = client.get("/__sys/classes", headers=auth_headers(token)).json()
    assert any(c["id"] == admin["user"]["school_class_id"] for c in classes)

    users = client.get("/__sys/users", headers=auth_headers(token)).json()
    assert any(u["email"] == "classadmin@example.com" for u in users)

    delete_resp = client.delete(f"/__sys/classes/{admin['user']['school_class_id']}", headers=auth_headers(token))
    assert delete_resp.status_code == 204

    users_after = client.get("/__sys/users", headers=auth_headers(token)).json()
    assert not any(u["email"] == "classadmin@example.com" for u in users_after)
