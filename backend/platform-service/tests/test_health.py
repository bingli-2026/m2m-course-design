from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_healthz() -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_state_shape() -> None:
    response = client.get("/api/v1/state")
    assert response.status_code == 200
    payload = response.json()
    assert "updated_at" in payload
    assert "workstations" in payload
    assert isinstance(payload["workstations"], list)
    assert len(payload["workstations"]) == 2
