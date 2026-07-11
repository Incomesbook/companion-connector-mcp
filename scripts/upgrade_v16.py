from pathlib import Path
p=Path('src/server.js')
t=p.read_text(encoding='utf-8')
helper=r'''
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
'''
if 'function browserBridge(cmd' not in t:
    t=t.replace('function listTools() { return [', helper+'\nfunction listTools() { return [')
tools=r'''
 { name:'browser_start', title:'Start controlled browser', description:'Start Chrome/Edge with remote debugging for browser automation.', inputSchema:{type:'object',properties:{port:{type:'number'},url:{type:'string'},profile:{type:'string'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'browser_list_tabs', title:'List browser tabs', description:'List tabs in the controlled browser.', inputSchema:{type:'object',properties:{port:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'browser_new_tab', title:'Open browser tab', description:'Open a new controlled browser tab.', inputSchema:{type:'object',properties:{port:{type:'number'},url:{type:'string'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'browser_navigate', title:'Navigate browser tab', description:'Navigate a controlled browser tab to a URL.', inputSchema:{type:'object',properties:{port:{type:'number'},tabId:{type:'string'},index:{type:'number'},url:{type:'string'},wait:{type:'number'}},required:['url']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'browser_dom_snapshot', title:'Browser DOM snapshot', description:'Read title, URL, text, links, buttons, inputs and headings from a controlled browser tab.', inputSchema:{type:'object',properties:{port:{type:'number'},tabId:{type:'string'},index:{type:'number'},outpath:{type:'string'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'browser_screenshot', title:'Browser screenshot', description:'Capture screenshot from controlled browser tab.', inputSchema:{type:'object',properties:{port:{type:'number'},tabId:{type:'string'},index:{type:'number'},outpath:{type:'string'},fullPage:{type:'boolean'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'desktop_screenshot', title:'Desktop screenshot', description:'Capture current desktop screen to results for live visual handoff.', inputSchema:{type:'object',properties:{outpath:{type:'string'},monitor:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
'''
if "name:'browser_start'" not in t:
    t=t.replace("{ name:'get_job_status', title:'Get job status'", tools+" { name:'get_job_status', title:'Get job status'")
tools2=r'''
 { name:'browser_click_text', title:'Browser click by text', description:'Click a visible browser element containing text.', inputSchema:{type:'object',properties:{port:{type:'number'},tabId:{type:'string'},index:{type:'number'},text:{type:'string'}},required:['text']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'browser_type_selector', title:'Browser type selector', description:'Type into an input/textarea/select by CSS selector.', inputSchema:{type:'object',properties:{port:{type:'number'},tabId:{type:'string'},index:{type:'number'},selector:{type:'string'},text:{type:'string'}},required:['selector','text']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'browser_press_key', title:'Browser press key', description:'Dispatch a key to the active controlled browser tab.', inputSchema:{type:'object',properties:{port:{type:'number'},tabId:{type:'string'},index:{type:'number'},key:{type:'string'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'browser_live_monitor', title:'Browser live monitor', description:'Capture repeated browser or desktop screenshots for live Fable/ChatGPT visual review.', inputSchema:{type:'object',properties:{port:{type:'number'},tabId:{type:'string'},index:{type:'number'},count:{type:'number'},interval:{type:'number'},outdir:{type:'string'},desktop:{type:'boolean'},monitor:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'inspect_password_archive', title:'Inspect password archive', description:'Inspect ZIP/7Z/TAR including encrypted ZIP metadata; password optional.', inputSchema:{type:'object',properties:{path:{type:'string'},password:{type:'string'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'extract_password_archive_to_results', title:'Extract password archive', description:'Extract password-protected ZIP/7Z safely into connector results.', inputSchema:{type:'object',properties:{path:{type:'string'},password:{type:'string'},outdir:{type:'string'},maxFiles:{type:'number'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
'''
if "name:'browser_click_text'" not in t:
    t=t.replace("{ name:'get_job_status', title:'Get job status'", tools2+" { name:'get_job_status', title:'Get job status'")
tools3=r'''
 { name:'analyze_chart_advanced', title:'Advanced chart analysis', description:'Advanced image/chart analysis: OCR, dominant colors, line angles, object boxes and plot-area guess.', inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'local_model_status', title:'Local model status', description:'List installed local Ollama models.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'local_model_pull', title:'Pull local model', description:'Pull a stronger local Ollama model for Fable provider.', inputSchema:{type:'object',properties:{model:{type:'string'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'local_model_chat_test', title:'Local model chat test', description:'Test local Ollama model on CPU provider.', inputSchema:{type:'object',properties:{model:{type:'string'},prompt:{type:'string'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'start_full_fable_micro_read', title:'Start full Fable micro-read', description:'Start durable background full Fable micro-read until completeAll=true is possible.', inputSchema:{type:'object',properties:{index:{type:'string'},out:{type:'string'},maxChars:{type:'number'},timeout:{type:'number'},model:{type:'string'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'get_full_fable_micro_status', title:'Get full Fable micro-read status', description:'Read progress for durable full Fable micro-read.', inputSchema:{type:'object',properties:{out:{type:'string'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
'''
if "name:'analyze_chart_advanced'" not in t:
    t=t.replace("{ name:'get_job_status', title:'Get job status'", tools3+" { name:'get_job_status', title:'Get job status'")
