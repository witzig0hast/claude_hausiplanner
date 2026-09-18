"""CLI helper to actually use the hidden superadmin API.

    python -m scripts.superadmin_login ./superadmin_karim_private.pem https://homework-api.example.de

Does the challenge/sign/login dance and then prints a live system overview.
Never sends the private key anywhere - it only ever leaves your machine as a
signature over a random, single-use nonce.
"""

import base64
import sys

import httpx
from cryptography.hazmat.primitives import serialization


def main():
    if len(sys.argv) != 3:
        print("Usage: python -m scripts.superadmin_login <private_key.pem> <api_base_url>")
        sys.exit(1)

    key_path, api_base = sys.argv[1], sys.argv[2].rstrip("/")
    private_key = serialization.load_pem_private_key(open(key_path, "rb").read(), password=None)

    challenge = httpx.post(f"{api_base}/__sys/challenge", timeout=30).json()
    nonce = base64.b64decode(challenge["nonce_b64"])
    signature = private_key.sign(nonce)

    login_resp = httpx.post(
        f"{api_base}/__sys/login",
        json={"challenge_id": challenge["challenge_id"], "signature_b64": base64.b64encode(signature).decode()},
        timeout=30,
    )
    login_resp.raise_for_status()
    token = login_resp.json()["access_token"]
    print(f"Eingeloggt. Token (gültig {login_resp.json()['expires_in_minutes']} Min.):\n{token}\n")

    headers = {"Authorization": f"Bearer {token}"}
    stats = httpx.get(f"{api_base}/__sys/stats", headers=headers, timeout=30).json()
    print("Systemübersicht:")
    print(f"  Klassen:            {stats['class_count']}")
    print(f"  Nutzer:             {stats['user_count']}")
    print(f"  Hausaufgaben total: {stats['homework_count']}")
    print(f"  davon offen:        {stats['open_homework_count']}")
    print()
    print("Weitere Aufrufe mit diesem Token, z.B.:")
    print(f'  curl -H "Authorization: Bearer {token}" {api_base}/__sys/classes')
    print(f'  curl -H "Authorization: Bearer {token}" {api_base}/__sys/users')
    print(f'  curl -H "Authorization: Bearer {token}" {api_base}/__sys/homework')


if __name__ == "__main__":
    main()
