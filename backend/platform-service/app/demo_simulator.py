from __future__ import annotations

import os
import random
import threading
import time
from datetime import datetime, timezone

from app.state_store import InMemoryStateStore


class DemoSimulator:
    """Generates realistic device telemetry when no real hardware is connected."""

    def __init__(self, state_store: InMemoryStateStore) -> None:
        self._store = state_store
        self._enabled = os.getenv("DEMO_MODE", "false").lower() in {"1", "true", "yes"}
        self._interval = float(os.getenv("DEMO_INTERVAL_SEC", "2"))
        self._thread: threading.Thread | None = None
        self._running = False

        self._devices = [
            {"device_id": "terminal-a", "seq": 0, "base_output": 80, "base_temp": 27.0},
            {"device_id": "terminal-b", "seq": 0, "base_output": 65, "base_temp": 38.0},
            {"device_id": "gateway", "seq": 0, "base_output": 0, "base_temp": 30.0},
        ]
        self._tick = 0

    @property
    def enabled(self) -> bool:
        return self._enabled

    def start(self) -> None:
        if not self._enabled:
            self._store.append_event(
                level="INFO", title="Demo simulator disabled", detail="DEMO_MODE is false", device_id=None,
            )
            return
        self._running = True
        self._thread = threading.Thread(target=self._loop, daemon=True, name="demo-sim")
        self._thread.start()

    def stop(self) -> None:
        self._running = False
        if self._thread:
            self._thread.join(timeout=3)

    def _loop(self) -> None:
        self._store.append_event(
            level="INFO", title="Demo simulator started",
            detail="Simulating terminal-a, terminal-b, gateway", device_id=None,
        )
        while self._running:
            self._tick += 1
            for dev in self._devices:
                self._simulate_device(dev)
            self._maybe_simulate_event()
            time.sleep(self._interval)

    def _simulate_device(self, dev: dict) -> None:
        dev["seq"] += 1
        did = dev["device_id"]
        seq = dev["seq"]

        # Occasional fault on terminal-b
        fault = None
        status = "ONLINE"
        if did == "terminal-b" and seq % 30 == 0:
            fault = "TEMP_HIGH"
            status = "WARNING"
        if did == "terminal-b" and seq % 45 == 0:
            fault = None
            status = "ONLINE"

        # Gateway occasionally reports UNKNOWN
        if did == "gateway" and seq % 50 == 0:
            status = "WARNING"

        self._store.ingest_telemetry(
            device_id=did, status=status, heartbeat_seq=seq, fault_code=fault,
        )

    def _maybe_simulate_event(self) -> None:
        t = self._tick
        if t % 5 == 0:
            self._store.append_event(
                level="INFO", title="Data sampling completed",
                detail=f"terminal-a cycle {t} sampling finished", device_id="terminal-a",
            )
        if t % 7 == 0:
            self._store.append_event(
                level="INFO", title="Telemetry batch uploaded",
                detail=f"gateway relayed batch #{t}", device_id="gateway",
            )
        if t % 15 == 0:
            self._store.append_event(
                level="WARN", title="Temperature near threshold",
                detail="terminal-b temp 41.8°C, approaching limit", device_id="terminal-b",
            )
        if t % 20 == 0:
            self._store.append_event(
                level="CRITICAL", title="Alert triggered",
                detail="terminal-b over-temp, entering protection mode", device_id="terminal-b",
            )
        if t % 22 == 0:
            self._store.append_event(
                level="INFO", title="Recovery command sent",
                detail="Control panel sent cooldown command to terminal-b", device_id="gateway",
            )
        if t % 25 == 0:
            self._store.append_event(
                level="INFO", title="Device recovered",
                detail="terminal-b temp back to normal, protection cleared", device_id="terminal-b",
            )

        # Simulate command + ack cycle
        if t % 10 == 0:
            now = datetime.now(timezone.utc)
            try:
                result = self._store.apply_command(
                    target_device="terminal-a",
                    command="start_sampling",
                    params={"rate": 2},
                )
                cmd_id = int(result["command_id"])
                self._store.update_command_status(command_id=cmd_id, status="sent")
                # Simulate processing delay: 200-600ms
                time.sleep(random.uniform(0.2, 0.6))
                self._store.update_command_status(command_id=cmd_id, status="acked")
                self._store.append_event(
                    level="INFO", title="Command acked",
                    detail=f"command_id={cmd_id}; start_sampling executed on terminal-a",
                    device_id="terminal-a",
                )
            except Exception:
                pass
