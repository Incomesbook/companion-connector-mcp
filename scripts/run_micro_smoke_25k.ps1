$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$env:OLLAMA_URL = "http://127.0.0.1:11435/api/chat"
$env:OLLAMA_MODEL = "qwen2.5:0.5b"
python -X utf8 scripts\run_fable_micro_full_folder_review.py --index "results\ro_content_20260710085101317_dc3cb0b0\content_index.json" --out "results\fable_micro_review_ollama_smoke_25k" --max-chars 25000 --max-tasks 1
