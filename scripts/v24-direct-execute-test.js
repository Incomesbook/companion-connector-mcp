import http from 'http';
const endpoint = 'http://127.0.0.1:8788/mcp';
function rpc(name, args={}){
  return new Promise((resolve,reject)=>{
    const body = JSON.stringify({jsonrpc:'2.0', id: Date.now(), method:'tools/call', params:{name, arguments:args}});
    const req = http.request(endpoint, {method:'POST', headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}}, res=>{
      let data=''; res.on('data', d=>data+=d); res.on('end',()=>{ try{resolve(JSON.parse(data))}catch(e){reject(e)} });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}
function unwrap(x){ if(x.error) throw new Error(JSON.stringify(x)); return x.result.structuredContent || x.result; }
const r = unwrap(await rpc('fable5_execute', {task:'Open Chrome, observe current ChatGPT screen if available, then display a visible completion message.', maxActions:5}));
const types = (r.executed||[]).map(x=>x.type);
if(!r.ok) throw new Error('not ok');
if(!types.includes('browser_start')) throw new Error('browser_start not executed');
if(!types.includes('observe_current_chat')) throw new Error('observe_current_chat not executed');
if(!types.includes('display_message')) throw new Error('display_message not executed');
console.log(JSON.stringify({ok:true, taskId:r.taskId, actions:types, proofPath:r.proofPath}, null, 2));
