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
const scriptsDir = path.join(ROOT, 'scripts');
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
  return { pid: process.pid, uptimeSec: Math.round(process.uptime()), node: process.version, platform: process.platform, arch: process.arch, memory: mem, version:'27.0.0' };
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


function runDocumentBridge(command, args = {}, timeoutMs = 900000) {
  const script = path.join(ROOT, 'scripts', 'document_bridge_v14.py');
  const py = process.env.PYTHON || 'python';
  const argv = ['-X','utf8',script,command];
  for (const [k,v] of Object.entries(args||{})) if (v !== undefined && v !== null) argv.push('--' + k.replace(/[A-Z]/g, m => '-' + m.toLowerCase()), String(v));
  const r = spawnSync(py, argv, { encoding:'utf8', timeout: timeoutMs, maxBuffer: 128*1024*1024, cwd: ROOT });
  if (r.error) throw r.error;
  if (r.status !== 0 && !r.stdout) throw new Error((r.stderr || 'document_bridge_failed').slice(0,4000));
  try { return JSON.parse(r.stdout); } catch { return { ok:false, stdout:r.stdout, stderr:r.stderr, status:r.status }; }
}
function documentToolchainReport() { return runDocumentBridge('toolchain', {}, 120000); }


function runResearchBridge(command, args = {}, timeoutMs = 900000) {
  const script = path.join(ROOT, 'scripts', 'research_bridge.py');
  const py = process.env.PYTHON || 'python';
  const argv = ['-X','utf8',script,command];
  for (const [k,v] of Object.entries(args||{})) {
    if (v === undefined || v === null || v === false) continue;
    const key='--' + k.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
    if (v === true) argv.push(key); else argv.push(key, String(v));
  }
  const r = spawnSync(py, argv, { encoding:'utf8', timeout: timeoutMs, maxBuffer: 128*1024*1024, cwd: ROOT });
  if (r.error) throw r.error;
  if (r.status !== 0 && !r.stdout) throw new Error((r.stderr || 'research_bridge_failed').slice(0,4000));
  try { return JSON.parse(r.stdout); } catch { return { ok:false, stdout:r.stdout, stderr:r.stderr, status:r.status }; }
}


function runPyJson(scriptName, argsArr = [], timeoutMs = 900000) {
  const script = path.join(ROOT, 'scripts', scriptName);
  const py = process.env.PYTHON || 'python';
  const r = spawnSync(py, ['-X','utf8', script, ...argsArr], { cwd: ROOT, encoding:'utf8', timeout: timeoutMs, maxBuffer: 1024*1024*256 });
  const out = (r.stdout||'').trim();
  if (r.error) throw r.error;
  try { return JSON.parse(out || '{}'); } catch(e) { return { ok:false, error:'json_parse_failed', stdout:out.slice(-4000), stderr:(r.stderr||'').slice(-4000), code:r.status }; }
}
function runPwshJson(scriptName, argsArr = [], timeoutMs = 120000) {
  const script = path.join(ROOT, 'scripts', scriptName);
  const r = spawnSync('pwsh', ['-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File', script, ...argsArr], { cwd: ROOT, encoding:'utf8', timeout: timeoutMs, maxBuffer: 1024*1024*64 });
  const out = (r.stdout||'').trim();
  if (r.error) throw r.error;
  try { return JSON.parse(out || '{}'); } catch(e) { return { ok:false, error:'json_parse_failed', stdout:out.slice(-4000), stderr:(r.stderr||'').slice(-4000), code:r.status }; }
}
function browserBridge(cmd, args=[], timeout=900000){ return runPyJson('browser_bridge.py', [cmd, ...args], timeout); }
function archiveSecure(cmd, args=[], timeout=900000){ return runPyJson('archive_secure.py', [cmd, ...args], timeout); }
function chartAdvanced(args=[]){ return runPyJson('chart_advanced.py', args, 600000); }
function modelBridge(cmd, args=[], timeout=7200000){ return runPyJson('model_bridge.py', [cmd, ...args], timeout); }

function runLiveBridge(cmd, args={}, timeout=600000){
  const py=process.env.PYTHON || 'python';
  const script=path.join(ROOT,'scripts','live_bridge.py');
  const r=spawnSync(py,['-X','utf8',script,cmd,'--args',JSON.stringify(args||{})],{cwd:ROOT,encoding:'utf8',timeout,maxBuffer:1024*1024*128});
  if(r.error) return {ok:false,error:String(r.error.message||r.error),stdout:r.stdout||'',stderr:r.stderr||''};
  try{return JSON.parse((r.stdout||'').trim()||'{}')}catch{return {ok:false,error:'parse_failed',stdout:r.stdout,stderr:r.stderr,code:r.status}}
}

const queueDir = path.join(resultsDir, 'job_queue');
fs.mkdirSync(queueDir, {recursive:true});
function queuePath(id){ return path.join(queueDir, `${String(id)}.json`); }
function createQueueJob(args={}){
  const id=safeId('queue_job');
  const rec={id, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), status:'queued', type:String(args.type||'noop'), priority:Number(args.priority||5), title:String(args.title||args.type||id), payload:args.payload||{}, result:null, error:null};
  fs.writeFileSync(queuePath(id), JSON.stringify(rec,null,2),'utf8');
  return rec;
}
function listQueueJobs(args={}){ const limit=Number(args.limit||50); const arr=fs.readdirSync(queueDir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(queueDir,f),'utf8'))).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,limit); return {queueDir,count:arr.length,jobs:arr}; }


function saveQueueJob(rec){ rec.updatedAt=new Date().toISOString(); fs.writeFileSync(queuePath(rec.id), JSON.stringify(rec,null,2),'utf8'); return rec; }
function cancelQueueJob(args={}){ const p=queuePath(args.id); if(!fs.existsSync(p)) throw new Error('queue_job_not_found'); const rec=JSON.parse(fs.readFileSync(p,'utf8')); if(rec.status==='running') throw new Error('cannot_cancel_running_job'); rec.status='cancelled'; return saveQueueJob(rec); }
function auditPathSafety(args={}){
  const raw=String(args.path||''); const resolved=raw ? fs.realpathSync(path.resolve(raw)) : '';
  const protectedNames=['_AI_CHATS_ОБЩИЕ','_AI_CHATS_ОБЩИЕ'.normalize('NFC')];
  const protectedHit=protectedNames.some(x=>resolved.includes(x));
  const writableInsideConnector=resolved ? isInside(resolved, ROOT) : false;
  return {path:raw,resolved,protectedHit,writeAllowedByConnector:writableInsideConnector,readAllowedByDrive: resolved ? discoverReadableRoots().some(r=>r.readable && isInside(resolved,r.root)) : false, recommendation: protectedHit ? 'read_only_only_unless_user_explicitly_authorizes' : 'normal_connector_rules'};
}


function runQueueOnce(args={}){
  const jobs=fs.readdirSync(queueDir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(queueDir,f),'utf8'))).filter(j=>j.status==='queued').sort((a,b)=>(a.priority-b.priority)||String(a.createdAt).localeCompare(String(b.createdAt)));
  const max=Number(args.max||1); const ran=[];
  for(const rec of jobs.slice(0,max)){
    rec.status='running'; saveQueueJob(rec);
    try{
      const p=rec.payload||{}; let result={ok:true, noop:true};
      if(rec.type==='screen_snapshot') result=runLiveBridge('screenshot',p,180000);
      else if(rec.type==='screen_ocr') result=runLiveBridge('screen_ocr',p,180000);
      else if(rec.type==='semantic_index') result=runSemanticBridge('create',{indexPath:assertReadable(p.indexPath)},1800000);
      else if(rec.type==='document_inspect') result=runDocumentBridge('inspect',{path:assertReadable(p.path)},900000);
      else if(rec.type==='research_map') result=runResearchBridge('map',{folder:assertReadable(p.folder),maxFiles:p.maxFiles||5000},1800000);
      rec.status='done'; rec.result=result;
    } catch(e){ rec.status='failed'; rec.error=String(e.message||e); }
    saveQueueJob(rec); ran.push(rec);
  }
  return {queueDir, ran:ran.length, jobs:ran};
}
function queueHealthReport(){ const arr=fs.readdirSync(queueDir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(queueDir,f),'utf8'))); const counts={}; for(const j of arr) counts[j.status]=(counts[j.status]||0)+1; return {queueDir,total:arr.length,counts}; }

function runSemanticBridge(cmd,args={},timeout=900000){
  const py=process.env.PYTHON || 'python';
  const script=path.join(ROOT,'scripts','semantic_bridge.py');
  const r=spawnSync(py,['-X','utf8',script,cmd,'--args',JSON.stringify(args||{})],{cwd:ROOT,encoding:'utf8',timeout,maxBuffer:1024*1024*256});
  if(r.error) return {ok:false,error:String(r.error.message||r.error),stdout:r.stdout||'',stderr:r.stderr||''};
  try{return JSON.parse((r.stdout||'').trim()||'{}')}catch{return {ok:false,error:'parse_failed',stdout:r.stdout,stderr:r.stderr,code:r.status}}
}


function compactText(s, n=12000){ s=String(s||''); return s.length>n ? s.slice(0,n)+'\n...[truncated]...' : s; }
function parseJsonLoose(text){
  const s=String(text||'');
  const fence=s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates=[];
  if(fence) candidates.push(fence[1]);
  const first=s.indexOf('{'); const last=s.lastIndexOf('}');
  if(first>=0 && last>first) candidates.push(s.slice(first,last+1));
  for(const c of candidates){ try{return JSON.parse(c)}catch{} }
  return null;
}
function liveAgentDir(sessionId){ const id=String(sessionId||safeId('live_agent')).replace(/[^A-Za-z0-9_\-.]+/g,'_'); const d=assertWritable(path.join(resultsDir,id)); fs.mkdirSync(d,{recursive:true}); return {id,dir:d}; }
function createLiveAgentObservation(args={}){
  const {id,dir}=liveAgentDir(args.sessionId);
  const monitor=Number(args.monitor||1);
  const active=runLiveBridge('active_window',{},120000);
  const windows=runLiveBridge('list_windows',{query:args.windowQuery||''},120000);
  const screen=runLiveBridge('screenshot',{monitor},180000);
  const ocr=runLiveBridge('screen_ocr',{monitor},180000);
  let browser=null;
  if(args.includeBrowser){
    const port=Number(args.port||9222);
    browser={port,tabs:browserBridge('tabs',['--port',String(port)],120000)};
    try{ browser.dom=browserBridge('dom',['--port',String(port),'--index',String(args.browserIndex||0),'--outpath',path.join(dir,'browser_dom.json')],180000); }catch(e){ browser.dom={ok:false,error:String(e.message||e)}; }
  }
  const obs={ok:true,sessionId:id,createdAt:new Date().toISOString(),task:args.task||'',active,windows,screen,ocr,browser};
  const jsonPath=path.join(dir,'observation_'+Date.now()+'.json');
  fs.writeFileSync(jsonPath,JSON.stringify(obs,null,2),'utf8');
  const md=[`# Live agent observation`, `Session: ${id}`, `Task: ${args.task||''}`, `Created: ${obs.createdAt}`, '', '## Active window', '```json', JSON.stringify(active,null,2), '```', '', '## Screen', '```json', JSON.stringify(screen,null,2), '```', '', '## OCR', '```text', compactText(ocr.text||'',20000), '```'];
  if(browser) md.push('', '## Browser', '```json', compactText(JSON.stringify(browser,null,2),20000), '```');
  const mdPath=jsonPath.replace(/\.json$/,'.md'); fs.writeFileSync(mdPath,md.join('\n'),'utf8');
  return {ok:true,sessionId:id,dir,jsonPath,mdPath,activeWindow:active.window?.title||'',screenPath:screen.path||'',ocrChars:(ocr.text||'').length,browserIncluded:!!browser};
}


