#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend/platform-service"
FRONTEND_DIR="$ROOT_DIR/web/dashboard"
RUN_DIR="$ROOT_DIR/.run"

BACKEND_HOST="${BACKEND_HOST:-0.0.0.0}"
BACKEND_PORT="${BACKEND_PORT:-8080}"
FRONTEND_HOST="${FRONTEND_HOST:-0.0.0.0}"
FRONTEND_PORT="${FRONTEND_PORT:-4173}"
MQTT_HOST="${MQTT_HOST:-127.0.0.1}"
MQTT_PORT="${MQTT_PORT:-1883}"

mkdir -p "$RUN_DIR"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[deploy] missing command: $1" >&2
    exit 1
  fi
}

require_cmd curl
require_cmd uv
require_cmd npm

if ! curl -fsS "http://${MQTT_HOST}:${MQTT_PORT}" >/dev/null 2>&1; then
  echo "[deploy] mqtt tcp endpoint check skipped (non-http service), continuing..."
fi

echo "[deploy] stopping old stack if running"
bash "$ROOT_DIR/scripts/stop-stack.sh" || true

echo "[deploy] build frontend"
(
  cd "$FRONTEND_DIR"
  npm run build >/dev/null
)

echo "[deploy] start backend :${BACKEND_PORT}"
(
  cd "$BACKEND_DIR"
  nohup env ENABLE_MQTT=true MQTT_HOST="$MQTT_HOST" MQTT_PORT="$MQTT_PORT" \
    uv run uvicorn app.main:app --host "$BACKEND_HOST" --port "$BACKEND_PORT" \
    > "$RUN_DIR/backend.log" 2>&1 &
  echo $! > "$RUN_DIR/backend.pid"
)

sleep 1
echo "[deploy] start frontend preview :${FRONTEND_PORT}"
(
  cd "$FRONTEND_DIR"
  nohup npm run preview -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT" \
    > "$RUN_DIR/frontend.log" 2>&1 &
  echo $! > "$RUN_DIR/frontend.pid"
)

sleep 1

echo "[deploy] health check backend"
curl -fsS "http://127.0.0.1:${BACKEND_PORT}/healthz" >/dev/null

echo "[deploy] deployed"
echo "  backend:  http://127.0.0.1:${BACKEND_PORT}"
echo "  frontend: http://127.0.0.1:${FRONTEND_PORT}"
echo "  logs:     $RUN_DIR/backend.log, $RUN_DIR/frontend.log"
