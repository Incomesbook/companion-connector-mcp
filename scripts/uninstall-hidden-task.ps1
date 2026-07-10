$TaskName = "CompanionConnectorHidden"
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
  Write-Output "Removed scheduled task: $TaskName"
} else {
  Write-Output "Scheduled task not found: $TaskName"
}