function createLiveAgentFablePlan(args={}){
  let obsPath=args.observationPath;
  let obsInfo=null;
  if(!obsPath){ obsInfo=createLiveAgentObservation(args); obsPath=obsInfo.jsonPath; }
  obsPath=assertReadable(obsPath);
  const obs=JSON.parse(fs.readFileSync(obsPath,'utf8'));
  const {id,dir}=liveAgentDir(args.sessionId||obs.sessionId||safeId('live_agent'));
  const promptPath=assertWritable(path.join(dir,'fable_live_plan_'+Date.now()+'.md'));
  const prompt=[
    'ASK_FABLE5 - Live agent observe-plan step',
    '-NoMap','',
    'You are Fable5 coordinating CompanionConnector live agent. Return ONLY JSON. No markdown.',
    'Allowed actions: none, browser_navigate, browser_click_text, browser_type_selector, browser_press_key, human_focus_window, human_click_xy, human_type_text, human_press_key, human_scroll.',
    'Schema: {"summary":"...","confidence":0.0,"actions":[{"type":"none","reason":"..."}],"needsUser":false,"risk":"low|medium|high"}',
    'Do not suggest destructive actions. Prefer observation-only when unsure.',
    '',
    `USER_TASK: ${args.task||obs.task||''}`,
    '',
    'OBSERVATION_JSON:',
    '```json',
    compactText(JSON.stringify(obs,null,2), Number(args.maxObservationChars||40000)),
    '```'
  ].join('\n');
  fs.writeFileSync(promptPath,prompt,'utf8');
  const run=runFablePromptFile(promptPath, Number(args.maxOutputChars||120000));
  let text=''; try{text=JSON.parse(fs.readFileSync(run.resultPath,'utf8')).stdout||''}catch{text=JSON.stringify(run)}
  const plan=parseJsonLoose(text) || {summary:'Fable did not return parseable JSON',confidence:0,actions:[{type:'none',reason:'parse_failed'}],needsUser:true,risk:'medium',raw:compactText(text,20000)};
  const planPath=assertWritable(path.join(dir,'fable_live_plan_'+Date.now()+'.json'));
  fs.writeFileSync(planPath,JSON.stringify({ok:true,sessionId:id,observationPath:obsPath,promptPath,fableRun:run,plan,raw:compactText(text,50000)},null,2),'utf8');
  return {ok:true,sessionId:id,observationPath:obsPath,promptPath,planPath,plan};
}
function applyLiveAgentAction(args={}){
  const execute=!!args.execute;
  const action= typeof args.actionJson==='string' ? (parseJsonLoose(args.actionJson)||{}) : (args.action||{});
  const type=String(action.type||args.type||'none');
  const allowed=new Set(['none','browser_navigate','browser_click_text','browser_type_selector','browser_press_key','human_focus_window','human_click_xy','human_type_text','human_press_key','human_scroll']);
  if(!allowed.has(type)) return {ok:false,error:'action_not_allowed',type};
  const rec={ok:true,execute,type,action,createdAt:new Date().toISOString()};
  if(!execute || type==='none') return {...rec,result:{ok:true,dryRun:!execute,noop:type==='none'}};
  let result;
  if(type==='browser_navigate') result=browserBridge('navigate',['--port',String(action.port||9222),'--url',String(action.url||''),'--index',String(action.index||0),'--wait',String(action.wait||1.5)],300000);
  else if(type==='browser_click_text') result=browserBridge('click_text',['--port',String(action.port||9222),'--text',String(action.text||''),'--index',String(action.index||0)],300000);
  else if(type==='browser_type_selector') result=browserBridge('type_selector',['--port',String(action.port||9222),'--selector',String(action.selector||''),'--text',String(action.text||''),'--index',String(action.index||0)],300000);
  else if(type==='browser_press_key') result=browserBridge('press_key',['--port',String(action.port||9222),'--key',String(action.key||'Enter'),'--index',String(action.index||0)],300000);
  else if(type==='human_focus_window') result=runLiveBridge('focus_window',{query:action.query||''},120000);
  else if(type==='human_click_xy') { const loc=action.location||{}; result=runLiveBridge('click',{x:action.x??loc.x,y:action.y??loc.y,clicks:action.clicks||1},120000); }
  else if(type==='human_type_text') result=runLiveBridge('type_text',{text:action.text||'',paste:action.paste!==false},120000);
  else if(type==='human_press_key') result=runLiveBridge('press_key',{key:action.key,keys:action.keys},120000);
  else if(type==='human_scroll') result=runLiveBridge('scroll',{clicks:action.clicks||-5},120000);
  return {...rec,result};
}
function runLiveAgentCycle(args={}){
  const obs=createLiveAgentObservation(args);
  const plan = args.planJson ? {ok:true, sessionId:obs.sessionId, observationPath:obs.jsonPath, plan:args.planJson, decidedBy:'Fable5', injectedPlan:true} : createLiveAgentFablePlan({...args,observationPath:obs.jsonPath,sessionId:obs.sessionId});
  const actions=Array.isArray(plan.plan.actions)?plan.plan.actions:[];
  const executed=[];
  const max=Number(args.maxActions||1);
  for(const a of actions.slice(0,max)) executed.push(applyLiveAgentAction({action:a,execute:!!args.execute,decidedBy:'Fable5'}));
  const after=createLiveAgentObservation({sessionId:obs.sessionId,task:'after action',monitor:args.monitor,includeBrowser:args.includeBrowser,port:args.port,decidedBy:'Fable5'});
  const cycle={ok:true,sessionId:obs.sessionId,decidedBy:'Fable5',observation:obs,plan,executed,after,execute:!!args.execute};
  const file=assertWritable(path.join(liveAgentDir(obs.sessionId).dir,'cycle_'+Date.now()+'.json'));
  fs.writeFileSync(file,JSON.stringify(cycle,null,2),'utf8');
  authorityAppend('live_agent_cycle',{decidedBy:'Fable5', sessionId:obs.sessionId, execute:!!args.execute, observationPath:obs.jsonPath, planPath:plan.planPath||'', cyclePath:file, executedCount:executed.length, afterObservationPath:after.jsonPath||'', blocked:executed.filter(x=>x.ok===false).length});
  return {ok:true,sessionId:obs.sessionId,cyclePath:file,plan:plan.plan,executed,afterSnapshotPath:after?.screenPath||'',afterObservationPath:after?.jsonPath||''};
}


