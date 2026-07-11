param([string]$Out = "results\fable_micro_full_review_v16")
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$metaPath = Join-Path $Out "run_meta.json"
$statusPath = Join-Path $Out "micro_status.json"
$manifestPath = Join-Path $Out "task_manifest.json"
$meta = if(Test-Path $metaPath){Get-Content $metaPath -Raw | ConvertFrom-Json}else{$null}
$status = if(Test-Path $statusPath){Get-Content $statusPath -Raw | ConvertFrom-Json}else{$null}
$manifest = if(Test-Path $manifestPath){Get-Content $manifestPath -Raw | ConvertFrom-Json}else{$null}
$procId = if($meta){$meta.pid}else{$null}
$running = $false
if($procId){ $running = [bool](Get-Process -Id $procId -ErrorAction SilentlyContinue) }
$done = 0
if(Test-Path (Join-Path $Out "micro_responses")){
  $done = (Get-ChildItem -LiteralPath (Join-Path $Out "micro_responses") -Filter "task_*.json" -File -ErrorAction SilentlyContinue | Measure-Object).Count
}
$total = if($manifest){$manifest.taskCount}elseif($status){$status.totalTasks}else{0}
$percent = if($total -gt 0){[math]::Round(($done/$total)*100,2)}else{0}
[pscustomobject]@{ ok=$true; running=$running; pid=$procId; completedTasks=$done; totalTasks=$total; percent=$percent; completeAll=if($status){$status.completeAll}else{$false}; failCount=if($status){$status.failCount}else{$null}; out=(Resolve-Path $Out -ErrorAction SilentlyContinue).Path } | ConvertTo-Json -Depth 5

