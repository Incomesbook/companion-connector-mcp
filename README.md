# Companion Connector MCP

Local Companion MCP app for ChatGPT New App custom server connection.

## V3 capabilities

This version is built for large local work, Fable handoff, screenshots/images, and future 21-service routing.

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
- `list_mcp_services`
- `describe_mcp_service`
- `create_fable_prompt_file`
- `get_job_status`
- `list_registered_resources`

## What it solves

- Big files are referenced by path instead of pasted into chat.
- Large questions can be written into local prompt bundles for Fable.
- Attachments can be stored as connector resources.
- Screenshots/images can be registered by path or small base64 payload.
- Fable can be given a bundle prompt file with transcript, attachment pointers, full text sections, image metadata, and hashes.
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

## Self-test

```powershell
npm test
```

V3 self-test covers 23 checks including transcript ingest, attachment ingest, Fable bundle creation, image pointer, base64 image ingest, directory inventory, digest jobs, service catalog, and widget resource MIME.

## Fable handoff test

Start the server, then run:

```powershell
npm run test:fable
```

This creates a local transcript resource, builds a Fable bundle prompt file, calls AskFable through the local wrapper, and stores the full result under `results/`.

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

## Current limitation

The app can ingest transcript text and attachments that are provided to the tool or available as local files. It cannot magically read a private ChatGPT conversation unless ChatGPT exposes that content to the app through a tool call, export, local file, or pasted transcript.
