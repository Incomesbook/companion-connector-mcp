param([string]$Port = "8788")
$lines = netstat -ano | Select-String ":$Port"
$pids = @()
foreach($line in $lines){
  $parts = ($line -split '\s+') | Where-Object { $_ }
  if($parts.Count -gt 0){ $pids += $parts[-1] }
}
$pids = $pids | Sort-Object -Unique
foreach($pid in $pids){
  try { Stop-Process -Id ([int]$pid) -Force; Write-Output "Stopped PID $pid on port $Port" } catch {}
}
if(!$pids){ Write-Output "No listener found on port $Port" }
