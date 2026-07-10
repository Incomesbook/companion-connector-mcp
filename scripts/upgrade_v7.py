from pathlib import Path
p = Path('src/server.js')
txt = p.read_text(encoding='utf-8')
helper = r'''
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
'''
if 'function loadForwardImprovements(limit = 1000)' not in txt:
    txt = txt.replace('function listTools() { return [', helper + '\nfunction listTools() { return [')
new_tools = r'''
 { name:'list_1000_forward_improvements', title:'List 1000 forward improvements', description:'List the V7 1000-item forward improvement backlog. Items are planned, not falsely marked implemented.', inputSchema:{type:'object',properties:{limit:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'audit_1000_forward_improvements', title:'Audit 1000 forward improvements', description:'Verify the 1000-item forward improvement backlog structure.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'no_window_startup_info', title:'No-window startup info', description:'Return verified files and instructions for hidden startup.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'create_startup_shortcut_info', title:'Startup shortcut info', description:'Return paths for VBS hidden start, scheduled task install, and stop script.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
'''
if "name:'list_1000_forward_improvements'" not in txt:
    txt = txt.replace("{ name:'get_job_status', title:'Get job status'", new_tools + " { name:'get_job_status', title:'Get job status'")
new_calls = r'''
 if (name==='list_1000_forward_improvements') return toolResult(loadForwardImprovements(args.limit));
 if (name==='audit_1000_forward_improvements') return toolResult(auditForwardImprovements());
 if (name==='no_window_startup_info') return toolResult(noWindowStartupInfo());
 if (name==='create_startup_shortcut_info') return toolResult(createStartupShortcutInfo());
'''
if "name==='list_1000_forward_improvements'" not in txt:
    txt = txt.replace("if (name==='get_job_status')", new_calls + " if (name==='get_job_status')")
txt = txt.replace("version:'6.0.0'", "version:'7.0.0'")
txt = txt.replace("version:'5.0.0'", "version:'7.0.0'")
txt = txt.replace("companion-connector v2 listening", "companion-connector v7 listening")
txt = txt.replace("companion-connector v6 listening", "companion-connector v7 listening")
p.write_text(txt, encoding='utf-8')
print('upgrade_v7.py applied')
