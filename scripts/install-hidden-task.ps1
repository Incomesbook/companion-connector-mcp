param(
  [string]$Port = "8788"
)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$TaskName = "CompanionConnectorHidden"
$Script = Join-Path $Root "scripts\start-background.ps1"
$Pwsh = (Get-Command pwsh -ErrorAction Stop).Source
$Arg = "-NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Script`" -Port $Port"
$Action = New-ScheduledTaskAction -Execute $Pwsh -Argument $Arg -WorkingDirectory $Root
$Trigger = New-ScheduledTaskTrigger -AtLogOn
$Settings = New-ScheduledTaskSettingsSet -Hidden -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Days 0)
Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Start CompanionConnector hidden at logon" -Force | Out-Null
Start-ScheduledTask -TaskName $TaskName
Write-Output "Installed and started scheduled task: $TaskName"
