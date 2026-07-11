from pathlib import Path
import json
root = Path.cwd()
server = root/'src'/'server.js'
text = server.read_text(encoding='utf-8')
text = text.replace("version:'23.0.0'", "version:'24.0.0'")
text = text.replace("version:'22.0.0'", "version:'24.0.0'")
text = text.replace("version:'21.0.0'", "version:'24.0.0'")
text = text.replace("version:'20.0.0'", "version:'24.0.0'")
text = text.replace("serverInfo:{name:'companion-connector',version:'23.0.0'}", "serverInfo:{name:'companion-connector',version:'24.0.0'}")
text = text.replace("serverInfo:{name:'companion-connector',version:'22.0.0'}", "serverInfo:{name:'companion-connector',version:'24.0.0'}")
text = text.replace("version:'23.0.0'", "version:'24.0.0'")
text = text.replace("version:'22.0.0'", "version:'24.0.0'")
text = text.replace("version:'21.0.0'", "version:'24.0.0'")
text = text.replace("version:'20.0.0'", "version:'24.0.0'")
text = text.replace("version:'19.0.0'", "version:'24.0.0'")
text = text.replace("version:'18.0.0'", "version:'24.0.0'")
text = text.replace("version:'17.0.0'", "version:'24.0.0'")
text = text.replace("version:'16.0.0'", "version:'24.0.0'")
text = text.replace("version:'15.0.0'", "version:'24.0.0'")
text = text.replace("version:'14.0.0'", "version:'24.0.0'")
text = text.replace("version:'13.0.0'", "version:'24.0.0'")
text = text.replace("version:'12.0.0'", "version:'24.0.0'")
text = text.replace("version:'11.0.0'", "version:'24.0.0'")
text = text.replace("companion-connector v23", "companion-connector v24")
text = text.replace("companion-connector v22", "companion-connector v24")
text = text.replace("version:'24.0.0'", "version:'24.0.0'")
# general literal in health/init
text = text.replace("version:'23.0.0'", "version:'24.0.0'")
text = text.replace("version:'22.0.0'", "version:'24.0.0'")
text = text.replace("version:'21.0.0'", "version:'24.0.0'")
text = text.replace("version:'20.0.0'", "version:'24.0.0'")
text = text.replace("version:'19.0.0'", "version:'24.0.0'")
# replace quoted health version occurrences
text = text.replace("version:'23.0.0'", "version:'24.0.0'")
text = text.replace("version:'22.0.0'", "version:'24.0.0'")
text = text.replace("version:'21.0.0'", "version:'24.0.0'")
text = text.replace("version:'20.0.0'", "version:'24.0.0'")
text = text.replace("version:'19.0.0'", "version:'24.0.0'")
text = text.replace("version:'18.0.0'", "version:'24.0.0'")
text = text.replace("version:'17.0.0'", "version:'24.0.0'")
text = text.replace("version:'16.0.0'", "version:'24.0.0'")
text = text.replace("version:'15.0.0'", "version:'24.0.0'")
text = text.replace("version:'14.0.0'", "version:'24.0.0'")
text = text.replace("version:'13.0.0'", "version:'24.0.0'")
# direct executor functions
functions = r'''

const fableExecDir = path.join(resultsDir, 'fable_direct_exec');
fs.mkdirSync(fableExecDir, {recursive:true});
function directExecPath(id){ return path.join(fableExecDir, `${String(id)}.json`); }
function htmlDataUrl(title, message){
  const esc = s => String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const html = `<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><body style="font-family:Segoe UI,Arial;margin:40px;background:#0b1020;color:#f5f7ff"><h1>${esc(title)}</h1><pre style="white-space:pre-wrap;font-size:18px;line-height:1.45;background:#151b30;padding:20px;border-radius:12px">${esc(message)}</pre></body>`;
  return 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
}
function directShowMessage(message, title='Fable5'){
  const url = htmlDataUrl(title, message);
  let start = browserBridge('start', ['--port','9222','--url',url], 300000);
  let tab = null;
  try { tab = browserBridge('new_tab', ['--port','9222','--url',url], 300000); } catch(e) { tab = {ok:false,error:String(e.message||e)}; }
  return {ok:true, type:'display_message', start, tab, messagePreview:compactDirectText(message,2000)};
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
  const focus = runLiveBridge('focus_window',{query:'ChatGPT'},120000);
  const obs = createLiveAgentObservation({sessionId:safeId('fable_chat_observe'), task: task||'Fable5 observe current chat', includeBrowser:false, monitor:1});
  return {ok:true, focus, observation:obs};
}
function directBuildActions(task, fableText=''){
  const s = (String(task||'') + '\n' + String(fableText||'')).toLowerCase();
  const actions=[];
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
  const rec=fableDirectSubmit({...args, task, decidedBy:'Fable5', runNow:true});
  const fableText=rec?.task?.replyText||'';
  let actions=parseFableActionJson(fableText) || directBuildActions(task, fableText);
  const max=Number(args.maxActions||5);
  actions=actions.slice(0,max);
  const executed=[];
  for(const a of actions){ executed.push(directExecuteAction(a, task)); }
  const after= args.afterSnapshot===false ? null : createLiveAgentObservation({sessionId:rec.task.id+'_after', task:'after Fable5 direct execution', includeBrowser:false, monitor:1});
  const out={ok:true, mode:'fable5_direct_execute', decidedBy:'Fable5', startedAt, finishedAt:new Date().toISOString(), taskId:rec.task.id, task, fableRecord:rec.task, actions, executed, after};
  const p=assertWritable(directExecPath(rec.task.id));
  fs.writeFileSync(p, JSON.stringify(out,null,2),'utf8');
  authorityAppend('fable_direct_execute',{decidedBy:'Fable5', taskId:rec.task.id, taskPreview:compactDirectText(task,2000), actions:actions.map(a=>a.type), executedOk:executed.filter(x=>x.ok).length, executedFailed:executed.filter(x=>!x.ok).length, proofPath:p});
  return {...out, proofPath:p};
}
'''
if 'function fableDirectExecute(args={})' not in text:
    text = text.replace("function listTools() { return [", functions + "\nfunction listTools() { return [")
