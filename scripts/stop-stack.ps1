#Requires -Version 5.1
<#
.SYNOPSIS
  Stops the M2M deploy stack (backend + frontend) started by deploy-stack.ps1
.DESCRIPTION
  Reads PIDs from .run/*.pid, kills the processes, and removes the PID files.
  Also cleans up background logging jobs.
#>

$ErrorActionPreference = "Continue"

$ROOT_DIR = Split-Path -Parent $PSScriptRoot
$RUN_DIR = Join-Path $ROOT_DIR ".run"

function Stop-ByPidFile($name, $pidFile) {
    if (-not (Test-Path $pidFile)) {
        Write-Host "[stop] no pid file: $pidFile" -ForegroundColor DarkGray
        return
    }

    $pidStr = (Get-Content $pidFile -Raw).Trim()
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue

    if (-not $pidStr -or $pidStr -notmatch '^\d+$') {
        Write-Host "[stop] invalid pid in $pidFile" -ForegroundColor DarkGray
        return
    }

    $pid = [int]$pidStr
    $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
    if ($proc) {
        Write-Host "[stop] stopping $name (pid=$pid)..." -ForegroundColor Yellow
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
        Write-Host "[stop] $name stopped" -ForegroundColor Green
    }
    else {
        Write-Host "[stop] $name (pid=$pid) not running" -ForegroundColor DarkGray
    }
}

Stop-ByPidFile "backend" (Join-Path $RUN_DIR "backend.pid")
Stop-ByPidFile "frontend" (Join-Path $RUN_DIR "frontend.pid")

# Clean up logger background jobs
$loggerJobs = Get-Job -Name "m2m-*-logger" -ErrorAction SilentlyContinue
if ($loggerJobs) {
    $loggerJobs | Stop-Job -ErrorAction SilentlyContinue
    $loggerJobs | Remove-Job -ErrorAction SilentlyContinue
}

Write-Host "[stop] done" -ForegroundColor Green
