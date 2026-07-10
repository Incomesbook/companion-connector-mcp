param([string]$Port = "8788")
$lines = netstat -ano | Select-String ":$Port"
$procIds = @()
foreach($line in $lines){
  $parts = ($line -split '\s+') | Where-Object { $_ }
  if($parts.Count -ge 5 -and $parts[-2] -eq 'LISTENING' -and $parts[-1] -ne '0'){
    $procIds += $parts[-1]
  }
}
$procIds = $procIds | Sort-Object -Unique
foreach($procId in $procIds){
  try {
    Stop-Process -Id ([int]$procId) -Force
    Write-Output "Stopped PID $procId on port $Port"
  } catch {
    Write-Output "Could not stop PID ${procId}: $($_.Exception.Message)"
  }
}
if(!$procIds){ Write-Output "No listener found on port $Port" }
