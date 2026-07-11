param(
  [string]$Index = "results\ro_content_20260710085101317_dc3cb0b0\content_index.json",
  [string]$Out = "results\fable_micro_full_review_v16",
  [int]$MaxChars = 25000,
  [int]$Timeout = 600,
  [string]$Model = "qwen2.5:3b"
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
New-Item -ItemType Directory -Force -Path $Out | Out-Null
$env:OLLAMA_URL = "http://127.0.0.1:11435/api/chat"
$env:OLLAMA_MODEL = $Model
$stdout = Join-Path $Out "runner.stdout.log"
$stderr = Join-Path $Out "runner.stderr.log"
$cmd = @(
  "-X", "utf8",
  "scripts\run_fable_micro_full_folder_review.py",
  "--index", $Index,
  "--out", $Out,
  "--max-chars", "$MaxChars",
  "--timeout", "$Timeout"
)
$p = Start-Process -FilePath "python" -ArgumentList $cmd -WorkingDirectory $Root -RedirectStandardOutput $stdout -RedirectStandardError $stderr -WindowStyle Hidden -PassThru
$meta = [ordered]@{ ok=$true; pid=$p.Id; out=(Resolve-Path $Out).Path; stdout=$stdout; stderr=$stderr; model=$Model; maxChars=$MaxChars; timeout=$Timeout; startedAt=(Get-Date -Format o) }
$meta | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $Out "run_meta.json") -Encoding UTF8
$meta | ConvertTo-Json
