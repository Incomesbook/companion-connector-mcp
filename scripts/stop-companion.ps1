param([string]$Port = "8788")
$lines = netstat -ano | Select-String ":$Port"
$procIds = @()
foreach($line in $lines){
  $parts = ($line -split '\s+') | Where-Object { $_ }
  if($parts.Count -gt 0){ $procIds += $parts[-1] }
}
$procIds = $procIds | Sort-Object -Unique
foreach($procId in $procIds){
  try { Stop-Process -Id ([int]$procId) -Force; Write-Output "Stopped PID $procId on port $Port" } catch {}
}
if(!$procIds){ Write-Output "No listener found on port $Port" }
