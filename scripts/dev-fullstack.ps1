#Requires -Version 5.1
<#
.SYNOPSIS
  M2M dev mode: backend (hot reload) + frontend (HMR)
.DESCRIPTION
  Starts uvicorn with --reload on :8080 and Vite dev server on :5173.
  Each service runs in its own window so you can see live output.
  Close both windows to stop.
#>

$ErrorActionPreference = "Stop"

$ROOT_DIR = Split-Path -Parent $PSScriptRoot
$BACKEND_DIR = Join-Path $ROOT_DIR "backend\platform-service"
$FRONTEND_DIR = Join-Path $ROOT_DIR "web\dashboard"

Write-Host "[dev] starting backend on :8080 with reload" -ForegroundColor Cyan
$backendProc = Start-Process -FilePath "cmd" -ArgumentList "/c", "title M2M Backend && cd /d `"$BACKEND_DIR`" && set ENABLE_MQTT=true && set MQTT_HOST=127.0.0.1 && set MQTT_PORT=1883 && uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8080 && pause" -PassThru

Start-Sleep -Seconds 2

Write-Host "[dev] starting frontend on :5173 with HMR" -ForegroundColor Cyan
$frontendProc = Start-Process -FilePath "cmd" -ArgumentList "/c", "title M2M Frontend && cd /d `"$FRONTEND_DIR`" && npm run dev -- --host 0.0.0.0 --port 5173 && pause" -PassThru

Write-Host ""
Write-Host "  backend  : http://127.0.0.1:8080" -ForegroundColor Green
Write-Host "  frontend : http://127.0.0.1:5173" -ForegroundColor Green
Write-Host ""
Write-Host "[dev] both services started. Close the backend/frontend windows to stop." -ForegroundColor Green
