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
    assert len(payload["workstations"]) == 3


def test_events_endpoint() -> None:
    response = client.get("/api/v1/events?limit=10")
    assert response.status_code == 200
    payload = response.json()
    assert "updated_at" in payload
    assert "events" in payload
    assert isinstance(payload["events"], list)
    assert len(payload["events"]) >= 1


def test_command_endpoint_success() -> None:
    response = client.post(
        "/api/v1/control/command",
        json={"target_device": "terminal-a", "command": "start_sampling", "params": {"rate": 2}},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["target_device"] == "terminal-a"
    assert payload["state"]["status"] == "ONLINE"
    assert isinstance(payload["command_id"], int)

    lookup = client.get(f"/api/v1/control/commands/{payload['command_id']}")
    assert lookup.status_code == 200
    command = lookup.json()
    assert command["target_device"] == "terminal-a"
    assert command["status"] in {"pending", "sent", "acked", "failed", "ignored"}


def test_command_endpoint_device_not_found() -> None:
    response = client.post(
        "/api/v1/control/command",
        json={"target_device": "terminal-x", "command": "start_sampling"},
    )
    assert response.status_code == 404


def test_ingest_telemetry_and_metrics() -> None:
    telemetry = client.post(
        "/api/v1/ingest/telemetry",
        json={
            "device_id": "terminal-b",
            "status": "WARNING",
            "heartbeat_seq": 33,
            "fault_code": "TEMP_HIGH",
        },
    )
    assert telemetry.status_code == 200
    t_payload = telemetry.json()
    assert t_payload["state"]["status"] == "WARNING"
    assert t_payload["state"]["fault_code"] == "TEMP_HIGH"

    heartbeat = client.post("/api/v1/ingest/heartbeat", json={"device_id": "gateway", "heartbeat_seq": 99})
    assert heartbeat.status_code == 200
    h_payload = heartbeat.json()
    assert h_payload["state"]["heartbeat_seq"] == 99

    metrics = client.get("/api/v1/metrics/summary")
    assert metrics.status_code == 200
    m_payload = metrics.json()
    assert m_payload["device_total"] >= 3
    assert m_payload["event_total"] >= 1


def test_list_commands_and_filter_events() -> None:
    c1 = client.post(
        "/api/v1/control/command",
        json={"target_device": "terminal-a", "command": "sync_config"},
    )
    assert c1.status_code == 200

    c2 = client.post(
        "/api/v1/control/command",
        json={"target_device": "terminal-b", "command": "emergency_stop"},
    )
    assert c2.status_code == 200

    listed = client.get("/api/v1/control/commands?limit=20")
    assert listed.status_code == 200
    commands = listed.json()["commands"]
    assert isinstance(commands, list)
    assert len(commands) >= 2

    filtered = client.get("/api/v1/control/commands?target_device=terminal-b&limit=20")
    assert filtered.status_code == 200
    for item in filtered.json()["commands"]:
        assert item["target_device"] == "terminal-b"

    warn_events = client.get("/api/v1/events?level=WARN&limit=50")
    assert warn_events.status_code == 200
    for event in warn_events.json()["events"]:
        assert event["level"] == "WARN"


def test_websocket_stream_snapshot() -> None:
    with client.websocket_connect("/api/v1/stream") as ws:
        payload = ws.receive_json()
        assert "updated_at" in payload
        assert "state" in payload
        assert "events" in payload
        assert "metrics" in payload
        assert "commands" in payload


def test_manual_command_ack_flow() -> None:
    created = client.post(
        "/api/v1/control/command",
        json={"target_device": "terminal-a", "command": "start_sampling"},
    )
    assert created.status_code == 200
    cid = int(created.json()["command_id"])

    ack = client.post(
        f"/api/v1/control/commands/{cid}/ack",
        json={"status": "acked", "detail": "simulated ack", "device_id": "terminal-a"},
    )
    assert ack.status_code == 200
    payload = ack.json()
    assert payload["command"]["status"] == "acked"
