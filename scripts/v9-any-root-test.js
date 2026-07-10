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
function unwrap(x){ if(x.error) throw new Error(JSON.stringify(x)); return x.result; }
const roots = unwrap(await post('tools/call',{name:'discover_readable_roots',arguments:{}}));
const readable = roots.structuredContent.roots.filter(x=>x.readable).map(x=>x.root);
const target = readable.find(x=>x.startsWith('C:')) ? 'C:\\Windows\\win.ini' : null;
let readOk = false;
if (target) {
  const r = unwrap(await post('tools/call',{name:'receive_text_file',arguments:{path:target,limit:4000}}));
  readOk = r.structuredContent.bytes > 0;
}
const ok = readable.length > 0 && (!target || readOk);
console.log(JSON.stringify({ok, readable, target, readOk}, null, 2));
if(!ok) process.exit(1);
