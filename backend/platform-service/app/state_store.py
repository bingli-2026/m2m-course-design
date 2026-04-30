from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from threading import RLock


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class WorkstationState:
    device_id: str
    status: str
    last_seen: str
    heartbeat_seq: int
    fault_code: str | None = None


class InMemoryStateStore:
    def __init__(self) -> None:
        self._lock = RLock()
        now = _now_iso()
        self._state: dict[str, WorkstationState] = {
            "terminal-a": WorkstationState("terminal-a", "UNKNOWN", now, 0, None),
            "terminal-b": WorkstationState("terminal-b", "UNKNOWN", now, 0, None),
        }

    def get_snapshot(self) -> dict[str, object]:
        with self._lock:
            return {
                "updated_at": _now_iso(),
                "workstations": [asdict(v) for v in self._state.values()],
            }
