# Companion Connector MCP

Local Companion MCP app for ChatGPT New App custom server connection.

## V2 capabilities

This version is built for large local work rather than pasted text.

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
- `list_mcp_services`
- `describe_mcp_service`
- `create_fable_prompt_file`
- `get_job_status`
- `list_registered_resources`

## What it solves

- Big files are referenced by path instead of pasted into chat.
- Long work is represented by job records and bounded result files.
- Screenshots/images can be registered by local path or small base64 payload.
- 21 planned MCP service folders are exposed as a service catalog.
- Fable prompt files can be prepared without touching source folders.

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

V2 self-test covers 20 checks including image pointer, base64 image ingest, directory inventory, digest jobs, service catalog, and widget resource MIME.

## Tunnel setup

See `TUNNEL_SETUP.md`.

## Safety boundaries

- Reads are restricted to configured allowed roots.
- Connector writes stay under the connector workspace.
- Source folders are not modified by pointer registration.
- Large outputs are written to `results/` and read by slice.
- Calls are logged by hash, not full arguments.
- Widget resource uses `text/html;profile=mcp-app`.
