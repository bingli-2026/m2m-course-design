#Requires -Version 5.1
<#
.SYNOPSIS
  M2M end-to-end smoke test: telemetry -> command -> ack -> state -> events
.DESCRIPTION
  Validates the full data loop: posts telemetry, creates a control command,
  publishes an MQTT ack, then verifies command status, device state, and
  event timeline. Set $env:BASE_URL and $env:DEVICE_ID to override defaults.
#>

$ErrorActionPreference = "Stop"

$BASE_URL = if ($env:BASE_URL) { $env:BASE_URL } else { "http://127.0.0.1:8080" }
$DEVICE_ID = if ($env:DEVICE_ID) { $env:DEVICE_ID } else { "terminal-a" }

# ------------------------------------------------------------------
# Check prerequisites
# ------------------------------------------------------------------
$missing = @()
foreach ($cmd in @("mosquitto_pub")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        $missing += $cmd
    }
}
if ($missing.Count -gt 0) {
    Write-Host "[smoke] warning: missing commands: $($missing -join ', ')" -ForegroundColor Yellow
    Write-Host "[smoke] MQTT ack publish will be skipped; backend may still process telemetry/command via HTTP" -ForegroundColor Yellow
}

# ------------------------------------------------------------------
# 1. Health check
# ------------------------------------------------------------------
Write-Host "[smoke] checking backend health..." -ForegroundColor Cyan
try {
    $null = Invoke-RestMethod -Uri "$BASE_URL/healthz" -TimeoutSec 5
    Write-Host "[smoke] backend is healthy" -ForegroundColor Green
}
catch {
    Write-Host "[smoke] backend health check failed: $_" -ForegroundColor Red
    exit 1
}

# ------------------------------------------------------------------
# 2. Ingest telemetry
# ------------------------------------------------------------------
Write-Host "[smoke] ingest telemetry for $DEVICE_ID" -ForegroundColor Cyan
$telemetryBody = @{
    device_id      = $DEVICE_ID
    status         = "ONLINE"
    heartbeat_seq  = 101
    fault_code     = $null
} | ConvertTo-Json

try {
    $null = Invoke-RestMethod -Uri "$BASE_URL/api/v1/ingest/telemetry" `
        -Method Post `
        -ContentType "application/json" `
        -Body $telemetryBody
    Write-Host "[smoke] telemetry ingested" -ForegroundColor Green
}
catch {
    Write-Host "[smoke] telemetry ingest failed: $_" -ForegroundColor Red
    exit 1
}

# ------------------------------------------------------------------
# 3. Create control command
# ------------------------------------------------------------------
Write-Host "[smoke] create control command" -ForegroundColor Cyan
$commandBody = @{
    target_device = $DEVICE_ID
    command       = "start_sampling"
    params        = @{ rate = 2 }
} | ConvertTo-Json

try {
    $cmdResponse = Invoke-RestMethod -Uri "$BASE_URL/api/v1/control/command" `
        -Method Post `
        -ContentType "application/json" `
        -Body $commandBody
    $commandId = $cmdResponse.command_id
    Write-Host "[smoke] command_id=$commandId" -ForegroundColor Green
}
catch {
    Write-Host "[smoke] control command failed: $_" -ForegroundColor Red
    exit 1
}

# ------------------------------------------------------------------
# 4. Publish MQTT ack (optional if mosquitto_pub missing)
# ------------------------------------------------------------------
$mosquittoOk = $true
if (Get-Command mosquitto_pub -ErrorAction SilentlyContinue) {
    Write-Host "[smoke] publish mqtt ack" -ForegroundColor Cyan
    $ackBody = @{
        command_id = $commandId
        device_id  = $DEVICE_ID
        status     = "acked"
        detail     = "smoke-pass"
    } | ConvertTo-Json -Compress

    try {
        & mosquitto_pub -h 127.0.0.1 -t m2m/up/command_ack -m $ackBody
        Write-Host "[smoke] mqtt ack published" -ForegroundColor Green
    }
    catch {
        Write-Host "[smoke] mqtt publish failed: $_" -ForegroundColor Yellow
        $mosquittoOk = $false
    }
}
else {
    Write-Host "[smoke] skipping mqtt ack (mosquitto_pub not found)" -ForegroundColor Yellow
    $mosquittoOk = $false
}

Start-Sleep -Seconds 1

# ------------------------------------------------------------------
# 5. Verify command status
# ------------------------------------------------------------------
Write-Host "[smoke] verify command status" -ForegroundColor Cyan
try {
    $cmdStatus = Invoke-RestMethod -Uri "$BASE_URL/api/v1/control/commands/$commandId" -TimeoutSec 5
    if ($mosquittoOk -and $cmdStatus.status -ne "acked") {
        Write-Host "[smoke] expected status=acked, got status=$($cmdStatus.status)" -ForegroundColor Red
        exit 2
    }
    Write-Host "[smoke] command status: $($cmdStatus.status)" -ForegroundColor Green
}
catch {
    Write-Host "[smoke] command status check failed: $_" -ForegroundColor Red
    exit 1
}

# ------------------------------------------------------------------
# 6. Verify device in state snapshot
# ------------------------------------------------------------------
Write-Host "[smoke] verify state contains device" -ForegroundColor Cyan
try {
    $state = Invoke-RestMethod -Uri "$BASE_URL/api/v1/state" -TimeoutSec 5
    $found = $false
    foreach ($ws in $state.workstations) {
        if ($ws.device_id -eq $DEVICE_ID) {
            $found = $true
            break
        }
    }
    if (-not $found) {
        Write-Host "[smoke] device not found in state snapshot" -ForegroundColor Red
        exit 3
    }
    Write-Host "[smoke] device '$DEVICE_ID' found in state" -ForegroundColor Green
}
catch {
    Write-Host "[smoke] state check failed: $_" -ForegroundColor Red
    exit 1
}

# ------------------------------------------------------------------
# 7. Verify ack event in recent events
# ------------------------------------------------------------------
Write-Host "[smoke] verify recent events include ack detail" -ForegroundColor Cyan
try {
    $events = Invoke-RestMethod -Uri "$BASE_URL/api/v1/events?limit=50" -TimeoutSec 5
    $foundEvent = $false
    foreach ($e in $events.events) {
        if (($e.detail) -and $e.detail -like "*smoke-pass*") {
            $foundEvent = $true
            break
        }
    }
    if ($mosquittoOk -and -not $foundEvent) {
        Write-Host "[smoke] ack event not found" -ForegroundColor Red
        exit 4
    }
    if ($mosquittoOk) {
        Write-Host "[smoke] ack event found" -ForegroundColor Green
    }
    else {
        Write-Host "[smoke] ack event check skipped (mosquitto_pub was unavailable)" -ForegroundColor Yellow
    }
}
catch {
    Write-Host "[smoke] events check failed: $_" -ForegroundColor Red
    exit 1
}

# ------------------------------------------------------------------
Write-Host "`n[smoke] PASS: telemetry/control/ack/state/events chain is healthy" -ForegroundColor Green
