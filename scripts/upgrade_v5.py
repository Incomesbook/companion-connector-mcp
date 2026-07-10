from pathlib import Path
p = Path('src/server.js')
txt = p.read_text(encoding='utf-8')
if "import https from 'node:https';" not in txt:
    txt = txt.replace("import http from 'node:http';", "import http from 'node:http';\nimport https from 'node:https';")
helper = r'''
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
'''
if 'function ensureUrlAllowed(rawUrl)' not in txt:
    txt = txt.replace('function listTools() { return [', helper + '\nfunction listTools() { return [')
new_tools = r'''
 { name:'fetch_url_text', title:'Fetch URL text', description:'Fetch bounded text from an http/https URL for read-only inspection.', inputSchema:{type:'object',properties:{url:{type:'string'},limit:{type:'number'}},required:['url']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'extract_links_from_url', title:'Extract links from URL', description:'Fetch a page and return bounded link list.', inputSchema:{type:'object',properties:{url:{type:'string'},limit:{type:'number'}},required:['url']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'create_url_snapshot_job', title:'Create URL snapshot job', description:'Fetch a URL into a local snapshot resource and return links.', inputSchema:{type:'object',properties:{url:{type:'string'},title:{type:'string'},limit:{type:'number'}},required:['url']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'register_video_pointer', title:'Register video pointer', description:'Register a local media file pointer and metadata.', inputSchema:{type:'object',properties:{filePath:{type:'string'},title:{type:'string'}},required:['filePath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_media_metadata_job', title:'Create media metadata job', description:'Create a media metadata job using ffprobe when available.', inputSchema:{type:'object',properties:{filePath:{type:'string'}},required:['filePath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_handoff_queue_item', title:'Create handoff queue item', description:'Create a local handoff queue item without touching source folders.', inputSchema:{type:'object',properties:{title:{type:'string'},body:{type:'string'},resourceIds:{type:'array'},filePaths:{type:'array'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'list_handoff_queue', title:'List handoff queue', description:'List local connector handoff queue items.', inputSchema:{type:'object',properties:{limit:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
'''
if "name:'fetch_url_text'" not in txt:
    txt = txt.replace("{ name:'get_job_status', title:'Get job status'", new_tools + " { name:'get_job_status', title:'Get job status'")
new_calls = r'''
 if (name==='fetch_url_text') { const u = await fetchUrlLimited(args.url, args.limit); return toolResult(u); }
 if (name==='extract_links_from_url') { const u = await fetchUrlLimited(args.url, args.limit); return toolResult({ url: u.url, status: u.status, links: extractLinks(u.text, u.url) }); }
 if (name==='create_url_snapshot_job') return toolResult(await createUrlSnapshot(args));
 if (name==='register_video_pointer') { const meta = mediaMetadata(args.filePath); const id = safeId('media'); const rec = saveResource({ id, title: args.title || path.basename(meta.path), path: meta.path, type:'media_pointer', metadata: meta, createdAt: new Date().toISOString() }); return toolResult({ id: rec.id, title: rec.title, metadata: meta }); }
 if (name==='create_media_metadata_job') return toolResult(makeJob('media_metadata', args.filePath, mediaMetadata(args.filePath)));
 if (name==='create_handoff_queue_item') return toolResult(createHandoffQueueItem(args));
 if (name==='list_handoff_queue') return toolResult({ items: listHandoffQueue(args.limit) });
'''
if "name==='fetch_url_text'" not in txt:
    txt = txt.replace("if (name==='get_job_status')", new_calls + " if (name==='get_job_status')")
txt = txt.replace("version:'4.0.0'", "version:'5.0.0'")
txt = txt.replace("version:'3.0.0'", "version:'5.0.0'")
txt = txt.replace("version:'2.0.0'", "version:'5.0.0'")
p.write_text(txt, encoding='utf-8')
print('upgrade_v5.py applied')
