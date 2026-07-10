param(
  [string]$Port = "8788"
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Log = Join-Path $Root "logs\hidden-start.log"
New-Item -ItemType Directory -Force -Path (Split-Path $Log -Parent) | Out-Null
$cmd = "cd '$Root'; `$env:COMPANION_PORT='$Port'; npm start *> '$Log'"
Start-Process pwsh -WindowStyle Hidden -ArgumentList @('-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-Command',$cmd)
Write-Output "Companion Connector started hidden on port $Port"
Write-Output "Log: $Log"
