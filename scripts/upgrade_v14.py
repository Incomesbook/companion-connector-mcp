from pathlib import Path
p=Path('src/server.js')
t=p.read_text(encoding='utf-8')
helper=r'''
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
'''
if 'function runDocumentBridge(command' not in t:
    t=t.replace('function listTools() { return [', helper+'\nfunction listTools() { return [')
tools=r'''
 { name:'document_toolchain_report', title:'Document toolchain report', description:'Check PDF/DOCX/PPTX/XLSX/archive/web extraction support.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'inspect_document_file', title:'Inspect document file', description:'Read PDF/DOCX/PPTX/XLSX/CSV/HTML/text into connector text/metadata bundle.', inputSchema:{type:'object',properties:{path:{type:'string'},maxChars:{type:'number'},maxRows:{type:'number'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'inspect_archive_file', title:'Inspect archive file', description:'Create read-only manifest for ZIP/TAR archives without extracting to source.', inputSchema:{type:'object',properties:{path:{type:'string'},maxEntries:{type:'number'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'extract_archive_to_results', title:'Extract archive to results', description:'Safely extract ZIP/TAR into connector results with path traversal protection.', inputSchema:{type:'object',properties:{path:{type:'string'},maxFiles:{type:'number'},maxBytes:{type:'number'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_web_snapshot', title:'Create web snapshot', description:'Fetch a web page into connector HTML/text/metadata snapshot with links.', inputSchema:{type:'object',properties:{url:{type:'string'},maxChars:{type:'number'}},required:['url']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'universal_resource_inspect', title:'Universal resource inspect', description:'Dispatch one file/url/folder/media/archive/document to the best Companion inspector.', inputSchema:{type:'object',properties:{target:{type:'string'},maxChars:{type:'number'},maxRows:{type:'number'}} ,required:['target']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
'''
if "name:'document_toolchain_report'" not in t:
    t=t.replace("{ name:'get_job_status', title:'Get job status'", tools+" { name:'get_job_status', title:'Get job status'")
calls = """
 if (name==='document_toolchain_report') return toolResult(documentToolchainReport());
 if (name==='inspect_document_file') return toolResult(runDocumentBridge('inspect-document', { path: assertReadable(args.path), maxChars: args.maxChars || 1000000, maxRows: args.maxRows || 500 }, 900000));
 if (name==='inspect_archive_file') return toolResult(runDocumentBridge('archive-manifest', { path: assertReadable(args.path), maxEntries: args.maxEntries || 100000 }, 900000));
 if (name==='extract_archive_to_results') return toolResult(runDocumentBridge('extract-archive', { path: assertReadable(args.path), maxFiles: args.maxFiles || 20000, maxBytes: args.maxBytes || 2000000000 }, 1800000));
 if (name==='create_web_snapshot') return toolResult(runDocumentBridge('web-snapshot', { url: args.url, maxChars: args.maxChars || 500000 }, 300000));
"""
if "name==='document_toolchain_report'" not in t:
    t=t.replace("if (name==='get_job_status')", calls + " if (name==='get_job_status')")
calls2 = """
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
"""
if "name==='universal_resource_inspect'" not in t:
    t=t.replace("if (name==='get_job_status')", calls2 + " if (name==='get_job_status')")
t=t.replace("version:'13.0.0'", "version:'14.0.0'")
t=t.replace("version:'12.0.0'", "version:'14.0.0'")
t=t.replace("companion-connector v13 listening", "companion-connector v14 listening")
p.write_text(t,encoding='utf-8')
print('upgrade_v14 applied')
