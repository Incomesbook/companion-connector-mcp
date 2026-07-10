from pathlib import Path
p = Path('src/server.js')
txt = p.read_text(encoding='utf-8')
helper = r'''
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
'''
if 'function walkFolderReadOnly(folderPath' not in txt:
    txt = txt.replace('function listTools() { return [', helper + '\nfunction listTools() { return [')
helper2 = r'''
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
'''
if 'function createReadOnlyFolderManifest(args' not in txt:
    txt = txt.replace('function listTools() { return [', helper2 + '\nfunction listTools() { return [')
helper3 = r'''
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
'''
if 'function createReadOnlyFolderContentBundle(args' not in txt:
    txt = txt.replace('function listTools() { return [', helper3 + '\nfunction listTools() { return [')
helper4 = r'''
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
'''
if 'function searchFolderContentBundle(args' not in txt:
    txt = txt.replace('function listTools() { return [', helper4 + '\nfunction listTools() { return [')
new_tools = r'''
 { name:'create_readonly_folder_manifest', title:'Create read-only folder manifest', description:'Recursively inventory and hash every file in a folder without modifying the source.', inputSchema:{type:'object',properties:{folderPath:{type:'string'},maxFiles:{type:'number'}},required:['folderPath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'audit_readonly_folder_manifest', title:'Audit read-only folder manifest', description:'Re-check file size and SHA256 against a stored read-only manifest.', inputSchema:{type:'object',properties:{manifestPath:{type:'string'}},required:['manifestPath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'create_readonly_folder_content_bundle', title:'Create read-only folder content bundle', description:'Read every file in a folder read-only, chunk all text files, hash-verify binaries, and store results under connector results.', inputSchema:{type:'object',properties:{folderPath:{type:'string'},manifestPath:{type:'string'},chunkChars:{type:'number'},maxFiles:{type:'number'}},required:[]}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'read_folder_bundle_chunk', title:'Read folder bundle chunk', description:'Read one stored text chunk from a folder content bundle.', inputSchema:{type:'object',properties:{indexPath:{type:'string'},fileIndex:{type:'number'},rel:{type:'string'},chunk:{type:'number'}},required:['indexPath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'search_folder_content_bundle', title:'Search folder content bundle', description:'Search file names and chunked text content inside a read-only folder content bundle.', inputSchema:{type:'object',properties:{indexPath:{type:'string'},query:{type:'string'},maxResults:{type:'number'}},required:['indexPath','query']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'create_fable_folder_handoff', title:'Create Fable folder handoff', description:'Create a complete read-only folder content bundle and Fable access guide, optionally run Fable on the guide.', inputSchema:{type:'object',properties:{folderPath:{type:'string'},manifestPath:{type:'string'},chunkChars:{type:'number'},maxFiles:{type:'number'},runFable:{type:'boolean'},maxOutputChars:{type:'number'}},required:[]}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'folder_explorer', title:'Folder explorer', description:'List one folder level under an allowed root without modifying files.', inputSchema:{type:'object',properties:{folderPath:{type:'string'},rel:{type:'string'}},required:['folderPath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
'''
if "name:'create_readonly_folder_manifest'" not in txt:
    txt = txt.replace("{ name:'get_job_status', title:'Get job status'", new_tools + " { name:'get_job_status', title:'Get job_status'").replace("title:'Get job_status'", "title:'Get job status'")
new_calls = r'''
 if (name==='create_readonly_folder_manifest') return toolResult(createReadOnlyFolderManifest(args));
 if (name==='audit_readonly_folder_manifest') return toolResult(auditReadOnlyFolderManifest(args));
 if (name==='create_readonly_folder_content_bundle') return toolResult(createReadOnlyFolderContentBundle(args));
 if (name==='read_folder_bundle_chunk') return toolResult(readFolderBundleChunk(args));
 if (name==='search_folder_content_bundle') return toolResult(searchFolderContentBundle(args));
 if (name==='create_fable_folder_handoff') return toolResult(createFableFolderHandoff(args));
 if (name==='folder_explorer') return toolResult(folderExplorer(args));
'''
if "name==='create_readonly_folder_manifest'" not in txt:
    txt = txt.replace("if (name==='get_job_status')", new_calls + " if (name==='get_job_status')")
txt = txt.replace("version:'7.0.0'", "version:'8.0.0'")
txt = txt.replace("version:'6.0.0'", "version:'8.0.0'")
txt = txt.replace("companion-connector v7 listening", "companion-connector v8 listening")
p.write_text(txt, encoding='utf-8')
print('upgrade_v8.py applied')