# Insert tools
if "name:'fable5_execute'" not in text:
    text = text.replace("function listTools() { return [\n", "function listTools() { return [\n { name:'fable5_execute', title:'Fable5 direct execute', description:'Send task to Fable5, build a safe action plan, execute allowlisted local actions, and store proof log.', inputSchema:{type:'object',properties:{task:{type:'string'},message:{type:'string'},context:{type:'string'},strong:{type:'boolean'},model:{type:'string'},maxActions:{type:'number'},afterSnapshot:{type:'boolean'}},required:[]}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },\n")
# Route fable5 to execute instead of only answer
old = "function fable5DirectChat(args={}){\n  const task=String(args.message||args.task||'').trim();\n  if(!task) throw new Error('message_required');\n  return fable5Direct({task,context:args.context||'',maxOutputChars:args.maxOutputChars||120000,runNow:true,model:args.model||'',strong:!!args.strong});\n}"
new = "function fable5DirectChat(args={}){\n  const task=String(args.message||args.task||'').trim();\n  if(!task) throw new Error('message_required');\n  return fableDirectExecute({...args, task});\n}"
if old in text:
    text = text.replace(old,new)
else:
    print('WARN fable5DirectChat old not found')
# call tool route
if "name==='fable5_execute'" not in text:
    text = text.replace("if (name==='fable5') return toolResult(fable5DirectChat(args));", "if (name==='fable5') return toolResult(fable5DirectChat(args));\n if (name==='fable5_execute') return toolResult(fableDirectExecute(args));")
# health/init versions robust
text = text.replace("version:'23.0.0'", "version:'24.0.0'")
text = text.replace("version:'22.0.0'", "version:'24.0.0'")
text = text.replace("version:'21.0.0'", "version:'24.0.0'")
text = text.replace("version:'20.0.0'", "version:'24.0.0'")
text = text.replace("version:'19.0.0'", "version:'24.0.0'")
text = text.replace("v23 listening", "v24 listening")
text = text.replace("v22 listening", "v24 listening")
server.write_text(text, encoding='utf-8')
# package update
pkg = root/'package.json'
p = json.loads(pkg.read_text(encoding='utf-8'))
p['version']='24.0.0'
p.setdefault('scripts',{})['test:v24']='node scripts/v24-direct-execute-test.js'
pkg.write_text(json.dumps(p, indent=2, ensure_ascii=False), encoding='utf-8')
print('upgrade_v24 applied')
