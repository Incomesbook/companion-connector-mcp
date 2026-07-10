import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'companion.config.json'), 'utf8'));
const PORT = Number(process.env.PORT || process.env.COMPANION_PORT || 8788);
const HOST = process.env.HOST || '127.0.0.1';
const jobsDir = path.join(ROOT, 'jobs');
const resultsDir = path.join(ROOT, 'results');
const resourcesDir = path.join(ROOT, 'resources');
const uploadsDir = path.join(ROOT, 'uploads');
const webDir = path.join(ROOT, 'web');
const logsDir = path.join(ROOT, 'logs');
for (const d of [jobsDir, resultsDir, resourcesDir, uploadsDir, webDir, logsDir]) fs.mkdirSync(d, { recursive: true });

const MCP_SERVICE_FOLDERS = ['_Sync-AI-Chat','AI_Bridge_8787','AI_Git_Bridge','ChatGPT_Web_Auto_Reader','Claude_Desktop_And_MCP_Config_C','Codex_Desktop_And_Agent_Config_C','Desktop_Commander_And_Access','Free_Claude_Fable5_Ask','Legacy_GPT_Web_Live_Bridge_45971','Local_Agent_Skills_And_MCP_Settings','NodeJS_And_PowerShell_Runtime_Refs','NPM_Global_And_NPX_MCP_Cache','OmniRoute','PC_And_TradingView_Control','Search_all_API_key','Shared_Connectors_All','Shared_Program_Connections_All','Video_Analyzer_MCP','VidLens_MCP','VSCode_MCP_And_Free_Model_Settings','YouTube_Transcript_MCP'];
function json(res, obj, status = 200, headers = {}) { const body = JSON.stringify(obj); res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), ...headers }); res.end(body); }
function rpc(id, result) { return { jsonrpc: '2.0', id, result }; }
function rpcErr(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } }; }
function safeId(prefix='job') { return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g,'')}_${crypto.randomBytes(4).toString('hex')}`; }
function isInside(child, parent) { const rel = path.relative(path.resolve(parent), path.resolve(child)); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); }
function assertReadable(p) { const real = fs.realpathSync(path.resolve(String(p || ''))); if (!CFG.allowedRoots.some(r => isInside(real, r))) throw new Error('path_not_allowed'); return real; }
function assertWritable(p) { const full = path.resolve(String(p || '')); const realRoot = fs.realpathSync(ROOT); if (!isInside(full, realRoot)) throw new Error('write_path_not_allowed'); return full; }
function argsHash(args) { return crypto.createHash('sha256').update(JSON.stringify(args || {})).digest('hex'); }
function audit(name, args) { fs.appendFileSync(path.join(logsDir, 'calls.log'), JSON.stringify({ ts: new Date().toISOString(), tool: name, argsHash: argsHash(args) }) + '\n'); }
function sha256File(file) { const h = crypto.createHash('sha256'); const fd = fs.openSync(file, 'r'); const buf = Buffer.alloc(1024*1024); let n; while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0,n)); fs.closeSync(fd); return h.digest('hex'); }

function boundedText(file, offset=0, limit=50000) { const full = assertReadable(file); const st = fs.statSync(full); if (!st.isFile()) throw new Error('not_a_file'); const max = Math.min(Number(limit)||50000, Number(CFG.maxSliceBytes)||200000); const start = Math.max(0, Number(offset)||0); const fd = fs.openSync(full, 'r'); const buf = Buffer.alloc(Math.max(0, Math.min(max, st.size - start))); fs.readSync(fd, buf, 0, buf.length, start); fs.closeSync(fd); return { path: full, size: st.size, offset: start, bytes: buf.length, text: buf.toString('utf8') }; }
function writeResult(jobId, name, obj) { const f = assertWritable(path.join(resultsDir, `${jobId}_${name}.json`)); fs.writeFileSync(f, JSON.stringify(obj, null, 2), 'utf8'); return f; }
function recordJob(job) { const f = assertWritable(path.join(jobsDir, `${job.id}.json`)); fs.writeFileSync(f, JSON.stringify(job, null, 2), 'utf8'); return f; }
function toolResult(data, text = null, meta = {}) { return { structuredContent: data, content: [{ type: 'text', text: text ?? JSON.stringify(data) }], _meta: meta }; }
function resourceIndex() { return fs.readdirSync(resourcesDir).filter(x => x.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(resourcesDir, f), 'utf8'))); }
function saveResource(rec) { fs.writeFileSync(assertWritable(path.join(resourcesDir, `${rec.id}.json`)), JSON.stringify(rec, null, 2), 'utf8'); return rec; }
function detectImage(file) { const full = assertReadable(file); const st = fs.statSync(full); const fd = fs.openSync(full, 'r'); const head = Buffer.alloc(Math.min(st.size, 64)); fs.readSync(fd, head, 0, head.length, 0); fs.closeSync(fd); let kind='unknown', width=null, height=null, mime='application/octet-stream'; if (head.slice(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) { kind='png'; mime='image/png'; width=head.readUInt32BE(16); height=head.readUInt32BE(20); } else if (head[0]===0xff && head[1]===0xd8) { kind='jpeg'; mime='image/jpeg'; const b=fs.readFileSync(full); let i=2; while(i<b.length-9){ if(b[i]!==0xff){i++; continue;} const marker=b[i+1]; const len=b.readUInt16BE(i+2); if(marker>=0xc0&&marker<=0xc3){height=b.readUInt16BE(i+5); width=b.readUInt16BE(i+7); break;} i += 2 + len; } } else if (head.slice(0,6).toString()==='GIF87a' || head.slice(0,6).toString()==='GIF89a') { kind='gif'; mime='image/gif'; width=head.readUInt16LE(6); height=head.readUInt16LE(8); } return { path: full, size: st.size, kind, mime, width, height, sha256: sha256File(full) }; }
function safeBase64ToBuffer(data) { const s = String(data || '').replace(/^data:[^;]+;base64,/, ''); const buf = Buffer.from(s, 'base64'); if (buf.length > Number(CFG.maxBase64Bytes || 5000000)) throw new Error('base64_too_large'); return buf; }
function serviceCatalog() { const root = CFG.mcpFoldersRoot; return MCP_SERVICE_FOLDERS.map(name => { const p = path.join(root, name); const exists = fs.existsSync(p); return { service_id: name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,''), folder: name, path: p, exists, risk: /api_key|commander|control|bridge|runtime|powershell|npm/i.test(name) ? 'high' : 'medium', public_surface: 'read_only_status_docs_search_fetch' }; }); }


function ingestText(title, text) {
  const id = safeId('txt');
  const file = assertWritable(path.join(uploadsDir, `${id}.txt`));
  fs.writeFileSync(file, String(text || ''), 'utf8');
  const st = fs.statSync(file);
  return saveResource({ id, title: title || id, path: file, type: 'text_blob', size: st.size, createdAt: new Date().toISOString() });
}
function ingestAttachment(filename, mime, base64) {
  const buf = safeBase64ToBuffer(base64);
  const safeName = String(filename || 'attachment.bin').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 120);
  const id = safeId('att');
  const file = assertWritable(path.join(uploadsDir, `${id}_${safeName}`));
  fs.writeFileSync(file, buf);
  const rec = saveResource({ id, title: safeName, path: file, type: String(mime || '').startsWith('image/') ? 'uploaded_image' : 'uploaded_attachment', mime: mime || 'application/octet-stream', size: buf.length, createdAt: new Date().toISOString() });
  return rec;
}
function isTextLike(file) {
  const ext = path.extname(file).toLowerCase();
  return ['.txt','.md','.json','.jsonl','.csv','.tsv','.js','.ts','.cjs','.mjs','.ps1','.cmd','.bat','.html','.css','.xml','.yaml','.yml','.log'].includes(ext);
}
function readWholeTextBounded(file, maxBytes) {
  const full = assertReadable(file);
  const st = fs.statSync(full);
  const max = Math.max(1, Math.min(Number(maxBytes) || st.size, st.size));
  const fd = fs.openSync(full, 'r');
  const buf = Buffer.alloc(max);
  const n = fs.readSync(fd, buf, 0, max, 0);
  fs.closeSync(fd);
  return { path: full, size: st.size, bytes: n, text: buf.subarray(0, n).toString('utf8'), truncated: n < st.size };
}
function createFableBundle(args = {}) {
  const id = safeId('bundle');
  const dir = assertWritable(path.join(resultsDir, id));
  fs.mkdirSync(dir, { recursive: true });
  const title = args.title || 'Companion Fable bundle';
  const question = args.question || '';
  const maxPerFile = Number(args.maxBytesPerFile || 1000000);
  const includeFullText = args.includeFullText !== false;
  const includeImageData = !!args.includeImageData;
  const files = [];
  const resourceIds = Array.isArray(args.resourceIds) ? args.resourceIds : [];
  const filePaths = Array.isArray(args.filePaths) ? args.filePaths : [];
  for (const rid of resourceIds) { const r = resourceIndex().find(x => x.id === rid); if (r) files.push(r.path); }
  for (const p of filePaths) files.push(p);
  const unique = [...new Set(files)].map(assertReadable);
  const md = [];
  md.push(`ASK_FABLE5 - ${title}`);
  md.push('-NoMap');
  md.push('');
  md.push('Question:');
  md.push(question);
  md.push('');
  md.push('Bundle rules: use the attached local file sections and file paths. Source files are read-only. Ask for exact additional paths if needed.');
  md.push('');
  md.push(`Files: ${unique.length}`);
  for (const file of unique) {
    const st = fs.statSync(file);
    md.push(''); md.push(`## FILE ${file}`); md.push(`size=${st.size} mtime=${st.mtime.toISOString()} sha256=${st.isFile()?sha256File(file):'directory'}`);
    if (st.isFile() && includeFullText && isTextLike(file)) {
      const part = readWholeTextBounded(file, maxPerFile);
      md.push(`included_bytes=${part.bytes} truncated=${part.truncated}`); md.push('```text'); md.push(part.text); md.push('```');
    } else if (st.isFile() && /\.(png|jpe?g|gif)$/i.test(file)) {
      const meta = detectImage(file); md.push(`image_meta=${JSON.stringify(meta)}`);
      if (includeImageData && st.size <= Number(CFG.maxBase64Bytes || 5000000)) md.push(`data_uri=data:${meta.mime};base64,${fs.readFileSync(file).toString('base64')}`);
    } else if (st.isDirectory()) {
      md.push(JSON.stringify(inventoryDir(file, 200), null, 2));
    } else {
      md.push('not_included_binary_or_disabled_full_text');
    }
  }
  const bundlePath = path.join(dir, 'fable_bundle_prompt.md');
  fs.writeFileSync(bundlePath, md.join('\n'), 'utf8');
  const manifest = { id, title, question, bundlePath, files: unique, createdAt: new Date().toISOString() };
  const manifestPath = path.join(dir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  return { bundleId: id, bundlePath, manifestPath, files: unique.length };
}
function runFablePromptFile(promptPath, maxOutputChars = 200000) {
  const full = assertReadable(promptPath);
  const ps1 = 'J:\\Setup_VcCode_Workspace\\S04_Shared_Connections\\S04_03_Shared_Program_Connections\\TOOLS\\AskFable\\Invoke-FableConsult.ps1';
  const r = spawnSync('pwsh', ['-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File', ps1, '-NoMap', '-PromptFile', full, '-MaxOutputChars', String(maxOutputChars), '-PrintFull'], { encoding: 'utf8', timeout: 600000 });
  const id = safeId('fable_run');
  const out = { id, promptPath: full, exitCode: r.status, stdout: r.stdout || '', stderr: r.stderr || '', error: r.error ? String(r.error.message || r.error) : '' };
  const resultPath = writeResult(id, 'fable_run', out);
  return { jobId: id, status: r.status === 0 ? 'completed' : 'failed', resultPath, stdoutPreview: out.stdout.slice(0, 2000), stderrPreview: out.stderr.slice(0, 2000) };
}


