const endpoint = 'http://127.0.0.1:8788/mcp';
async function rpc(name, args) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {'content-type': 'application/json; charset=utf-8'},
    body: JSON.stringify({jsonrpc:'2.0', id: Date.now(), method:'tools/call', params:{name, arguments: args}})
  });
  const json = await res.json();
  if (json.error) throw new Error(JSON.stringify(json.error));
  return json.result.structuredContent;
}
const task = 'FABLE5: прочти чат https://chatgpt.com/c/6a4d514b-cb3c-83ea-a369-7f28569b76ff. Чат называется Codex Chat Watch. Выведи русское сообщение по пунктам о том, что понял.';
const out = await rpc('fable5_execute', {task, maxActions: 3, afterSnapshot: false});
const action = out.executed.find(x => x.type === 'read_chat_summary_display');
console.log(JSON.stringify({
  ok: out.ok,
  versionCheck: 'v25',
  taskId: out.taskId,
  actions: out.actions.map(a=>a.type),
  readOk: !!action?.ok,
  usedQuery: action?.result?.usedQuery,
  ocrChars: action?.result?.summary?.combinedChars,
  shown: !!action?.result?.shown?.ok,
  proofPath: out.proofPath
}, null, 2));
