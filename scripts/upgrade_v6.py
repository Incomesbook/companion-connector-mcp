from pathlib import Path
p = Path('src/server.js')
txt = p.read_text(encoding='utf-8')
helper = r'''
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
'''
if 'function loadImplementedImprovements()' not in txt:
    txt = txt.replace('function listTools() { return [', helper + '\nfunction listTools() { return [')
new_tools = r'''
 { name:'list_implemented_improvements', title:'List 100 implemented improvements', description:'List the V6 implemented improvement registry.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'audit_100_improvements', title:'Audit 100 improvements', description:'Verify that the 100-improvement registry exists and evidence files are present.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'create_support_bundle', title:'Create support bundle', description:'Create a local support bundle with config, docs, health and improvement audit.', inputSchema:{type:'object',properties:{includeLogs:{type:'boolean'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'runtime_metrics', title:'Runtime metrics', description:'Return runtime memory, uptime, process and platform metrics.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'validate_connector_config', title:'Validate connector config', description:'Validate required connector configuration keys.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'create_debug_snapshot', title:'Create debug snapshot', description:'Create a local debug snapshot result file.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
'''
if "name:'audit_100_improvements'" not in txt:
    txt = txt.replace("{ name:'get_job_status', title:'Get job status'", new_tools + " { name:'get_job_status', title:'Get job status'")
new_calls = r'''
 if (name==='list_implemented_improvements') return toolResult(loadImplementedImprovements());
 if (name==='audit_100_improvements') return toolResult(auditImplementedImprovements());
 if (name==='create_support_bundle') return toolResult(createSupportBundle(args));
 if (name==='runtime_metrics') return toolResult(runtimeMetrics());
 if (name==='validate_connector_config') return toolResult(validateConnectorConfig());
 if (name==='create_debug_snapshot') return toolResult(createDebugSnapshot());
'''
if "name==='audit_100_improvements'" not in txt:
    txt = txt.replace("if (name==='get_job_status')", new_calls + " if (name==='get_job_status')")
txt = txt.replace("version:'5.0.0'", "version:'6.0.0'")
txt = txt.replace("version:'4.0.0'", "version:'6.0.0'")
txt = txt.replace("version:'3.0.0'", "version:'6.0.0'")
txt = txt.replace("version:'2.0.0'", "version:'6.0.0'")
p.write_text(txt, encoding='utf-8')
print('upgrade_v6.py applied')
