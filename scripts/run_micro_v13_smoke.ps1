$ErrorActionPreference='Stop'
Set-Location "J:\Setup_VcCode_Workspace\S04_Shared_Connections\S04_02_Shared_MCP_Connections\MCP_Gateway\CompanionConnector"
python -X utf8 scripts\run_fable_micro_full_folder_review.py --index results\ro_content_20260710085101317_dc3cb0b0\content_index.json --out results\fable_micro_smoke_v13 --max-chars 25000 --max-tasks 1 --timeout 240 --retries 1