calls=r'''
 if (name==='browser_start') return toolResult(browserBridge('start', ['--port', String(args.port||9222), ...(args.url?['--url',args.url]:[]), ...(args.profile?['--profile',args.profile]:[])], 120000));
 if (name==='browser_list_tabs') return toolResult(browserBridge('tabs', ['--port', String(args.port||9222)], 60000));
 if (name==='browser_new_tab') return toolResult(browserBridge('new_tab', ['--port', String(args.port||9222), ...(args.url?['--url',args.url]:[])], 60000));
 if (name==='browser_navigate') return toolResult(browserBridge('navigate', ['--port', String(args.port||9222), ...(args.tabId?['--tab-id',args.tabId]:[]), ...(args.index!==undefined?['--index',String(args.index)]:[]), '--url', String(args.url), '--wait', String(args.wait||1.5)], 120000));
 if (name==='browser_dom_snapshot') return toolResult(browserBridge('dom', ['--port', String(args.port||9222), ...(args.tabId?['--tab-id',args.tabId]:[]), ...(args.index!==undefined?['--index',String(args.index)]:[]), ...(args.outpath?['--outpath',String(args.outpath)]:[])], 120000));
 if (name==='browser_screenshot') return toolResult(browserBridge('screenshot', ['--port', String(args.port||9222), ...(args.tabId?['--tab-id',args.tabId]:[]), ...(args.index!==undefined?['--index',String(args.index)]:[]), ...(args.outpath?['--outpath',String(args.outpath)]:[]), ...(args.fullPage?['--full-page']:[])], 120000));
 if (name==='desktop_screenshot') return toolResult(browserBridge('desktop_screenshot', [...(args.outpath?['--outpath',String(args.outpath)]:[]), '--monitor', String(args.monitor||1)], 120000));
'''
if "name==='browser_start'" not in t:
    t=t.replace("if (name==='get_job_status')", calls+" if (name==='get_job_status')")
calls2=r'''
 if (name==='browser_click_text') return toolResult(browserBridge('click_text', ['--port', String(args.port||9222), ...(args.tabId?['--tab-id',args.tabId]:[]), ...(args.index!==undefined?['--index',String(args.index)]:[]), '--text', String(args.text)], 120000));
 if (name==='browser_type_selector') return toolResult(browserBridge('type_selector', ['--port', String(args.port||9222), ...(args.tabId?['--tab-id',args.tabId]:[]), ...(args.index!==undefined?['--index',String(args.index)]:[]), '--selector', String(args.selector), '--text', String(args.text)], 120000));
 if (name==='browser_press_key') return toolResult(browserBridge('press_key', ['--port', String(args.port||9222), ...(args.tabId?['--tab-id',args.tabId]:[]), ...(args.index!==undefined?['--index',String(args.index)]:[]), '--key', String(args.key||'Enter')], 120000));
 if (name==='browser_live_monitor') return toolResult(browserBridge('monitor', ['--port', String(args.port||9222), ...(args.tabId?['--tab-id',args.tabId]:[]), ...(args.index!==undefined?['--index',String(args.index)]:[]), '--count', String(args.count||5), '--interval', String(args.interval||1), ...(args.outdir?['--outdir',String(args.outdir)]:[]), ...(args.desktop?['--desktop']:[]), '--monitor', String(args.monitor||1)], 600000));
 if (name==='inspect_password_archive') return toolResult(archiveSecure('inspect', ['--path', assertReadable(args.path), ...(args.password?['--password',String(args.password)]:[])], 600000));
 if (name==='extract_password_archive_to_results') return toolResult(archiveSecure('extract', ['--path', assertReadable(args.path), ...(args.password?['--password',String(args.password)]:[]), ...(args.outdir?['--outdir',String(args.outdir)]:[]), '--max-files', String(args.maxFiles||10000)], 1200000));
'''
if "name==='browser_click_text'" not in t:
    t=t.replace("if (name==='get_job_status')", calls2+" if (name==='get_job_status')")
calls3=r'''
 if (name==='analyze_chart_advanced') return toolResult(chartAdvanced(['--path', assertReadable(args.path)]));
 if (name==='local_model_status') return toolResult(modelBridge('list', [], 120000));
 if (name==='local_model_pull') return toolResult(modelBridge('pull', ['--model', String(args.model||'qwen2.5:3b')], 7200000));
 if (name==='local_model_chat_test') return toolResult(modelBridge('chat', ['--model', String(args.model||'qwen2.5:3b'), '--prompt', String(args.prompt||'Return OK.')], 900000));
 if (name==='start_full_fable_micro_read') return toolResult(runPwshJson('start_v16_full_micro_read.ps1', [...(args.index?['-Index',String(args.index)]:[]), ...(args.out?['-Out',String(args.out)]:[]), '-MaxChars', String(args.maxChars||25000), '-Timeout', String(args.timeout||600), '-Model', String(args.model||'qwen2.5:3b')], 120000));
 if (name==='get_full_fable_micro_status') return toolResult(runPwshJson('status_v16_full_micro_read.ps1', [...(args.out?['-Out',String(args.out)]:[])], 120000));
'''
if "name==='analyze_chart_advanced'" not in t:
    t=t.replace("if (name==='get_job_status')", calls3+" if (name==='get_job_status')")
t=t.replace("version:'15.0.0'", "version:'16.0.0'").replace("version:'14.0.0'", "version:'16.0.0'").replace('companion-connector v13 listening','companion-connector v16 listening').replace('companion-connector v15 listening','companion-connector v16 listening')
p.write_text(t, encoding='utf-8')
print('upgrade_v16 applied')
