import os
from pathlib import Path

TEST_DB_PATH = Path(__file__).parent / "test_hausiplanner.db"
os.environ["HOMEWORK_DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"
os.environ["HOMEWORK_JWT_SECRET"] = "test-secret"

import pytest
from fastapi.testclient import TestClient

from app.database import Base, engine
from app.main import app


@pytest.fixture(autouse=True)
def _fresh_schema():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
