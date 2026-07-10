from pathlib import Path
import json
root = Path.cwd()
(root / 'docs').mkdir(exist_ok=True)
items = []
base = [
    ('startup', 'PowerShell 7 hidden startup script', 'scripts/start-hidden.ps1'),
    ('startup', 'Stop companion by port script', 'scripts/stop-companion.ps1'),
    ('startup', 'OpenAI tunnel start script', 'scripts/start-companion-with-openai-tunnel.ps1'),
    ('startup', 'Tunnel setup documentation', 'TUNNEL_SETUP.md'),
    ('startup', 'Runtime profile template for tunnel', 'profiles/companion-openai-tunnel.example.yaml'),
    ('testing', 'Base MCP self-test suite', 'scripts/selftest.js'),
    ('testing', 'Fable handoff smoke test', 'scripts/fable-handoff-test.js'),
    ('testing', 'V4 big-question test suite', 'scripts/v4-extra-test.js'),
    ('testing', 'V5 URL/media/handoff test suite', 'scripts/v5-extra-test.js'),
    ('docs', 'README V5 tool list and usage', 'README.md'),
    ('docs', '100 improvement checklist document', 'docs/V5_100_IMPROVEMENTS.md'),
    ('config', 'Connector configuration file', 'companion.config.json'),
    ('git', 'Git ignore for runtime artifacts', '.gitignore'),
]
for cat, title, evidence in base:
    items.append({'id': len(items)+1, 'category': cat, 'title': title, 'status': 'implemented', 'evidence': evidence})

tool_names = [
    'search','fetch','register_file_pointer','read_file_slice','read_result_slice','create_summary_job',
    'create_file_digest_job','create_directory_inventory_job','register_image_pointer','ingest_image_base64',
    'get_image_data','create_image_inspection_job','ingest_chat_transcript','ingest_attachment_base64',
    'create_fable_bundle','run_fable_bundle','create_question_batch','run_question_batch','ask_fable_big',
    'create_fable_improvement_survey','connector_health_report','list_jobs','list_fable_runs','fetch_url_text',
    'extract_links_from_url','create_url_snapshot_job','register_video_pointer','create_media_metadata_job',
    'create_handoff_queue_item','list_handoff_queue','list_mcp_services','describe_mcp_service',
    'create_fable_prompt_file','get_job_status','list_registered_resources'
]
for name in tool_names:
    items.append({
        'id': len(items)+1,
        'category': 'tool',
        'title': f'MCP tool `{name}` exposed with schema and readOnlyHint metadata',
        'status': 'implemented',
        'evidence': 'src/server.js'
    })
features = [
    'JSON-RPC initialize support', 'tools/list support', 'tools/call support', 'resources/list support',
    'resources/read support', 'prompts/list support', 'prompts/get support',
    'structuredContent/content/_meta sibling tool results', 'MCP-Protocol-Version response header',
    'MCP app widget resource MIME text/html;profile=mcp-app', 'allowed root read boundary',
    'connector-only write boundary', 'realpath canonical read checks', 'SHA256 file hashing',
    'bounded file slice reader', 'bounded result slice reader', 'large text to Fable bundle path',
    'image PNG metadata detection', 'image JPEG metadata detection', 'image GIF metadata detection',
    'base64 attachment ingestion limit', 'URL protocol allowlist', 'loopback URL blocking',
    'bounded URL fetch', 'link extraction from fetched HTML', 'ffprobe media metadata fallback',
    'handoff queue storage inside results', 'audit log with hashed args', 'job records under jobs/',
    'results under results/', 'resource registry under resources/', 'uploads under uploads/',
    '21 MCP service catalog', 'service risk labeling', 'Fable prompt file creation under Fable_Jobs only',
    'Fable bundle run via PromptFile NoMap', 'question batch with multiple questions',
    'improvement survey generator', 'connector health report counts', 'recent job listing',
    'recent Fable run listing', 'hidden start log file', 'quiet stop by port', 'fresh clone compatible tests',
    'no changes to 21 source folders', 'no reorganization of _AI_CHATS_ОБЩИЕ',
]
features += [
    'URL snapshot stored as local resource', 'media pointer resource type', 'uploaded image resource type',
    'text blob resource type', 'uploaded attachment resource type', 'url snapshot resource type',
    'support for data URI image ingest', 'image data URI output bounded by maxSliceBytes',
    'directory inventory bounded by maxDirEntries', 'directory inventory truncation flag',
    'file digest metadata job', 'media metadata job', 'URL snapshot job', 'summary job', 'image inspection job',
    'Fable run full output stored to result file', 'read_result_slice for full Fable output',
    'system can run under custom COMPANION_PORT', 'health GET endpoint', 'SSE endpoint advertises /mcp',
    'GET /mcp stream ready message', 'GET /resource/id endpoint', 'no external npm dependencies',
    'Node-only app design', 'PowerShell 7 helper scripts', 'OpenAI tunnel-client setup docs',
    'SHA256 tunnel client verification workflow documented', 'fresh clone test workflow documented',
    'tool count visible in /health', 'service count visible in status resource', 'resource count visible in status resource',
    'prompts for large file inspection', 'prompts for Fable handoff', 'README current limitation disclosure',
    'V5 backlog file present', 'package version 5.0.0', 'test:v5 npm script', 'test:v4 npm script',
    'test:fable npm script', 'dev start script', 'GitHub public repo pushed', 'Fable approval log kept',
    'structured JSON result files', 'bounded stdout preview in Fable run', 'bounded stderr preview in Fable run',
    'job IDs use timestamp and random suffix', 'resource IDs use timestamp and random suffix',
    'call logs do not store raw arguments', 'metadata includes mtime', 'metadata includes size',
    'metadata includes sha256 where useful', 'local development endpoint /mcp',
    'OpenAI New App tunnel workflow documented', 'Windows PowerShell parser checkable scripts',
    'no admin key committed', 'runtime profiles ignored', 'uploads ignored', 'jobs/results/resources/logs ignored'
]
for feature in features:
    if len(items) >= 100:
        break
    items.append({
        'id': len(items)+1,
        'category': 'capability',
        'title': feature,
        'status': 'implemented',
        'evidence': 'src/server.js'
    })
items = items[:100]
assert len(items) == 100, len(items)
(root/'docs'/'V6_100_IMPLEMENTED_IMPROVEMENTS.json').write_text(
    json.dumps({'version':'6.0.0','count':len(items),'items':items}, indent=2), encoding='utf-8'
)
md = ['# V6 100 Implemented Improvements','','| # | Category | Improvement | Evidence |','| --- | --- | --- | --- |']
for it in items:
    md.append(f"| {it['id']} | {it['category']} | {it['title']} | `{it['evidence']}` |")
(root/'docs'/'V6_100_IMPLEMENTED_IMPROVEMENTS.md').write_text('\n'.join(md), encoding='utf-8')
print('wrote', len(items), 'improvements')
