param(
  [Parameter(Mandatory=$true, Position=0)] [string]$Task,
  [string]$Context = "",
  [switch]$NoRun,
  [int]$MaxOutputChars = 120000,
  [string]$Endpoint = "http://127.0.0.1:8788/mcp"
)
$ErrorActionPreference = 'Stop'
$Arguments = @{
  task = $Task
  context = $Context
  runNow = (-not $NoRun.IsPresent)
  maxOutputChars = $MaxOutputChars
  decidedBy = 'User'
}
$Body = @{
  jsonrpc = '2.0'
  id = [int](Get-Random -Minimum 1000 -Maximum 999999999)
  method = 'tools/call'
  params = @{ name = 'fable_direct_submit'; arguments = $Arguments }
} | ConvertTo-Json -Depth 20
$Response = Invoke-RestMethod -Uri $Endpoint -Method Post -Body $Body -ContentType 'application/json'
if($Response.error){ throw ($Response.error | ConvertTo-Json -Depth 10) }
$Result = $Response.result.structuredContent
$Result | ConvertTo-Json -Depth 20
