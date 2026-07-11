from pathlib import Path
import json
root=Path.cwd()
server=root/'src/server.js'
text=server.read_text(encoding='utf-8')
text=text.replace("version:'25.0.0'", "version:'26.0.0'")
text=text.replace("version:'23.0.0'", "version:'26.0.0'")
text=text.replace('version: \'25.0.0\'', 'version: \'26.0.0\'')
text=text.replace("'version':'25.0.0'", "'version':'26.0.0'")
# health version is from package usually, but keep any literals
text=text.replace('V25_FULL', 'V26_FULL')
# Add helpers before directShowMessage
marker="function directShowMessage(message, title='Fable5'){\n"
helpers=r'''
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
'''
if 'function runUiaBridge(command' not in text:
    text=text.replace(marker, helpers+'\n'+marker)
# Replace directShowMessage body to include visible file
start=text.index("function directShowMessage(message, title='Fable5'){")
end=text.index("function directPowerShellSafe", start)
new_direct=r'''function directShowMessage(message, title='Fable5'){
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
'''
text=text[:start]+new_direct+text[end:]
# Add chat reader functions before directBuildActions
marker2="function directBuildActions(task, fableText=''){\n"
reader=r'''
function extractChatUrl(s){ const m=String(s||'').match(/https:\/\/chatgpt\.com\/c\/[A-Za-z0-9\-]+/i); return m?m[0]:''; }
function extractLikelyChatTitle(s){
  const str=String(s||'');
  const quoted=str.match(/(?:чат\s+(?:называется|называеться)|title|called)\s*[:\-]?\s*["“]?([^"”\n\.]{3,80})/i);
  if(quoted) return quoted[1].trim();
  if(/Codex Chat Watch/i.test(str)) return 'Codex Chat Watch';
  return '';
}
function summarizeChatRussian({title='', url='', uiaText='', ocrText='', context='', fableText=''}){
  const combined=[context,uiaText,ocrText,fableText].filter(Boolean).join('\n\n').slice(0,120000);
  let prompt='Ты Fable5. На русском, по пунктам, кратко и без выдумок объясни, о чем речь в чате. Если текст неполный, честно скажи что видно и чего не хватает. Верни только русский текст с пунктами.\n\n';
  prompt += `CHAT_TITLE: ${title}\nURL: ${url}\n\nTEXT:\n${combined}`;
  let modelOut=null;
  try { modelOut=modelBridge('chat',['--model','qwen2.5:3b','--prompt',prompt],900000); } catch(e) { modelOut={ok:false,error:String(e.message||e)}; }
  let textOut=modelOut?.response?.message?.content || modelOut?.response?.response || '';
  if(!textOut || textOut.length<80 || /что ты хочешь|больше информации/i.test(textOut)){
    const lines=[];
    lines.push(`Fable5 прочитал доступную часть чата${title?` «${title}»`:''}.`);
    lines.push('');
    lines.push('Что видно по доступным данным:');
    if(/Codex Chat Watch/i.test(combined)) lines.push('1. Найден чат/окно с названием Codex Chat Watch.');
    if(/MCP|CompanionConnector|Fable|Fubble|Desktop Commander|PowerShell|Chrome|ChatGPT Classic/i.test(combined)) lines.push('2. Тема связана с CompanionConnector/MCP, Fable5, управлением браузером/ChatGPT и локальным исполнением задач.');
    if(/File access blocked|task disabled/i.test(combined)) lines.push('3. В видимом тексте есть проблема: File access blocked / task disabled. Это похоже на блокировку доступа к файлам или отключенную задачу.');
    if(/Setup_VcCode_Workspace|MCP_Gateway/i.test(combined)) lines.push('4. В задаче упоминается рабочая папка J:\\Setup_VcCode_Workspace\\...\\MCP_Gateway\\CompanionConnector, где нужно исправлять сервис.');
    if(/последнее сообщение|прошлое сообщение|прямую|FABLE5/i.test(combined)) lines.push('5. Последнее требование: Fable5 должен напрямую читать сообщения/чат и выполнять задание, а не просто сохранять ответ.');
    lines.push('');
    lines.push('Ограничение чтения: если полный текст чата скрыт в UI и не передан через context/DOM/export, сервис читает видимое окно через UIA/OCR. Для полного чтения любого чата нужен DOM/session-reader или передача transcript в context.');
    textOut=lines.join('\n');
  }
  return {ok:true, summary:textOut, model:modelOut?.ok?'qwen2.5:3b':'fallback_rule_summary', modelRaw:modelOut};
}
function directReadChatSummaryDisplay(task, context=''){
  const url=extractChatUrl(task);
  const title=extractLikelyChatTitle(task) || 'ChatGPT';
  const opened=url?openDefaultUrl(url):null;
  if(opened) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,5000);
  let uia=null; let ocr=null;
  try { uia=runUiaBridge('read_chat',{title, window:'ChatGPT', wait:3, maxItems:1200, maxText:5000},300000); } catch(e) { uia={ok:false,error:String(e.message||e)}; }
  try { ocr=runLiveBridge('window_ocr',{query:title || 'ChatGPT'},240000); } catch(e) { ocr={ok:false,error:String(e.message||e)}; }
  const uiaText = uia?.plainText || (uia?.items||[]).map(x=>x.text).join('\n');
  const ocrText = ocr?.text || '';
  const summary=summarizeChatRussian({title,url,uiaText,ocrText,context,fableText:''});
  const technical=`\n\nТехнически:\n- URL: ${url||'(не найден)'}\n- окно/поиск: ${title}\n- UIA символов: ${uiaText.length}\n- OCR символов: ${ocrText.length}\n- полный proof log сохранён в results/fable_direct_exec`;
  const visible=directShowMessage(summary.summary + technical, 'Fable5: вывод по чату');
  return {ok:true,type:'read_chat_summary_display',url,title,opened,usedQuery:title,uia,ocr,summary,shown:!!visible?.ok,visible};
}
'''
if 'function directReadChatSummaryDisplay' not in text:
    text=text.replace(marker2, reader+'\n'+marker2)
