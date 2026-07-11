[CmdletBinding()]
param(
  [Parameter(ValueFromRemainingArguments=$true, Position=0)]
  [string[]]$TaskParts,
  [string]$Task,
  [string]$Context = "",
  [switch]$NoRun,
  [switch]$Strong,
  [switch]$ExecuteSafe,
  [int]$MaxOutputChars = 120000,
  [string]$Endpoint = "http://127.0.0.1:8788/mcp"
)
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
if([string]::IsNullOrWhiteSpace($Task)){
  $Task = ($TaskParts -join ' ').Trim()
}
if([string]::IsNullOrWhiteSpace($Task)){
  throw 'Task text is empty. Example: .\Fable5-Direct.ps1 "your task for Fable5"'
}
$model = if($Strong.IsPresent){ 'qwen2.5:3b' } else { '' }
function Invoke-McpTool($Name, $Arguments){
  $Body = @{
    jsonrpc = '2.0'
    id = [int](Get-Random -Minimum 1000 -Maximum 999999999)
    method = 'tools/call'
    params = @{ name = $Name; arguments = $Arguments }
  } | ConvertTo-Json -Depth 40
  $BodyBytes = [System.Text.Encoding]::UTF8.GetBytes($Body)
$Response = Invoke-RestMethod -Uri $Endpoint -Method Post -Body $BodyBytes -ContentType 'application/json; charset=utf-8'
  if($Response.error){ throw ($Response.error | ConvertTo-Json -Depth 10) }
  return $Response.result.structuredContent
}
$args1 = @{
  task = $Task
  context = $Context
  runNow = (-not $NoRun.IsPresent)
  maxOutputChars = $MaxOutputChars
  decidedBy = 'User'
}
if($model){ $args1.model = $model }
$result = Invoke-McpTool 'fable5' $args1

# Convenience safe executor for common local browser request.
# This is intentionally narrow and logged; all broad automation still goes through MCP tools.
$lower = $Task.ToLowerInvariant()
if($ExecuteSafe.IsPresent -or (($lower -match 'chrome|хром|браузер|browser') -and ($lower -match 'запусти|открой|open|start|launch'))){
  try{
    $action = Invoke-McpTool 'browser_start' @{ url = 'about:blank'; port = 9222 }
    $result | Add-Member -NotePropertyName safeAction -NotePropertyValue $action -Force
  } catch {
    $result | Add-Member -NotePropertyName safeActionError -NotePropertyValue $_.Exception.Message -Force
  }
}
$result | ConvertTo-Json -Depth 40
