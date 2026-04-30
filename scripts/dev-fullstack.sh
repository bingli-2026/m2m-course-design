#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend/platform-service"
FRONTEND_DIR="$ROOT_DIR/web/dashboard"

cleanup() {
  jobs -p | xargs -r kill >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

echo "[dev] starting backend on :8080 with reload"
(
  cd "$BACKEND_DIR"
  ENABLE_MQTT=true DEMO_MODE=true MQTT_HOST=127.0.0.1 MQTT_PORT=1883 uv run uvicorn app.main:app --reload --port 8080
) &

sleep 1

echo "[dev] starting frontend on :5173 with HMR"
(
  cd "$FRONTEND_DIR"
  npm run dev -- --host 0.0.0.0 --port 5173
) &

wait
