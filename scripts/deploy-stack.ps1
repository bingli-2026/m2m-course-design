#Requires -Version 5.1
<#
.SYNOPSIS
  M2M production deployment: builds frontend, starts backend + frontend preview
.DESCRIPTION
  Builds the React frontend, then starts backend (uvicorn) and frontend (vite preview)
  as background processes. Writes PID files to .run/ for stop-stack.ps1.
#>

$ErrorActionPreference = "Stop"

$ROOT_DIR = Split-Path -Parent $PSScriptRoot
$BACKEND_DIR = Join-Path $ROOT_DIR "backend\platform-service"
$FRONTEND_DIR = Join-Path $ROOT_DIR "web\dashboard"
$RUN_DIR = Join-Path $ROOT_DIR ".run"

$BACKEND_HOST = if ($env:BACKEND_HOST) { $env:BACKEND_HOST } else { "0.0.0.0" }
$BACKEND_PORT = if ($env:BACKEND_PORT) { $env:BACKEND_PORT } else { "8080" }
$FRONTEND_HOST = if ($env:FRONTEND_HOST) { $env:FRONTEND_HOST } else { "0.0.0.0" }
$FRONTEND_PORT = if ($env:FRONTEND_PORT) { $env:FRONTEND_PORT } else { "4173" }
$MQTT_HOST = if ($env:MQTT_HOST) { $env:MQTT_HOST } else { "127.0.0.1" }
$MQTT_PORT = if ($env:MQTT_PORT) { $env:MQTT_PORT } else { "1883" }

if (-not (Test-Path $RUN_DIR)) {
    New-Item -ItemType Directory -Path $RUN_DIR -Force | Out-Null
}

function Test-Command($cmd) {
    return (Get-Command $cmd -ErrorAction SilentlyContinue) -ne $null
}

foreach ($cmd in @("curl", "uv", "npm")) {
    if (-not (Test-Command $cmd)) {
        Write-Host "[deploy] missing command: $cmd" -ForegroundColor Red
        exit 1
    }
}

# Stop old stack ----------------------------------------------------------
Write-Host "[deploy] stopping old stack if running" -ForegroundColor Cyan
$stopScript = Join-Path $ROOT_DIR "scripts\stop-stack.ps1"
if (Test-Path $stopScript) {
    & powershell -File $stopScript 2>$null
}
Start-Sleep -Seconds 1

# Build frontend ----------------------------------------------------------
Write-Host "[deploy] build frontend" -ForegroundColor Cyan
Push-Location $FRONTEND_DIR
try {
    npm run build 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[deploy] frontend build failed" -ForegroundColor Red
        exit 1
    }
}
finally {
    Pop-Location
}

# Start backend -----------------------------------------------------------
Write-Host "[deploy] start backend :$BACKEND_PORT" -ForegroundColor Cyan
$backendLog = Join-Path $RUN_DIR "backend.log"
$env:ENABLE_MQTT = "true"
$env:MQTT_HOST = $MQTT_HOST
$env:MQTT_PORT = $MQTT_PORT

$backendPsi = New-Object System.Diagnostics.ProcessStartInfo
$backendPsi.FileName = "uv"
$backendPsi.Arguments = "run uvicorn app.main:app --host $BACKEND_HOST --port $BACKEND_PORT"
$backendPsi.WorkingDirectory = $BACKEND_DIR
$backendPsi.UseShellExecute = $false
$backendPsi.RedirectStandardOutput = $true
$backendPsi.RedirectStandardError = $true
$backendPsi.EnvironmentVariables["ENABLE_MQTT"] = "true"
$backendPsi.EnvironmentVariables["MQTT_HOST"] = $MQTT_HOST
$backendPsi.EnvironmentVariables["MQTT_PORT"] = $MQTT_PORT

$backendProc = [System.Diagnostics.Process]::Start($backendPsi)
$backendPid = $backendProc.Id
$backendPid | Out-File -FilePath (Join-Path $RUN_DIR "backend.pid") -NoNewline

# Start a background job to capture output to log file
Start-Job -Name "m2m-backend-logger" -ArgumentList $backendProc, $backendLog -ScriptBlock {
    param($proc, $log)
    # read from stdout/stderr streams and append to log
    while (-not $proc.HasExited) {
        $out = $proc.StandardOutput.ReadLine()
        if ($out) { Add-Content -Path $log -Value $out }
        Start-Sleep -Milliseconds 100
    }
} | Out-Null

Start-Sleep -Seconds 2

# Start frontend preview --------------------------------------------------
Write-Host "[deploy] start frontend preview :$FRONTEND_PORT" -ForegroundColor Cyan
$frontendLog = Join-Path $RUN_DIR "frontend.log"

$frontendPsi = New-Object System.Diagnostics.ProcessStartInfo
$frontendPsi.FileName = "npm"
$frontendPsi.Arguments = "run preview -- --host $FRONTEND_HOST --port $FRONTEND_PORT"
$frontendPsi.WorkingDirectory = $FRONTEND_DIR
$frontendPsi.UseShellExecute = $false
$frontendPsi.RedirectStandardOutput = $true
$frontendPsi.RedirectStandardError = $true

$frontendProc = [System.Diagnostics.Process]::Start($frontendPsi)
$frontendPid = $frontendProc.Id
$frontendPid | Out-File -FilePath (Join-Path $RUN_DIR "frontend.pid") -NoNewline

Start-Job -Name "m2m-frontend-logger" -ArgumentList $frontendProc, $frontendLog -ScriptBlock {
    param($proc, $log)
    while (-not $proc.HasExited) {
        $out = $proc.StandardOutput.ReadLine()
        if ($out) { Add-Content -Path $log -Value $out }
        Start-Sleep -Milliseconds 100
    }
} | Out-Null

Start-Sleep -Seconds 2

# Health check ------------------------------------------------------------
Write-Host "[deploy] health check backend" -ForegroundColor Cyan
try {
    $null = Invoke-RestMethod -Uri "http://127.0.0.1:$BACKEND_PORT/healthz" -TimeoutSec 5
    Write-Host "[deploy] deployed" -ForegroundColor Green
    Write-Host "  backend:  http://127.0.0.1:$BACKEND_PORT"
    Write-Host "  frontend: http://127.0.0.1:$FRONTEND_PORT"
    Write-Host "  logs:     $backendLog, $frontendLog"
}
catch {
    Write-Host "[deploy] health check failed: $_" -ForegroundColor Red
    exit 1
}
