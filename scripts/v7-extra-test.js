import http from 'node:http';
const port = Number(process.env.COMPANION_PORT || 8788);
function post(method, params={}) {
  return new Promise((resolve, reject)=>{
    const body = JSON.stringify({jsonrpc:'2.0', id: Math.floor(Math.random()*1e6), method, params});
    const req = http.request({hostname:'127.0.0.1', port, path:'/mcp', method:'POST', headers:{'content-type':'application/json','accept':'application/json, text/event-stream','content-length':Buffer.byteLength(body)}}, res=>{
      let data=''; res.on('data', c=>data+=c); res.on('end', ()=>resolve(JSON.parse(data||'{}')));
    });
    req.on('error', reject); req.end(body);
  });
}
function unwrap(x){ if(x.error) throw new Error(JSON.stringify(x)); return x.result; }
const checks=[];
checks.push(unwrap(await post('tools/call',{name:'list_1000_forward_improvements',arguments:{limit:1000}})));
checks.push(unwrap(await post('tools/call',{name:'audit_1000_forward_improvements',arguments:{}})));
checks.push(unwrap(await post('tools/call',{name:'no_window_startup_info',arguments:{}})));
checks.push(unwrap(await post('tools/call',{name:'create_startup_shortcut_info',arguments:{}})));
const ok = checks.length === 4 && checks[0].structuredContent.count === 1000 && checks[1].structuredContent.ok === true && checks[2].structuredContent.ok === true;
console.log(JSON.stringify({ok,count:checks.length,forwardImprovements:checks[0].structuredContent.count,audit:checks[1].structuredContent.ok,noWindowFiles:checks[2].structuredContent.ok}, null, 2));
if(!ok) process.exit(1);
