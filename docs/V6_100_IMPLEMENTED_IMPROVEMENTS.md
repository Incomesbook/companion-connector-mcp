# V6 100 Implemented Improvements

| # | Category | Improvement | Evidence |
| --- | --- | --- | --- |
| 1 | startup | PowerShell 7 hidden startup script | `scripts/start-hidden.ps1` |
| 2 | startup | Stop companion by port script | `scripts/stop-companion.ps1` |
| 3 | startup | OpenAI tunnel start script | `scripts/start-companion-with-openai-tunnel.ps1` |
| 4 | startup | Tunnel setup documentation | `TUNNEL_SETUP.md` |
| 5 | startup | Runtime profile template for tunnel | `profiles/companion-openai-tunnel.example.yaml` |
| 6 | testing | Base MCP self-test suite | `scripts/selftest.js` |
| 7 | testing | Fable handoff smoke test | `scripts/fable-handoff-test.js` |
| 8 | testing | V4 big-question test suite | `scripts/v4-extra-test.js` |
| 9 | testing | V5 URL/media/handoff test suite | `scripts/v5-extra-test.js` |
| 10 | docs | README V5 tool list and usage | `README.md` |
| 11 | docs | 100 improvement checklist document | `docs/V5_100_IMPROVEMENTS.md` |
| 12 | config | Connector configuration file | `companion.config.json` |
| 13 | git | Git ignore for runtime artifacts | `.gitignore` |
| 14 | tool | MCP tool `search` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 15 | tool | MCP tool `fetch` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 16 | tool | MCP tool `register_file_pointer` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 17 | tool | MCP tool `read_file_slice` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 18 | tool | MCP tool `read_result_slice` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 19 | tool | MCP tool `create_summary_job` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 20 | tool | MCP tool `create_file_digest_job` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 21 | tool | MCP tool `create_directory_inventory_job` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 22 | tool | MCP tool `register_image_pointer` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 23 | tool | MCP tool `ingest_image_base64` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 24 | tool | MCP tool `get_image_data` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 25 | tool | MCP tool `create_image_inspection_job` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 26 | tool | MCP tool `ingest_chat_transcript` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 27 | tool | MCP tool `ingest_attachment_base64` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 28 | tool | MCP tool `create_fable_bundle` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 29 | tool | MCP tool `run_fable_bundle` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 30 | tool | MCP tool `create_question_batch` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 31 | tool | MCP tool `run_question_batch` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 32 | tool | MCP tool `ask_fable_big` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 33 | tool | MCP tool `create_fable_improvement_survey` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 34 | tool | MCP tool `connector_health_report` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 35 | tool | MCP tool `list_jobs` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 36 | tool | MCP tool `list_fable_runs` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 37 | tool | MCP tool `fetch_url_text` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 38 | tool | MCP tool `extract_links_from_url` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 39 | tool | MCP tool `create_url_snapshot_job` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 40 | tool | MCP tool `register_video_pointer` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 41 | tool | MCP tool `create_media_metadata_job` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 42 | tool | MCP tool `create_handoff_queue_item` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 43 | tool | MCP tool `list_handoff_queue` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 44 | tool | MCP tool `list_mcp_services` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 45 | tool | MCP tool `describe_mcp_service` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 46 | tool | MCP tool `create_fable_prompt_file` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 47 | tool | MCP tool `get_job_status` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 48 | tool | MCP tool `list_registered_resources` exposed with schema and readOnlyHint metadata | `src/server.js` |
| 49 | capability | JSON-RPC initialize support | `src/server.js` |
| 50 | capability | tools/list support | `src/server.js` |
| 51 | capability | tools/call support | `src/server.js` |
| 52 | capability | resources/list support | `src/server.js` |
| 53 | capability | resources/read support | `src/server.js` |
| 54 | capability | prompts/list support | `src/server.js` |
| 55 | capability | prompts/get support | `src/server.js` |
| 56 | capability | structuredContent/content/_meta sibling tool results | `src/server.js` |
| 57 | capability | MCP-Protocol-Version response header | `src/server.js` |
| 58 | capability | MCP app widget resource MIME text/html;profile=mcp-app | `src/server.js` |
| 59 | capability | allowed root read boundary | `src/server.js` |
| 60 | capability | connector-only write boundary | `src/server.js` |
| 61 | capability | realpath canonical read checks | `src/server.js` |
| 62 | capability | SHA256 file hashing | `src/server.js` |
| 63 | capability | bounded file slice reader | `src/server.js` |
| 64 | capability | bounded result slice reader | `src/server.js` |
| 65 | capability | large text to Fable bundle path | `src/server.js` |
| 66 | capability | image PNG metadata detection | `src/server.js` |
| 67 | capability | image JPEG metadata detection | `src/server.js` |
| 68 | capability | image GIF metadata detection | `src/server.js` |
| 69 | capability | base64 attachment ingestion limit | `src/server.js` |
| 70 | capability | URL protocol allowlist | `src/server.js` |
| 71 | capability | loopback URL blocking | `src/server.js` |
| 72 | capability | bounded URL fetch | `src/server.js` |
| 73 | capability | link extraction from fetched HTML | `src/server.js` |
| 74 | capability | ffprobe media metadata fallback | `src/server.js` |
| 75 | capability | handoff queue storage inside results | `src/server.js` |
| 76 | capability | audit log with hashed args | `src/server.js` |
| 77 | capability | job records under jobs/ | `src/server.js` |
| 78 | capability | results under results/ | `src/server.js` |
| 79 | capability | resource registry under resources/ | `src/server.js` |
| 80 | capability | uploads under uploads/ | `src/server.js` |
| 81 | capability | 21 MCP service catalog | `src/server.js` |
| 82 | capability | service risk labeling | `src/server.js` |
| 83 | capability | Fable prompt file creation under Fable_Jobs only | `src/server.js` |
| 84 | capability | Fable bundle run via PromptFile NoMap | `src/server.js` |
| 85 | capability | question batch with multiple questions | `src/server.js` |
| 86 | capability | improvement survey generator | `src/server.js` |
| 87 | capability | connector health report counts | `src/server.js` |
| 88 | capability | recent job listing | `src/server.js` |
| 89 | capability | recent Fable run listing | `src/server.js` |
| 90 | capability | hidden start log file | `src/server.js` |
| 91 | capability | quiet stop by port | `src/server.js` |
| 92 | capability | fresh clone compatible tests | `src/server.js` |
| 93 | capability | no changes to 21 source folders | `src/server.js` |
| 94 | capability | no reorganization of _AI_CHATS_ОБЩИЕ | `src/server.js` |
| 95 | capability | URL snapshot stored as local resource | `src/server.js` |
| 96 | capability | media pointer resource type | `src/server.js` |
| 97 | capability | uploaded image resource type | `src/server.js` |
| 98 | capability | text blob resource type | `src/server.js` |
| 99 | capability | uploaded attachment resource type | `src/server.js` |
| 100 | capability | url snapshot resource type | `src/server.js` |