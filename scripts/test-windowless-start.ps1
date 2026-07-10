$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Port = "8798"
& (Join-Path $PSScriptRoot "stop-companion.ps1") -Port $Port | Out-Null
& (Join-Path $PSScriptRoot "start-background.ps1") -Port $Port
Start-Sleep -Seconds 2
$health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 5
if (-not $health.ok) { throw "Health check failed" }
$pidFile = Join-Path $Root "runtime\companion.pid.json"
if (!(Test-Path -LiteralPath $pidFile)) { throw "PID file missing" }
& (Join-Path $PSScriptRoot "stop-companion.ps1") -Port $Port | Out-Null
Write-Output (@{ ok = $true; port = $Port; health = $health } | ConvertTo-Json -Depth 5)
