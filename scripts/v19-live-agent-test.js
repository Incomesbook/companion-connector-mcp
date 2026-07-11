import http from 'node:http';
const port = Number(process.env.COMPANION_PORT || 8788);
function post(method, params={}) {
  return new Promise((resolve, reject)=>{
    const body = JSON.stringify({jsonrpc:'2.0', id: Math.floor(Math.random()*1e6), method, params});
    const req = http.request({hostname:'127.0.0.1', port, path:'/mcp', method:'POST', headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}}, res=>{
      let data=''; res.on('data', c=>data+=c); res.on('end', ()=>resolve(JSON.parse(data||'{}')));
    }); req.on('error', reject); req.end(body);
  });
}
function unwrap(x){ if(x.error) throw new Error(JSON.stringify(x)); return x.result.structuredContent || x.result; }
const obs = unwrap(await post('tools/call',{name:'live_agent_observe',arguments:{sessionId:'v19_test_session',task:'V19 smoke observe',monitor:1,includeBrowser:false}}));
const dry = unwrap(await post('tools/call',{name:'live_agent_apply_action',arguments:{execute:false,action:{type:'human_scroll',clicks:-1,reason:'dry run'}}}));
const none = unwrap(await post('tools/call',{name:'live_agent_apply_action',arguments:{execute:true,action:{type:'none',reason:'noop'}}}));
const ok = obs.ok && obs.ocrChars >= 0 && obs.screenPath && dry.ok && dry.result.dryRun && none.ok;
console.log(JSON.stringify({ok, sessionId:obs.sessionId, screenPath:obs.screenPath, ocrChars:obs.ocrChars, dryRun:dry.result.dryRun, none:none.result.noop}, null, 2));
if(!ok) process.exit(1);
