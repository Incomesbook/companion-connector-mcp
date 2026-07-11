param([string]$Endpoint = "http://127.0.0.1:8788/mcp")
$ErrorActionPreference = 'Stop'
$Body = @{ jsonrpc='2.0'; id=1; method='tools/call'; params=@{ name='fable_direct_dashboard'; arguments=@{limit=50} } } | ConvertTo-Json -Depth 20
$Response = Invoke-RestMethod -Uri $Endpoint -Method Post -Body $Body -ContentType 'application/json'
if($Response.error){ throw ($Response.error | ConvertTo-Json -Depth 10) }
$Path = $Response.result.structuredContent.htmlPath
Start-Process $Path
$Response.result.structuredContent | ConvertTo-Json -Depth 20
