from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from threading import RLock
from typing import Any


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class InMemoryStateStore:
    """Compatibility name kept; implementation is now SQLite-backed."""

    def __init__(self) -> None:
        self._lock = RLock()
        self._db_path = os.getenv("SQLITE_DB_PATH", "platform.db")
        self._offline_after_seconds = int(os.getenv("OFFLINE_AFTER_SECONDS", "15"))
        self._init_db()

    def _effective_status(self, status: str, last_seen: str) -> str:
        if status == "FAULT":
            return status
        try:
            seen = datetime.fromisoformat(last_seen)
            if seen.tzinfo is None:
                seen = seen.replace(tzinfo=timezone.utc)
            delta = (datetime.now(timezone.utc) - seen).total_seconds()
            if delta > self._offline_after_seconds:
                return "OFFLINE"
            return status
        except Exception:
            return "OFFLINE"

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._lock:
            conn = self._conn()
            try:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS device_state (
                      device_id TEXT PRIMARY KEY,
                      status TEXT NOT NULL,
                      last_seen TEXT NOT NULL,
                      heartbeat_seq INTEGER NOT NULL,
                      fault_code TEXT
                    )
                    """
                )
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS event_log (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      timestamp TEXT NOT NULL,
                      level TEXT NOT NULL,
                      title TEXT NOT NULL,
                      detail TEXT NOT NULL,
                      device_id TEXT
                    )
                    """
                )
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS command_log (
                      id INTEGER PRIMARY KEY AUTOINCREMENT,
                      target_device TEXT NOT NULL,
                      command TEXT NOT NULL,
                      params_json TEXT,
                      status TEXT NOT NULL,
                      created_at TEXT NOT NULL,
                      updated_at TEXT NOT NULL
                    )
                    """
                )

                now = _now_iso()
                for device_id in ("terminal-a", "terminal-b", "gateway"):
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO device_state(device_id, status, last_seen, heartbeat_seq, fault_code)
                        VALUES(?, 'UNKNOWN', ?, 0, NULL)
                        """,
                        (device_id, now),
                    )

                row = conn.execute("SELECT COUNT(*) AS c FROM event_log").fetchone()
                if row and int(row["c"]) == 0:
                    conn.execute(
                        """
                        INSERT INTO event_log(timestamp, level, title, detail, device_id)
                        VALUES(?, ?, ?, ?, ?)
                        """,
                        (_now_iso(), "INFO", "Platform service started", "SQLite state store initialized", None),
                    )

                conn.commit()
            finally:
                conn.close()

    def get_snapshot(self) -> dict[str, object]:
        with self._lock:
            conn = self._conn()
            try:
                rows = conn.execute(
                    "SELECT device_id, status, last_seen, heartbeat_seq, fault_code FROM device_state ORDER BY device_id"
                ).fetchall()
                return {
                    "updated_at": _now_iso(),
                    "workstations": [
                        {
                            "device_id": r["device_id"],
                            "status": self._effective_status(r["status"], r["last_seen"]),
                            "last_seen": r["last_seen"],
                            "heartbeat_seq": r["heartbeat_seq"],
                            "fault_code": r["fault_code"],
                        }
                        for r in rows
                    ],
                }
            finally:
                conn.close()

    def get_events(
        self,
        limit: int = 50,
        *,
        level: str | None = None,
        device_id: str | None = None,
        start: str | None = None,
        end: str | None = None,
    ) -> dict[str, object]:
        safe_limit = max(1, min(limit, 200))
        with self._lock:
            conn = self._conn()
            try:
                where: list[str] = []
                args: list[Any] = []
                if level:
                    where.append("level = ?")
                    args.append(level.upper())
                if device_id:
                    where.append("device_id = ?")
                    args.append(device_id)
                if start:
                    where.append("timestamp >= ?")
                    args.append(start)
                if end:
                    where.append("timestamp <= ?")
                    args.append(end)

                where_sql = f"WHERE {' AND '.join(where)}" if where else ""
                rows = conn.execute(
                    f"""
                    SELECT id, timestamp, level, title, detail, device_id
                    FROM event_log
                    {where_sql}
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (*args, safe_limit),
                ).fetchall()
                return {
                    "updated_at": _now_iso(),
                    "events": [dict(r) for r in rows],
                }
            finally:
                conn.close()

    def append_event(self, *, level: str, title: str, detail: str, device_id: str | None) -> Any:
        with self._lock:
            conn = self._conn()
            try:
                now = _now_iso()
                cur = conn.execute(
                    """
                    INSERT INTO event_log(timestamp, level, title, detail, device_id)
                    VALUES(?, ?, ?, ?, ?)
                    """,
                    (now, level, title, detail, device_id),
                )
                conn.commit()
                return type("EventRecord", (), {"id": cur.lastrowid, "timestamp": now})()
            finally:
                conn.close()

    def ingest_heartbeat(self, *, device_id: str, heartbeat_seq: int | None = None) -> dict[str, object]:
        with self._lock:
            conn = self._conn()
            try:
                row = conn.execute(
                    "SELECT heartbeat_seq FROM device_state WHERE device_id = ?", (device_id,)
                ).fetchone()
                now = _now_iso()
                if row is None:
                    seq = heartbeat_seq if heartbeat_seq is not None else 1
                    conn.execute(
                        """
                        INSERT INTO device_state(device_id, status, last_seen, heartbeat_seq, fault_code)
                        VALUES(?, 'ONLINE', ?, ?, NULL)
                        """,
                        (device_id, now, seq),
                    )
                else:
                    seq = heartbeat_seq if heartbeat_seq is not None else int(row["heartbeat_seq"]) + 1
                    conn.execute(
                        """
                        UPDATE device_state
                        SET status='ONLINE', last_seen=?, heartbeat_seq=?
                        WHERE device_id=?
                        """,
                        (now, seq, device_id),
                    )
                conn.commit()
                result = conn.execute(
                    "SELECT device_id, status, last_seen, heartbeat_seq, fault_code FROM device_state WHERE device_id=?",
                    (device_id,),
                ).fetchone()
                return dict(result)
            finally:
                conn.close()

    def ingest_telemetry(
        self,
        *,
        device_id: str,
        status: str | None,
        heartbeat_seq: int | None,
        fault_code: str | None,
    ) -> dict[str, object]:
        with self._lock:
            conn = self._conn()
            try:
                row = conn.execute(
                    "SELECT status, heartbeat_seq FROM device_state WHERE device_id=?", (device_id,)
                ).fetchone()
                now = _now_iso()
                if row is None:
                    final_status = status or "UNKNOWN"
                    seq = heartbeat_seq if heartbeat_seq is not None else 1
                    conn.execute(
                        """
                        INSERT INTO device_state(device_id, status, last_seen, heartbeat_seq, fault_code)
                        VALUES(?, ?, ?, ?, ?)
                        """,
                        (device_id, final_status, now, seq, fault_code),
                    )
                else:
                    final_status = status or row["status"]
                    seq = heartbeat_seq if heartbeat_seq is not None else int(row["heartbeat_seq"]) + 1
                    conn.execute(
                        """
                        UPDATE device_state
                        SET status=?, last_seen=?, heartbeat_seq=?, fault_code=?
                        WHERE device_id=?
                        """,
                        (final_status, now, seq, fault_code, device_id),
                    )
                conn.commit()
                result = conn.execute(
                    "SELECT device_id, status, last_seen, heartbeat_seq, fault_code FROM device_state WHERE device_id=?",
                    (device_id,),
                ).fetchone()
                return dict(result)
            finally:
                conn.close()

    def get_metrics_summary(self) -> dict[str, object]:
        with self._lock:
            snapshot = self.get_snapshot()
            states = snapshot["workstations"]
            total = len(states)
            online = sum(1 for s in states if s["status"] == "ONLINE")
            warning = sum(1 for s in states if s["status"] == "WARNING")
            fault = sum(1 for s in states if s["status"] == "FAULT")
            conn = self._conn()
            try:
                event_total = conn.execute("SELECT COUNT(*) AS c FROM event_log").fetchone()["c"]
                command_total = conn.execute("SELECT COUNT(*) AS c FROM command_log").fetchone()["c"]
            finally:
                conn.close()

            return {
                "updated_at": _now_iso(),
                "device_total": total,
                "online_count": online,
                "warning_count": warning,
                "fault_count": fault,
                "online_rate": round((online / total) * 100, 2) if total else 0.0,
                "event_total": int(event_total or 0),
                "command_total": int(command_total or 0),
            }

    def get_realtime_dashboard_metrics(self, points: int = 12, bucket_seconds: int = 5) -> dict[str, object]:
        safe_points = max(6, min(points, 60))
        safe_bucket = max(1, min(bucket_seconds, 60))
        now = datetime.now(timezone.utc)
        labels: list[str] = []
        starts: list[datetime] = []
        for i in range(safe_points):
            delta = safe_bucket * (safe_points - 1 - i)
            labels.append(f"-{delta}s" if delta > 0 else "now")
            starts.append(now.replace(microsecond=0) - timedelta(seconds=delta))

        conn = self._conn()
        try:
            event_rows = conn.execute("SELECT timestamp, level FROM event_log ORDER BY id DESC LIMIT 2000").fetchall()
            cmd_rows = conn.execute(
                "SELECT created_at, updated_at, status FROM command_log ORDER BY id DESC LIMIT 2000"
            ).fetchall()
        finally:
            conn.close()

        event_times: list[tuple[datetime, str]] = []
        for r in event_rows:
            try:
                t = datetime.fromisoformat(r["timestamp"])
                if t.tzinfo is None:
                    t = t.replace(tzinfo=timezone.utc)
                event_times.append((t, r["level"]))
            except Exception:
                continue

        throughput: list[int] = []
        critical_count = 0
        warn_count = 0
        for idx, start in enumerate(starts):
            end = start + timedelta(seconds=safe_bucket)
            c = 0
            for t, lvl in event_times:
                if start <= t < end:
                    c += 1
                    if idx == len(starts) - 1:
                        if lvl == "CRITICAL":
                            critical_count += 1
                        elif lvl == "WARN":
                            warn_count += 1
            throughput.append(c)

        latency_buckets_sum = [0.0] * safe_points
        latency_buckets_cnt = [0] * safe_points
        for r in cmd_rows:
            try:
                created = datetime.fromisoformat(r["created_at"])
                updated = datetime.fromisoformat(r["updated_at"])
                if created.tzinfo is None:
                    created = created.replace(tzinfo=timezone.utc)
                if updated.tzinfo is None:
                    updated = updated.replace(tzinfo=timezone.utc)
                latency_ms = max(0.0, (updated - created).total_seconds() * 1000.0)
                for i, start in enumerate(starts):
                    end = start + timedelta(seconds=safe_bucket)
                    if start <= created < end:
                        latency_buckets_sum[i] += latency_ms
                        latency_buckets_cnt[i] += 1
                        break
            except Exception:
                continue

        latency: list[float] = []
        for i in range(safe_points):
            if latency_buckets_cnt[i] == 0:
                latency.append(0.0)
            else:
                latency.append(round(latency_buckets_sum[i] / latency_buckets_cnt[i], 2))

        summary = self.get_metrics_summary()
        online_rate = float(summary["online_rate"])
        fault_penalty = min(40.0, float(summary["fault_count"]) * 15.0)
        warn_penalty = min(20.0, float(summary["warning_count"]) * 8.0)
        health_score = max(0.0, min(100.0, online_rate - fault_penalty - warn_penalty))

        return {
            "updated_at": _now_iso(),
            "labels": labels,
            "throughput": throughput,
            "latency_ms": latency,
            "health_score": round(health_score, 2),
            "active_alerts": {
                "critical": critical_count,
                "warn": warn_count,
            },
        }

    def get_command(self, command_id: int) -> dict[str, object] | None:
        with self._lock:
            conn = self._conn()
            try:
                row = conn.execute(
                    """
                    SELECT id, target_device, command, params_json, status, created_at, updated_at
                    FROM command_log
                    WHERE id=?
                    """,
                    (command_id,),
                ).fetchone()
                if row is None:
                    return None
                payload = dict(row)
                payload["params"] = json.loads(payload.pop("params_json") or "null")
                return payload
            finally:
                conn.close()

    def list_commands(self, limit: int = 50, *, status: str | None = None, target_device: str | None = None) -> dict[str, object]:
        safe_limit = max(1, min(limit, 200))
        with self._lock:
            conn = self._conn()
            try:
                where: list[str] = []
                args: list[Any] = []
                if status:
                    where.append("status = ?")
                    args.append(status.lower())
                if target_device:
                    where.append("target_device = ?")
                    args.append(target_device)
                where_sql = f"WHERE {' AND '.join(where)}" if where else ""
                rows = conn.execute(
                    f"""
                    SELECT id, target_device, command, params_json, status, created_at, updated_at
                    FROM command_log
                    {where_sql}
                    ORDER BY id DESC
                    LIMIT ?
                    """,
                    (*args, safe_limit),
                ).fetchall()
                commands: list[dict[str, Any]] = []
                for row in rows:
                    item = dict(row)
                    item["params"] = json.loads(item.pop("params_json") or "null")
                    commands.append(item)
                return {"updated_at": _now_iso(), "commands": commands}
            finally:
                conn.close()

    def update_command_status(self, *, command_id: int, status: str) -> bool:
        with self._lock:
            conn = self._conn()
            try:
                cur = conn.execute(
                    """
                    UPDATE command_log
                    SET status = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (status.lower(), _now_iso(), command_id),
                )
                conn.commit()
                return cur.rowcount > 0
            finally:
                conn.close()

    def apply_command(self, *, target_device: str, command: str, params: dict[str, Any] | None) -> dict[str, object]:
        with self._lock:
            conn = self._conn()
            try:
                row = conn.execute(
                    "SELECT device_id, status, last_seen, heartbeat_seq, fault_code FROM device_state WHERE device_id=?",
                    (target_device,),
                ).fetchone()
                if row is None:
                    raise KeyError(target_device)

                now = _now_iso()
                normalized = command.strip().lower()
                result_status = "ok"
                event_level = "INFO"

                new_status = row["status"]
                new_fault = row["fault_code"]
                new_seq = int(row["heartbeat_seq"]) + 1

                if normalized in {"start_sampling", "sync_config", "reboot", "reset_node"}:
                    new_status = "ONLINE"
                    if normalized in {"reboot", "reset_node"}:
                        new_fault = None
                elif normalized in {"emergency_stop", "stop"}:
                    new_status = "FAULT"
                    new_fault = "EMERGENCY_STOP"
                    event_level = "WARN"
                elif normalized in {"clear_fault", "recover"}:
                    new_status = "ONLINE"
                    new_fault = None
                else:
                    result_status = "ignored"
                    event_level = "WARN"

                conn.execute(
                    """
                    UPDATE device_state
                    SET status=?, last_seen=?, heartbeat_seq=?, fault_code=?
                    WHERE device_id=?
                    """,
                    (new_status, now, new_seq, new_fault, target_device),
                )

                cur = conn.execute(
                    """
                    INSERT INTO command_log(target_device, command, params_json, status, created_at, updated_at)
                    VALUES(?, ?, ?, ?, ?, ?)
                    """,
                    (
                        target_device,
                        command,
                        json.dumps(params, ensure_ascii=False) if params is not None else None,
                        "pending" if result_status == "ok" else "ignored",
                        now,
                        now,
                    ),
                )
                command_id = int(cur.lastrowid)

                event_cur = conn.execute(
                    """
                    INSERT INTO event_log(timestamp, level, title, detail, device_id)
                    VALUES(?, ?, ?, ?, ?)
                    """,
                    (now, event_level, f"Command executed: {command}", f"target={target_device}, params={params or {}}", target_device),
                )
                event_id = int(event_cur.lastrowid)
                conn.commit()

                state = conn.execute(
                    "SELECT device_id, status, last_seen, heartbeat_seq, fault_code FROM device_state WHERE device_id=?",
                    (target_device,),
                ).fetchone()

                return {
                    "status": result_status,
                    "target_device": target_device,
                    "command": command,
                    "applied_at": _now_iso(),
                    "event_id": event_id,
                    "command_id": command_id,
                    "state": dict(state),
                }
            finally:
                conn.close()
