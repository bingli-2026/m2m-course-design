#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8080}"
DEVICE_ID="${DEVICE_ID:-terminal-a}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[smoke] missing command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd mosquitto_pub
require_cmd python3

echo "[smoke] checking backend health..."
curl -fsS "$BASE_URL/healthz" >/dev/null

echo "[smoke] ingest telemetry for $DEVICE_ID"
curl -fsS -X POST "$BASE_URL/api/v1/ingest/telemetry" \
  -H 'Content-Type: application/json' \
  -d "{\"device_id\":\"$DEVICE_ID\",\"status\":\"ONLINE\",\"heartbeat_seq\":101,\"fault_code\":null}" >/dev/null

echo "[smoke] create control command"
cmd_resp="$(curl -fsS -X POST "$BASE_URL/api/v1/control/command" \
  -H 'Content-Type: application/json' \
  -d "{\"target_device\":\"$DEVICE_ID\",\"command\":\"start_sampling\",\"params\":{\"rate\":2}}")"

command_id="$(printf '%s' "$cmd_resp" | python3 -c 'import json,sys; print(json.load(sys.stdin)["command_id"])')"
echo "[smoke] command_id=$command_id"

echo "[smoke] publish mqtt ack"
mosquitto_pub -h 127.0.0.1 -t m2m/up/command_ack -m "{\"command_id\":$command_id,\"device_id\":\"$DEVICE_ID\",\"status\":\"acked\",\"detail\":\"smoke-pass\"}" 

sleep 1

echo "[smoke] verify command status"
status="$(curl -fsS "$BASE_URL/api/v1/control/commands/$command_id" | python3 -c 'import json,sys; print(json.load(sys.stdin)["status"])')"
if [[ "$status" != "acked" ]]; then
  echo "[smoke] expected status=acked, got status=$status" >&2
  exit 2
fi

echo "[smoke] verify state contains device"
state_ok="$(curl -fsS "$BASE_URL/api/v1/state" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(any(x.get("device_id")=="'"$DEVICE_ID"'" for x in d.get("workstations",[])))')"
if [[ "$state_ok" != "True" ]]; then
  echo "[smoke] device not found in state snapshot" >&2
  exit 3
fi

echo "[smoke] verify recent events include ack detail"
event_ok="$(curl -fsS "$BASE_URL/api/v1/events?limit=50" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(any("smoke-pass" in (e.get("detail") or "") for e in d.get("events",[])))')"
if [[ "$event_ok" != "True" ]]; then
  echo "[smoke] ack event not found" >&2
  exit 4
fi

echo "[smoke] PASS: telemetry/control/ack/state/events chain is healthy"
