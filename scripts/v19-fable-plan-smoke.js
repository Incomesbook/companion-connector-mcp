import http from 'node:http';
const port = Number(process.env.COMPANION_PORT || 8788);
function post(method, params={}) { return new Promise((resolve, reject)=>{ const body=JSON.stringify({jsonrpc:'2.0',id:Date.now(),method,params}); const req=http.request({hostname:'127.0.0.1',port,path:'/mcp',method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve(JSON.parse(data||'{}')))}); req.on('error',reject); req.end(body);}); }
function unwrap(x){ if(x.error) throw new Error(JSON.stringify(x)); return x.result.structuredContent||x.result; }
const obs=unwrap(await post('tools/call',{name:'live_agent_observe',arguments:{sessionId:'v19_fable_smoke',task:'Look only and return none action',monitor:1,includeBrowser:false}}));
const plan=unwrap(await post('tools/call',{name:'live_agent_fable_plan',arguments:{sessionId:obs.sessionId,task:'Look only and return one none action',observationPath:obs.jsonPath,maxObservationChars:4000,maxOutputChars:20000}}));
const ok=!!plan.plan && Array.isArray(plan.plan.actions);
console.log(JSON.stringify({ok,sessionId:obs.sessionId,planPath:plan.planPath,summary:plan.plan.summary||'',actions:plan.plan.actions},null,2));
if(!ok) process.exit(1);
