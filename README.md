# Companion Connector MCP

Local companion MCP-style app for ChatGPT New App custom server connection.

## What it solves

- Big files are referenced by path instead of pasted into chat.
- Long work is represented by job records and bounded result files.
- Screenshots, logs, markdown, JSONL, and other local documents can be registered as resources.
- Source files are not modified by pointer registration.

## Start locally

```powershell
npm start
```

Default endpoint:

```text
http://127.0.0.1:8788/mcp
```

The New App screen can use Tunnel / Server URL pointing to the MCP endpoint.

## Self-test

```powershell
npm test
```

The self-test covers initialize, tools/list, resources/list, pointer registration, search, fetch, bounded slices, summary job, job status, and widget resource MIME.

## Tools

- `search`
- `fetch`
- `register_file_pointer`
- `read_file_slice`
- `create_summary_job`
- `get_job_status`
- `list_registered_resources`

## Safety boundaries

- Reads are restricted to configured allowed roots.
- New connector artifacts stay under the connector workspace.
- Job outputs are bounded and stored in `results/`.
- Tool calls are logged by hash, not full arguments.
- The widget resource uses `text/html;profile=mcp-app`.