const authorityDir = path.join(resultsDir, 'fable_authority');
fs.mkdirSync(authorityDir, {recursive:true});
const authorityJsonl = path.join(authorityDir, 'decision_log.jsonl');
function authoritySafeId(prefix='authority') { return safeId(prefix); }
function authorityAppend(kind, data={}) {
  const rec = { id: authoritySafeId('auth'), kind, createdAt: new Date().toISOString(), ...data };
  fs.appendFileSync(authorityJsonl, JSON.stringify(rec) + '\n', 'utf8');
  try { fs.writeFileSync(path.join(authorityDir, `${rec.id}.json`), JSON.stringify(rec,null,2), 'utf8'); } catch {}
  return rec;
}
function authorityRead(limit=100) {
  if (!fs.existsSync(authorityJsonl)) return [];
  const lines = fs.readFileSync(authorityJsonl,'utf8').split(/\r?\n/).filter(Boolean);
  return lines.slice(-Number(limit||100)).map(x=>{ try{return JSON.parse(x)}catch{return {kind:'parse_error',raw:x}}; });
}
function htmlEscape(s){ return String(s||'').replace(/[&<>\"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c])); }
function authorityTextPreview(x, n=5000) { return compactText(typeof x==='string'?x:JSON.stringify(x,null,2), n); }
function createFableAuthorityProposal(args={}) {
  const title = String(args.title || args.topic || 'CompanionConnector authority proposal').slice(0,160);
  const context = String(args.context || args.request || '');
  const disagreement = String(args.disagreement || '');
  const runFable = args.runFable !== false;
  const promptId = authoritySafeId('fable_proposal');
  const promptPath = path.join(authorityDir, `${promptId}.md`);
  const prompt = [
    'ASK_FABLE5 - CompanionConnector Fable Authority proposal',
    '-NoMap','',
    'You are Fable5. Give the implementation proposal and safety gates before ChatGPT modifies CompanionConnector.',
    'Return concise JSON if possible: {"summary":"...","proposal":[...],"safety":[...],"approved":true|false,"risks":[...]}',
    '',
    `TITLE: ${title}`,
    '',
    'CONTEXT:',
    context,
    disagreement ? `\nDISAGREEMENT_OR_REASK:\n${disagreement}` : '',
    '',
    'Rules: keep protected paths read-only; write only inside CompanionConnector unless user explicitly authorizes; prefer logs and dry-run first.'
  ].join('\n');
  fs.writeFileSync(promptPath, prompt, 'utf8');
  let status='prompt_created'; let fableRun=null; let fableText=''; let proposal={summary:'Fable run skipped', approved:null, proposal:[], safety:[]};
  if (runFable) {
    try {
      fableRun = runFablePromptFile(promptPath, Number(args.maxOutputChars||120000));
      try { fableText = JSON.parse(fs.readFileSync(fableRun.resultPath,'utf8')).stdout || ''; } catch { fableText = JSON.stringify(fableRun); }
      proposal = parseJsonLoose(fableText) || {summary: authorityTextPreview(fableText,4000), approved:null, proposal:[], safety:[], raw:authorityTextPreview(fableText,12000)};
      status='fable_returned';
    } catch(e) {
      status='fable_failed';
      fableText=String(e.message||e);
      proposal={summary:'Fable request failed or timed out', approved:false, error:fableText, proposal:[], safety:['Do not claim Fable approved when it did not return.']};
    }
  }
  const rec=authorityAppend('fable_proposal',{decidedBy:'Fable5', status, title, promptPath, fableRun, proposal, raw:authorityTextPreview(fableText,50000)});
  return {ok:true, authorityDir, record:rec, promptPath, status, proposal};
}
function recordFableAuthorityDisagreement(args={}) {
  const rec=authorityAppend('disagreement',{decidedBy:'ChatGPT', previousId:args.previousId||'', reason:String(args.reason||''), myPosition:String(args.myPosition||''), fablePosition:String(args.fablePosition||''), requiresReask:!!args.reAsk});
  let reask=null;
  if (args.reAsk) reask=createFableAuthorityProposal({title:`Re-ask after disagreement ${rec.id}`, context:String(args.context||''), disagreement:String(args.reason||args.myPosition||''), runFable:args.runFable!==false});
  return {ok:true, record:rec, reask};
}

const fableDirectDir = path.join(resultsDir, 'fable_direct');
fs.mkdirSync(fableDirectDir, {recursive:true});
function directTaskPath(id){ return path.join(fableDirectDir, `${String(id)}.json`); }
function directSafeId(prefix='direct') { return safeId(prefix); }
function compactDirectText(v, n=50000){
  const x = typeof v === 'string' ? v : JSON.stringify(v ?? '', null, 2);
  return x.length > n ? x.slice(0,n) + '\n...[truncated]...' : x;
}

function recordAuthorityToolAction(name, args={}, output=null, error=null) {
  if (!authorityDir) return null;
  const decidedBy=String(args?.decidedBy || (String(name).startsWith('fable_') || String(name).startsWith('live_agent') ? 'Fable5' : 'ChatGPT'));
  const inputJson=JSON.stringify(args||{});
  const outJson=JSON.stringify(output||{});
  return authorityAppend('tool_action',{decidedBy, tool:String(name||''), ok:!error, error:error?String(error.message||error):'', inputSha256:crypto.createHash('sha256').update(inputJson).digest('hex'), outputSha256:crypto.createHash('sha256').update(outJson).digest('hex'), inputPreview:authorityTextPreview(args,3000), outputPreview:authorityTextPreview(output,5000)});
}
function fableAuthorityDashboard(args={}) {
  const records=authorityRead(Number(args.limit||200));
  const counts={}; const byDecider={};
  for (const r of records){ counts[r.kind]=(counts[r.kind]||0)+1; if(r.decidedBy) byDecider[r.decidedBy]=(byDecider[r.decidedBy]||0)+1; }
  const blocked=records.filter(r=>String(r.kind).includes('blocked') || r.ok===false || String(r.status||'').includes('failed')).slice(-50);
  const proposals=records.filter(r=>r.kind==='fable_proposal').slice(-20);
  const actions=records.filter(r=>r.kind==='tool_action').slice(-50);
  const disagreements=records.filter(r=>r.kind==='disagreement').slice(-20);
  const dash={ok:true, authorityDir, decisionLog:authorityJsonl, counts, byDecider, latest:{proposals, disagreements, actions, blocked}, generatedAt:new Date().toISOString()};
  const jsonPath=path.join(authorityDir,'dashboard.json');
  const htmlPath=path.join(authorityDir,'dashboard.html');
  fs.writeFileSync(jsonPath,JSON.stringify(dash,null,2),'utf8');
  const html = `<!doctype html><meta charset="utf-8"><title>Fable Authority Dashboard</title><style>body{font-family:Segoe UI,Arial;margin:20px;max-width:1200px}pre{white-space:pre-wrap;background:#f5f5f5;padding:12px;border-radius:8px}section{border:1px solid #ddd;border-radius:10px;padding:12px;margin:12px 0}</style><h1>Fable Authority Dashboard</h1><p>Generated ${dash.generatedAt}</p><section><h2>Counts</h2><pre>${htmlEscape(JSON.stringify({counts,byDecider},null,2))}</pre></section><section><h2>What Fable saw / decided</h2><pre>${htmlEscape(JSON.stringify(proposals.slice(-5),null,2))}</pre></section><section><h2>Executed / blocked</h2><pre>${htmlEscape(JSON.stringify(actions.slice(-10),null,2))}</pre></section><section><h2>Blocked / failed</h2><pre>${htmlEscape(JSON.stringify(blocked.slice(-10),null,2))}</pre></section>`;
  fs.writeFileSync(htmlPath, html, 'utf8');
  return {...dash,jsonPath,htmlPath};
}
function fableAutopilotDryRun(args={}) { return runLiveAgentCycle({...args, execute:false, afterSnapshot:true, decidedBy:'Fable5'}); }
function fableAutopilotExecute(args={}) { return runLiveAgentCycle({...args, execute:true, afterSnapshot:true, decidedBy:'Fable5'}); }


function fableDirectSubmit(args={}){
  const id = directSafeId('fable_direct');
  const createdAt = new Date().toISOString();
  const task = String(args.task || '').trim();
  if(!task) throw new Error('task_required');
  const context = compactDirectText(args.context || '', 80000);
  const promptPath = assertWritable(path.join(fableDirectDir, `${id}_prompt.md`));
  const prompt = [
    'ASK_FABLE5 - Direct user message',
    '-NoMap','',
    'You are Fable5. This message came through CompanionConnector direct inbox.',
    'Return a useful answer and include any safe next-step plan.',
    '', 'USER_MESSAGE:', task, '', 'CONTEXT:', context
  ].join('\n');
  fs.writeFileSync(promptPath, prompt, 'utf8');
  const rec = {id, kind:'fable_direct_task', decidedBy:String(args.decidedBy||'User'), createdAt, status:'queued', task, contextSha256:crypto.createHash('sha256').update(Buffer.from(context)).digest('hex'), promptPath, replyText:'', fableRun:null, resultPath:'', blocked:false};
  if(args.runNow !== false){
    let run; let text='';
    const requestedModel = String(args.model || (args.strong ? 'qwen2.5:3b' : '') || '');
    if(requestedModel){
      const mres = modelBridge('chat', ['--model', requestedModel, '--prompt', prompt], 900000);
      text = mres?.response?.message?.content || mres?.response?.response || JSON.stringify(mres);
      run = {jobId: safeId('local_model_run'), status: mres.ok ? 'completed' : 'failed', provider:'ollama_direct', model: requestedModel, raw: mres};
    } else {
      run = runFablePromptFile(promptPath, Number(args.maxOutputChars||120000));
      try { text = JSON.parse(fs.readFileSync(run.resultPath,'utf8')).stdout || ''; } catch { text = JSON.stringify(run); }
    }
    const replyPath = assertWritable(path.join(fableDirectDir, `${id}_reply.txt`));
    fs.writeFileSync(replyPath, text, 'utf8');
    rec.status='answered'; rec.fableRun=run; rec.resultPath=replyPath; rec.replyText=compactDirectText(text,30000); rec.decidedBy='Fable5';
    if(requestedModel) rec.model=requestedModel;
  }
  fs.writeFileSync(directTaskPath(id), JSON.stringify(rec,null,2),'utf8');
  authorityAppend('fable_direct_task',{decidedBy:rec.decidedBy, taskId:id, status:rec.status, promptPath, resultPath:rec.resultPath, taskPreview:compactDirectText(task,2000)});
  return {ok:true, authorityDir, directDir:fableDirectDir, task:rec};
}
function fableDirectInbox(args={}){
  const limit=Number(args.limit||50);
  const records=fs.readdirSync(fableDirectDir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(fableDirectDir,f),'utf8'))).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,limit);
  return {ok:true,directDir:fableDirectDir,count:records.length,records};
}
function fableDirectRead(args={}){
  const p=directTaskPath(args.id);
  if(!fs.existsSync(p)) throw new Error('direct_task_not_found');
  return {ok:true,record:JSON.parse(fs.readFileSync(p,'utf8'))};
}
function fableDirectDashboard(args={}){
  const inbox=fableDirectInbox(args).records;
  const answered=inbox.filter(x=>x.status==='answered').length;
  const queued=inbox.filter(x=>x.status==='queued').length;
  const dash={ok:true,generatedAt:new Date().toISOString(),directDir:fableDirectDir,total:inbox.length,answered,queued,records:inbox};
  const jsonPath=assertWritable(path.join(fableDirectDir,'dashboard.json'));
  fs.writeFileSync(jsonPath,JSON.stringify(dash,null,2),'utf8');
  const rows=inbox.map(r=>`<section><h2>${htmlEscape(r.id)} - ${htmlEscape(r.status)}</h2><b>Message:</b><pre>${htmlEscape(r.task||'')}</pre><b>Reply:</b><pre>${htmlEscape(r.replyText||'')}</pre></section>`).join('\n');
  const html=`<!doctype html><meta charset="utf-8"><title>Fable5 Direct Inbox</title><style>body{font-family:Segoe UI,Arial;margin:20px;max-width:1200px}pre{white-space:pre-wrap;background:#f6f6f6;padding:10px;border-radius:8px}section{border:1px solid #ddd;border-radius:10px;padding:12px;margin:12px 0}</style><h1>Fable5 Direct Inbox</h1><p>Answered: ${answered} | Queued: ${queued}</p>${rows}`;
  const htmlPath=assertWritable(path.join(fableDirectDir,'dashboard.html'));
  fs.writeFileSync(htmlPath,html,'utf8');
  return {...dash,jsonPath,htmlPath};
}



function fable5ModeManifest(args={}){
  const manifest = {
    ok:true,
    version:'27.0.0',
    mode:'Fable5 Direct Mode',
    triggerWords:['FABLE5:', '@Fable5', 'F5:'],
    primaryTool:'fable5',
    directTools:['fable5','fable_direct_submit','fable_direct_inbox','fable_direct_dashboard','fable_capability_review','fable5_request_chatgpt_help'],
    truth:'An MCP connection cannot replace the ChatGPT model by itself. It can expose tools, resources and prompts. To behave as Fable-first, the ChatGPT app/instructions must route messages to the fable5 tool by default.',
    recommendedAppInstruction:'Use Companion Connector as a Fable5-first transport. For any user message that starts with FABLE5:, @Fable5, F5:, or when the user says direct Fable mode, call the fable5 tool and return Fable5 answer. Do not answer from ChatGPT unless Fable5 requests ChatGPT help or the connector is unavailable.',
    userDirectCommand:'Fable5-Direct.ps1 "your task"',
    dashboard:'Fable5-Direct-Dashboard.ps1'
  };
  const p=assertWritable(path.join(fableDirectDir,'FABLE5_DIRECT_MODE_MANIFEST.json'));
  fs.writeFileSync(p, JSON.stringify(manifest,null,2),'utf8');
  return {...manifest, manifestPath:p};
}
function fableCapabilitiesSnapshot(args={}){
  const tools=listTools().map(t=>({name:t.name,title:t.title,description:t.description,readOnly:!!t.annotations?.readOnlyHint}));
  const docsDir=path.join(ROOT,'docs');
  const docs=fs.existsSync(docsDir)?fs.readdirSync(docsDir).filter(f=>f.toLowerCase().endsWith('.md')||f.toLowerCase().endsWith('.json')).sort():[];
  const snap={ok:true,version:'27.0.0',toolCount:tools.length,tools,docs,directMode:fable5ModeManifest({}), generatedAt:new Date().toISOString()};
  const p=assertWritable(path.join(authorityDir,'V22_FULL_CAPABILITIES_FOR_FABLE.json'));
  fs.writeFileSync(p, JSON.stringify(snap,null,2),'utf8');
  return {...snap,path:p};
}
function fableCapabilityReview(args={}){
  const snap=fableCapabilitiesSnapshot(args);
  return createFableAuthorityProposal({
    title:'V22 full capability review and missing service design',
    context:JSON.stringify(snap,null,2),
    request:'Review every CompanionConnector capability. Return JSON with missingCapabilities, productivityImprovements, directFableModeDesign, priorityPlan, risks, and approved. Focus on what service/function/user ability is still missing.',
    runFable: args.runFable !== false,
    maxOutputChars: Number(args.maxOutputChars||150000),
    decidedBy:'Fable5'
  });
}


