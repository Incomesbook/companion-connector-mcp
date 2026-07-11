# V21 Direct Fable5 Inbox

V21 adds a direct user-to-Fable5 intake layer on top of V20 Authority Mode.

## Goal

The user can send tasks to Fable5 without asking ChatGPT to relay the text.
Every direct task is still logged through CompanionConnector authority records.

## New MCP tools

- `fable_direct_submit`
- `fable_direct_inbox`
- `fable_direct_read`
- `fable_direct_dashboard`

## Direct command

```powershell
cd "J:\Setup_VcCode_Workspace\S04_Shared_Connections\S04_02_Shared_MCP_Connections\MCP_Gateway\CompanionConnector"
.\Fable5-Direct.ps1 "Your task for Fable5 here"
```

Or:

```cmd
Fable5-Direct.cmd "Your task for Fable5 here"
```
## Dashboard

```powershell
.\Fable5-Direct-Dashboard.ps1
```

Dashboard files:

```text
results\fable_direct\dashboard.json
results\fable_direct\dashboard.html
```

## Logs

Each task creates:

```text
results\fable_direct\<id>.json
results\fable_direct\<id>_prompt.md
results\fable_direct\<id>_reply.txt
```

Authority log also records the direct task:

```text
results\fable_authority\decision_log.jsonl
```

## Safety model

Fable5 can answer directly and propose safe next steps. Execution still goes through CompanionConnector tools and allowlists. Direct inbox does not give uncontrolled write/admin access.
