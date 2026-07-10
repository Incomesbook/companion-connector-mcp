# V11 Durable Fable Micro-Reader Status

Goal: make full successful Fable reading of all `research_out` text chunks possible and auditable.

What was added:

- Patched Fable provider router with optional reliable providers:
  - `OPENAI_API_KEY` + `OPENAI_MODEL`
  - `GROQ_API_KEY`
  - local `OLLAMA_URL` + `OLLAMA_MODEL`
  - existing free mirror fallback
- Added resumable micro-reader:
  - `scripts/run_fable_micro_full_folder_review.py`
- It splits the full folder content index into small auditable micro tasks.
- Every task stores:
  - file index
  - relative path
  - chunk number
  - part number
  - byte/character range
  - piece SHA256
  - Fable response
  - ok/fail status

Current verified folder index:

- Source folder: `J:\ПРОЕКТЫ\G01_All_About_Trading\G01_P09_All_for_TradingView\G01_P09_01_Project\TradingView_INDICATORS\IGOR_ENTER2\research_out`
- Files: 907
- Text files: 822
- Binary files: 85
- Original text chunks: 996
- Bytes read: 178,297,503

Micro-reader smoke test:

```json
{
  "ok": false,
  "okCount": 0,
  "failCount": 1,
  "attempted": 1,
  "required": 1,
  "totalTasks": 135237,
  "completeAll": false
}
```

The first micro-task failed because the only currently reachable public mirror returned a network/IP traffic-abnormal message. This proves the micro-reader can detect failure and refuses to mark the read as successful.

How to make it equal to full successful Fable reading:

One of these reliable providers must be available:

1. Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`.
2. Set `GROQ_API_KEY`.
3. Install and run Ollama, then set `OLLAMA_MODEL` if needed.
4. Wait until the public free mirror is no longer blocking this IP.

Then run:

```powershell
cd J:\Setup_VcCode_Workspace\S04_Shared_Connections\S04_02_Shared_MCP_Connections\MCP_Gateway\CompanionConnector
python -X utf8 scripts\run_fable_micro_full_folder_review.py --index "results\ro_content_20260710085101317_dc3cb0b0\content_index.json" --out "results\fable_micro_full_review_final" --max-chars 1000
```

Success condition:

```json
{
  "completeAll": true,
  "okCount": 135237,
  "failCount": 0
}
```

Until that condition is true, the system must not claim that Fable fully read all chunks.
