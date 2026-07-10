$Root = Split-Path -Parent $PSScriptRoot
$out = Join-Path $Root "results\fable_micro_full_review_ollama_v12"
$pidFile = Join-Path $out "runner_pid.json"
$manifest = Join-Path $out "task_manifest.json"
$respDir = Join-Path $out "micro_responses"
$log = Join-Path $out "runner.stdout.log"
$pidInfo = if(Test-Path $pidFile){ Get-Content $pidFile -Raw | ConvertFrom-Json } else { $null }
$total = if(Test-Path $manifest){ (Get-Content $manifest -Raw | ConvertFrom-Json).taskCount } else { $null }
$count = if(Test-Path $respDir){ (Get-ChildItem -LiteralPath $respDir -Filter "task_*.json" -ErrorAction SilentlyContinue | Measure-Object).Count } else { 0 }
$running = $false
if($pidInfo){ $running = [bool](Get-Process -Id $pidInfo.pid -ErrorAction SilentlyContinue) }
$tail = if(Test-Path $log){ Get-Content $log -Tail 10 } else { @() }
[pscustomobject]@{ running=$running; pid=if($pidInfo){$pidInfo.pid}else{$null}; completedTasks=$count; totalTasks=$total; percent=if($total){[math]::Round(($count/$total)*100,2)}else{$null}; out=$out; tail=$tail } | ConvertTo-Json -Depth 6