function listJobs(limit = 100) {
  return fs.readdirSync(jobsDir).filter(x => x.endsWith('.json')).sort().slice(-Math.min(Number(limit)||100, 500)).map(f => JSON.parse(fs.readFileSync(path.join(jobsDir, f), 'utf8')));
}
function listFableRuns(limit = 100) {
  return fs.readdirSync(resultsDir).filter(x => x.includes('_fable_run.json')).sort().slice(-Math.min(Number(limit)||100, 500)).map(f => {
    const p = path.join(resultsDir, f);
    const o = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { id: o.id, promptPath: o.promptPath, exitCode: o.exitCode, resultPath: p, stdoutBytes: Buffer.byteLength(o.stdout || ''), stderrBytes: Buffer.byteLength(o.stderr || '') };
  });
}

function createQuestionBatch(args = {}) {
  const id = safeId('qbatch');
  const dir = assertWritable(path.join(resultsDir, id));
  fs.mkdirSync(dir, { recursive: true });
  const questions = Array.isArray(args.questions) ? args.questions.map(String) : [String(args.question || '')];
  const context = args.context || '';
  const files = [];
  for (const rid of (Array.isArray(args.resourceIds) ? args.resourceIds : [])) { const r = resourceIndex().find(x => x.id === rid); if (r) files.push(r.path); }
  for (const fp of (Array.isArray(args.filePaths) ? args.filePaths : [])) files.push(fp);
  const unique = [...new Set(files)].map(assertReadable);
  const md = [];
  md.push(`ASK_FABLE5 - Question batch ${args.title || id}`);
  md.push('-NoMap'); md.push(''); md.push('Context:'); md.push(String(context)); md.push('');
  md.push('Questions:'); questions.forEach((q, i) => md.push(`${i + 1}. ${q}`)); md.push('');
  md.push('Attached paths:'); unique.forEach((fp, i) => md.push(`${i + 1}. ${fp}`));
  md.push(''); md.push('Instructions: Answer every question. If a file is referenced, use included text sections or request a follow-up file pointer.');
  for (const fp of unique) {
    const st = fs.statSync(fp); md.push(''); md.push(`## PATH ${fp}`); md.push(`size=${st.size} mtime=${st.mtime.toISOString()}`);
    if (st.isFile() && isTextLike(fp)) { const part = readWholeTextBounded(fp, args.maxBytesPerFile || 250000); md.push(`included_bytes=${part.bytes} truncated=${part.truncated}`); md.push('```text'); md.push(part.text); md.push('```'); }
    else if (st.isFile() && /\.(png|jpe?g|gif)$/i.test(fp)) md.push(`image_meta=${JSON.stringify(detectImage(fp))}`);
  }
  const promptPath = path.join(dir, 'question_batch.md'); fs.writeFileSync(promptPath, md.join('\n'), 'utf8');
  const manifest = { id, title: args.title || id, promptPath, questions, files: unique, createdAt: new Date().toISOString() };
  const manifestPath = path.join(dir, 'manifest.json'); fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  return { batchId: id, promptPath, manifestPath, questions: questions.length, files: unique.length };
}

