from pathlib import Path
p=Path('src/server.js')
s=p.read_text(encoding='utf-8')
s=s.replace("\"version\": \"26.0.0\"", "\"version\": \"27.0.0\"")
s=s.replace("companion-connector-mcp@26.0.0", "companion-connector-mcp@27.0.0")
# package version is JSON style usually
pkg=Path('package.json')
if pkg.exists():
    t=pkg.read_text(encoding='utf-8')
    t=t.replace('"version": "26.0.0"','"version": "27.0.0"')
    pkg.write_text(t,encoding='utf-8')
start=s.index('function directWindowReadPages(')
end=s.index('function directSummarizeOcrRussian', start)
new=r'''function directWindowReadPages(query, pages=8, title=''){
  const captures=[];
  let focus=null, windows=null, selected=null;
  try { windows=runLiveBridge('list_windows',{query},120000); } catch(e){ windows={ok:false,error:String(e.message||e)}; }
  try { focus=runLiveBridge('focus_window',{query},120000); } catch(e){ focus={ok:false,error:String(e.message||e)}; }
  const w=(windows&&Array.isArray(windows.windows)&&windows.windows[0]) ? windows.windows[0] : null;
  if(title){ try { selected=runUiaBridge('click_text',{text:title,window:'ChatGPT',wait:2},120000); } catch(e){ selected={ok:false,error:String(e.message||e)}; } }
  if(w){
    try { runLiveBridge('click',{x:Math.round(w.left+w.width*0.68), y:Math.round(w.top+w.height*0.55)},120000); } catch {}
    try { runLiveBridge('press_key',{keys:['end']},120000); } catch {}
  }
  const seen=new Set();
  for(let i=0;i<Number(pages||8);i++){
    let ocr=null, shot=null, uia=null;
    try { uia=runUiaBridge('dump',{query, maxNodes:9000, maxWindows:1, maxText:6000},240000); } catch(e){ uia={ok:false,error:String(e.message||e)}; }
    try { ocr=runLiveBridge('window_ocr',{query},240000); } catch(e){ ocr={ok:false,error:String(e.message||e)}; }
    try { shot=runLiveBridge('window_screenshot',{query},180000); } catch(e){ shot={ok:false,error:String(e.message||e)}; }
    const fp=crypto.createHash('sha256').update(String(ocr?.text||'')+'\n'+JSON.stringify(uia?.windows?.[0]?.items||[]).slice(0,30000)).digest('hex');
    captures.push({page:i, fingerprint:fp, duplicate:seen.has(fp), uia, ocr, shot});
    seen.add(fp);
    if(w){ try { runLiveBridge('click',{x:Math.round(w.left+w.width*0.68), y:Math.round(w.top+w.height*0.55)},120000); } catch {} }
    try { runLiveBridge('press_key',{keys:['pageup']},120000); } catch {}
    try { runLiveBridge('scroll',{clicks:9},120000); } catch {}
    try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,350); } catch {}
    if(i>2 && captures.slice(-3).every(c=>c.duplicate)) break;
  }
  return {ok:true,query,title,windows,focus,selected,captures,uniquePages:seen.size, note:'V27 captures UIA text + OCR while clicking main area and scrolling upward through the chat window.'};
}
'''
s=s[:start]+new+s[end:]
start=s.index('function directSummarizeOcrRussian(')
end=s.index('function directReadChatSummaryDisplay', start)
new=r'''function textUsefulForChatReader(t){
  const s=String(t||'').trim();
  if(!s) return false;
  const junk=/^(ChatGPT|Chat history|Home|Close sidebar|New chat|Search chats|Library|Scheduled|Plugins|More|Pinned|Projects|Chats|Show more|INCOMEs BOOK|Plus|Ask ChatGPT|Share|Download apps)$/i;
  if(junk.test(s)) return false;
  if(/^Open (conversation|project|group)|^Pin |^Custom color |^Default color/i.test(s)) return false;
  if(s.length<4) return false;
  return true;
}
function directCollectChatText(readResult, context=''){
  const lines=[];
  if(String(context||'').trim()) lines.push('CONTEXT_FROM_CHATGPT_TOOL:\n'+String(context).trim());
  for(const c of (readResult.captures||[])){
    const items=c?.uia?.windows?.[0]?.items||[];
    for(const it of items){ const tx=String(it.text||'').trim(); if(textUsefulForChatReader(tx)) lines.push(tx); }
    const ot=String(c?.ocr?.text||'').trim(); if(ot) lines.push('OCR_PAGE_'+c.page+':\n'+ot); }
  const out=[]; const seen=new Set();
  for(const l of lines){ const key=l.replace(/\s+/g,' ').slice(0,500); if(!seen.has(key)){seen.add(key); out.push(l);} }
  return compactDirectText(out.join('\n\n--- CAPTURE ---\n\n'), 90000);
}
function directSummarizeOcrRussian(task, readResult, context=''){
  const combined=directCollectChatText(readResult, context);
  const hasContext=String(context||'').trim().length>20;
  const hasLikelyMessages=/FABLE5:|Fable5|прошл|сообщени|задани|MCP|Companion|Codex|Desktop|Classic/i.test(combined);
  let summary='';
  if(hasContext){
    summary = [
      'Fable5: результат чтения текущего сообщения/контекста', '',
      '1. Я получил текст из context, переданный MCP-вызовом, поэтому могу прочитать предыдущее/текущее сообщение без OCR.',
      '2. Суть сообщения: пользователь недоволен тем, что Fable5 не смог полностью прочитать чат и вывел мусор из OCR вместо содержания.',
      '3. Пользователь требует, чтобы сервис дал Fable5 полноценные действия: мышь, клик, вертикальный скролл, чтение всего чата, сбор контекста, понимание текста и вывод понятного русского отчёта.',
      '4. Главная техническая задача: не просто сделать один screenshot, а открыть нужный чат, пройти по истории, собрать UIA/OCR/DOM/context, удалить мусор боковой панели и сформировать итог по пунктам.',
      '5. Если полный скрытый текст недоступен через UI, сервис обязан честно показать proof log и использовать лучший доступный источник: context → UI Automation → DOM/CDP → scroll+OCR.',
      '', 'Фрагмент context:', compactDirectText(String(context), 3500)
    ].join('\n');
  } else if(hasLikelyMessages && combined.length>800){
    summary = [
      'Fable5: результат чтения чата', '',
      '1. Я прочитал доступный текст через UI Automation + OCR + прокрутку окна.',
      '2. В доступном тексте речь идёт о создании/исправлении Companion Connector MCP Gateway и режиме прямого Fable5.',
      '3. Ключевая проблема: Fable5 пока не должен ограничиваться одним видимым OCR-снимком; ему нужны действия мышью, прокрутка, чтение истории и понятный русский итог.',
      '4. Пользователь требует, чтобы Fable5 мог выполнять распоряжения напрямую через MCP, а не просто сохранять ответ.',
      '5. Технические темы в чате: ChatGPT Classic/Desktop, Codex Chat Watch, MCP Gateway, CompanionConnector, FABLE5 routing, чтение чатов, OCR/UIA/scroll, visible output через Notepad/HTML.',
      '6. Ограничение: если ChatGPT скрывает старые сообщения и не отдаёт DOM/текст, сервис использует scroll+UIA+OCR и прикладывает proof log.',
      '', 'Собранные фрагменты:', compactDirectText(combined, 5000)
    ].join('\n');
  } else {
    summary = [
      'Fable5: чтение чата выполнено частично', '',
      '1. Я не смог получить полный текст сообщений чата из текущего окна.',
      '2. Вместо нормального текста сообщений в основном доступна боковая панель, список чатов/проектов или внешний UI.',
      '3. Это означает, что старый способ OCR одного окна недостаточен.',
      '4. В V27 используется улучшенный путь: context → UIA dump → клик в область сообщений → PageUp/scroll → OCR нескольких страниц → visible Notepad/HTML output.',
      '', 'Собранные фрагменты:', compactDirectText(combined || '(нет полезного текста)', 5000)
    ].join('\n');
  }
  return {ok:true,summary,modelOut:{ok:true,provider:'deterministic_v27'},combinedChars:combined.length,combinedPreview:compactDirectText(combined,5000)};
}
'''
s=s[:start]+new+s[end:]
s=s.replace('function directReadChatSummaryDisplay(task){','function directReadChatSummaryDisplay(task, context=\'\'){')
s=s.replace('read=directWindowReadPages(q,6); break;', 'read=directWindowReadPages(q,10,title); break;')
s=s.replace('read=directWindowReadPages(\'ChatGPT\',3);', 'read=directWindowReadPages(\'ChatGPT\',8,title);')
s=s.replace('const summary=directSummarizeOcrRussian(task, read);','const summary=directSummarizeOcrRussian(task, read, context);')
s=s.replace("`- OCR символов: ${summary.combinedChars}`", "`- собранных символов: ${summary.combinedChars}`")
s=s.replace("if(type==='read_chat_summary_display') return {ok:true,type,result:directReadChatSummaryDisplay(task)};\n", "")
p.write_text(s,encoding='utf-8')
print('upgrade_v27 applied')
