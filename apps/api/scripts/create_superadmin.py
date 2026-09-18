"""Run this ONCE, locally, directly on your server (never over HTTP - there is
deliberately no API endpoint for this).

    cd apps/api
    python -m scripts.create_superadmin "Karim"

Generates a fresh Ed25519 keypair, stores only the PUBLIC key in the database,
and writes the PRIVATE key to a local .pem file that you must move somewhere
safe (a password manager, an offline USB stick, ...) and then delete from the
server. Anyone holding that private key file has full superadmin access -
treat it like the master key it is.
"""

import sys
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import SessionLocal  # noqa: E402
from app.models.super_admin import SuperAdmin  # noqa: E402


def main():
    if len(sys.argv) != 2:
        print("Usage: python -m scripts.create_superadmin <label>")
        sys.exit(1)
    label = sys.argv[1]

    private_key = Ed25519PrivateKey.generate()
    public_key = private_key.public_key()

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")

    db = SessionLocal()
    try:
        admin = SuperAdmin(label=label, public_key_pem=public_pem)
        db.add(admin)
        db.commit()
        db.refresh(admin)
    finally:
        db.close()

    key_path = Path(f"./superadmin_{label}_private.pem")
    key_path.write_text(private_pem)
    key_path.chmod(0o600)

    print(f"Superadmin '{label}' angelegt (id={admin.id}).")
    print(f"Privater Schlüssel gespeichert unter: {key_path.resolve()}")
    print("WICHTIG: Diese Datei jetzt vom Server herunterladen, sicher verwahren")
    print("(Passwortmanager/offline), und danach vom Server löschen:")
    print(f"  rm {key_path.resolve()}")
    print()
    print("Login-Test:")
    print(f"  python -m scripts.superadmin_login {key_path} <API_BASE_URL>")


if __name__ == "__main__":
    main()