function connectorHealthReport() {
  return { ok: true, version: '4.0.0', root: ROOT, port: PORT, tools: listTools().length, resources: resourceIndex().length, jobs: fs.readdirSync(jobsDir).filter(x => x.endsWith('.json')).length, results: fs.readdirSync(resultsDir).length, services: serviceCatalog().length, allowedRoots: CFG.allowedRoots, writeRoot: CFG.writeRoot };
}
function createFableImprovementSurvey() {
  const questions = [
    'What communication or handoff problems did you experience with ChatGPT?',
    'What file-transfer or context-transfer problems did you experience?',
    'What should Companion Connector add for very large questions?',
    'What should Companion Connector add for screenshots and attachments?',
    'What should Companion Connector add for many questions in one task?',
    'What should Companion Connector add for reliability and verification?',
    'What should Companion Connector add for future 21-folder MCP services?',
    'What exact tests should prove the next version is ready?'
  ];
  return createQuestionBatch({ title: 'Fable improvement survey', context: 'Please answer as an implementation checklist for the existing Node CompanionConnector. New files only inside CompanionConnector.', questions, filePaths: [path.join(ROOT, 'README.md'), path.join(ROOT, 'src', 'server.js')], maxBytesPerFile: 500000 });
}
function runQuestionBatch(promptPath, maxOutputChars = 300000) { return runFablePromptFile(promptPath, maxOutputChars); }
function askFableBig(args = {}) {
  const batch = createQuestionBatch({ title: args.title || 'Big Fable question', context: args.context || '', question: args.question || '', questions: args.questions || undefined, resourceIds: args.resourceIds || [], filePaths: args.filePaths || [], maxBytesPerFile: args.maxBytesPerFile || 500000 });
  const run = runQuestionBatch(batch.promptPath, args.maxOutputChars || 300000);
  return { ...batch, fableRun: run };
}

