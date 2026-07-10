$ErrorActionPreference = "Stop"
$Ollama = "C:\Users\IgorK\AppData\Local\Programs\Ollama\ollama.exe"
if (!(Test-Path -LiteralPath $Ollama)) { throw "Ollama not found: $Ollama" }
Stop-Process -Name ollama,llama-server -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
$env:OLLAMA_HOST = "127.0.0.1:11435"
$env:OLLAMA_LLM_LIBRARY = "cpu_avx2"
$p = Start-Process -FilePath $Ollama -ArgumentList "serve" -WindowStyle Hidden -Environment @{ OLLAMA_HOST="127.0.0.1:11435"; OLLAMA_LLM_LIBRARY="cpu_avx2" } -PassThru
Start-Sleep -Seconds 5
@{ pid=$p.Id; url="http://127.0.0.1:11435/api/chat"; model="qwen2.5:0.5b"; library="cpu_avx2"; startedAt=(Get-Date -Format o) } | ConvertTo-Json | Set-Content -LiteralPath "results\ollama_cpu_provider.json" -Encoding UTF8
Write-Output "Ollama CPU provider started PID $($p.Id) at 127.0.0.1:11435"
