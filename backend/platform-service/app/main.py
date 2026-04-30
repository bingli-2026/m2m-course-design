from contextlib import asynccontextmanager
import asyncio

from fastapi import FastAPI
from fastapi import HTTPException
from fastapi import WebSocket
from fastapi import WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.mqtt_bridge import MqttBridge
from app.state_store import InMemoryStateStore
from app.demo_simulator import DemoSimulator

state_store = InMemoryStateStore()
mqtt_bridge = MqttBridge(state_store)
demo_sim = DemoSimulator(state_store)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    mqtt_bridge.start()
    demo_sim.start()
    yield
    demo_sim.stop()
    mqtt_bridge.stop()


app = FastAPI(title="platform-service", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.api_route("/healthz", methods=["GET", "HEAD"])
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.api_route("/", methods=["GET", "HEAD"])
def index() -> dict[str, object]:
    return {
        "service": "platform-service",
        "mode": "demo",
        "hints": {
            "GET": [
                "/healthz",
                "/api/v1/state",
                "/api/v1/events",
                "/api/v1/metrics/summary",
                "/api/v1/control/commands",
                "/api/v1/control/commands/{id}",
            ],
            "POST": [
                "/api/v1/control/command",
                "/api/v1/control/commands/{id}/ack",
                "/api/v1/ingest/heartbeat",
                "/api/v1/ingest/telemetry",
                "/api/v1/ingest/event",
            ],
            "WS": ["/api/v1/stream"],
        },
    }


@app.api_route("/api/v1/state", methods=["GET", "HEAD"])
def get_state() -> dict[str, object]:
    return state_store.get_snapshot()


@app.api_route("/api/v1/events", methods=["GET", "HEAD"])
def get_events(
    limit: int = 50,
    level: str | None = None,
    device_id: str | None = None,
    start: str | None = None,
    end: str | None = None,
) -> dict[str, object]:
    return state_store.get_events(limit=limit, level=level, device_id=device_id, start=start, end=end)


class CommandRequest(BaseModel):
    target_device: str = Field(min_length=1, max_length=64)
    command: str = Field(min_length=1, max_length=64)
    params: dict[str, object] | None = None


class HeartbeatIngestRequest(BaseModel):
    device_id: str = Field(min_length=1, max_length=64)
    heartbeat_seq: int | None = Field(default=None, ge=0)


class TelemetryIngestRequest(BaseModel):
    device_id: str = Field(min_length=1, max_length=64)
    status: str | None = Field(default=None, min_length=1, max_length=32)
    heartbeat_seq: int | None = Field(default=None, ge=0)
    fault_code: str | None = Field(default=None, max_length=64)


class EventIngestRequest(BaseModel):
    level: str = Field(min_length=1, max_length=16)
    title: str = Field(min_length=1, max_length=128)
    detail: str = Field(min_length=1, max_length=1024)
    device_id: str | None = Field(default=None, max_length=64)


class CommandAckRequest(BaseModel):
    status: str = Field(min_length=1, max_length=16)
    detail: str | None = Field(default=None, max_length=512)
    device_id: str | None = Field(default=None, max_length=64)


@app.post("/api/v1/control/command")
def post_command(payload: CommandRequest) -> dict[str, object]:
    try:
        result = state_store.apply_command(
            target_device=payload.target_device,
            command=payload.command,
            params=payload.params,
        )
        published = mqtt_bridge.publish_command(
            target_device=payload.target_device,
            command=payload.command,
            params=payload.params,
            command_id=int(result["command_id"]),
        )
        if published:
            state_store.update_command_status(command_id=int(result["command_id"]), status="sent")
            result["command_status"] = "sent"
        else:
            result["command_status"] = "pending"
        return result
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"device not found: {exc.args[0]}") from exc


@app.api_route("/api/v1/control/commands/{command_id}", methods=["GET", "HEAD"])
def get_command(command_id: int) -> dict[str, object]:
    payload = state_store.get_command(command_id)
    if payload is None:
        raise HTTPException(status_code=404, detail=f"command not found: {command_id}")
    return payload


@app.api_route("/api/v1/control/commands", methods=["GET", "HEAD"])
def list_commands(limit: int = 50, status: str | None = None, target_device: str | None = None) -> dict[str, object]:
    return state_store.list_commands(limit=limit, status=status, target_device=target_device)


@app.post("/api/v1/control/commands/{command_id}/ack")
def ack_command(command_id: int, payload: CommandAckRequest) -> dict[str, object]:
    normalized = payload.status.strip().lower()
    if normalized not in {"acked", "failed"}:
        raise HTTPException(status_code=422, detail="status must be one of: acked, failed")

    updated = state_store.update_command_status(command_id=command_id, status=normalized)
    if not updated:
        raise HTTPException(status_code=404, detail=f"command not found: {command_id}")

    state_store.append_event(
        level="INFO" if normalized == "acked" else "WARN",
        title=f"Command {normalized} (manual)",
        detail=payload.detail or f"command_id={command_id}",
        device_id=payload.device_id,
    )
    result = state_store.get_command(command_id)
    return {"status": "ok", "command": result}


@app.post("/api/v1/ingest/heartbeat")
def ingest_heartbeat(payload: HeartbeatIngestRequest) -> dict[str, object]:
    state = state_store.ingest_heartbeat(
        device_id=payload.device_id,
        heartbeat_seq=payload.heartbeat_seq,
    )
    state_store.append_event(
        level="INFO",
        title="Heartbeat ingested",
        detail=f"device={payload.device_id}, seq={state['heartbeat_seq']}",
        device_id=payload.device_id,
    )
    return {"status": "ok", "state": state}


@app.post("/api/v1/ingest/telemetry")
def ingest_telemetry(payload: TelemetryIngestRequest) -> dict[str, object]:
    state = state_store.ingest_telemetry(
        device_id=payload.device_id,
        status=payload.status,
        heartbeat_seq=payload.heartbeat_seq,
        fault_code=payload.fault_code,
    )
    state_store.append_event(
        level="INFO",
        title="Telemetry ingested",
        detail=f"device={payload.device_id}, status={state['status']}, fault={state['fault_code']}",
        device_id=payload.device_id,
    )
    return {"status": "ok", "state": state}


@app.post("/api/v1/ingest/event")
def ingest_event(payload: EventIngestRequest) -> dict[str, object]:
    event = state_store.append_event(
        level=payload.level.upper(),
        title=payload.title,
        detail=payload.detail,
        device_id=payload.device_id,
    )
    return {"status": "ok", "event_id": event.id}


@app.api_route("/api/v1/metrics/summary", methods=["GET", "HEAD"])
def get_metrics_summary() -> dict[str, object]:
    return state_store.get_metrics_summary()


@app.api_route("/api/v1/metrics/realtime", methods=["GET", "HEAD"])
def get_metrics_realtime(points: int = 12, bucket_seconds: int = 5) -> dict[str, object]:
    return state_store.get_realtime_dashboard_metrics(points=points, bucket_seconds=bucket_seconds)


@app.websocket("/api/v1/stream")
async def stream_snapshot(websocket: WebSocket) -> None:
    await websocket.accept()
    try:
        while True:
            snapshot = state_store.get_snapshot()
            payload = {
                "updated_at": snapshot["updated_at"],
                "state": snapshot,
                "events": state_store.get_events(limit=20),
                "metrics": state_store.get_metrics_summary(),
                "realtime": state_store.get_realtime_dashboard_metrics(points=12, bucket_seconds=5),
                "commands": state_store.list_commands(limit=20),
            }
            await websocket.send_json(payload)
            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        return
