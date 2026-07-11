const endpoint='http://127.0.0.1:8788/mcp';
const task='FABLE5: Прочти последнее сообщение из чата https://chatgpt.com/c/6a4d514b-cb3c-83ea-a369-7f28569b76ff. Чат называется Codex Chat Watch. Выведи русский вывод по пунктам.';
const context='Пользователь требует исправить провал: Fable5 прочитал мусор из OCR вместо самого чата. Нужно уметь читать context, использовать UI Automation, двигать мышь, кликать в область сообщений, прокручивать чат и выводить итог через Notepad/HTML.';
async function call(name,args){
 const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({jsonrpc:'2.0',id:Date.now(),method:'tools/call',params:{name,arguments:args}})});
 const j=await res.json(); if(j.error) throw new Error(JSON.stringify(j.error)); return j.result.structuredContent;
}
const out=await call('fable5_execute',{task,context,maxActions:1,afterSnapshot:false});
const exec=out.executed?.find(x=>x.type==='read_chat_summary_display')?.result;
const pages=exec?.read?.captures?.length||0;
const unique=exec?.read?.uniquePages||0;
const summary=exec?.summary?.summary||'';
console.log(JSON.stringify({ok:out.ok,versionCheck:'v27',taskId:out.taskId,actions:out.actions.map(a=>a.type),readOk:!!exec?.ok,pages,uniquePages:unique,summaryChars:summary.length,combinedChars:exec?.summary?.combinedChars||0,shown:!!exec?.shown,proofPath:out.proofPath},null,2));
if(!exec?.shown || summary.length<500 || pages<1) process.exit(1);
