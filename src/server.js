import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'companion.config.json'), 'utf8'));
const PORT = Number(process.env.PORT || process.env.COMPANION_PORT || 8788);
const HOST = process.env.HOST || '127.0.0.1';
const jobsDir = path.join(ROOT, 'jobs');
const resultsDir = path.join(ROOT, 'results');
const resourcesDir = path.join(ROOT, 'resources');
const webDir = path.join(ROOT, 'web');
const logsDir = path.join(ROOT, 'logs');
for (const d of [jobsDir, resultsDir, resourcesDir, webDir, logsDir]) fs.mkdirSync(d, { recursive: true });

function json(res, obj, status = 200, headers = {}) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body), ...headers });
  res.end(body);
}
function rpc(id, result) { return { jsonrpc: '2.0', id, result }; }
function rpcErr(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } }; }
function safeId(prefix='job') { return `${prefix}_${new Date().toISOString().replace(/[-:.TZ]/g,'')}_${crypto.randomBytes(4).toString('hex')}`; }
function isInside(child, parent) { const rel = path.relative(path.resolve(parent), path.resolve(child)); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); }
function assertReadable(p) {
  const full = path.resolve(String(p || ''));
  const real = fs.realpathSync(full);
  if (!CFG.allowedRoots.some(r => isInside(real, r))) throw new Error('path_not_allowed');
  return real;
}
function argsHash(args) { return crypto.createHash('sha256').update(JSON.stringify(args || {})).digest('hex'); }
function audit(name, args) { fs.appendFileSync(path.join(logsDir, 'calls.log'), JSON.stringify({ ts: new Date().toISOString(), tool: name, argsHash: argsHash(args) }) + '\\n'); }
function boundedText(file, offset=0, limit=50000) {
  const full = assertReadable(file);
  const st = fs.statSync(full);
  if (!st.isFile()) throw new Error('not_a_file');
  const max = Math.min(Number(limit)||50000, Number(CFG.maxSliceBytes)||200000);
  const start = Math.max(0, Number(offset)||0);
  const fd = fs.openSync(full, 'r');
  const buf = Buffer.alloc(Math.max(0, Math.min(max, st.size - start)));
  fs.readSync(fd, buf, 0, buf.length, start);
  fs.closeSync(fd);
  return { path: full, size: st.size, offset: start, bytes: buf.length, text: buf.toString('utf8') };
}
function writeResult(jobId, name, obj) {
  const f = path.join(resultsDir, `${jobId}_${name}.json`);
  fs.writeFileSync(f, JSON.stringify(obj, null, 2), 'utf8');
  return f;
}
function recordJob(job) {
  const f = path.join(jobsDir, `${job.id}.json`);
  fs.writeFileSync(f, JSON.stringify(job, null, 2), 'utf8');
  return f;
}
function toolResult(data) {
  return { structuredContent: data, content: [{ type: 'text', text: JSON.stringify(data) }] };
}
function listTools() {
  return [
    { name: 'search', title: 'Search companion resources', description: 'Search registered file pointers and job results.', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }, outputSchema: { type: 'object', properties: { results: { type: 'array' } }, required: ['results'] }, annotations: { readOnlyHint: true } },
    { name: 'fetch', title: 'Fetch companion item', description: 'Fetch a registered resource or job result by id.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] }, outputSchema: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, text: { type: 'string' }, url: { type: 'string' }, metadata: { type: 'object' } }, required: ['id','title','text','url'] }, annotations: { readOnlyHint: true } },
    { name: 'register_file_pointer', title: 'Register file pointer', description: 'Register a local file path as a pointer. The source file is not changed.', inputSchema: { type: 'object', properties: { filePath: { type: 'string' }, title: { type: 'string' } }, required: ['filePath'] }, outputSchema: { type: 'object' }, annotations: { readOnlyHint: false } },
    { name: 'read_file_slice', title: 'Read file slice', description: 'Read a bounded UTF-8 slice from a registered or allowed file path.', inputSchema: { type: 'object', properties: { filePath: { type: 'string' }, offset: { type: 'number' }, limit: { type: 'number' } }, required: ['filePath'] }, outputSchema: { type: 'object' }, annotations: { readOnlyHint: true } },
    { name: 'create_summary_job', title: 'Create summary job', description: 'Create a bounded summary job from a local file path.', inputSchema: { type: 'object', properties: { filePath: { type: 'string' }, maxBytes: { type: 'number' } }, required: ['filePath'] }, outputSchema: { type: 'object' }, annotations: { readOnlyHint: false } },
    { name: 'get_job_status', title: 'Get job status', description: 'Read one companion job record.', inputSchema: { type: 'object', properties: { jobId: { type: 'string' } }, required: ['jobId'] }, outputSchema: { type: 'object' }, annotations: { readOnlyHint: true } },
    { name: 'list_registered_resources', title: 'List registered resources', description: 'List local pointer resources created by this connector.', inputSchema: { type: 'object', properties: {} }, outputSchema: { type: 'object' }, annotations: { readOnlyHint: true } }
  ];
}
function resourceIndex() {
  const files = fs.readdirSync(resourcesDir).filter(x => x.endsWith('.json'));
  return files.map(f => {
    const o = JSON.parse(fs.readFileSync(path.join(resourcesDir, f), 'utf8'));
    return { id: o.id, title: o.title || o.id, path: o.path, type: o.type || 'file_pointer' };
  });
}
function searchResources(query) {
  const q = String(query || '').toLowerCase();
  const items = resourceIndex().filter(r => JSON.stringify(r).toLowerCase().includes(q)).slice(0, 50);
  return { results: items.map(r => ({ id: r.id, title: r.title, url: '' })) };
}
function fetchResource(id) {
  const candidates = resourceIndex();
  const item = candidates.find(x => x.id === id);
  if (!item) throw new Error('not_found');
  const slice = boundedText(item.path, 0, 50000);
  return { id, title: item.title, text: slice.text, url: '', metadata: { path: item.path, size: String(slice.size), bytes: String(slice.bytes) } };
}
async function callTool(name, args = {}) {
  if (name === 'search') return toolResult(searchResources(args.query));
  if (name === 'fetch') return toolResult(fetchResource(args.id));
  if (name === 'register_file_pointer') {
    const full = assertReadable(args.filePath);
    const st = fs.statSync(full);
    if (!st.isFile()) throw new Error('not_a_file');
    const id = safeId('res');
    const rec = { id, title: args.title || path.basename(full), path: full, type: 'file_pointer', size: st.size, createdAt: new Date().toISOString() };
    fs.writeFileSync(path.join(resourcesDir, `${id}.json`), JSON.stringify(rec, null, 2), 'utf8');
    return toolResult({ id, title: rec.title, size: st.size, path: full });
  }
  if (name === 'read_file_slice') return toolResult(boundedText(args.filePath, args.offset, args.limit));
  if (name === 'create_summary_job') {
    const full = assertReadable(args.filePath);
    const max = Math.min(Number(args.maxBytes)||100000, Number(CFG.maxSliceBytes)||200000);
    const slice = boundedText(full, 0, max);
    const lines = slice.text.split(/\r?\n/);
    const summary = { path: full, size: slice.size, bytesRead: slice.bytes, lineSampleCount: lines.length, firstLines: lines.slice(0, 80), lastLines: lines.slice(-40) };
    const id = safeId('job');
    const resultPath = writeResult(id, 'summary', summary);
    const job = { id, type: 'summary', status: 'completed', sourcePath: full, resultPath, createdAt: new Date().toISOString(), completedAt: new Date().toISOString() };
    recordJob(job);
    return toolResult({ jobId: id, status: job.status, resultPath });
  }
  if (name === 'get_job_status') {
    const f = path.join(jobsDir, `${String(args.jobId)}.json`);
    if (!fs.existsSync(f)) throw new Error('job_not_found');
    return toolResult(JSON.parse(fs.readFileSync(f, 'utf8')));
  }
  if (name === 'list_registered_resources') return toolResult({ resources: resourceIndex() });
  throw new Error('unknown_tool');
}
function listResources() {
  return [
    { uri: 'companion://status', name: 'Companion Connector status', mimeType: 'application/json' },
    { uri: 'ui://companion/dashboard.html', name: 'Companion dashboard', mimeType: 'text/html;profile=mcp-app' },
    ...resourceIndex().map(r => ({ uri: `companion://resource/${r.id}`, name: r.title, mimeType: 'text/plain' }))
  ];
}
function readResource(uri) {
  if (uri === 'companion://status') return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify({ ok: true, root: ROOT, resources: resourceIndex().length }, null, 2) }] };
  if (uri === 'ui://companion/dashboard.html') return { contents: [{ uri, mimeType: 'text/html;profile=mcp-app', text: fs.readFileSync(path.join(webDir, 'dashboard.html'), 'utf8') }] };
  const m = String(uri).match(/^companion:\/\/resource\/(.+)$/);
  if (m) return { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(fetchResource(m[1]), null, 2) }] };
  throw new Error('resource_not_found');
}
async function handleRpc(msg) {
  const id = msg.id ?? null;
  try {
    if (msg.method === 'initialize') return rpc(id, { protocolVersion: CFG.mcpProtocolVersion || '2025-06-18', capabilities: { tools: {}, resources: {} }, serverInfo: { name: 'companion-connector', version: '1.0.0' } });
    if (msg.method === 'tools/list') return rpc(id, { tools: listTools() });
    if (msg.method === 'tools/call') {
      const { name, arguments: args } = msg.params || {};
      audit(name, args || {});
      return rpc(id, await callTool(name, args || {}));
    }
    if (msg.method === 'resources/list') return rpc(id, { resources: listResources() });
    if (msg.method === 'resources/read') return rpc(id, readResource(msg.params?.uri));
    if (msg.method === 'prompts/list') return rpc(id, { prompts: [] });
    if (msg.method === 'notifications/initialized' || msg.method?.startsWith('notifications/')) return null;
    return rpcErr(id, -32601, 'method_not_found');
  } catch (e) { return rpcErr(id, -32000, e.message || 'error'); }
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) return json(res, { ok: true, name: 'companion-connector', port: PORT, mcp: '/mcp' });
    if (req.method === 'GET' && url.pathname === '/sse') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(`event: endpoint\ndata: /mcp\n\n`); return;
    }
    if (req.method === 'GET' && url.pathname === '/mcp') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/message', params: { level: 'info', data: 'companion connector ready' } })}\n\n`); return;
    }
    if (req.method === 'GET' && url.pathname.startsWith('/resource/')) {
      const id = decodeURIComponent(url.pathname.slice('/resource/'.length));
      const data = fetchResource(id);
      return json(res, data);
    }
    if (req.method === 'POST' && (url.pathname === '/mcp' || url.pathname === '/message')) {
      const body = await readBody(req);
      const input = body ? JSON.parse(body) : {};
      const out = Array.isArray(input) ? (await Promise.all(input.map(handleRpc))).filter(Boolean) : await handleRpc(input);
      if (!out) return json(res, {}, 202);
      return json(res, out, 200, { 'mcp-protocol-version': CFG.mcpProtocolVersion || '2025-06-18' });
    }
    return json(res, { error: 'not_found' }, 404);
  } catch (e) { return json(res, { error: e.message || 'server_error' }, 500); }
});
server.listen(PORT, HOST, () => {
  const line = `[${new Date().toISOString()}] companion-connector listening http://${HOST}:${PORT}/mcp\n`;
  fs.appendFileSync(path.join(logsDir, 'server.log'), line);
  console.log(line.trim());
});

