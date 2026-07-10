$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$env:OLLAMA_URL = "http://127.0.0.1:11435/api/chat"
$env:OLLAMA_MODEL = "qwen2.5:0.5b"
$out = Join-Path $Root "results\fable_micro_full_review_ollama_v12"
New-Item -ItemType Directory -Force -Path $out | Out-Null
$log = Join-Path $out "runner.stdout.log"
$err = Join-Path $out "runner.stderr.log"
$args = @("-X","utf8","scripts\run_fable_micro_full_folder_review.py","--index","results\ro_content_20260710085101317_dc3cb0b0\content_index.json","--out","results\fable_micro_full_review_ollama_v12","--max-chars","25000")
$p = Start-Process -FilePath "python" -ArgumentList $args -WorkingDirectory $Root -WindowStyle Hidden -RedirectStandardOutput $log -RedirectStandardError $err -PassThru
@{ pid=$p.Id; out=$out; log=$log; err=$err; startedAt=(Get-Date -Format o); maxChars=25000; model=$env:OLLAMA_MODEL; provider=$env:OLLAMA_URL } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $out "runner_pid.json") -Encoding UTF8
Write-Output "Started V12 full Ollama review PID $($p.Id)"
