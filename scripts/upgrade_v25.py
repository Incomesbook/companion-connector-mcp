from pathlib import Path
import json, re
root = Path(r"J:\Setup_VcCode_Workspace\S04_Shared_Connections\S04_02_Shared_MCP_Connections\MCP_Gateway\CompanionConnector")
server = root / 'src' / 'server.js'
text = server.read_text(encoding='utf-8')
text = text.replace('"version": "24.0.0"', '"version": "25.0.0"')
text = text.replace("version:'24.0.0'", "version:'25.0.0'")
text = text.replace("version:'23.0.0'", "version:'25.0.0'")
text = text.replace("version:'22.0.0'", "version:'25.0.0'")
text = text.replace("version:'21.0.0'", "version:'25.0.0'")
text = text.replace("version:'20.0.0'", "version:'25.0.0'")
text = text.replace("version:'19.0.0'", "version:'25.0.0'")
text = re.sub(r"serverInfo:\{name:'companion-connector',version:'[^']+'\}", "serverInfo:{name:'companion-connector',version:'25.0.0'}", text)
text = re.sub(r"version:'[^']+',port:PORT", "version:'25.0.0',port:PORT", text)
text = re.sub(r"companion-connector v\d+ listening", "companion-connector v25 listening", text)
insert_marker = "function directBuildActions(task, fableText=''){"
helper = r'''
function directExtractChatUrl(task){
  const m=String(task||'').match(/https:\/\/chatgpt\.com\/c\/[A-Za-z0-9-]+/i);
  return m ? m[0] : '';
}
function directLikelyChatTitle(task){
  const s=String(task||'');
  const m=s.match(/(?:чат\s+называется|chat\s+(?:is\s+)?called|title\s*:?)\s*["“”']?([^\n"“”']{3,80})/i);
  if(m) return m[1].trim().replace(/[.!?]+$/,'');
  if(/codex\s+chat\s+watch/i.test(s)) return 'Codex Chat Watch';
  if(/chatgpt\s+classic/i.test(s)) return 'ChatGPT Classic';
  return 'ChatGPT';
}
function directOpenUrlDefault(url){
  if(!/^https:\/\/chatgpt\.com\/c\/[A-Za-z0-9-]+/i.test(String(url||''))) return {ok:false,error:'url_not_allowed',url};
  const ps=`Start-Process -FilePath ${JSON.stringify(url)}`;
  const r=spawnSync('pwsh',['-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-Command',ps],{cwd:ROOT,encoding:'utf8',timeout:30000,maxBuffer:1024*1024});
  return {ok:r.status===0,code:r.status,stdout:(r.stdout||'').slice(-2000),stderr:(r.stderr||'').slice(-2000),url};
}
function directWindowReadPages(query, pages=5){
  const captures=[];
  let focus=null;
  try { focus=runLiveBridge('focus_window',{query},120000); } catch(e){ focus={ok:false,error:String(e.message||e)}; }
  for(let i=0;i<Number(pages||5);i++){
    let ocr=null, shot=null;
    try { ocr=runLiveBridge('window_ocr',{query},180000); } catch(e){ ocr={ok:false,error:String(e.message||e)}; }
    try { shot=runLiveBridge('window_screenshot',{query},180000); } catch(e){ shot={ok:false,error:String(e.message||e)}; }
    captures.push({page:i,ocr,shot});
    try { runLiveBridge('scroll',{clicks:-7},120000); } catch {}
  }
  return {ok:true,query,focus,captures};
}
function directSummarizeOcrRussian(task, readResult){
  const texts=[];
  for(const c of (readResult.captures||[])){
    const t=c?.ocr?.text||'';
    if(t && !texts.includes(t)) texts.push(t);
  }
  const combined=compactDirectText(texts.join('\n\n--- PAGE ---\n\n'), 30000);
  const prompt=[
    'Ты Fable5. Пользователь просит прочитать чат и вывести русское сообщение по пунктам.',
    'Сделай только честный вывод из OCR/наблюдения. Если полного текста нет, скажи что видно и что не удалось прочесть.',
    'Не выдумывай скрытые части чата.',
    '', 'ЗАДАНИЕ:', String(task||''), '', 'OCR/НАБЛЮДЕНИЕ:', combined
  ].join('\n');
  let modelOut=null, summary='';
  try{
    modelOut=modelBridge('chat',['--model','qwen2.5:3b','--prompt',prompt],900000);
    summary=modelOut?.response?.message?.content || modelOut?.response?.response || '';
  }catch(e){ modelOut={ok:false,error:String(e.message||e)}; }
  if(!summary || summary.length<30){
    summary = [
      'Fable5: результат чтения чата',
      '',
      '1. Я смог прочитать только видимую часть окна через OCR.',
      '2. Полная скрытая история чата не была доступна через текущий UI-снимок.',
      '3. Видимый текст/фрагменты:',
      compactDirectText(combined || '(OCR не вернул текста)', 5000),
      '',
      '4. Чтобы прочитать весь чат полностью, нужно открыть нужный чат в активном браузере/приложении и дать сервису доступ к DOM или сделать автоматический scroll+OCR по всей истории.'
    ].join('\n');
  }
  return {ok:true,summary,modelOut,combinedChars:combined.length,combinedPreview:compactDirectText(combined,3000)};
}
function directReadChatSummaryDisplay(task){
  const url=directExtractChatUrl(task);
  const title=directLikelyChatTitle(task);
  const opened=url ? directOpenUrlDefault(url) : {ok:false,skipped:true};
  const preferredQueries=[];
  if(title) preferredQueries.push(title);
  preferredQueries.push('Codex Chat Watch','ChatGPT Classic','ChatGPT');
  let read=null, usedQuery='';
  for(const q of preferredQueries){
    try{
      const wins=runLiveBridge('list_windows',{query:q},120000);
      if(wins?.count>0){ usedQuery=q; read=directWindowReadPages(q,6); break; }
    }catch {}
  }
  if(!read){ usedQuery='ChatGPT'; read=directWindowReadPages('ChatGPT',3); }
  const summary=directSummarizeOcrRussian(task, read);
  const message=[
    'Fable5 прочитал доступную часть чата/окна и сделал вывод:',
    '',
    summary.summary,
    '',
    'Технически:',
    `- URL: ${url||'(не найден)'}`,
    `- окно/поиск: ${usedQuery}`,
    `- OCR символов: ${summary.combinedChars}`,
    '- полный proof log сохранён в results/fable_direct_exec'
  ].join('\n');
  const shown=directShowMessage(message, 'Fable5: вывод по чату');
  return {ok:true,type:'read_chat_summary_display',url,title,opened,usedQuery,read,summary,shown};
}
'''
if 'function directExtractChatUrl(task)' not in text:
    text = text.replace(insert_marker, helper + "\n" + insert_marker)
