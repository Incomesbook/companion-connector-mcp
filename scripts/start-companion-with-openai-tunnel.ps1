param(
  [string]$TunnelId = $env:CONTROL_PLANE_TUNNEL_ID,
  [string]$Port = "8788",
  [string]$HealthPort = "8789"
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$TunnelExe = Join-Path $Root "tools\tunnel-client-v0.0.10-windows-amd64\tunnel-client.exe"
if (!(Test-Path -LiteralPath $TunnelExe)) {
  Write-Host "Tunnel client not found. Downloading v0.0.10..."
  $Tools = Join-Path $Root "tools"
  New-Item -ItemType Directory -Force -Path $Tools | Out-Null
  Push-Location $Tools
  gh release download v0.0.10 --repo openai/tunnel-client -p "tunnel-client-v0.0.10-windows-amd64.zip" -p "SHA256SUMS.txt" --clobber
  Expand-Archive -Path ".\tunnel-client-v0.0.10-windows-amd64.zip" -DestinationPath ".\tunnel-client-v0.0.10-windows-amd64" -Force
  Pop-Location
}
if (!$TunnelId) { $TunnelId = Read-Host "Paste OpenAI tunnel id, e.g. tunnel_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" }
if (!$env:CONTROL_PLANE_API_KEY) {
  $secure = Read-Host "Paste CONTROL_PLANE_API_KEY runtime key" -AsSecureString
  $env:CONTROL_PLANE_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
}

function Test-CompanionHealth {
  try { Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 2 | Out-Null; return $true }
  catch { return $false }
}
if (!(Test-CompanionHealth)) {
  Write-Host "Starting Companion Connector on port $Port..."
  Start-Process pwsh -ArgumentList @('-NoLogo','-NoProfile','-Command', "cd '$Root'; `$env:COMPANION_PORT='$Port'; npm start") | Out-Null
  Start-Sleep -Seconds 3
}
if (!(Test-CompanionHealth)) { throw "Companion Connector did not become healthy on port $Port" }
$RuntimeDir = Join-Path $Root "profiles\runtime"
New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
$ProfileFile = Join-Path $RuntimeDir "companion-openai-tunnel.runtime.yaml"
@"
config_version: 1
control_plane:
  base_url: "https://api.openai.com"
  tunnel_id: "$TunnelId"
  api_key: "env:CONTROL_PLANE_API_KEY"
health:
  listen_addr: "127.0.0.1:$HealthPort"
admin_ui:
  open_browser: true
log:
  level: info
  format: json
mcp:
  server_urls:
    - channel: main
      url: "http://127.0.0.1:$Port/mcp"
"@ | Set-Content -LiteralPath $ProfileFile -Encoding UTF8
Write-Host "Running tunnel-client doctor..."
& $TunnelExe doctor --profile-file $ProfileFile --explain
if ($LASTEXITCODE -ne 0) { throw "tunnel-client doctor failed. Check tunnel id, runtime key, and permissions." }
Write-Host "Starting OpenAI tunnel-client. Keep this window open."
Write-Host "Local MCP: http://127.0.0.1:$Port/mcp"
Write-Host "Tunnel health UI: http://127.0.0.1:$HealthPort/ui"
& $TunnelExe run --profile-file $ProfileFile