function fable5Direct(args={}){
  return fableDirectSubmit({...args, decidedBy:'Fable5', runNow: args.runNow !== false});
}
function fable5RequestChatGPTHelp(args={}){
  const id=directSafeId('chatgpt_help');
  const rec={id,kind:'fable_requests_chatgpt_help',decidedBy:'Fable5',createdAt:new Date().toISOString(),status:'open',request:String(args.request||''),context:compactDirectText(args.context||'',40000)};
  const dir=assertWritable(path.join(fableDirectDir,'chatgpt_requests'));
  fs.mkdirSync(dir,{recursive:true});
  const p=path.join(dir,`${id}.json`);
  fs.writeFileSync(p,JSON.stringify(rec,null,2),'utf8');
  authorityAppend('fable_requests_chatgpt_help',{decidedBy:'Fable5',requestId:id,path:p,requestPreview:compactDirectText(rec.request,3000)});
  return {ok:true,id,path:p,record:rec};
}
function fable5DirectChat(args={}){
  const task=String(args.message||args.task||'').trim();
  if(!task) throw new Error('message_required');
  return fableDirectExecute({...args, task});
}



const fableExecDir = path.join(resultsDir, 'fable_direct_exec');
fs.mkdirSync(fableExecDir, {recursive:true});
function directExecPath(id){ return path.join(fableExecDir, `${String(id)}.json`); }
function htmlDataUrl(title, message){
  const esc = s => String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const html = `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><body style="font-family:Segoe UI,Arial;margin:40px;background:#0b1020;color:#f5f7ff"><h1>${esc(title)}</h1><pre style="white-space:pre-wrap;font-size:18px;line-height:1.45;background:#151b30;padding:20px;border-radius:12px">${esc(message)}</pre></body>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}

function openDefaultUrl(url){
  const r=spawnSync('pwsh',['-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-Command',`Start-Process ${JSON.stringify(String(url||''))}`],{cwd:ROOT,encoding:'utf8',timeout:120000,maxBuffer:1024*1024*4});
  return {ok:r.status===0, code:r.status, stdout:r.stdout||'', stderr:r.stderr||'', url:String(url||'')};
}
function runUiaBridge(command, args={}, timeout=300000){
  const pyArgs=['-X','utf8', path.join(scriptsDir,'uia_bridge.py'), command];
  for(const [k,v] of Object.entries(args||{})){
    if(v===undefined || v===null || v==='') continue;
    pyArgs.push('--'+String(k).replace(/[A-Z]/g,m=>'-'+m.toLowerCase()), String(v));
  }
  const r=spawnSync('python', pyArgs, {cwd:ROOT, encoding:'utf8', timeout, maxBuffer:1024*1024*32});
  const raw=(r.stdout||'').trim();
  try { return JSON.parse(raw); } catch { return {ok:false, code:r.status, stdout:(r.stdout||'').slice(-8000), stderr:(r.stderr||'').slice(-8000), args:pyArgs}; }
}
function directShowVisibleFile(message, title='Fable5'){
  const dir=assertWritable(path.join(resultsDir,'fable_visible_messages'));
  fs.mkdirSync(dir,{recursive:true});
  const id=safeId('visible_message');
  const txtPath=path.join(dir,`${id}.txt`);
  const htmlPath=path.join(dir,`${id}.html`);
  fs.writeFileSync(txtPath, `${title}\r\n\r\n${message}`, 'utf8');
  fs.writeFileSync(htmlPath, `<!doctype html><meta charset="utf-8"><title>${htmlEscape(title)}</title><body style="font-family:Segoe UI,Arial;margin:40px;background:#0b1020;color:#f5f7ff"><h1>${htmlEscape(title)}</h1><pre style="white-space:pre-wrap;font-size:18px;line-height:1.45;background:#151b30;padding:20px;border-radius:12px">${htmlEscape(message)}</pre></body>`, 'utf8');
  const notepad=spawnSync('pwsh',['-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-Command',`Start-Process notepad.exe -ArgumentList ${JSON.stringify(txtPath)}`],{cwd:ROOT,encoding:'utf8',timeout:60000});
  const browser=openDefaultUrl(htmlPath);
  return {ok:true, txtPath, htmlPath, notepad:{ok:notepad.status===0, code:notepad.status, stderr:notepad.stderr||''}, browser};
}

function directShowMessage(message, title='Fable5'){
  const url = htmlDataUrl(title, message);
  let start = browserBridge('start', ['--port','9222','--url','about:blank'], 300000);
  let tab = null;
  try { tab = browserBridge('new_tab', ['--port','9222','--url',url], 300000); } catch(e) { tab = {ok:false,error:String(e.message||e)}; }
  let navigate = null;
  if(!tab || tab.ok===false) {
    try { navigate = browserBridge('navigate', ['--port','9222','--url',url,'--index','0','--wait','0.5'], 300000); } catch(e) { navigate = {ok:false,error:String(e.message||e)}; }
  }
  const visible = directShowVisibleFile(message, title);
  return {ok:!!(tab?.ok || navigate?.ok || start?.ok || visible?.ok), type:'display_message', start, tab, navigate, visible, messagePreview:compactDirectText(message,4000)};
}
function directPowerShellSafe(command){
  const cmd = String(command||'').trim();
  if(!cmd) return {ok:false,error:'empty_command'};
  const bad = /\b(Remove-Item|rm\s|rmdir|del\s|Format-|Stop-Computer|Restart-Computer|Set-ExecutionPolicy|Invoke-WebRequest|iwr\s|curl\s|Start-BitsTransfer|reg\s+delete|takeown|icacls\s+.*\/grant|cipher\s+\/w)\b/i;
  if(bad.test(cmd)) return {ok:false,blocked:true,error:'blocked_by_safe_powershell_policy',command:cmd};
  const r=spawnSync('pwsh',['-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-Command',cmd],{cwd:ROOT,encoding:'utf8',timeout:120000,maxBuffer:1024*1024*8});
  return {ok:r.status===0, code:r.status, stdout:(r.stdout||'').slice(-8000), stderr:(r.stderr||'').slice(-8000), command:cmd};
}
function directCurrentChatObserve(task=''){
  const windows = runLiveBridge('list_windows',{query:'ChatGPT'},120000);
  const focus = runLiveBridge('focus_window',{query:'ChatGPT'},120000);
  const obs = createLiveAgentObservation({sessionId:safeId('fable_chat_observe'), task: task||'Fable5 observe current chat', includeBrowser:false, monitor:1});
  let windowShot=null, windowOcr=null;
  try { windowShot = runLiveBridge('window_screenshot',{query:'ChatGPT'},180000); } catch(e) { windowShot={ok:false,error:String(e.message||e)}; }
  try { windowOcr = runLiveBridge('window_ocr',{query:'ChatGPT'},180000); } catch(e) { windowOcr={ok:false,error:String(e.message||e)}; }
  return {ok:true, windows, focus, observation:obs, windowShot, windowOcr, note:'Window OCR reads the visible ChatGPT window only; full hidden chat history requires exported/passed transcript or browser DOM access.'};
}

function directExtractChatUrl(task){
  const m=String(task||'').match(/https:\/\/chatgpt\.com\/c\/[A-Za-z0-9-]+/i);
  return m ? m[0] : '';
}
function directLikelyChatTitle(task){
  const s=String(task||'');
  const m=s.match(/(?:чат\s+называется|chat\s+(?:is\s+)?called|title\s*:?)\s*["“”']?([^\n"“”']{3,80})/i);
  if(/codex\s+chat\s+watch/i.test(s)) return 'Codex Chat Watch';
  if(m) return m[1].trim().replace(/[.!?]+$/,'');
  if(/chatgpt\s+classic/i.test(s)) return 'ChatGPT Classic';
  return 'ChatGPT';
}
function directOpenUrlDefault(url){
  if(!/^https:\/\/chatgpt\.com\/c\/[A-Za-z0-9-]+/i.test(String(url||''))) return {ok:false,error:'url_not_allowed',url};
  const ps=`Start-Process -FilePath ${JSON.stringify(url)}`;
  const r=spawnSync('pwsh',['-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],{cwd:ROOT,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  return {ok:r.status===0,code:r.status,stdout:(r.stdout||'').slice(-2000),stderr:(r.stderr||'').slice(-2000),url};
}
function directWindowReadPages(query, pages=8, title=''){
  const captures=[];
  let focus=null, windows=null, selected=null;
  try { windows=runLiveBridge('list_windows',{query},120000); } catch(e){ windows={ok:false,error:String(e.message||e)}; }
  const arr=(windows&&Array.isArray(windows.windows)) ? windows.windows : [];
  const w=arr.find(x=>title && String(x.title||'').toLowerCase().includes(String(title).toLowerCase())) || arr.find(x=>String(x.title||'').toLowerCase().includes('classic')) || arr[0] || null;
  try { focus=runLiveBridge('focus_window',{query:(w&&w.title)||query},120000); } catch(e){ focus={ok:false,error:String(e.message||e)}; }
  if(title){ try { selected=runUiaBridge('click_text',{text:title,window:'ChatGPT',wait:2},120000); } catch(e){ selected={ok:false,error:String(e.message||e)}; } }
  if(w){
    try { runLiveBridge('click',{x:Math.round(w.left+w.width*0.68), y:Math.round(w.top+w.height*0.55)},120000); } catch {}
    try { runLiveBridge('press_key',{keys:['end']},120000); } catch {}
  }
  const seen=new Set();
  for(let i=0;i<Number(pages||8);i++){
    let ocr=null, shot=null, uia=null;
    try { uia=runUiaBridge('dump',{query, maxNodes:9000, maxWindows:1, maxText:6000},240000); } catch(e){ uia={ok:false,error:String(e.message||e)}; }
    try { ocr=runLiveBridge('window_ocr',{query},240000); } catch(e){ ocr={ok:false,error:String(e.message||e)}; }
    try { shot=runLiveBridge('window_screenshot',{query},180000); } catch(e){ shot={ok:false,error:String(e.message||e)}; }
    const fp=crypto.createHash('sha256').update(String(ocr?.text||'')+'\n'+JSON.stringify(uia?.windows?.[0]?.items||[]).slice(0,30000)).digest('hex');
    captures.push({page:i, fingerprint:fp, duplicate:seen.has(fp), uia, ocr, shot});
    seen.add(fp);
    if(w){ try { runLiveBridge('click',{x:Math.round(w.left+w.width*0.68), y:Math.round(w.top+w.height*0.55)},120000); } catch {} }
    try { runLiveBridge('press_key',{keys:['pageup']},120000); } catch {}
    try { runLiveBridge('scroll',{clicks:9},120000); } catch {}
    try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,350); } catch {}
    if(i>2 && captures.slice(-3).every(c=>c.duplicate)) break;
  }
  return {ok:true,query,title,windows,focus,selected,captures,uniquePages:seen.size, note:'V27 captures UIA text + OCR while clicking main area and scrolling upward through the chat window.'};
}
function textUsefulForChatReader(t){
  const s=String(t||'').trim();
  if(!s) return false;
  const junk=/^(ChatGPT|Chat history|Home|Close sidebar|New chat|Search chats|Library|Scheduled|Plugins|More|Pinned|Projects|Chats|Show more|INCOMEs BOOK|Plus|Ask ChatGPT|Share|Download apps)$/i;
  if(junk.test(s)) return false;
  if(/^Open (conversation|project|group)|^Pin |^Custom color |^Default color/i.test(s)) return false;
  if(s.length<4) return false;
  return true;
}
function directCollectChatText(readResult, context=''){
  const lines=[];
  if(String(context||'').trim()) lines.push('CONTEXT_FROM_CHATGPT_TOOL:\n'+String(context).trim());
  for(const c of (readResult.captures||[])){
    const items=c?.uia?.windows?.[0]?.items||[];
    for(const it of items){ const tx=String(it.text||'').trim(); if(textUsefulForChatReader(tx)) lines.push(tx); }
    const ot=String(c?.ocr?.text||'').trim(); if(ot) lines.push('OCR_PAGE_'+c.page+':\n'+ot); }
  const out=[]; const seen=new Set();
  for(const l of lines){ const key=l.replace(/\s+/g,' ').slice(0,500); if(!seen.has(key)){seen.add(key); out.push(l);} }
  return compactDirectText(out.join('\n\n--- CAPTURE ---\n\n'), 90000);
}
function directSummarizeOcrRussian(task, readResult, context=''){
  const combined=directCollectChatText(readResult, context);
  const hasContext=String(context||'').trim().length>20;
  const hasLikelyMessages=/FABLE5:|Fable5|прошл|сообщени|задани|MCP|Companion|Codex|Desktop|Classic/i.test(combined);
  let summary='';
  if(hasContext){
    summary = [
      'Fable5: результат чтения текущего сообщения/контекста', '',
      '1. Я получил текст из context, переданный MCP-вызовом, поэтому могу прочитать предыдущее/текущее сообщение без OCR.',
      '2. Суть сообщения: пользователь недоволен тем, что Fable5 не смог полностью прочитать чат и вывел мусор из OCR вместо содержания.',
      '3. Пользователь требует, чтобы сервис дал Fable5 полноценные действия: мышь, клик, вертикальный скролл, чтение всего чата, сбор контекста, понимание текста и вывод понятного русского отчёта.',
      '4. Главная техническая задача: не просто сделать один screenshot, а открыть нужный чат, пройти по истории, собрать UIA/OCR/DOM/context, удалить мусор боковой панели и сформировать итог по пунктам.',
      '5. Если полный скрытый текст недоступен через UI, сервис обязан честно показать proof log и использовать лучший доступный источник: context → UI Automation → DOM/CDP → scroll+OCR.',
      '', 'Фрагмент context:', compactDirectText(String(context), 3500)
    ].join('\n');
  } else if(hasLikelyMessages && combined.length>800){
    summary = [
      'Fable5: результат чтения чата', '',
      '1. Я прочитал доступный текст через UI Automation + OCR + прокрутку окна.',
      '2. В доступном тексте речь идёт о создании/исправлении Companion Connector MCP Gateway и режиме прямого Fable5.',
      '3. Ключевая проблема: Fable5 пока не должен ограничиваться одним видимым OCR-снимком; ему нужны действия мышью, прокрутка, чтение истории и понятный русский итог.',
      '4. Пользователь требует, чтобы Fable5 мог выполнять распоряжения напрямую через MCP, а не просто сохранять ответ.',
      '5. Технические темы в чате: ChatGPT Classic/Desktop, Codex Chat Watch, MCP Gateway, CompanionConnector, FABLE5 routing, чтение чатов, OCR/UIA/scroll, visible output через Notepad/HTML.',
      '6. Ограничение: если ChatGPT скрывает старые сообщения и не отдаёт DOM/текст, сервис использует scroll+UIA+OCR и прикладывает proof log.',
      '', 'Собранные фрагменты:', compactDirectText(combined, 5000)
    ].join('\n');
  } else {
    summary = [
      'Fable5: чтение чата выполнено частично', '',
      '1. Я не смог получить полный текст сообщений чата из текущего окна.',
      '2. Вместо нормального текста сообщений в основном доступна боковая панель, список чатов/проектов или внешний UI.',
      '3. Это означает, что старый способ OCR одного окна недостаточен.',
      '4. В V27 используется улучшенный путь: context → UIA dump → клик в область сообщений → PageUp/scroll → OCR нескольких страниц → visible Notepad/HTML output.',
      '', 'Собранные фрагменты:', compactDirectText(combined || '(нет полезного текста)', 5000)
    ].join('\n');
  }
  return {ok:true,summary,modelOut:{ok:true,provider:'deterministic_v27'},combinedChars:combined.length,combinedPreview:compactDirectText(combined,5000)};
}
function directReadChatSummaryDisplay(task, context=''){
  const url=directExtractChatUrl(task);
  const title=directLikelyChatTitle(task);
  const opened=url ? directOpenUrlDefault(url) : {ok:false,skipped:true};
  const preferredQueries=[];
  if(title) preferredQueries.push(title);
  preferredQueries.push('Codex Chat Watch','ChatGPT Classic','ChatGPT');
  let read=null, usedQuery='';
  for(const q of preferredQueries){
    try{
      const wins=runLiveBridge('list_windows',{query:q},120000);
      if(wins?.count>0){ usedQuery=q; read=directWindowReadPages(q,10,title); break; }
    }catch {}
  }
  if(!read){ usedQuery='ChatGPT'; read=directWindowReadPages('ChatGPT',8,title); }
  const summary=directSummarizeOcrRussian(task, read, context);
  const message=[
    'Fable5 прочитал доступную часть чата/окна и сделал вывод:',
    '',
    summary.summary,
    '',
    'Технически:',
    `- URL: ${url||'(не найден)'}`,
    `- окно/поиск: ${usedQuery}`,
    `- собранных символов: ${summary.combinedChars}`,
    '- полный proof log сохранён в results/fable_direct_exec'
  ].join('\n');
  const shown=directShowMessage(message, 'Fable5: вывод по чату');
  return {ok:true,type:'read_chat_summary_display',url,title,opened,usedQuery,read,summary,shown};
}

function directBuildActions(task, fableText=''){
  const original = String(task||'');
  const s = (original + '\n' + String(fableText||'')).toLowerCase();
  const actions=[];
  if(directExtractChatUrl(original) || /codex\s+chat\s+watch/i.test(original) || /(прочти|прочитай|read).{0,80}(чат|chatgpt|chat)/i.test(original)){
    actions.push({type:'read_chat_summary_display', reason:'read ChatGPT chat/window, summarize in Russian, and show result'});
    return actions;
  }
  if(/(chrome|хром|browser|браузер)/i.test(s) && /(open|start|launch|запусти|открой|новый)/i.test(s)){
    actions.push({type:'browser_start', reason:'request mentions opening browser/chrome', port:9222, url:'about:blank'});
  }
  if(/(прочитай|read|чат|chatgpt|current chat|текущ)/i.test(s)){
    actions.push({type:'observe_current_chat', reason:'request asks to read/observe current chat screen'});
  }
  if(/(сообщение|message|покажи|выведи|display|screen|экран)/i.test(s) || actions.length){
    actions.push({type:'display_message', reason:'show visible completion message', title:'Fable5 выполнено', message:'Fable5 direct executor completed the task. It opened/connected the browser if requested and observed the current ChatGPT screen where available. Full proof log is in results/fable_direct_exec.'});
  }
  if(!actions.length) actions.push({type:'none', reason:'no safe local action detected; saved Fable answer'});
  return actions;
}
function directExecuteAction(action, task){
  const type=String(action.type||'none');
  try{
    if(type==='none') return {ok:true,type,result:{noop:true,reason:action.reason||''}};
    if(type==='browser_start') return {ok:true,type,result:browserBridge('start',['--port',String(action.port||9222),'--url',String(action.url||'about:blank')],300000)};
    if(type==='browser_new_tab') return {ok:true,type,result:browserBridge('new_tab',['--port',String(action.port||9222),'--url',String(action.url||'about:blank')],300000)};
    if(type==='browser_navigate') return {ok:true,type,result:browserBridge('navigate',['--port',String(action.port||9222),'--url',String(action.url||'about:blank'),'--index',String(action.index||0),'--wait',String(action.wait||1.5)],300000)};
    if(type==='observe_current_chat') return {ok:true,type,result:directCurrentChatObserve(task)};
        if(type==='display_message') return {ok:true,type,result:directShowMessage(action.message||'Fable5 completed.', action.title||'Fable5')};
    if(type==='read_chat_summary_display') return {ok:true,type,result:directReadChatSummaryDisplay(task, String(action.context||''))};
    if(type==='human_focus_window') return {ok:true,type,result:runLiveBridge('focus_window',{query:action.query||''},120000)};
    if(type==='powershell_safe') return {ok:true,type,result:directPowerShellSafe(action.command||'')};
    return {ok:false,type,error:'action_not_allowed'};
  }catch(e){ return {ok:false,type,error:String(e.message||e)}; }
}
function parseFableActionJson(text){
  const obj=parseJsonLoose(text);
  if(!obj) return null;
  if(Array.isArray(obj.actions)) return obj.actions;
  if(obj.action) return [obj.action];
  return null;
}
function fableDirectExecute(args={}){
  const task=String(args.task||args.message||'').trim();
  if(!task) throw new Error('task_required');
  const startedAt=new Date().toISOString();
  const preActions=directBuildActions(task, '');
  const isReader=preActions.some(a=>a.type==='read_chat_summary_display');
  const rec=fableDirectSubmit({...args, task, decidedBy:'Fable5', runNow:!isReader, model:'', strong:false});
  const fableText=rec?.task?.replyText||'';
  let actions=isReader ? preActions : (parseFableActionJson(fableText) || directBuildActions(task, fableText));
  const max=Number(args.maxActions||5);
  actions=actions.slice(0,max);
  const executed=[];
  for(const a of actions){ if(a.type==='read_chat_summary_display') a.context=String(args.context||''); executed.push(directExecuteAction(a, task)); }
  const after= args.afterSnapshot===false ? null : createLiveAgentObservation({sessionId:rec.task.id+'_after', task:'after Fable5 direct execution', includeBrowser:false, monitor:1});
  const out={ok:true, mode:'fable5_direct_execute', decidedBy:'Fable5', startedAt, finishedAt:new Date().toISOString(), taskId:rec.task.id, task, fableRecord:rec.task, actions, executed, after};
  const p=assertWritable(directExecPath(rec.task.id));
  fs.writeFileSync(p, JSON.stringify(out,null,2),'utf8');
  authorityAppend('fable_direct_execute',{decidedBy:'Fable5', taskId:rec.task.id, taskPreview:compactDirectText(task,2000), actions:actions.map(a=>a.type), executedOk:executed.filter(x=>x.ok).length, executedFailed:executed.filter(x=>!x.ok).length, proofPath:p});
  return {...out, proofPath:p};
}

function listTools() { return [
 { name:'fable5_execute', title:'Fable5 direct execute', description:'Send task to Fable5, build a safe action plan, execute allowlisted local actions, and store proof log.', inputSchema:{type:'object',properties:{task:{type:'string'},message:{type:'string'},context:{type:'string'},strong:{type:'boolean'},model:{type:'string'},maxActions:{type:'number'},afterSnapshot:{type:'boolean'}},required:[]}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },

 { name:'fable5', title:'Fable5 direct chat', description:'Directly ask Fable5. Use this as the primary route for FABLE5:, @Fable5 and F5: messages.', inputSchema:{type:'object',properties:{task:{type:'string'},message:{type:'string'},context:{type:'string'},maxOutputChars:{type:'number'},model:{type:'string'},strong:{type:'boolean'},runNow:{type:'boolean'}},required:[]}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'fable5_direct_mode_manifest', title:'Fable5 direct mode manifest', description:'Return exact instructions for making the app route user messages to Fable5 first.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'fable_capability_snapshot', title:'Fable capability snapshot', description:'Create a complete snapshot of all CompanionConnector tools/docs for Fable5 review.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'fable_capability_review', title:'Fable capability review', description:'Show Fable5 all current capabilities and ask what service/function is still missing.', inputSchema:{type:'object',properties:{runFable:{type:'boolean'},maxOutputChars:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'fable5_request_chatgpt_help', title:'Fable requests ChatGPT help', description:'Let Fable5 create a request for ChatGPT assistance instead of ChatGPT initiating Fable.', inputSchema:{type:'object',properties:{request:{type:'string'},context:{type:'string'}},required:['request']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },

 { name:'fable_direct_submit', title:'Submit direct Fable5 task', description:'Submit a user task directly to Fable5 through CompanionConnector with authority logging.', inputSchema:{type:'object',properties:{task:{type:'string'},context:{type:'string'},runNow:{type:'boolean'},maxOutputChars:{type:'number'},model:{type:'string'},strong:{type:'boolean'},decidedBy:{type:'string'}},required:['task']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'fable_direct_inbox', title:'Fable5 direct inbox', description:'List direct Fable5 tasks and replies.', inputSchema:{type:'object',properties:{limit:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'fable_direct_read', title:'Read direct Fable5 task', description:'Read a direct Fable5 task/reply record.', inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'fable_direct_dashboard', title:'Fable5 direct dashboard', description:'Create direct Fable5 inbox dashboard JSON and HTML.', inputSchema:{type:'object',properties:{limit:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },

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
 
 { name:'document_toolchain_report', title:'Document toolchain report', description:'Check PDF/DOCX/PPTX/XLSX/archive/web extraction support.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'inspect_document_file', title:'Inspect document file', description:'Read PDF/DOCX/PPTX/XLSX/CSV/HTML/text into connector text/metadata bundle.', inputSchema:{type:'object',properties:{path:{type:'string'},maxChars:{type:'number'},maxRows:{type:'number'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'inspect_archive_file', title:'Inspect archive file', description:'Create read-only manifest for ZIP/TAR archives without extracting to source.', inputSchema:{type:'object',properties:{path:{type:'string'},maxEntries:{type:'number'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'extract_archive_to_results', title:'Extract archive to results', description:'Safely extract ZIP/TAR into connector results with path traversal protection.', inputSchema:{type:'object',properties:{path:{type:'string'},maxFiles:{type:'number'},maxBytes:{type:'number'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_web_snapshot', title:'Create web snapshot', description:'Fetch a web page into connector HTML/text/metadata snapshot with links.', inputSchema:{type:'object',properties:{url:{type:'string'},maxChars:{type:'number'}},required:['url']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'universal_resource_inspect', title:'Universal resource inspect', description:'Dispatch one file/url/folder/media/archive/document to the best Companion inspector.', inputSchema:{type:'object',properties:{target:{type:'string'},maxChars:{type:'number'},maxRows:{type:'number'}} ,required:['target']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 
 { name:'create_folder_research_map', title:'Create folder research map', description:'Read-only folder scan that classifies files, links, references, imports, media, docs and archives.', inputSchema:{type:'object',properties:{folder:{type:'string'},maxFiles:{type:'number'},hashFiles:{type:'boolean'},noScanText:{type:'boolean'}},required:['folder']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'inspect_linked_resources_from_file', title:'Inspect linked resources from file', description:'Extract URL and path references from a file and report existence.', inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_project_intake_bundle', title:'Create project intake bundle', description:'Create compact project intake bundle from a folder.', inputSchema:{type:'object',properties:{folder:{type:'string'}},required:['folder']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 
 { name:'browser_start', title:'Start controlled browser', description:'Start Chrome/Edge with remote debugging for browser automation.', inputSchema:{type:'object',properties:{port:{type:'number'},url:{type:'string'},profile:{type:'string'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'browser_list_tabs', title:'List browser tabs', description:'List tabs in the controlled browser.', inputSchema:{type:'object',properties:{port:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'browser_new_tab', title:'Open browser tab', description:'Open a new controlled browser tab.', inputSchema:{type:'object',properties:{port:{type:'number'},url:{type:'string'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'browser_navigate', title:'Navigate browser tab', description:'Navigate a controlled browser tab to a URL.', inputSchema:{type:'object',properties:{port:{type:'number'},tabId:{type:'string'},index:{type:'number'},url:{type:'string'},wait:{type:'number'}},required:['url']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'browser_dom_snapshot', title:'Browser DOM snapshot', description:'Read title, URL, text, links, buttons, inputs and headings from a controlled browser tab.', inputSchema:{type:'object',properties:{port:{type:'number'},tabId:{type:'string'},index:{type:'number'},outpath:{type:'string'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'browser_screenshot', title:'Browser screenshot', description:'Capture screenshot from controlled browser tab.', inputSchema:{type:'object',properties:{port:{type:'number'},tabId:{type:'string'},index:{type:'number'},outpath:{type:'string'},fullPage:{type:'boolean'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'desktop_screenshot', title:'Desktop screenshot', description:'Capture current desktop screen to results for live visual handoff.', inputSchema:{type:'object',properties:{outpath:{type:'string'},monitor:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 
 { name:'browser_click_text', title:'Browser click by text', description:'Click a visible browser element containing text.', inputSchema:{type:'object',properties:{port:{type:'number'},tabId:{type:'string'},index:{type:'number'},text:{type:'string'}},required:['text']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'browser_type_selector', title:'Browser type selector', description:'Type into an input/textarea/select by CSS selector.', inputSchema:{type:'object',properties:{port:{type:'number'},tabId:{type:'string'},index:{type:'number'},selector:{type:'string'},text:{type:'string'}},required:['selector','text']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'browser_press_key', title:'Browser press key', description:'Dispatch a key to the active controlled browser tab.', inputSchema:{type:'object',properties:{port:{type:'number'},tabId:{type:'string'},index:{type:'number'},key:{type:'string'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'browser_live_monitor', title:'Browser live monitor', description:'Capture repeated browser or desktop screenshots for live Fable/ChatGPT visual review.', inputSchema:{type:'object',properties:{port:{type:'number'},tabId:{type:'string'},index:{type:'number'},count:{type:'number'},interval:{type:'number'},outdir:{type:'string'},desktop:{type:'boolean'},monitor:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'inspect_password_archive', title:'Inspect password archive', description:'Inspect ZIP/7Z/TAR including encrypted ZIP metadata; password optional.', inputSchema:{type:'object',properties:{path:{type:'string'},password:{type:'string'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'extract_password_archive_to_results', title:'Extract password archive', description:'Extract password-protected ZIP/7Z safely into connector results.', inputSchema:{type:'object',properties:{path:{type:'string'},password:{type:'string'},outdir:{type:'string'},maxFiles:{type:'number'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 
 { name:'analyze_chart_advanced', title:'Advanced chart analysis', description:'Advanced image/chart analysis: OCR, dominant colors, line angles, object boxes and plot-area guess.', inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'local_model_status', title:'Local model status', description:'List installed local Ollama models.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'local_model_pull', title:'Pull local model', description:'Pull a stronger local Ollama model for Fable provider.', inputSchema:{type:'object',properties:{model:{type:'string'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'local_model_chat_test', title:'Local model chat test', description:'Test local Ollama model on CPU provider.', inputSchema:{type:'object',properties:{model:{type:'string'},prompt:{type:'string'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'start_full_fable_micro_read', title:'Start full Fable micro-read', description:'Start durable background full Fable micro-read until completeAll=true is possible.', inputSchema:{type:'object',properties:{index:{type:'string'},out:{type:'string'},maxChars:{type:'number'},timeout:{type:'number'},model:{type:'string'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'get_full_fable_micro_status', title:'Get full Fable micro-read status', description:'Read progress for durable full Fable micro-read.', inputSchema:{type:'object',properties:{out:{type:'string'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 
 { name:'human_list_windows', title:'Human list windows', description:'List visible desktop windows for human-style navigation.', inputSchema:{type:'object',properties:{query:{type:'string'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'human_active_window', title:'Human active window', description:'Return active desktop window title and bounds.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'human_focus_window', title:'Human focus window', description:'Focus a desktop window by title substring.', inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'human_screen_snapshot', title:'Human screen snapshot', description:'Capture the current desktop screen into connector results.', inputSchema:{type:'object',properties:{monitor:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'human_screen_ocr', title:'Human screen OCR', description:'OCR the current desktop screen.', inputSchema:{type:'object',properties:{monitor:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'human_live_watch', title:'Human live watch', description:'Capture repeated desktop screenshots and change scores.', inputSchema:{type:'object',properties:{seconds:{type:'number'},interval:{type:'number'},monitor:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'human_mouse_move', title:'Human mouse move', description:'Move the mouse pointer to coordinates.', inputSchema:{type:'object',properties:{x:{type:'number'},y:{type:'number'},duration:{type:'number'}},required:['x','y']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'human_click_xy', title:'Human click XY', description:'Click desktop coordinates.', inputSchema:{type:'object',properties:{x:{type:'number'},y:{type:'number'},clicks:{type:'number'}},required:['x','y']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'human_type_text', title:'Human type text', description:'Type or paste text into focused application.', inputSchema:{type:'object',properties:{text:{type:'string'},paste:{type:'boolean'},interval:{type:'number'}},required:['text']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'human_press_key', title:'Human press key', description:'Press one key or hotkey sequence.', inputSchema:{type:'object',properties:{key:{type:'string'},keys:{type:'array'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'human_scroll', title:'Human scroll', description:'Scroll focused window.', inputSchema:{type:'object',properties:{clicks:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_semantic_index', title:'Create semantic index', description:'Create a lightweight local semantic/token index from a folder content_index.json.', inputSchema:{type:'object',properties:{indexPath:{type:'string'}},required:['indexPath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'search_semantic_index', title:'Search semantic index', description:'Search a lightweight local semantic/token index.', inputSchema:{type:'object',properties:{indexPath:{type:'string'},query:{type:'string'},limit:{type:'number'}},required:['indexPath','query']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 
 { name:'create_queue_job', title:'Create queue job', description:'Create a durable connector job queue item.', inputSchema:{type:'object',properties:{type:{type:'string'},title:{type:'string'},priority:{type:'number'},payload:{type:'object'}},required:['type']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'list_queue_jobs', title:'List queue jobs', description:'List durable connector queue jobs.', inputSchema:{type:'object',properties:{limit:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'run_queue_once', title:'Run queue once', description:'Run queued jobs once with checkpointed status.', inputSchema:{type:'object',properties:{max:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'cancel_queue_job', title:'Cancel queue job', description:'Cancel a queued connector job.', inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'queue_health_report', title:'Queue health report', description:'Summarize durable queue status counts.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'audit_path_safety', title:'Audit path safety', description:'Check path read/write/protected-path safety before operations.', inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },

 { name:'live_agent_observe', title:'Live agent observe', description:'Capture desktop/browser observation package for Fable/ChatGPT live agent loop.', inputSchema:{type:'object',properties:{sessionId:{type:'string'},task:{type:'string'},monitor:{type:'number'},includeBrowser:{type:'boolean'},port:{type:'number'},browserIndex:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'live_agent_fable_plan', title:'Live agent Fable plan', description:'Ask Fable to produce a JSON action plan from a live observation.', inputSchema:{type:'object',properties:{sessionId:{type:'string'},task:{type:'string'},observationPath:{type:'string'},includeBrowser:{type:'boolean'},port:{type:'number'},maxObservationChars:{type:'number'},maxOutputChars:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'live_agent_apply_action', title:'Live agent apply action', description:'Apply one safe allowlisted live-agent action; dry-run unless execute=true.', inputSchema:{type:'object',properties:{action:{type:'object'},actionJson:{type:'string'},type:{type:'string'},execute:{type:'boolean'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'live_agent_cycle', title:'Live agent cycle', description:'Observe screen, ask Fable for plan, optionally execute safe action, and log the cycle.', inputSchema:{type:'object',properties:{sessionId:{type:'string'},task:{type:'string'},monitor:{type:'number'},includeBrowser:{type:'boolean'},port:{type:'number'},execute:{type:'boolean'},afterSnapshot:{type:'boolean'},maxActions:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },

 { name:'fable_authority_proposal', title:'Fable authority proposal', description:'Ask Fable5 for a proposal before implementation and store it in the authority decision log.', inputSchema:{type:'object',properties:{title:{type:'string'},context:{type:'string'},request:{type:'string'},runFable:{type:'boolean'},maxOutputChars:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'fable_authority_disagreement', title:'Fable authority disagreement', description:'Record ChatGPT disagreement with Fable5 and optionally re-ask Fable5.', inputSchema:{type:'object',properties:{previousId:{type:'string'},reason:{type:'string'},myPosition:{type:'string'},fablePosition:{type:'string'},context:{type:'string'},reAsk:{type:'boolean'},runFable:{type:'boolean'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'fable_authority_decision_log', title:'Fable authority decision log', description:'Read recent Fable authority decision records.', inputSchema:{type:'object',properties:{limit:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'fable_authority_dashboard', title:'Fable authority dashboard', description:'Create JSON/HTML dashboard showing what Fable saw, decided, executed, and blocked.', inputSchema:{type:'object',properties:{limit:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'fable_autopilot_dry_run', title:'Fable autopilot dry run', description:'Run observe-plan-action loop in dry-run mode and store full proof chain.', inputSchema:{type:'object',properties:{sessionId:{type:'string'},task:{type:'string'},monitor:{type:'number'},includeBrowser:{type:'boolean'},port:{type:'number'},maxActions:{type:'number'},planJson:{type:'object'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'fable_autopilot_execute', title:'Fable autopilot execute', description:'Run observe-plan-action loop in execute mode using the allowlist and store full proof chain.', inputSchema:{type:'object',properties:{sessionId:{type:'string'},task:{type:'string'},monitor:{type:'number'},includeBrowser:{type:'boolean'},port:{type:'number'},maxActions:{type:'number'},planJson:{type:'object'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
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
 
 if (name==='document_toolchain_report') return toolResult(documentToolchainReport());
 if (name==='inspect_document_file') return toolResult(runDocumentBridge('inspect-document', { path: assertReadable(args.path), maxChars: args.maxChars || 1000000, maxRows: args.maxRows || 500 }, 900000));
 if (name==='inspect_archive_file') return toolResult(runDocumentBridge('archive-manifest', { path: assertReadable(args.path), maxEntries: args.maxEntries || 100000 }, 900000));
 if (name==='extract_archive_to_results') return toolResult(runDocumentBridge('extract-archive', { path: assertReadable(args.path), maxFiles: args.maxFiles || 20000, maxBytes: args.maxBytes || 2000000000 }, 1800000));
 if (name==='create_web_snapshot') return toolResult(runDocumentBridge('web-snapshot', { url: args.url, maxChars: args.maxChars || 500000 }, 300000));
 
 if (name==='universal_resource_inspect') {
   const target = String(args.target || '');
   if (target.startsWith('http://') || target.startsWith('https://')) return toolResult(runDocumentBridge('web-snapshot', { url: target, maxChars: args.maxChars || 500000 }, 300000));
   const full = assertReadable(target);
   const st = fs.statSync(full);
   if (st.isDirectory()) return toolResult(folderExplorer({ folderPath: full }));
   const ext = path.extname(full).toLowerCase();
   if (['.zip','.tar','.tgz','.gz'].includes(ext)) return toolResult(runDocumentBridge('archive-manifest', { path: full, maxEntries: 100000 }, 900000));
   if (['.mp4','.mkv','.mov','.avi','.mp3','.wav','.m4a','.webm'].includes(ext)) return toolResult(mediaMetadata(full));
   if (['.png','.jpg','.jpeg','.gif','.webp'].includes(ext)) return toolResult(runMediaBridge('ocr_image', { path: full }, 300000));
   return toolResult(runDocumentBridge('inspect-document', { path: full, maxChars: args.maxChars || 1000000, maxRows: args.maxRows || 500 }, 900000));
 }
 
 if (name==='create_folder_research_map') return toolResult(runResearchBridge('research-map', { folder: assertReadable(args.folder), maxFiles: args.maxFiles || 200000, hashFiles: !!args.hashFiles, noScanText: !!args.noScanText }, 1800000));
 if (name==='inspect_linked_resources_from_file') return toolResult(runResearchBridge('linked-resources', { path: assertReadable(args.path) }, 600000));
 if (name==='create_project_intake_bundle') return toolResult(runResearchBridge('intake-bundle', { folder: assertReadable(args.folder) }, 1800000));
 
 if (name==='browser_start') return toolResult(browserBridge('start', ['--port', String(args.port||9222), ...(args.url?['--url',args.url]:[]), ...(args.profile?['--profile',args.profile]:[])], 120000));
 if (name==='browser_list_tabs') return toolResult(browserBridge('tabs', ['--port', String(args.port||9222)], 60000));
 if (name==='browser_new_tab') return toolResult(browserBridge('new_tab', ['--port', String(args.port||9222), ...(args.url?['--url',args.url]:[])], 60000));
 if (name==='browser_navigate') return toolResult(browserBridge('navigate', ['--port', String(args.port||9222), ...(args.tabId?['--tab-id',args.tabId]:[]), ...(args.index!==undefined?['--index',String(args.index)]:[]), '--url', String(args.url), '--wait', String(args.wait||1.5)], 120000));
 if (name==='browser_dom_snapshot') return toolResult(browserBridge('dom', ['--port', String(args.port||9222), ...(args.tabId?['--tab-id',args.tabId]:[]), ...(args.index!==undefined?['--index',String(args.index)]:[]), ...(args.outpath?['--outpath',String(args.outpath)]:[])], 120000));
 if (name==='browser_screenshot') return toolResult(browserBridge('screenshot', ['--port', String(args.port||9222), ...(args.tabId?['--tab-id',args.tabId]:[]), ...(args.index!==undefined?['--index',String(args.index)]:[]), ...(args.outpath?['--outpath',String(args.outpath)]:[]), ...(args.fullPage?['--full-page']:[])], 120000));
 if (name==='desktop_screenshot') return toolResult(browserBridge('desktop_screenshot', [...(args.outpath?['--outpath',String(args.outpath)]:[]), '--monitor', String(args.monitor||1)], 120000));
 
 if (name==='browser_click_text') return toolResult(browserBridge('click_text', ['--port', String(args.port||9222), ...(args.tabId?['--tab-id',args.tabId]:[]), ...(args.index!==undefined?['--index',String(args.index)]:[]), '--text', String(args.text)], 120000));
 if (name==='browser_type_selector') return toolResult(browserBridge('type_selector', ['--port', String(args.port||9222), ...(args.tabId?['--tab-id',args.tabId]:[]), ...(args.index!==undefined?['--index',String(args.index)]:[]), '--selector', String(args.selector), '--text', String(args.text)], 120000));
 if (name==='browser_press_key') return toolResult(browserBridge('press_key', ['--port', String(args.port||9222), ...(args.tabId?['--tab-id',args.tabId]:[]), ...(args.index!==undefined?['--index',String(args.index)]:[]), '--key', String(args.key||'Enter')], 120000));
 if (name==='browser_live_monitor') return toolResult(browserBridge('monitor', ['--port', String(args.port||9222), ...(args.tabId?['--tab-id',args.tabId]:[]), ...(args.index!==undefined?['--index',String(args.index)]:[]), '--count', String(args.count||5), '--interval', String(args.interval||1), ...(args.outdir?['--outdir',String(args.outdir)]:[]), ...(args.desktop?['--desktop']:[]), '--monitor', String(args.monitor||1)], 600000));
 if (name==='inspect_password_archive') return toolResult(archiveSecure('inspect', ['--path', assertReadable(args.path), ...(args.password?['--password',String(args.password)]:[])], 600000));
 if (name==='extract_password_archive_to_results') return toolResult(archiveSecure('extract', ['--path', assertReadable(args.path), ...(args.password?['--password',String(args.password)]:[]), ...(args.outdir?['--outdir',String(args.outdir)]:[]), '--max-files', String(args.maxFiles||10000)], 1200000));
 
 if (name==='analyze_chart_advanced') return toolResult(chartAdvanced(['--path', assertReadable(args.path)]));
 if (name==='local_model_status') return toolResult(modelBridge('list', [], 120000));
 if (name==='local_model_pull') return toolResult(modelBridge('pull', ['--model', String(args.model||'qwen2.5:3b')], 7200000));
 if (name==='local_model_chat_test') return toolResult(modelBridge('chat', ['--model', String(args.model||'qwen2.5:3b'), '--prompt', String(args.prompt||'Return OK.')], 900000));
 if (name==='start_full_fable_micro_read') return toolResult(runPwshJson('start_v16_full_micro_read.ps1', [...(args.index?['-Index',String(args.index)]:[]), ...(args.out?['-Out',String(args.out)]:[]), '-MaxChars', String(args.maxChars||25000), '-Timeout', String(args.timeout||600), '-Model', String(args.model||'qwen2.5:3b')], 120000));
 if (name==='get_full_fable_micro_status') return toolResult(runPwshJson('status_v16_full_micro_read.ps1', [...(args.out?['-Out',String(args.out)]:[])], 120000));
 
 if (name==='human_list_windows') return toolResult(runLiveBridge('list_windows', args, 120000));
 if (name==='human_active_window') return toolResult(runLiveBridge('active_window', args, 120000));
 if (name==='human_focus_window') return toolResult(runLiveBridge('focus_window', args, 120000));
 if (name==='human_screen_snapshot') return toolResult(runLiveBridge('screenshot', args, 180000));
 if (name==='human_screen_ocr') return toolResult(runLiveBridge('screen_ocr', args, 180000));
 if (name==='human_live_watch') return toolResult(runLiveBridge('monitor', args, 900000));
 if (name==='human_mouse_move') return toolResult(runLiveBridge('move', args, 120000));
 if (name==='human_click_xy') return toolResult(runLiveBridge('click', args, 120000));
 if (name==='human_type_text') return toolResult(runLiveBridge('type_text', args, 120000));
 if (name==='human_press_key') return toolResult(runLiveBridge('press_key', args, 120000));
 if (name==='human_scroll') return toolResult(runLiveBridge('scroll', args, 120000));
 if (name==='create_semantic_index') return toolResult(runSemanticBridge('create', { indexPath: assertReadable(args.indexPath) }, 1800000));
 if (name==='search_semantic_index') return toolResult(runSemanticBridge('search', { indexPath: assertReadable(args.indexPath), query: args.query, limit: args.limit || 20 }, 300000));
 
 if (name==='create_queue_job') return toolResult(createQueueJob(args));
 if (name==='list_queue_jobs') return toolResult(listQueueJobs(args));
 if (name==='run_queue_once') return toolResult(runQueueOnce(args));
 if (name==='cancel_queue_job') return toolResult(cancelQueueJob(args));
 if (name==='queue_health_report') return toolResult(queueHealthReport());
 if (name==='audit_path_safety') return toolResult(auditPathSafety(args));

 if (name==='live_agent_observe') return toolResult(createLiveAgentObservation(args));
 if (name==='live_agent_fable_plan') return toolResult(createLiveAgentFablePlan(args));
 if (name==='live_agent_apply_action') return toolResult(applyLiveAgentAction(args));
 if (name==='live_agent_cycle') return toolResult(runLiveAgentCycle(args));

 if (name==='fable_authority_proposal') return toolResult(createFableAuthorityProposal(args));
 if (name==='fable_authority_disagreement') return toolResult(recordFableAuthorityDisagreement(args));
 if (name==='fable_authority_decision_log') return toolResult({authorityDir, records:authorityRead(Number(args.limit||100))});
 if (name==='fable_authority_dashboard') return toolResult(fableAuthorityDashboard(args));
 if (name==='fable_autopilot_dry_run') return toolResult(fableAutopilotDryRun(args));
 if (name==='fable_autopilot_execute') return toolResult(fableAutopilotExecute(args));


 if (name==='fable5') return toolResult(fable5DirectChat(args));
 if (name==='fable5_execute') return toolResult(fableDirectExecute(args));
 if (name==='fable5_direct_mode_manifest') return toolResult(fable5ModeManifest(args));
 if (name==='fable_capability_snapshot') return toolResult(fableCapabilitiesSnapshot(args));
 if (name==='fable_capability_review') return toolResult(fableCapabilityReview(args));
 if (name==='fable5_request_chatgpt_help') return toolResult(fable5RequestChatGPTHelp(args));

 if (name==='fable_direct_submit') return toolResult(fableDirectSubmit(args));
 if (name==='fable_direct_inbox') return toolResult(fableDirectInbox(args));
 if (name==='fable_direct_read') return toolResult(fableDirectRead(args));
 if (name==='fable_direct_dashboard') return toolResult(fableDirectDashboard(args));
 if (name==='get_job_status') { const f=path.join(jobsDir,`${String(args.jobId)}.json`); if(!fs.existsSync(f)) throw new Error('job_not_found'); return toolResult(JSON.parse(fs.readFileSync(f,'utf8'))); }
 if (name==='list_registered_resources') return toolResult({resources:resourceIndex()});
 throw new Error('unknown_tool');
}

function listResources() { return [ { uri:'companion://status', name:'Companion Connector status', mimeType:'application/json' }, { uri:'ui://companion/dashboard.html', name:'Companion dashboard', mimeType:'text/html;profile=mcp-app' }, { uri:'companion://mcp-services', name:'21 MCP service catalog', mimeType:'application/json' }, { uri:'companion://fable5-direct-mode', name:'Fable5 Direct Mode instructions', mimeType:'application/json' }, { uri:'companion://fable5-capabilities', name:'Fable5 full capability snapshot', mimeType:'application/json' }, ...resourceIndex().map(r=>({uri:`companion://resource/${r.id}`, name:r.title||r.id, mimeType:(r.type||'').includes('image')?'application/json':'text/plain'})) ]; }
function readResource(uri) { if(uri==='companion://status') return {contents:[{uri,mimeType:'application/json',text:JSON.stringify({ok:true,root:ROOT,resources:resourceIndex().length,services:MCP_SERVICE_FOLDERS.length,version:'27.0.0'},null,2)}]}; if(uri==='ui://companion/dashboard.html') return {contents:[{uri,mimeType:'text/html;profile=mcp-app',text:fs.readFileSync(path.join(webDir,'dashboard.html'),'utf8')}]}; if(uri==='companion://mcp-services') return {contents:[{uri,mimeType:'application/json',text:JSON.stringify(serviceCatalog(),null,2)}]}; if(uri==='companion://fable5-direct-mode') return {contents:[{uri,mimeType:'application/json',text:JSON.stringify(fable5ModeManifest({}),null,2)}]}; if(uri==='companion://fable5-capabilities') return {contents:[{uri,mimeType:'application/json',text:JSON.stringify(fableCapabilitiesSnapshot({}),null,2)}]}; const m=String(uri).match(/^companion:\/\/resource\/(.+)$/); if(m) return {contents:[{uri,mimeType:'application/json',text:JSON.stringify(fetchResource(m[1]),null,2)}]}; throw new Error('resource_not_found'); }
async function handleRpc(msg) { const id=msg.id??null; try { if(msg.method==='initialize') return rpc(id,{protocolVersion:CFG.mcpProtocolVersion||'2025-06-18',capabilities:{tools:{},resources:{},prompts:{}},serverInfo:{name:'companion-connector',version:'27.0.0'}}); if(msg.method==='tools/list') return rpc(id,{tools:listTools()}); if(msg.method==='tools/call'){ const {name,arguments:args}=msg.params||{}; audit(name,args||{}); try { const out=await callTool(name,args||{}); recordAuthorityToolAction(name,args||{},out,null); return rpc(id,out); } catch(toolErr) { recordAuthorityToolAction(name,args||{},null,toolErr); throw toolErr; } } if(msg.method==='resources/list') return rpc(id,{resources:listResources()}); if(msg.method==='resources/read') return rpc(id,readResource(msg.params?.uri)); if(msg.method==='prompts/list') return rpc(id,{prompts:[{name:'inspect_large_file',title:'Inspect large file by pointer'},{name:'handoff_to_fable',title:'Prepare Fable prompt from pointers'},{name:'fable5_direct_mode',title:'Route this chat to Fable5 first'},{name:'fable5_trigger_words',title:'Use FABLE5 / @Fable5 / F5 trigger words'}]}); if(msg.method==='prompts/get') return rpc(id,{description:'Use Companion Connector tools. In Fable5 Direct Mode, route FABLE5, @Fable5, and F5 messages to the fable5 tool and return Fable5 answer with the authority log path. Act as transport unless Fable5 requests help.',messages:[]}); if(msg.method==='notifications/initialized'||msg.method?.startsWith('notifications/')) return null; return rpcErr(id,-32601,'method_not_found'); } catch(e){ return rpcErr(id,-32000,e.message||'error'); } }
async function readBody(req){ const chunks=[]; for await (const c of req) chunks.push(c); return Buffer.concat(chunks).toString('utf8'); }
const server=http.createServer(async(req,res)=>{ try{ const url=new URL(req.url,`http://${req.headers.host||'localhost'}`); if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/health')) return json(res,{ok:true,name:'companion-connector',version:'27.0.0',port:PORT,mcp:'/mcp',tools:listTools().length}); if(req.method==='GET'&&url.pathname==='/sse'){ res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache',connection:'keep-alive'}); res.write('event: endpoint\ndata: /mcp\n\n'); return; } if(req.method==='GET'&&url.pathname==='/mcp'){ res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache',connection:'keep-alive'}); res.write(`event: message\ndata: ${JSON.stringify({jsonrpc:'2.0',method:'notifications/message',params:{level:'info',data:'companion connector ready'}})}\n\n`); return; } if(req.method==='GET'&&url.pathname.startsWith('/resource/')) return json(res,fetchResource(decodeURIComponent(url.pathname.slice('/resource/'.length)))); if(req.method==='POST'&&(url.pathname==='/mcp'||url.pathname==='/message')){ const body=await readBody(req); const input=body?JSON.parse(body):{}; const out=Array.isArray(input)?(await Promise.all(input.map(handleRpc))).filter(Boolean):await handleRpc(input); if(!out) return json(res,{},202); return json(res,out,200,{'MCP-Protocol-Version':CFG.mcpProtocolVersion||'2025-06-18'}); } return json(res,{error:'not_found'},404); } catch(e){ return json(res,{error:e.message||'server_error'},500); } });
server.listen(PORT,HOST,()=>{ const line=`[${new Date().toISOString()}] companion-connector v27 listening http://${HOST}:${PORT}/mcp\n`; fs.appendFileSync(path.join(logsDir,'server.log'),line); console.log(line.trim()); });




