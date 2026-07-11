# Companion Connector MCP

Local Companion MCP app for ChatGPT New App custom server connection.

## V5 capabilities

This version is built for large local work, Fable handoff, screenshots/images, URL reading, media metadata, and future 21-service routing.

### Core MCP tools

- `search`
- `fetch`
- `register_file_pointer`
- `read_file_slice`
- `read_result_slice`
- `create_summary_job`
- `create_file_digest_job`
- `create_directory_inventory_job`
- `register_image_pointer`
- `ingest_image_base64`
- `get_image_data`
- `create_image_inspection_job`
- `ingest_chat_transcript`
- `ingest_attachment_base64`
- `create_fable_bundle`
- `run_fable_bundle`

### Fable and batch tools

- `create_question_batch`
- `run_question_batch`
- `ask_fable_big`
- `create_fable_improvement_survey`
- `connector_health_report`
- `list_jobs`
- `list_fable_runs`
- `create_fable_prompt_file`
- `get_job_status`
- `list_registered_resources`

### URL/media/handoff tools

- `fetch_url_text`
- `extract_links_from_url`
- `create_url_snapshot_job`
- `register_video_pointer`
- `create_media_metadata_job`
- `create_handoff_queue_item`
- `list_handoff_queue`
- `list_mcp_services`
- `describe_mcp_service`

## What it solves

- Big files are referenced by path instead of pasted into chat.
- Large questions can be written into local prompt bundles for Fable.
- Multiple questions can be batched into one file-backed request.
- URLs can be fetched into bounded snapshots.
- Links can be extracted from a page.
- Attachments can be stored as connector resources.
- Screenshots/images can be registered by path or small base64 payload.
- Media/video files can be registered and inspected with ffprobe when available.
- Fable can be given a bundle prompt file with transcript, attachment pointers, full text sections, image metadata, media metadata, and hashes.
- 21 planned MCP service folders are exposed as a service catalog.
- Outputs are written to `results/` and read by slice.

## Start locally

```powershell
npm start
```

Default endpoint:

```text
http://127.0.0.1:8788/mcp
```

## Tests

```powershell
npm test
npm run test:fable
npm run test:v4
npm run test:v5
```

## Hidden PowerShell 7 startup

```powershell
.\scripts\start-hidden.ps1
```

Stop by port:

```powershell
.\scripts\stop-companion.ps1
```

## Tunnel setup

See `TUNNEL_SETUP.md`.

## Safety boundaries

- Reads are restricted to configured allowed roots.
- Connector writes stay under the connector workspace.
- Source folders are not modified by pointer registration.
- `_AI_CHATS_ОБЩИЕ` is not reorganized by this app.
- Large outputs are written to `results/` and read by slice.
- Calls are logged by hash, not full arguments.
- Widget resource uses `text/html;profile=mcp-app`.

## V6 additions

V6 adds a verified 100-improvement registry and audit layer:

- `list_implemented_improvements`
- `audit_100_improvements`
- `create_support_bundle`
- `runtime_metrics`
- `validate_connector_config`
- `create_debug_snapshot`

Files:

- `docs/V6_100_IMPLEMENTED_IMPROVEMENTS.md`
- `docs/V6_100_IMPLEMENTED_IMPROVEMENTS.json`

Test:

```powershell
npm run test:v6
```

## V7 no-window startup and 1000 forward improvements

Manual `npm start` no longer keeps a visible server console open. It starts the connector in the background through PowerShell 7.

Best daily start method with no popup:

```powershell
wscript.exe .\CompanionConnector-START-HIDDEN.vbs
```

Or double-click:

```text
CompanionConnector-START-HIDDEN.vbs
```

Install hidden startup at Windows logon:

```powershell
.\scripts\install-hidden-task.ps1
```

Remove hidden startup task:

```powershell
.\scripts\uninstall-hidden-task.ps1
```

V7 also adds a 1000-item forward improvement backlog. It is explicitly not falsely marked as implemented:

- `docs/V7_1000_FORWARD_IMPROVEMENTS.md`
- `docs/V7_1000_FORWARD_IMPROVEMENTS.json`

V7 tests:

```powershell
npm run test:v7
npm run test:windowless
```

## V8 read-only full-folder bridge

V8 adds tools for large read-only folder access without modifying the source folder:

- `folder_explorer`
- `create_readonly_folder_manifest`
- `audit_readonly_folder_manifest`
- `create_readonly_folder_content_bundle`
- `read_folder_bundle_chunk`
- `search_folder_content_bundle`
- `create_fable_folder_handoff`

Tested target:

```text
J:\ПРОЕКТЫ\G01_All_About_Trading\G01_P09_All_for_TradingView\G01_P09_01_Project\TradingView_INDICATORS\IGOR_ENTER2\research_out
```

V8 test:

```powershell
npm run test:v8
```