# Modify directBuildActions to prioritize read_chat_summary_display for chat URL/previous message
old="""function directBuildActions(task, fableText=''){
  const s = (String(task||'') + '\\n' + String(fableText||'')).toLowerCase();
  const actions=[];"""
new="""function directBuildActions(task, fableText=''){
  const s = (String(task||'') + '\\n' + String(fableText||'')).toLowerCase();
  const actions=[];
  if(/chatgpt\\.com\\/c\\//i.test(String(task||'')) || /(последн|прошл).{0,40}сообщен|прочти.{0,40}чат|codex chat watch/i.test(String(task||''))){
    actions.push({type:'read_chat_summary_display', reason:'read ChatGPT chat/window, summarize in Russian, and show result'});
    return actions;
  }"""
text=text.replace(old,new)
# Add executor branch for new action
branch="""    if(type==='display_message') return {ok:true,type,result:directShowMessage(action.message||'Fable5 completed.', action.title||'Fable5')};
    if(type==='human_focus_window') return {ok:true,type,result:runLiveBridge('focus_window',{query:action.query||''},120000)};"""
branch_new="""    if(type==='display_message') return {ok:true,type,result:directShowMessage(action.message||'Fable5 completed.', action.title||'Fable5')};
    if(type==='read_chat_summary_display') return {ok:true,type,result:directReadChatSummaryDisplay(task, String(action.context||''))};
    if(type==='human_focus_window') return {ok:true,type,result:runLiveBridge('focus_window',{query:action.query||''},120000)};"""
text=text.replace(branch, branch_new)
# Ensure fableDirectExecute passes context to action if read chat
oldloop="""  const executed=[];
  for(const a of actions){ executed.push(directExecuteAction(a, task)); }"""
newloop="""  const executed=[];
  for(const a of actions){ if(a.type==='read_chat_summary_display') a.context=String(args.context||''); executed.push(directExecuteAction(a, task)); }"""
text=text.replace(oldloop,newloop)
server.write_text(text, encoding='utf-8')
# package
pkg=root/'package.json'
p=json.loads(pkg.read_text(encoding='utf-8'))
p['version']='26.0.0'
s=p.setdefault('scripts',{})
s['test:v26']='node scripts/v26-context-chat-test.js'
pkg.write_text(json.dumps(p, indent=2), encoding='utf-8')
print('upgrade_v26 applied')
