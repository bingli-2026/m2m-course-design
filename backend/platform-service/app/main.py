from fastapi import FastAPI

from app.state_store import InMemoryStateStore

app = FastAPI(title="platform-service", version="0.1.0")
state_store = InMemoryStateStore()


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/state")
def get_state() -> dict[str, object]:
    return state_store.get_snapshot()