old_build = r"""function directBuildActions(task, fableText=''){
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
"""
new_build = r"""function directBuildActions(task, fableText=''){
  const original = String(task||'');
  const s = (original + '\n' + String(fableText||'')).toLowerCase();
  const actions=[];
  if(directExtractChatUrl(original) || /codex\s+chat\s+watch/i.test(original) || /(прочти|прочитай|read).{0,80}(чат|chatgpt|chat)/i.test(original)){
    actions.push({type:'read_chat_summary_display', reason:'read ChatGPT chat/window, summarize in Russian, and show result'});
    return actions;
  }
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
"""
if old_build in text:
    text=text.replace(old_build,new_build)
else:
    print('WARN directBuildActions exact block not found')
needle = "    if(type==='observe_current_chat') return {ok:true,type,result:directCurrentChatObserve(task)};"
replacement = "    if(type==='observe_current_chat') return {ok:true,type,result:directCurrentChatObserve(task)};\n    if(type==='read_chat_summary_display') return {ok:true,type,result:directReadChatSummaryDisplay(task)};"
if "type==='read_chat_summary_display'" not in text:
    text=text.replace(needle,replacement)
server.write_text(text, encoding='utf-8')
pkg=root/'package.json'
p=json.loads(pkg.read_text(encoding='utf-8'))
p['version']='25.0.0'
p.setdefault('scripts',{})['test:v25']='node scripts/v25-chat-reader-test.js'
pkg.write_text(json.dumps(p, indent=2, ensure_ascii=False), encoding='utf-8')
print('upgrade_v25 applied')
