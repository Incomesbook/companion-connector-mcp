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
