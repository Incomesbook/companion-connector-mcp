from pathlib import Path
p=Path('src/server.js')
t=p.read_text(encoding='utf-8')
helper=r'''
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
'''
if 'function runResearchBridge(command' not in t:
    t=t.replace('function listTools() { return [', helper+'\nfunction listTools() { return [')
tools = """
 { name:'create_folder_research_map', title:'Create folder research map', description:'Read-only folder scan that classifies files, links, references, imports, media, docs and archives.', inputSchema:{type:'object',properties:{folder:{type:'string'},maxFiles:{type:'number'},hashFiles:{type:'boolean'},noScanText:{type:'boolean'}},required:['folder']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'inspect_linked_resources_from_file', title:'Inspect linked resources from file', description:'Extract URL and path references from a file and report existence.', inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_project_intake_bundle', title:'Create project intake bundle', description:'Create compact project intake bundle from a folder.', inputSchema:{type:'object',properties:{folder:{type:'string'}},required:['folder']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
"""
if "name:'create_folder_research_map'" not in t:
    t=t.replace("{ name:'get_job_status', title:'Get job status'", tools + " { name:'get_job_status', title:'Get job status'")
calls = """
 if (name==='create_folder_research_map') return toolResult(runResearchBridge('research-map', { folder: assertReadable(args.folder), maxFiles: args.maxFiles || 200000, hashFiles: !!args.hashFiles, noScanText: !!args.noScanText }, 1800000));
 if (name==='inspect_linked_resources_from_file') return toolResult(runResearchBridge('linked-resources', { path: assertReadable(args.path) }, 600000));
 if (name==='create_project_intake_bundle') return toolResult(runResearchBridge('intake-bundle', { folder: assertReadable(args.folder) }, 1800000));
"""
if "name==='create_folder_research_map'" not in t:
    t=t.replace("if (name==='get_job_status')", calls + " if (name==='get_job_status')")
t=t.replace("version:'14.0.0'", "version:'15.0.0'")
t=t.replace("version:'13.0.0'", "version:'15.0.0'")
t=t.replace("companion-connector v14 listening", "companion-connector v15 listening")
p.write_text(t,encoding='utf-8')
print('upgrade_v15 applied')
