import http from 'node:http';
import https from 'node:https';
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
function assertReadable(p) { const real = fs.realpathSync(path.resolve(String(p || ''))); const cfgOk = CFG.allowedRoots.some(r => isInside(real, r)); const driveOk = discoverReadableRoots().some(r => r.readable && isInside(real, r.root)); if (!cfgOk && !driveOk) throw new Error('path_not_allowed'); return real; }
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


function ensureUrlAllowed(rawUrl) {
  const u = new URL(String(rawUrl));
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('url_protocol_not_allowed');
  if (['localhost','127.0.0.1','0.0.0.0','::1'].includes(u.hostname)) throw new Error('loopback_url_blocked');
  return u.toString();
}
async function fetchUrlLimited(rawUrl, limit = 300000) {
  const url = ensureUrlAllowed(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow', headers: { 'user-agent': 'CompanionConnector/5.0' } });
    const contentType = res.headers.get('content-type') || '';
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab).subarray(0, Math.min(Number(limit)||300000, Number(CFG.maxSliceBytes)||200000));
    return { url, status: res.status, contentType, bytes: buf.length, truncated: Buffer.byteLength(Buffer.from(ab)) > buf.length, text: buf.toString('utf8') };
  } finally { clearTimeout(timer); }
}
function extractLinks(html, baseUrl) {
  const out = [];
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m; while ((m = re.exec(String(html))) && out.length < 200) {
    try { out.push({ url: new URL(m[1], baseUrl).toString(), text: String(m[2]).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,200) }); } catch {}
  }
  return out;
}
async function createUrlSnapshot(args = {}) {
  const snap = await fetchUrlLimited(args.url, args.limit || 300000);
  const id = safeId('url');
  const f = assertWritable(path.join(uploadsDir, `${id}.txt`));
  fs.writeFileSync(f, snap.text, 'utf8');
  saveResource({ id, title: args.title || snap.url, path: f, type: 'url_snapshot', url: snap.url, status: snap.status, contentType: snap.contentType, createdAt: new Date().toISOString() });
  return { id, url: snap.url, status: snap.status, contentType: snap.contentType, bytes: snap.bytes, truncated: snap.truncated, links: extractLinks(snap.text, snap.url).slice(0, 50) };
}
function mediaMetadata(filePath) {
  const full = assertReadable(filePath);
  const st = fs.statSync(full);
  if (!st.isFile()) throw new Error('not_a_file');
  const base = { path: full, size: st.size, mtime: st.mtime.toISOString(), sha256: sha256File(full), ext: path.extname(full).toLowerCase() };
  const ff = spawnSync('ffprobe', ['-v','error','-show_format','-show_streams','-print_format','json', full], { encoding:'utf8', timeout:30000 });
  if (ff.status === 0 && ff.stdout) {
    try { return { ...base, ffprobeAvailable: true, ffprobe: JSON.parse(ff.stdout) }; } catch { return { ...base, ffprobeAvailable: true, raw: ff.stdout.slice(0,10000) }; }
  }
  return { ...base, ffprobeAvailable: false, note: 'ffprobe not available or failed', stderr: (ff.stderr || '').slice(0,1000) };
}
function createHandoffQueueItem(args = {}) {
  const id = safeId('handoff');
  const dir = assertWritable(path.join(resultsDir, 'handoff_queue'));
  fs.mkdirSync(dir, { recursive: true });
  const item = { id, status: 'queued', title: args.title || id, body: args.body || '', resourceIds: args.resourceIds || [], filePaths: args.filePaths || [], createdAt: new Date().toISOString() };
  const file = path.join(dir, `${id}.json`);
  fs.writeFileSync(file, JSON.stringify(item, null, 2), 'utf8');
  return { id, queuePath: file, status: item.status };
}
function listHandoffQueue(limit = 100) {
  const dir = path.join(resultsDir, 'handoff_queue');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(x=>x.endsWith('.json')).sort().slice(-Math.min(Number(limit)||100,500)).map(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')));
}


function loadImplementedImprovements() {
  const f = path.join(ROOT, 'docs', 'V6_100_IMPLEMENTED_IMPROVEMENTS.json');
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
function auditImplementedImprovements() {
  const data = loadImplementedImprovements();
  const missing = [];
  for (const item of data.items || []) {
    const ev = item.evidence;
    if (ev && !ev.includes('src/server.js') && !fs.existsSync(path.join(ROOT, ev))) missing.push({ id: item.id, evidence: ev });
  }
  return { ok: data.count >= 100 && missing.length === 0, count: data.count, missingEvidence: missing };
}
function createSupportBundle(args = {}) {
  const id = safeId('support');
  const dir = assertWritable(path.join(resultsDir, id));
  fs.mkdirSync(dir, { recursive: true });
  const files = ['package.json','README.md','companion.config.json','docs/V6_100_IMPLEMENTED_IMPROVEMENTS.json'];
  const manifest = { id, createdAt: new Date().toISOString(), health: connectorHealthReport(), improvements: auditImplementedImprovements(), files: [] };
  for (const rel of files) {
    const src = path.join(ROOT, rel);
    if (fs.existsSync(src)) {
      const dst = path.join(dir, rel.replace(/[\\/:]+/g, '_'));
      fs.copyFileSync(src, dst);
      manifest.files.push({ source: src, copy: dst, size: fs.statSync(dst).size });
    }
  }
  const manifestPath = path.join(dir, 'support_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  return { supportId: id, manifestPath, fileCount: manifest.files.length };
}
function runtimeMetrics() {
  const mem = process.memoryUsage();
  return { pid: process.pid, uptimeSec: Math.round(process.uptime()), node: process.version, platform: process.platform, arch: process.arch, memory: mem, version: '6.0.0' };
}
function validateConnectorConfig() {
  const required = ['allowedRoots','writeRoot','maxSliceBytes','mcpProtocolVersion'];
  const missing = required.filter(k => !(k in CFG));
  return { ok: missing.length === 0, missing, keys: Object.keys(CFG).sort() };
}
function createDebugSnapshot() {
  const id = safeId('debug');
  const data = { id, createdAt: new Date().toISOString(), metrics: runtimeMetrics(), config: validateConnectorConfig(), health: connectorHealthReport(), improvements: auditImplementedImprovements() };
  const resultPath = writeResult(id, 'debug_snapshot', data);
  return { snapshotId: id, resultPath };
}


function loadForwardImprovements(limit = 1000) {
  const f = path.join(ROOT, 'docs', 'V7_1000_FORWARD_IMPROVEMENTS.json');
  const data = JSON.parse(fs.readFileSync(f, 'utf8'));
  const n = Math.min(Number(limit)||1000, 1000);
  return { ...data, items: data.items.slice(0, n) };
}
function auditForwardImprovements() {
  const data = loadForwardImprovements(1000);
  const ids = new Set(data.items.map(x => x.id));
  const categories = new Set(data.items.map(x => x.category));
  return { ok: data.count === 1000 && ids.size === 1000 && categories.size >= 10 && data.type.includes('not_claimed_implemented'), count: data.count, uniqueIds: ids.size, categories: categories.size, type: data.type };
}
function noWindowStartupInfo() {
  const files = ['CompanionConnector-START-HIDDEN.vbs','scripts/start-background.ps1','scripts/install-hidden-task.ps1','scripts/uninstall-hidden-task.ps1','scripts/stop-companion.ps1'];
  return { ok: files.every(f => fs.existsSync(path.join(ROOT, f))), files: files.map(f => ({ path: path.join(ROOT, f), exists: fs.existsSync(path.join(ROOT, f)) })), recommended: 'Double-click CompanionConnector-START-HIDDEN.vbs or install scripts/install-hidden-task.ps1. Do not use manual npm start for daily use.' };
}
function createStartupShortcutInfo() {
  return { shortcut: path.join(ROOT, 'CompanionConnector-START-HIDDEN.vbs'), taskInstall: path.join(ROOT, 'scripts', 'install-hidden-task.ps1'), stop: path.join(ROOT, 'scripts', 'stop-companion.ps1') };
}


const TEXT_EXTS = new Set(['.txt','.md','.json','.jsonl','.csv','.tsv','.js','.ts','.cjs','.mjs','.ps1','.cmd','.bat','.html','.htm','.css','.xml','.yaml','.yml','.log','.pine','.pinescript','.sql','.ini','.cfg','.conf','.map']);
function relUnix(root, p) { return path.relative(root, p).replace(/\\/g, '/'); }
function isProbablyTextBuffer(buf) {
  if (!buf || buf.length === 0) return true;
  let zeros = 0;
  const n = Math.min(buf.length, 4096);
  for (let i=0;i<n;i++) if (buf[i] === 0) zeros++;
  return zeros === 0;
}
function walkFolderReadOnly(folderPath, maxFiles = 1000000) {
  const root = assertReadable(folderPath);
  const st = fs.statSync(root);
  if (!st.isDirectory()) throw new Error('not_a_directory');
  const files = [];
  const dirs = [];
  const skipped = [];
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    dirs.push({ path: dir, rel: relUnix(root, dir), mtime: fs.statSync(dir).mtime.toISOString() });
    let names = [];
    try { names = fs.readdirSync(dir); } catch(e) { skipped.push({ path: dir, reason: e.message }); continue; }
    for (const name of names) {
      const p = path.join(dir, name);
      let lst;
      try { lst = fs.lstatSync(p); } catch(e) { skipped.push({ path: p, reason: e.message }); continue; }
      if (lst.isSymbolicLink()) { skipped.push({ path: p, rel: relUnix(root,p), type:'symlink', reason:'symlink_skipped_readonly_safety' }); continue; }
      if (lst.isDirectory()) stack.push(p);
      else if (lst.isFile()) {
        if (files.length >= Number(maxFiles)) throw new Error('max_files_exceeded');
        const ext = path.extname(p).toLowerCase();
        const sha256 = sha256File(p);
        files.push({ index: files.length, path: p, rel: relUnix(root,p), name, ext, size: lst.size, mtime: lst.mtime.toISOString(), sha256, textByExt: TEXT_EXTS.has(ext) });
      }
    }
  }
  return { root, files, dirs, skipped };
}


function createReadOnlyFolderManifest(args = {}) {
  const tree = walkFolderReadOnly(args.folderPath, args.maxFiles || 1000000);
  const id = safeId('ro_folder');
  const dir = assertWritable(path.join(resultsDir, id));
  fs.mkdirSync(dir, { recursive: true });
  const manifest = { id, createdAt: new Date().toISOString(), mode: 'read_only_no_source_mutation', root: tree.root, fileCount: tree.files.length, dirCount: tree.dirs.length, skippedCount: tree.skipped.length, totalBytes: tree.files.reduce((a,b)=>a+b.size,0), files: tree.files, dirs: tree.dirs, skipped: tree.skipped };
  const manifestPath = path.join(dir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  const jsonlPath = path.join(dir, 'inventory.jsonl');
  fs.writeFileSync(jsonlPath, tree.files.map(x => JSON.stringify(x)).join('\n'), 'utf8');
  const schemaPath = path.join(dir, 'inventory_schema.json');
  fs.writeFileSync(schemaPath, JSON.stringify({ type:'object', required:['path','rel','size','mtime','sha256'], properties:{ path:{type:'string'}, rel:{type:'string'}, size:{type:'number'}, mtime:{type:'string'}, sha256:{type:'string'} } }, null, 2), 'utf8');
  const reportPath = path.join(dir, 'report.md');
  fs.writeFileSync(reportPath, `# Read-only folder manifest\n\nRoot: ${tree.root}\nFiles: ${tree.files.length}\nDirs: ${tree.dirs.length}\nBytes: ${manifest.totalBytes}\nSkipped: ${tree.skipped.length}\nMode: read-only source; no writes to source folder.\n`, 'utf8');
  return { folderBridgeId: id, root: tree.root, manifestPath, jsonlPath, schemaPath, reportPath, fileCount: manifest.fileCount, dirCount: manifest.dirCount, totalBytes: manifest.totalBytes, skippedCount: manifest.skippedCount };
}
function auditReadOnlyFolderManifest(args = {}) {
  const m = JSON.parse(fs.readFileSync(assertReadable(args.manifestPath), 'utf8'));
  const mismatches = [];
  let checked = 0;
  for (const f of m.files || []) {
    checked++;
    try {
      const st = fs.statSync(f.path);
      if (!st.isFile()) mismatches.push({ rel:f.rel, reason:'not_file' });
      else if (st.size !== f.size) mismatches.push({ rel:f.rel, reason:'size_changed', was:f.size, now:st.size });
      else if (sha256File(f.path) !== f.sha256) mismatches.push({ rel:f.rel, reason:'hash_changed' });
    } catch(e) { mismatches.push({ rel:f.rel, reason:e.message }); }
  }
  return { ok: mismatches.length === 0, checked, mismatches: mismatches.slice(0,100), mismatchCount: mismatches.length, sourceRoot: m.root };
}


function createReadOnlyFolderContentBundle(args = {}) {
  const manifestInfo = args.manifestPath ? null : createReadOnlyFolderManifest(args);
  const manifestPath = args.manifestPath ? assertReadable(args.manifestPath) : manifestInfo.manifestPath;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const id = safeId('ro_content');
  const dir = assertWritable(path.join(resultsDir, id));
  const chunksDir = path.join(dir, 'chunks');
  fs.mkdirSync(chunksDir, { recursive: true });
  const chunkChars = Math.max(1000, Number(args.chunkChars || 500000));
  const index = { id, createdAt: new Date().toISOString(), sourceManifestPath: manifestPath, root: manifest.root, files: [], totalChunks: 0, textFileCount: 0, binaryFileCount: 0, bytesRead: 0, mode:'read_all_files_readonly_source_write_chunks_to_connector_results' };
  for (const f of manifest.files || []) {
    const ext = path.extname(f.path).toLowerCase();
    let rec = { index: f.index, rel: f.rel, path: f.path, size: f.size, sha256: f.sha256, mtime: f.mtime, ext, chunks: [], readStatus: 'metadata_only' };
    const buf = fs.readFileSync(f.path);
    index.bytesRead += buf.length;
    const textLike = TEXT_EXTS.has(ext) || isProbablyTextBuffer(buf.subarray(0, Math.min(buf.length, 4096)));
    if (textLike) {
      const text = buf.toString('utf8');
      rec.readStatus = 'full_text_chunked';
      for (let off = 0, c = 0; off < text.length; off += chunkChars, c++) {
        const chunkText = text.slice(off, off + chunkChars);
        const chunkFile = path.join(chunksDir, `file_${String(f.index).padStart(6,'0')}_chunk_${String(c).padStart(4,'0')}.txt`);
        fs.writeFileSync(chunkFile, chunkText, 'utf8');
        rec.chunks.push({ chunk: c, path: chunkFile, chars: chunkText.length, start: off, end: off + chunkText.length });
      }
      index.textFileCount++;
      index.totalChunks += rec.chunks.length;
    } else {
      rec.readStatus = 'binary_read_hash_verified';
      index.binaryFileCount++;
    }
    index.files.push(rec);
  }
  const indexPath = path.join(dir, 'content_index.json');
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
  const guidePath = path.join(dir, 'FABLE_ACCESS_GUIDE.md');
  const lines = [`# Fable read-only folder access guide`, ``, `Root: ${manifest.root}`, `Files: ${index.files.length}`, `Text files chunked: ${index.textFileCount}`, `Binary files hash-verified: ${index.binaryFileCount}`, `Chunks: ${index.totalChunks}`, `Bytes read from source: ${index.bytesRead}`, ``, `Use content_index.json and chunk files to read full text content. Source folder is read-only and was not modified.`, ``];
  for (const f of index.files) { lines.push(`- [${f.index}] ${f.rel} :: ${f.readStatus} :: chunks=${f.chunks.length} :: sha256=${f.sha256}`); }
  fs.writeFileSync(guidePath, lines.join('\n'), 'utf8');
  return { contentBridgeId: id, indexPath, guidePath, chunksDir, fileCount: index.files.length, textFileCount: index.textFileCount, binaryFileCount: index.binaryFileCount, totalChunks: index.totalChunks, bytesRead: index.bytesRead };
}
function readFolderBundleChunk(args = {}) {
  const idx = JSON.parse(fs.readFileSync(assertReadable(args.indexPath), 'utf8'));
  const fileRec = idx.files.find(x => x.rel === args.rel || x.index === args.fileIndex);
  if (!fileRec) throw new Error('file_not_found_in_bundle');
  const c = fileRec.chunks.find(x => x.chunk === Number(args.chunk || 0));
  if (!c) throw new Error('chunk_not_found');
  return { rel: fileRec.rel, fileIndex: fileRec.index, chunk: c.chunk, totalChunks: fileRec.chunks.length, text: fs.readFileSync(assertReadable(c.path), 'utf8'), chunkPath: c.path };
}


function searchFolderContentBundle(args = {}) {
  const idx = JSON.parse(fs.readFileSync(assertReadable(args.indexPath), 'utf8'));
  const q = String(args.query || '').toLowerCase();
  const max = Math.min(Number(args.maxResults || 50), 500);
  const results = [];
  for (const f of idx.files) {
    if (f.rel.toLowerCase().includes(q)) results.push({ rel:f.rel, fileIndex:f.index, type:'path', score:1 });
    for (const ch of f.chunks || []) {
      if (results.length >= max) break;
      const text = fs.readFileSync(assertReadable(ch.path), 'utf8');
      const pos = text.toLowerCase().indexOf(q);
      if (pos >= 0) results.push({ rel:f.rel, fileIndex:f.index, chunk:ch.chunk, type:'content', pos, preview:text.slice(Math.max(0,pos-160), Math.min(text.length,pos+360)), chunkPath:ch.path });
    }
    if (results.length >= max) break;
  }
  return { query: args.query, count: results.length, results };
}
function createFableFolderHandoff(args = {}) {
  const content = createReadOnlyFolderContentBundle(args);
  const promptId = safeId('folder_fable');
  const promptPath = assertWritable(path.join(resultsDir, `${promptId}_folder_handoff.md`));
  const prompt = [`ASK_FABLE5 - Read-only folder handoff`, `-NoMap`, ``, `A read-only folder bridge has been prepared.`, `Source folder was not modified.`, `Content index: ${content.indexPath}`, `Access guide: ${content.guidePath}`, `Chunks directory: ${content.chunksDir}`, `Files: ${content.fileCount}`, `Text files chunked: ${content.textFileCount}`, `Binary files hash-verified: ${content.binaryFileCount}`, `Total chunks: ${content.totalChunks}`, `Bytes read: ${content.bytesRead}`, ``, `Task: Confirm the bridge is usable. Explain how to query/read any file by content_index and chunk path. Do not request modification of source folder.`].join('\n');
  fs.writeFileSync(promptPath, prompt, 'utf8');
  const run = args.runFable === false ? null : runFablePromptFile(promptPath, args.maxOutputChars || 100000);
  return { ...content, promptPath, fableRun: run };
}
function folderExplorer(args = {}) {
  const folder = assertReadable(args.folderPath);
  const rel = args.rel ? String(args.rel).replace(/^[\\/]+/,'') : '';
  const current = assertReadable(path.join(folder, rel));
  if (!isInside(current, folder)) throw new Error('outside_folder');
  const st = fs.statSync(current);
  if (!st.isDirectory()) throw new Error('not_a_directory');
  const entries = fs.readdirSync(current).map(name => {
    const p = path.join(current, name); const s = fs.statSync(p);
    return { name, rel: relUnix(folder,p), type: s.isDirectory()?'dir':'file', size: s.size, mtime: s.mtime.toISOString() };
  }).sort((a,b)=>a.type.localeCompare(b.type)||a.name.localeCompare(b.name));
  return { root: folder, rel, count: entries.length, entries };
}


function discoverReadableRoots() {
  const roots = [];
  if (process.platform === 'win32') {
    for (let c = 65; c <= 90; c++) {
      const r = String.fromCharCode(c) + ':\\';
      try { if (fs.existsSync(r)) roots.push({ root: r, readable: true }); } catch { roots.push({ root: r, readable: false }); }
    }
  } else {
    roots.push({ root: '/', readable: true });
  }
  return roots;
}
function fileSnippet(text, max = 3000) {
  const clean = String(text || '').replace(/\r/g, '');
  if (clean.length <= max) return clean;
  const half = Math.floor(max / 2);
  return clean.slice(0, half) + '\n\n...[middle omitted in report; full chunks available in bundle]...\n\n' + clean.slice(-half);
}
function topTermsFromText(text, limit = 30) {
  const stop = new Set('the and for with that this from are you your file files folder import const function return true false null undefined чтобы как это для что или all path data на по из в и не a an to of in is it be as at by or on if else while let var new'.split(/\s+/));
  const map = new Map();
  const m = String(text || '').toLowerCase().match(/[a-zа-я0-9_]{3,}/giu) || [];
  for (const w of m) if (!stop.has(w)) map.set(w, (map.get(w) || 0) + 1);
  return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0, limit).map(([term,count])=>({term,count}));
}
function createFolderIntelReport(args = {}) {
  const index = JSON.parse(fs.readFileSync(assertReadable(args.indexPath), 'utf8'));
  const id = safeId('folder_intel');
  const dir = assertWritable(path.join(resultsDir, id));
  fs.mkdirSync(dir, { recursive: true });
  const extCounts = {};
  const fileReports = [];
  let combinedForTerms = '';
  let processedFiles = 0;
  let processedChunks = 0;
  for (const f of index.files || []) {
    extCounts[f.ext || ''] = (extCounts[f.ext || ''] || 0) + 1;
    const chunks = [];
    let full = '';
    for (const ch of f.chunks || []) {
      const t = fs.readFileSync(assertReadable(ch.path), 'utf8');
      full += t + '\n';
      processedChunks++;
    }
    if (full) combinedForTerms += '\n' + full.slice(0, 20000);
    const headings = (full.match(/^\s{0,3}#{1,6}\s+.+$/gmi) || []).slice(0, 50);
    const lines = full.split(/\n/).filter(x=>x.trim()).length;
    fileReports.push({ index: f.index, rel: f.rel, size: f.size, ext: f.ext, sha256: f.sha256, readStatus: f.readStatus, chunks: (f.chunks||[]).length, nonEmptyLines: lines, headings, snippet: fileSnippet(full, Number(args.snippetChars || 2500)) });
    processedFiles++;
  }
  const topTerms = topTermsFromText(combinedForTerms, 80);
  const report = { id, createdAt: new Date().toISOString(), sourceIndexPath: args.indexPath, root: index.root, fileCount: index.files.length, processedFiles, processedChunks, textFileCount: index.textFileCount, binaryFileCount: index.binaryFileCount, totalChunks: index.totalChunks, bytesRead: index.bytesRead, extCounts, topTerms, fileReports };
  const jsonPath = path.join(dir, 'folder_intel_report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  const md = ['# Folder intelligence report', '', `Root: ${report.root}`, `Files: ${report.fileCount}`, `Processed files: ${processedFiles}`, `Text chunks: ${processedChunks}`, `Bytes read: ${report.bytesRead}`, '', '## Extensions', ''];
  for (const [k,v] of Object.entries(extCounts).sort()) md.push(`- ${k || '[none]'}: ${v}`);
  md.push('', '## Top terms', '', topTerms.map(x=>`${x.term}(${x.count})`).join(', '), '', '## Files');
  for (const f of fileReports) {
    md.push('', `### [${f.index}] ${f.rel}`, `size=${f.size} chunks=${f.chunks} status=${f.readStatus} sha256=${f.sha256}`);
    if (f.headings.length) md.push('Headings:', ...f.headings.map(h=>`- ${h}`));
    if (f.snippet) md.push('', 'Snippet:', '```text', f.snippet, '```');
  }
  const mdPath = path.join(dir, 'folder_intel_report.md');
  fs.writeFileSync(mdPath, md.join('\n'), 'utf8');
  return { reportId: id, jsonPath, mdPath, processedFiles, processedChunks, topTerms: topTerms.slice(0,20) };
}


function createFableFolderSummaryFile(args = {}) {
  const bundle = args.indexPath ? null : createReadOnlyFolderContentBundle(args);
  const indexPath = args.indexPath || bundle.indexPath;
  const intel = args.intelReportPath ? { mdPath: args.intelReportPath } : createFolderIntelReport({ indexPath, snippetChars: args.snippetChars || 2500 });
  const id = safeId('fable_folder_summary');
  const promptPath = assertWritable(path.join(resultsDir, `${id}_prompt.md`));
  const prompt = [`ASK_FABLE5 - Folder summary from read-only bridge`, `-NoMap`, ``, `You are reviewing a complete read-only folder bridge package.`, `Do not request or suggest changing the source folder.`, `The connector has already read all files read-only, created full text chunks, hash-verified binaries, and prepared an intelligence report.`, ``, `Content index path: ${indexPath}`, `Intel report path: ${intel.mdPath}`, ``, `Task: read the provided intel report path and produce a practical summary:`, `1. What this folder is about.`, `2. Main file groups and topics.`, `3. Important scripts/reports/data artifacts.`, `4. TradingView/indicator/research conclusions visible from the files.`, `5. What should be inspected next using chunk search/read tools.`, ``, `Return a clear Russian summary. Mention if more detailed per-file analysis requires reading specific chunk paths from content_index.`].join('\n');
  fs.writeFileSync(promptPath, prompt, 'utf8');
  const run = runFablePromptFile(promptPath, args.maxOutputChars || 250000);
  const summaryPath = assertWritable(path.join(resultsDir, `${id}_FABLE_SUMMARY.txt`));
  let full = '';
  try { full = JSON.parse(fs.readFileSync(run.resultPath, 'utf8')).stdout || ''; } catch { full = JSON.stringify(run); }
  fs.writeFileSync(summaryPath, full, 'utf8');
  return { summaryId: id, indexPath, intelReportPath: intel.mdPath, promptPath, fableRun: run, summaryPath, summaryBytes: Buffer.byteLength(full) };
}
function receiveTextFile(args = {}) {
  const p = assertReadable(args.path);
  const out = boundedText(p, args.offset || 0, args.limit || CFG.maxSliceBytes || 200000);
  return { path: out.path, size: out.size, offset: out.offset, bytes: out.bytes, text: out.text };
}


function createGroundedFableFolderSummaryFile(args = {}) {
  const bundle = args.indexPath ? null : createReadOnlyFolderContentBundle(args);
  const indexPath = args.indexPath || bundle.indexPath;
  const idx = JSON.parse(fs.readFileSync(assertReadable(indexPath), 'utf8'));
  const extCounts = {};
  const roots = {};
  for (const f of idx.files || []) {
    extCounts[f.ext || '[none]'] = (extCounts[f.ext || '[none]'] || 0) + 1;
    const top = f.rel.includes('/') ? f.rel.split('/')[0] : '[root]';
    roots[top] = (roots[top] || 0) + 1;
  }
  const id = safeId('grounded_fable_summary');
  const promptPath = assertWritable(path.join(resultsDir, `${id}_prompt.md`));
  const lines = ['ASK_FABLE5 - Grounded folder summary', '-NoMap', '', 'STRICT RULES: Use only facts listed in this prompt. Do not invent file names, folders, indicators, scripts, or conclusions. If a detail is not visible, say it is not visible in this compact index. Return Russian summary.', '', `Root: ${idx.root}`, `Files: ${idx.files.length}`, `Text files: ${idx.textFileCount}`, `Binary files: ${idx.binaryFileCount}`, `Chunks: ${idx.totalChunks}`, `Bytes read: ${idx.bytesRead}`, '', 'Extensions:'];
  Object.entries(extCounts).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>lines.push(`- ${k}: ${v}`));
  lines.push('', 'Top-level groups:');
  Object.entries(roots).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>lines.push(`- ${k}: ${v}`));
  lines.push('', 'All file paths from the read-only index:');
  for (const f of idx.files || []) lines.push(`- [${f.index}] ${f.rel} | ext=${f.ext||''} | size=${f.size} | chunks=${(f.chunks||[]).length} | status=${f.readStatus}`);
  fs.writeFileSync(promptPath, lines.join('\n'), 'utf8');
  const run = runFablePromptFile(promptPath, args.maxOutputChars || 200000);
  const summaryPath = assertWritable(path.join(resultsDir, `${id}_FABLE_GROUNDED_SUMMARY.txt`));
  let full = '';
  try { full = JSON.parse(fs.readFileSync(run.resultPath, 'utf8')).stdout || ''; } catch { full = JSON.stringify(run); }
  fs.writeFileSync(summaryPath, full, 'utf8');
  return { summaryId: id, indexPath, promptPath, fableRun: run, summaryPath, summaryBytes: Buffer.byteLength(full) };
}


function runMediaBridge(command, args = {}, timeoutMs = 900000) {
  const script = path.join(ROOT, 'scripts', 'media_bridge.py');
  const py = process.env.PYTHON || 'python';
  const r = spawnSync(py, ['-X','utf8', script, command, '--json', JSON.stringify(args || {})], { encoding:'utf8', timeout: timeoutMs, cwd: ROOT });
  if (r.error) return { ok:false, error:String(r.error.message || r.error), stdout:r.stdout || '', stderr:r.stderr || '' };
  const raw = (r.stdout || '').trim();
  try { return JSON.parse(raw); }
  catch { return { ok:false, parseError:true, exitCode:r.status, stdout:r.stdout || '', stderr:r.stderr || '' }; }
}
function parseLocalLinksFromFile(args = {}) { return runMediaBridge('links_from_file', { path: assertReadable(args.filePath) }, 120000); }
function mediaToolchainReport() { return runMediaBridge('toolchain', {}, 120000); }

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
 
 { name:'fetch_url_text', title:'Fetch URL text', description:'Fetch bounded text from an http/https URL for read-only inspection.', inputSchema:{type:'object',properties:{url:{type:'string'},limit:{type:'number'}},required:['url']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'extract_links_from_url', title:'Extract links from URL', description:'Fetch a page and return bounded link list.', inputSchema:{type:'object',properties:{url:{type:'string'},limit:{type:'number'}},required:['url']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'create_url_snapshot_job', title:'Create URL snapshot job', description:'Fetch a URL into a local snapshot resource and return links.', inputSchema:{type:'object',properties:{url:{type:'string'},title:{type:'string'},limit:{type:'number'}},required:['url']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'register_video_pointer', title:'Register video pointer', description:'Register a local media file pointer and metadata.', inputSchema:{type:'object',properties:{filePath:{type:'string'},title:{type:'string'}},required:['filePath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_media_metadata_job', title:'Create media metadata job', description:'Create a media metadata job using ffprobe when available.', inputSchema:{type:'object',properties:{filePath:{type:'string'}},required:['filePath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_handoff_queue_item', title:'Create handoff queue item', description:'Create a local handoff queue item without touching source folders.', inputSchema:{type:'object',properties:{title:{type:'string'},body:{type:'string'},resourceIds:{type:'array'},filePaths:{type:'array'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'list_handoff_queue', title:'List handoff queue', description:'List local connector handoff queue items.', inputSchema:{type:'object',properties:{limit:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 
 { name:'list_implemented_improvements', title:'List 100 implemented improvements', description:'List the V6 implemented improvement registry.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'audit_100_improvements', title:'Audit 100 improvements', description:'Verify that the 100-improvement registry exists and evidence files are present.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'create_support_bundle', title:'Create support bundle', description:'Create a local support bundle with config, docs, health and improvement audit.', inputSchema:{type:'object',properties:{includeLogs:{type:'boolean'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'runtime_metrics', title:'Runtime metrics', description:'Return runtime memory, uptime, process and platform metrics.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'validate_connector_config', title:'Validate connector config', description:'Validate required connector configuration keys.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'create_debug_snapshot', title:'Create debug snapshot', description:'Create a local debug snapshot result file.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 
 { name:'list_1000_forward_improvements', title:'List 1000 forward improvements', description:'List the V7 1000-item forward improvement backlog. Items are planned, not falsely marked implemented.', inputSchema:{type:'object',properties:{limit:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'audit_1000_forward_improvements', title:'Audit 1000 forward improvements', description:'Verify the 1000-item forward improvement backlog structure.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'no_window_startup_info', title:'No-window startup info', description:'Return verified files and instructions for hidden startup.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'create_startup_shortcut_info', title:'Startup shortcut info', description:'Return paths for VBS hidden start, scheduled task install, and stop script.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 
 { name:'create_readonly_folder_manifest', title:'Create read-only folder manifest', description:'Recursively inventory and hash every file in a folder without modifying the source.', inputSchema:{type:'object',properties:{folderPath:{type:'string'},maxFiles:{type:'number'}},required:['folderPath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'audit_readonly_folder_manifest', title:'Audit read-only folder manifest', description:'Re-check file size and SHA256 against a stored read-only manifest.', inputSchema:{type:'object',properties:{manifestPath:{type:'string'}},required:['manifestPath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'create_readonly_folder_content_bundle', title:'Create read-only folder content bundle', description:'Read every file in a folder read-only, chunk all text files, hash-verify binaries, and store results under connector results.', inputSchema:{type:'object',properties:{folderPath:{type:'string'},manifestPath:{type:'string'},chunkChars:{type:'number'},maxFiles:{type:'number'}},required:[]}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'read_folder_bundle_chunk', title:'Read folder bundle chunk', description:'Read one stored text chunk from a folder content bundle.', inputSchema:{type:'object',properties:{indexPath:{type:'string'},fileIndex:{type:'number'},rel:{type:'string'},chunk:{type:'number'}},required:['indexPath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'search_folder_content_bundle', title:'Search folder content bundle', description:'Search file names and chunked text content inside a read-only folder content bundle.', inputSchema:{type:'object',properties:{indexPath:{type:'string'},query:{type:'string'},maxResults:{type:'number'}},required:['indexPath','query']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'create_fable_folder_handoff', title:'Create Fable folder handoff', description:'Create a complete read-only folder content bundle and Fable access guide, optionally run Fable on the guide.', inputSchema:{type:'object',properties:{folderPath:{type:'string'},manifestPath:{type:'string'},chunkChars:{type:'number'},maxFiles:{type:'number'},runFable:{type:'boolean'},maxOutputChars:{type:'number'}},required:[]}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'folder_explorer', title:'Folder explorer', description:'List one folder level under an allowed root without modifying files.', inputSchema:{type:'object',properties:{folderPath:{type:'string'},rel:{type:'string'}},required:['folderPath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 
 { name:'discover_readable_roots', title:'Discover readable roots', description:'List drive roots that exist on this computer for read-only bridge use.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'create_folder_intel_report', title:'Create folder intelligence report', description:'Build a local intelligence report from a full read-only folder content bundle.', inputSchema:{type:'object',properties:{indexPath:{type:'string'},snippetChars:{type:'number'}},required:['indexPath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_fable_folder_summary_file', title:'Create Fable folder summary file', description:'Run Fable on a read-only folder intel report and store Fable summary as a text file.', inputSchema:{type:'object',properties:{folderPath:{type:'string'},indexPath:{type:'string'},intelReportPath:{type:'string'},chunkChars:{type:'number'},snippetChars:{type:'number'},maxOutputChars:{type:'number'}},required:[]}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'receive_text_file', title:'Receive text file', description:'Read a text file produced by CompanionConnector/Fable by path and bounded offset.', inputSchema:{type:'object',properties:{path:{type:'string'},offset:{type:'number'},limit:{type:'number'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 
 { name:'create_grounded_fable_folder_summary_file', title:'Create grounded Fable folder summary file', description:'Create a grounded Fable summary using inline counts and all file paths from the read-only folder index.', inputSchema:{type:'object',properties:{folderPath:{type:'string'},indexPath:{type:'string'},chunkChars:{type:'number'},maxOutputChars:{type:'number'}},required:[]}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 
 { name:'media_toolchain_report', title:'Media toolchain report', description:'Check ffmpeg, ffprobe, yt-dlp, tesseract and Python media modules.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'extract_video_frames', title:'Extract video frames', description:'Read video file and create sampled frame images under connector results.', inputSchema:{type:'object',properties:{video:{type:'string'},interval:{type:'number'},maxFrames:{type:'number'},outdir:{type:'string'}},required:['video']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_video_contact_sheet', title:'Create video contact sheet', description:'Extract sampled frames and build a contact sheet image for quick visual review.', inputSchema:{type:'object',properties:{video:{type:'string'},interval:{type:'number'},maxFrames:{type:'number'},outpath:{type:'string'},thumbW:{type:'number'},cols:{type:'number'}},required:['video']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'extract_audio_track', title:'Extract audio track', description:'Extract mono 16k wav audio from video or audio media.', inputSchema:{type:'object',properties:{media:{type:'string'},outpath:{type:'string'}},required:['media']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'transcribe_media_audio', title:'Transcribe media audio', description:'Transcribe local audio/video with faster-whisper CPU when model is available.', inputSchema:{type:'object',properties:{media:{type:'string'},model:{type:'string'},language:{type:'string'}},required:['media']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'ocr_image_file', title:'OCR image file', description:'Extract visible text from an image using local Tesseract OCR.', inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'analyze_chart_image', title:'Analyze chart image', description:'OCR and simple line/edge analysis for chart/graph screenshots.', inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'extract_links_from_file', title:'Extract links from file', description:'Extract http/https and markdown links from a local text file.', inputSchema:{type:'object',properties:{filePath:{type:'string'}},required:['filePath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
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
 
 if (name==='fetch_url_text') { const u = await fetchUrlLimited(args.url, args.limit); return toolResult(u); }
 if (name==='extract_links_from_url') { const u = await fetchUrlLimited(args.url, args.limit); return toolResult({ url: u.url, status: u.status, links: extractLinks(u.text, u.url) }); }
 if (name==='create_url_snapshot_job') return toolResult(await createUrlSnapshot(args));
 if (name==='register_video_pointer') { const meta = mediaMetadata(args.filePath); const id = safeId('media'); const rec = saveResource({ id, title: args.title || path.basename(meta.path), path: meta.path, type:'media_pointer', metadata: meta, createdAt: new Date().toISOString() }); return toolResult({ id: rec.id, title: rec.title, metadata: meta }); }
 if (name==='create_media_metadata_job') return toolResult(makeJob('media_metadata', args.filePath, mediaMetadata(args.filePath)));
 if (name==='create_handoff_queue_item') return toolResult(createHandoffQueueItem(args));
 if (name==='list_handoff_queue') return toolResult({ items: listHandoffQueue(args.limit) });
 
 if (name==='list_implemented_improvements') return toolResult(loadImplementedImprovements());
 if (name==='audit_100_improvements') return toolResult(auditImplementedImprovements());
 if (name==='create_support_bundle') return toolResult(createSupportBundle(args));
 if (name==='runtime_metrics') return toolResult(runtimeMetrics());
 if (name==='validate_connector_config') return toolResult(validateConnectorConfig());
 if (name==='create_debug_snapshot') return toolResult(createDebugSnapshot());
 
 if (name==='list_1000_forward_improvements') return toolResult(loadForwardImprovements(args.limit));
 if (name==='audit_1000_forward_improvements') return toolResult(auditForwardImprovements());
 if (name==='no_window_startup_info') return toolResult(noWindowStartupInfo());
 if (name==='create_startup_shortcut_info') return toolResult(createStartupShortcutInfo());
 
 if (name==='create_readonly_folder_manifest') return toolResult(createReadOnlyFolderManifest(args));
 if (name==='audit_readonly_folder_manifest') return toolResult(auditReadOnlyFolderManifest(args));
 if (name==='create_readonly_folder_content_bundle') return toolResult(createReadOnlyFolderContentBundle(args));
 if (name==='read_folder_bundle_chunk') return toolResult(readFolderBundleChunk(args));
 if (name==='search_folder_content_bundle') return toolResult(searchFolderContentBundle(args));
 if (name==='create_fable_folder_handoff') return toolResult(createFableFolderHandoff(args));
 if (name==='folder_explorer') return toolResult(folderExplorer(args));
 
 if (name==='discover_readable_roots') return toolResult({ roots: discoverReadableRoots() });
 if (name==='create_folder_intel_report') return toolResult(createFolderIntelReport(args));
 if (name==='create_fable_folder_summary_file') return toolResult(createFableFolderSummaryFile(args));
 if (name==='receive_text_file') return toolResult(receiveTextFile(args));
 
 if (name==='create_grounded_fable_folder_summary_file') return toolResult(createGroundedFableFolderSummaryFile(args));
 
 if (name==='media_toolchain_report') return toolResult(mediaToolchainReport());
 if (name==='extract_video_frames') return toolResult(runMediaBridge('extract_frames', { video: assertReadable(args.video), interval: args.interval || 10, maxFrames: args.maxFrames || 100, outdir: args.outdir }, 1200000));
 if (name==='create_video_contact_sheet') return toolResult(runMediaBridge('video_contact_sheet', { video: assertReadable(args.video), interval: args.interval || 10, maxFrames: args.maxFrames || 50, outpath: args.outpath, thumbW: args.thumbW || 320, cols: args.cols || 5 }, 1200000));
 if (name==='extract_audio_track') return toolResult(runMediaBridge('extract_audio', { media: assertReadable(args.media), outpath: args.outpath }, 1200000));
 if (name==='transcribe_media_audio') return toolResult(runMediaBridge('transcribe', { media: assertReadable(args.media), model: args.model || 'tiny', language: args.language }, 3600000));
 if (name==='ocr_image_file') return toolResult(runMediaBridge('ocr_image', { path: assertReadable(args.path) }, 300000));
 if (name==='analyze_chart_image') return toolResult(runMediaBridge('chart_image', { path: assertReadable(args.path) }, 300000));
 if (name==='extract_links_from_file') return toolResult(parseLocalLinksFromFile(args));
 if (name==='get_job_status') { const f=path.join(jobsDir,`${String(args.jobId)}.json`); if(!fs.existsSync(f)) throw new Error('job_not_found'); return toolResult(JSON.parse(fs.readFileSync(f,'utf8'))); }
 if (name==='list_registered_resources') return toolResult({resources:resourceIndex()});
 throw new Error('unknown_tool');
}

function listResources() { return [ { uri:'companion://status', name:'Companion Connector status', mimeType:'application/json' }, { uri:'ui://companion/dashboard.html', name:'Companion dashboard', mimeType:'text/html;profile=mcp-app' }, { uri:'companion://mcp-services', name:'21 MCP service catalog', mimeType:'application/json' }, ...resourceIndex().map(r=>({uri:`companion://resource/${r.id}`, name:r.title||r.id, mimeType:(r.type||'').includes('image')?'application/json':'text/plain'})) ]; }
function readResource(uri) { if(uri==='companion://status') return {contents:[{uri,mimeType:'application/json',text:JSON.stringify({ok:true,root:ROOT,resources:resourceIndex().length,services:MCP_SERVICE_FOLDERS.length},null,2)}]}; if(uri==='ui://companion/dashboard.html') return {contents:[{uri,mimeType:'text/html;profile=mcp-app',text:fs.readFileSync(path.join(webDir,'dashboard.html'),'utf8')}]}; if(uri==='companion://mcp-services') return {contents:[{uri,mimeType:'application/json',text:JSON.stringify(serviceCatalog(),null,2)}]}; const m=String(uri).match(/^companion:\/\/resource\/(.+)$/); if(m) return {contents:[{uri,mimeType:'application/json',text:JSON.stringify(fetchResource(m[1]),null,2)}]}; throw new Error('resource_not_found'); }
async function handleRpc(msg) { const id=msg.id??null; try { if(msg.method==='initialize') return rpc(id,{protocolVersion:CFG.mcpProtocolVersion||'2025-06-18',capabilities:{tools:{},resources:{},prompts:{}},serverInfo:{name:'companion-connector',version:'13.0.0'}}); if(msg.method==='tools/list') return rpc(id,{tools:listTools()}); if(msg.method==='tools/call'){ const {name,arguments:args}=msg.params||{}; audit(name,args||{}); return rpc(id,await callTool(name,args||{})); } if(msg.method==='resources/list') return rpc(id,{resources:listResources()}); if(msg.method==='resources/read') return rpc(id,readResource(msg.params?.uri)); if(msg.method==='prompts/list') return rpc(id,{prompts:[{name:'inspect_large_file',title:'Inspect large file by pointer'},{name:'handoff_to_fable',title:'Prepare Fable prompt from pointers'}]}); if(msg.method==='prompts/get') return rpc(id,{description:'Use Companion Connector tools for file pointers, jobs, image metadata, and MCP service catalog.',messages:[]}); if(msg.method==='notifications/initialized'||msg.method?.startsWith('notifications/')) return null; return rpcErr(id,-32601,'method_not_found'); } catch(e){ return rpcErr(id,-32000,e.message||'error'); } }
async function readBody(req){ const chunks=[]; for await (const c of req) chunks.push(c); return Buffer.concat(chunks).toString('utf8'); }
const server=http.createServer(async(req,res)=>{ try{ const url=new URL(req.url,`http://${req.headers.host||'localhost'}`); if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/health')) return json(res,{ok:true,name:'companion-connector',version:'13.0.0',port:PORT,mcp:'/mcp',tools:listTools().length}); if(req.method==='GET'&&url.pathname==='/sse'){ res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache',connection:'keep-alive'}); res.write('event: endpoint\ndata: /mcp\n\n'); return; } if(req.method==='GET'&&url.pathname==='/mcp'){ res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache',connection:'keep-alive'}); res.write(`event: message\ndata: ${JSON.stringify({jsonrpc:'2.0',method:'notifications/message',params:{level:'info',data:'companion connector ready'}})}\n\n`); return; } if(req.method==='GET'&&url.pathname.startsWith('/resource/')) return json(res,fetchResource(decodeURIComponent(url.pathname.slice('/resource/'.length)))); if(req.method==='POST'&&(url.pathname==='/mcp'||url.pathname==='/message')){ const body=await readBody(req); const input=body?JSON.parse(body):{}; const out=Array.isArray(input)?(await Promise.all(input.map(handleRpc))).filter(Boolean):await handleRpc(input); if(!out) return json(res,{},202); return json(res,out,200,{'MCP-Protocol-Version':CFG.mcpProtocolVersion||'2025-06-18'}); } return json(res,{error:'not_found'},404); } catch(e){ return json(res,{error:e.message||'server_error'},500); } });
server.listen(PORT,HOST,()=>{ const line=`[${new Date().toISOString()}] companion-connector v13 listening http://${HOST}:${PORT}/mcp\n`; fs.appendFileSync(path.join(logsDir,'server.log'),line); console.log(line.trim()); });




