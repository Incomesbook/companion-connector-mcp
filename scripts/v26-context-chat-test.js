const endpoint='http://127.0.0.1:8788/mcp';
const task='Прочти чат https://chatgpt.com/c/6a4d514b-cb3c-83ea-a369-7f28569b76ff. Чат называется Codex Chat Watch. Дай русский вывод по пунктам.';
const context='Пользователь проверяет CompanionConnector. Тема: Fable5 должен напрямую читать задания, понимать чат Codex Chat Watch, выводить понятный русский результат на экран, не только сохранять ответ. Сервис уже имеет MCP Gateway, Fable authority/direct mode, OCR/UIA/browser tools. Проблема: нужно показывать сообщение через Notepad/HTML и использовать context текущего чата, когда скрытая история не доступна через UI.';
async function call(name,args){
 const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:Date.now(),method:'tools/call',params:{name,arguments:args}})});
 const j=await res.json(); if(j.error) throw new Error(JSON.stringify(j.error)); return j.result.structuredContent;
}
const out=await call('fable5_execute',{task,context,strong:true,maxActions:3});
const exec=out.executed?.find(x=>x.type==='read_chat_summary_display')?.result;
console.log(JSON.stringify({ok:out.ok,versionCheck:'v26',taskId:out.taskId,actions:out.actions.map(a=>a.type),readOk:!!exec?.ok,summaryChars:exec?.summary?.summary?.length||0,uiaChars:exec?.uia?.plainText?.length||0,ocrChars:exec?.ocr?.text?.length||0,shown:!!exec?.shown,proofPath:out.proofPath},null,2));
if(!exec?.shown || (exec?.summary?.summary?.length||0)<200) process.exit(1);
