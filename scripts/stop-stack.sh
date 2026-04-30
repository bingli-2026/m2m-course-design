#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUN_DIR="$ROOT_DIR/.run"

stop_by_pid_file() {
  local name="$1"
  local file="$2"
  if [[ -f "$file" ]]; then
    local pid
    pid="$(cat "$file")"
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" || true
      sleep 0.5
      kill -9 "$pid" 2>/dev/null || true
      echo "[stop] $name stopped (pid=$pid)"
    fi
    rm -f "$file"
  fi
}

stop_by_pid_file "backend" "$RUN_DIR/backend.pid"
stop_by_pid_file "frontend" "$RUN_DIR/frontend.pid"
