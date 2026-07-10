param(
  [string]$Port = "8788"
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $Root "logs"
$RuntimeDir = Join-Path $Root "runtime"
New-Item -ItemType Directory -Force -Path $LogDir,$RuntimeDir | Out-Null
$Already = netstat -ano | Select-String ":$Port" | Select-String "LISTENING"
if ($Already) {
  Set-Content -LiteralPath (Join-Path $RuntimeDir "last-start-hidden.txt") -Value "Already running on port $Port at $(Get-Date -Format o)" -Encoding UTF8
  exit 0
}
$env:COMPANION_PORT = $Port
$Node = (Get-Command node -ErrorAction Stop).Source
$StdOut = Join-Path $LogDir "server.stdout.log"
$StdErr = Join-Path $LogDir "server.stderr.log"
$Args = @("src/server.js")
$proc = Start-Process -FilePath $Node -ArgumentList $Args -WorkingDirectory $Root -WindowStyle Hidden -RedirectStandardOutput $StdOut -RedirectStandardError $StdErr -PassThru
$info = [ordered]@{
  pid = $proc.Id
  port = $Port
  root = $Root
  node = $Node
  startedAt = (Get-Date -Format o)
  stdout = $StdOut
  stderr = $StdErr
}
$info | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $RuntimeDir "companion.pid.json") -Encoding UTF8
Start-Sleep -Milliseconds 700
Set-Content -LiteralPath (Join-Path $RuntimeDir "last-start-hidden.txt") -Value "Started hidden PID $($proc.Id) on port $Port at $(Get-Date -Format o)" -Encoding UTF8