function listTools() { return [
 { name:'search', title:'Search companion resources', description:'Search registered resources and job result pointers.', inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'fetch', title:'Fetch companion item', description:'Fetch registered text/image/job resource by id.', inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'register_file_pointer', title:'Register file pointer', description:'Register a local file path without changing the source file.', inputSchema:{type:'object',properties:{filePath:{type:'string'},title:{type:'string'}},required:['filePath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'read_file_slice', title:'Read file slice', description:'Read a bounded UTF-8 slice from an allowed file.', inputSchema:{type:'object',properties:{filePath:{type:'string'},offset:{type:'number'},limit:{type:'number'}},required:['filePath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'read_result_slice', title:'Read result slice', description:'Read a bounded slice from connector result file by path.', inputSchema:{type:'object',properties:{resultPath:{type:'string'},offset:{type:'number'},limit:{type:'number'}},required:['resultPath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'create_summary_job', title:'Create summary job', description:'Create bounded summary job for a large local file.', inputSchema:{type:'object',properties:{filePath:{type:'string'},maxBytes:{type:'number'}},required:['filePath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_file_digest_job', title:'Create file digest job', description:'Create metadata and SHA256 digest job for a local file.', inputSchema:{type:'object',properties:{filePath:{type:'string'}},required:['filePath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_directory_inventory_job', title:'Create directory inventory job', description:'Create bounded inventory for a local directory.', inputSchema:{type:'object',properties:{dirPath:{type:'string'},maxEntries:{type:'number'}},required:['dirPath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'register_image_pointer', title:'Register image pointer', description:'Register PNG/JPEG/GIF image path and metadata.', inputSchema:{type:'object',properties:{filePath:{type:'string'},title:{type:'string'}},required:['filePath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'ingest_image_base64', title:'Ingest image base64', description:'Save a small base64 image into connector uploads and register it.', inputSchema:{type:'object',properties:{base64:{type:'string'},mime:{type:'string'},title:{type:'string'}},required:['base64']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'get_image_data', title:'Get image data', description:'Return registered image metadata and bounded data URI.', inputSchema:{type:'object',properties:{id:{type:'string'},includeData:{type:'boolean'}},required:['id']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'create_image_inspection_job', title:'Create image inspection job', description:'Create metadata/hash inspection job for an image.', inputSchema:{type:'object',properties:{filePath:{type:'string'}},required:['filePath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'list_mcp_services', title:'List MCP services', description:'List the 21 planned MCP service folders.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'describe_mcp_service', title:'Describe MCP service', description:'Describe one planned MCP service folder.', inputSchema:{type:'object',properties:{serviceId:{type:'string'}},required:['serviceId']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'create_fable_prompt_file', title:'Create Fable prompt file', description:'Create a Fable prompt file in Fable_Jobs for later review.', inputSchema:{type:'object',properties:{title:{type:'string'},body:{type:'string'}},required:['title','body']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
  { name:'ingest_chat_transcript', title:'Ingest chat transcript', description:'Store a large chat transcript as a local resource for Fable handoff.', inputSchema:{type:'object',properties:{title:{type:'string'},text:{type:'string'}},required:['text']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'ingest_attachment_base64', title:'Ingest attachment base64', description:'Store a provided attachment payload under connector uploads and register it.', inputSchema:{type:'object',properties:{filename:{type:'string'},mime:{type:'string'},base64:{type:'string'}},required:['base64']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_fable_bundle', title:'Create Fable bundle', description:'Create a large file-backed Fable prompt bundle from resource IDs and file paths.', inputSchema:{type:'object',properties:{title:{type:'string'},question:{type:'string'},resourceIds:{type:'array'},filePaths:{type:'array'},includeFullText:{type:'boolean'},includeImageData:{type:'boolean'},maxBytesPerFile:{type:'number'}},required:['title','question']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'run_fable_bundle', title:'Run Fable bundle', description:'Run AskFable on a prepared bundle prompt file and store the full result.', inputSchema:{type:'object',properties:{bundlePath:{type:'string'},maxOutputChars:{type:'number'}},required:['bundlePath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },

 { name:'create_question_batch', title:'Create question batch', description:'Create a multi-question Fable prompt bundle with attached local resources.', inputSchema:{type:'object',properties:{title:{type:'string'},context:{type:'string'},question:{type:'string'},questions:{type:'array'},resourceIds:{type:'array'},filePaths:{type:'array'},maxBytesPerFile:{type:'number'}},required:['title']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'run_question_batch', title:'Run question batch', description:'Run AskFable on a question batch prompt path.', inputSchema:{type:'object',properties:{promptPath:{type:'string'},maxOutputChars:{type:'number'}},required:['promptPath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'ask_fable_big', title:'Ask Fable big', description:'Create a question batch and run Fable in one call, using file-backed context.', inputSchema:{type:'object',properties:{title:{type:'string'},context:{type:'string'},question:{type:'string'},questions:{type:'array'},resourceIds:{type:'array'},filePaths:{type:'array'},maxBytesPerFile:{type:'number'},maxOutputChars:{type:'number'}},required:['title']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_fable_improvement_survey', title:'Create Fable improvement survey', description:'Create a standard survey asking Fable what to improve next.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'connector_health_report', title:'Connector health report', description:'Return connector capability and artifact counts.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'list_jobs', title:'List jobs', description:'List recent connector job records.', inputSchema:{type:'object',properties:{limit:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'list_fable_runs', title:'List Fable runs', description:'List recent stored Fable run outputs.', inputSchema:{type:'object',properties:{limit:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'get_job_status', title:'Get job status', description:'Read connector job record.', inputSchema:{type:'object',properties:{jobId:{type:'string'}},required:['jobId']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'list_registered_resources', title:'List registered resources', description:'List pointer/image resources created by this connector.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} }
]; }
function searchResources(query) { const q=String(query||'').toLowerCase(); const items=[...resourceIndex().map(r=>({id:r.id,title:r.title||r.id,type:r.type,url:''})),...serviceCatalog().map(s=>({id:s.service_id,title:s.folder,type:'mcp_service',url:''}))].filter(r=>JSON.stringify(r).toLowerCase().includes(q)).slice(0,80); return { results: items }; }

function fetchResource(id) { const item = resourceIndex().find(x => x.id === id); if (!item) throw new Error('not_found'); if (item.type === 'image_pointer' || item.type === 'uploaded_image') return imagePayload(item, false); const slice = boundedText(item.path, 0, 50000); return { id, title:item.title||id, text:slice.text, url:'', metadata:{ path:item.path, type:item.type||'file_pointer', size:String(slice.size), bytes:String(slice.bytes) } }; }
function imagePayload(item, includeData=false) { const meta = detectImage(item.path); const out = { id:item.id, title:item.title||item.id, url:'', metadata:{...meta, path:item.path} }; if (includeData) { const max=Number(CFG.maxSliceBytes||200000); const b=fs.readFileSync(item.path); if (b.length <= max) out.dataUri = `data:${meta.mime};base64,${b.toString('base64')}`; else out.dataNote = `image larger than max inline bytes ${max}`; } return out; }
function makeJob(type, source, result) { const id=safeId('job'); const resultPath=writeResult(id, type, result); const job={id,type,status:'completed',sourcePath:source||'',resultPath,createdAt:new Date().toISOString(),completedAt:new Date().toISOString()}; recordJob(job); return { jobId:id,status:'completed',resultPath}; }
function inventoryDir(dirPath, maxEntries=500) { const root=assertReadable(dirPath); if (!fs.statSync(root).isDirectory()) throw new Error('not_a_directory'); const max=Math.min(Number(maxEntries)||500, Number(CFG.maxDirEntries)||5000); const out=[]; const stack=[root]; while(stack.length && out.length<max){ const dir=stack.pop(); for(const n of fs.readdirSync(dir)){ const p=path.join(dir,n); const st=fs.statSync(p); out.push({path:p,type:st.isDirectory()?'dir':'file',size:st.size,mtime:st.mtime.toISOString()}); if(st.isDirectory() && out.length<max) stack.push(p); if(out.length>=max) break; } } return { root, count:out.length, truncated:out.length>=max, entries:out }; }
async function callTool(name, args={}) {
 if (name==='search') return toolResult(searchResources(args.query));
 if (name==='fetch') return toolResult(fetchResource(args.id));
 if (name==='register_file_pointer') { const full=assertReadable(args.filePath); const st=fs.statSync(full); if(!st.isFile()) throw new Error('not_a_file'); const id=safeId('res'); const rec=saveResource({id,title:args.title||path.basename(full),path:full,type:'file_pointer',size:st.size,createdAt:new Date().toISOString()}); return toolResult({id:rec.id,title:rec.title,size:rec.size,path:rec.path}); }
 if (name==='read_file_slice') return toolResult(boundedText(args.filePath,args.offset,args.limit));
 if (name==='read_result_slice') return toolResult(boundedText(args.resultPath,args.offset,args.limit));
 if (name==='create_summary_job') { const full=assertReadable(args.filePath); const slice=boundedText(full,0,Math.min(Number(args.maxBytes)||100000,Number(CFG.maxSliceBytes)||200000)); const lines=slice.text.split(/\r?\n/); return toolResult(makeJob('summary',full,{path:full,size:slice.size,bytesRead:slice.bytes,lineSampleCount:lines.length,firstLines:lines.slice(0,120),lastLines:lines.slice(-80)})); }
 if (name==='create_file_digest_job') { const full=assertReadable(args.filePath); const st=fs.statSync(full); if(!st.isFile()) throw new Error('not_a_file'); return toolResult(makeJob('digest',full,{path:full,size:st.size,mtime:st.mtime.toISOString(),sha256:sha256File(full)})); }
 if (name==='create_directory_inventory_job') return toolResult(makeJob('directory_inventory',args.dirPath,inventoryDir(args.dirPath,args.maxEntries)));
 if (name==='register_image_pointer') { const meta=detectImage(args.filePath); if(!['png','jpeg','gif'].includes(meta.kind)) throw new Error('unsupported_image'); const id=safeId('img'); const rec=saveResource({id,title:args.title||path.basename(meta.path),path:meta.path,type:'image_pointer',metadata:meta,createdAt:new Date().toISOString()}); return toolResult({id:rec.id,title:rec.title,metadata:meta}); }
 if (name==='ingest_image_base64') { const buf=safeBase64ToBuffer(args.base64); const mime=String(args.mime||'image/png'); const ext=mime.includes('jpeg')?'jpg':mime.includes('gif')?'gif':'png'; const id=safeId('img'); const file=assertWritable(path.join(uploadsDir,`${id}.${ext}`)); fs.writeFileSync(file,buf); const meta=detectImage(file); const rec=saveResource({id,title:args.title||`${id}.${ext}`,path:file,type:'uploaded_image',metadata:meta,createdAt:new Date().toISOString()}); return toolResult({id:rec.id,title:rec.title,metadata:meta}); }
 if (name==='get_image_data') { const item=resourceIndex().find(x=>x.id===args.id); if(!item) throw new Error('not_found'); return toolResult(imagePayload(item,!!args.includeData)); }
 if (name==='create_image_inspection_job') { const meta=detectImage(args.filePath); return toolResult(makeJob('image_inspection',meta.path,meta)); }
 if (name==='list_mcp_services') return toolResult({ services: serviceCatalog() });
 if (name==='describe_mcp_service') { const svc=serviceCatalog().find(s=>s.service_id===args.serviceId||s.folder===args.serviceId); if(!svc) throw new Error('service_not_found'); return toolResult(svc); }
 if (name==='create_fable_prompt_file') { const dir=path.join(CFG.fableJobsRoot,'Jobs'); fs.mkdirSync(dir,{recursive:true}); const id=safeId('fable'); const safeTitle=String(args.title).replace(/[^A-Za-z0-9_\-.]+/g,'_').slice(0,80); const file=path.join(dir,`${id}_${safeTitle}.txt`); fs.writeFileSync(file,`ASK_FABLE5 - ${args.title}\n-NoMap\n\n${args.body}`,'utf8'); return toolResult({promptPath:file}); }
 if (name==='ingest_chat_transcript') { const rec = ingestText(args.title || 'chat transcript', args.text || ''); return toolResult({ id: rec.id, title: rec.title, path: rec.path, size: rec.size }); }
 if (name==='ingest_attachment_base64') { const rec = ingestAttachment(args.filename, args.mime, args.base64); return toolResult({ id: rec.id, title: rec.title, path: rec.path, type: rec.type, size: rec.size }); }
 if (name==='create_fable_bundle') return toolResult(createFableBundle(args));
 if (name==='run_fable_bundle') return toolResult(runFablePromptFile(args.bundlePath, args.maxOutputChars));
 
 if (name==='create_question_batch') return toolResult(createQuestionBatch(args));
 if (name==='run_question_batch') return toolResult(runQuestionBatch(args.promptPath, args.maxOutputChars));
 if (name==='ask_fable_big') return toolResult(askFableBig(args));
 if (name==='create_fable_improvement_survey') return toolResult(createFableImprovementSurvey());
 if (name==='connector_health_report') return toolResult(connectorHealthReport());
 if (name==='list_jobs') return toolResult({ jobs: listJobs(args.limit) });
 if (name==='list_fable_runs') return toolResult({ runs: listFableRuns(args.limit) });
 if (name==='get_job_status') { const f=path.join(jobsDir,`${String(args.jobId)}.json`); if(!fs.existsSync(f)) throw new Error('job_not_found'); return toolResult(JSON.parse(fs.readFileSync(f,'utf8'))); }
 if (name==='list_registered_resources') return toolResult({resources:resourceIndex()});
 throw new Error('unknown_tool');
}

function listResources() { return [ { uri:'companion://status', name:'Companion Connector status', mimeType:'application/json' }, { uri:'ui://companion/dashboard.html', name:'Companion dashboard', mimeType:'text/html;profile=mcp-app' }, { uri:'companion://mcp-services', name:'21 MCP service catalog', mimeType:'application/json' }, ...resourceIndex().map(r=>({uri:`companion://resource/${r.id}`, name:r.title||r.id, mimeType:(r.type||'').includes('image')?'application/json':'text/plain'})) ]; }
function readResource(uri) { if(uri==='companion://status') return {contents:[{uri,mimeType:'application/json',text:JSON.stringify({ok:true,root:ROOT,resources:resourceIndex().length,services:MCP_SERVICE_FOLDERS.length},null,2)}]}; if(uri==='ui://companion/dashboard.html') return {contents:[{uri,mimeType:'text/html;profile=mcp-app',text:fs.readFileSync(path.join(webDir,'dashboard.html'),'utf8')}]}; if(uri==='companion://mcp-services') return {contents:[{uri,mimeType:'application/json',text:JSON.stringify(serviceCatalog(),null,2)}]}; const m=String(uri).match(/^companion:\/\/resource\/(.+)$/); if(m) return {contents:[{uri,mimeType:'application/json',text:JSON.stringify(fetchResource(m[1]),null,2)}]}; throw new Error('resource_not_found'); }
async function handleRpc(msg) { const id=msg.id??null; try { if(msg.method==='initialize') return rpc(id,{protocolVersion:CFG.mcpProtocolVersion||'2025-06-18',capabilities:{tools:{},resources:{},prompts:{}},serverInfo:{name:'companion-connector',version:'4.0.0'}}); if(msg.method==='tools/list') return rpc(id,{tools:listTools()}); if(msg.method==='tools/call'){ const {name,arguments:args}=msg.params||{}; audit(name,args||{}); return rpc(id,await callTool(name,args||{})); } if(msg.method==='resources/list') return rpc(id,{resources:listResources()}); if(msg.method==='resources/read') return rpc(id,readResource(msg.params?.uri)); if(msg.method==='prompts/list') return rpc(id,{prompts:[{name:'inspect_large_file',title:'Inspect large file by pointer'},{name:'handoff_to_fable',title:'Prepare Fable prompt from pointers'}]}); if(msg.method==='prompts/get') return rpc(id,{description:'Use Companion Connector tools for file pointers, jobs, image metadata, and MCP service catalog.',messages:[]}); if(msg.method==='notifications/initialized'||msg.method?.startsWith('notifications/')) return null; return rpcErr(id,-32601,'method_not_found'); } catch(e){ return rpcErr(id,-32000,e.message||'error'); } }
async function readBody(req){ const chunks=[]; for await (const c of req) chunks.push(c); return Buffer.concat(chunks).toString('utf8'); }
const server=http.createServer(async(req,res)=>{ try{ const url=new URL(req.url,`http://${req.headers.host||'localhost'}`); if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/health')) return json(res,{ok:true,name:'companion-connector',version:'4.0.0',port:PORT,mcp:'/mcp',tools:listTools().length}); if(req.method==='GET'&&url.pathname==='/sse'){ res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache',connection:'keep-alive'}); res.write('event: endpoint\ndata: /mcp\n\n'); return; } if(req.method==='GET'&&url.pathname==='/mcp'){ res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache',connection:'keep-alive'}); res.write(`event: message\ndata: ${JSON.stringify({jsonrpc:'2.0',method:'notifications/message',params:{level:'info',data:'companion connector ready'}})}\n\n`); return; } if(req.method==='GET'&&url.pathname.startsWith('/resource/')) return json(res,fetchResource(decodeURIComponent(url.pathname.slice('/resource/'.length)))); if(req.method==='POST'&&(url.pathname==='/mcp'||url.pathname==='/message')){ const body=await readBody(req); const input=body?JSON.parse(body):{}; const out=Array.isArray(input)?(await Promise.all(input.map(handleRpc))).filter(Boolean):await handleRpc(input); if(!out) return json(res,{},202); return json(res,out,200,{'MCP-Protocol-Version':CFG.mcpProtocolVersion||'2025-06-18'}); } return json(res,{error:'not_found'},404); } catch(e){ return json(res,{error:e.message||'server_error'},500); } });
server.listen(PORT,HOST,()=>{ const line=`[${new Date().toISOString()}] companion-connector v2 listening http://${HOST}:${PORT}/mcp\n`; fs.appendFileSync(path.join(logsDir,'server.log'),line); console.log(line.trim()); });