The source folder is only read. Manifest, chunks, hashes, and Fable guide are written under CompanionConnector `results/`.

## V14 documents, archives, and web snapshots

V14 adds document/archive/web research tools:

- `document_toolchain_report`
- `inspect_document_file`
- `inspect_archive_file`
- `extract_archive_to_results`
- `create_web_snapshot`
- `universal_resource_inspect`

Supported document families include text/HTML/CSV/JSON/code files, DOCX, PPTX, XLSX/XLSM, and PDF when a Python PDF engine is available.

Archives are inspected read-only and extracted only into connector `results/` with path-traversal protection.

Test:

```powershell
npm run test:v14
```

## V15 project research map

V15 adds project-level intake and relationship mapping:

- `create_folder_research_map`
- `inspect_linked_resources_from_file`
- `create_project_intake_bundle`

These tools create Markdown/JSON outputs with file classification, extension counts, URL links, local references, import/include/source-like lines, and research intake summaries.

Test:

```powershell
npm run test:v15
```

## V16 browser, live visual monitor, password archives, advanced charts, stronger Fable model

V16 adds browser/DOM tools, repeated screenshot capture, password archive support,
advanced chart image analysis, local model controls, and durable full Fable micro-read controls.

New V16 tools include:

```text
browser_start
browser_list_tabs
browser_new_tab
browser_navigate
browser_dom_snapshot
browser_screenshot
desktop_screenshot
browser_click_text
browser_type_selector
browser_press_key
browser_live_monitor
inspect_password_archive
extract_password_archive_to_results
analyze_chart_advanced
local_model_status
local_model_pull
local_model_chat_test
start_full_fable_micro_read
get_full_fable_micro_status
```

## V17/V18 human live, semantic index and queue

V17 adds human-style desktop window listing, active-window inspection, focus, desktop screenshots, screen OCR, live watch screenshots, mouse/keyboard actions, and lightweight semantic indexing/search. V18 adds durable queue jobs, queue health, queue execution, cancel, and path safety audit. See docs/V17_V18_HUMAN_LIVE_SEMANTIC_QUEUE_STATUS.md.



## V19 Live Agent Loop

V19 adds a real observe-plan-act loop:

- `live_agent_observe` captures screen, OCR, active window, windows list, and optional browser state.
- `live_agent_fable_plan` asks Fable for a JSON action plan from the observation.
- `live_agent_apply_action` applies one safe allowlisted action, dry-run unless `execute=true`.
- `live_agent_cycle` performs observation, Fable planning, optional action, and an after-snapshot log.

All live-agent cycles write evidence into `results/<sessionId>/`.

## V20 Fable Authority Mode

V20 adds an auditable authority layer so Fable5 decisions are recorded instead of only reported verbally.

New tools:

- `fable_authority_proposal`
- `fable_authority_disagreement`
- `fable_authority_decision_log`
- `fable_authority_dashboard`
- `fable_autopilot_dry_run`
- `fable_autopilot_execute`

Authority outputs:

```text
results\fable_authority\decision_log.jsonl
results\fable_authority\dashboard.json
results\fable_authority\dashboard.html
```

Live-agent proof chain now records observation, Fable plan, executed/dry-run action, next observation, and dashboard evidence.



## V21 Direct Fable5 Inbox

Direct user-to-Fable5 task entry is available through:

```powershell
.\Fable5-Direct.ps1 "Ask Fable5 something directly"
```

Dashboard:

```powershell
.\Fable5-Direct-Dashboard.ps1
```

MCP tools:

- `fable_direct_submit`
- `fable_direct_inbox`
- `fable_direct_read`
- `fable_direct_dashboard`

All direct messages are logged under `results\fable_direct` and mirrored into `results\fable_authority\decision_log.jsonl`.

## V22 Fable5 Direct Mode

New direct route:

- `fable5`
- `fable5_direct_mode_manifest`
- `fable_capability_snapshot`
- `fable_capability_review`
- `fable5_request_chatgpt_help`

Trigger words for a connected ChatGPT app:

```text
FABLE5:
@Fable5
F5:
```

The MCP connection cannot technically replace ChatGPT's base model by itself. The connected app must route these trigger messages to the `fable5` tool. The manifest is exposed at `companion://fable5-direct-mode` and via `fable5_direct_mode_manifest`.

## V23 direct CLI fix

The local direct command now accepts natural multi-argument PowerShell input and preserves UTF-8 Cyrillic text:

```powershell
.\Fable5-Direct.ps1 Yeah. "Запусти новый Хром."
.\Fable5-Direct.ps1 "Запусти новый Хром."
.\Fable5-Direct.ps1 -Strong "сложная задача для Fable5"
```

`-Strong` routes to local `qwen2.5:3b`; default remains the faster Fable path so existing MCP connections do not stall.

See: `docs/V23_DIRECT_CLI_FIX_AND_MODEL_STATUS.md`.
