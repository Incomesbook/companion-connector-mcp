import http from 'node:http';
import fs from 'node:fs';

function rpc(name, args={}){
  return new Promise((resolve,reject)=>{
    const body=JSON.stringify({jsonrpc:'2.0',id:Date.now(),method:'tools/call',params:{name,arguments:args}});
    const req=http.request({hostname:'127.0.0.1',port:8788,path:'/mcp',method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{
      let data=''; res.on('data',d=>data+=d); res.on('end',()=>resolve(JSON.parse(data)));
    });
    req.on('error',reject); req.write(body); req.end();
  });
}
function unwrap(x){ if(x.error) throw new Error(JSON.stringify(x)); return x.result.structuredContent || x.result; }

const cap = fs.readFileSync('results/fable_authority/V21_CAPABILITIES_FOR_FABLE.json','utf8').slice(0,18000);
const request = [
  'Review CompanionConnector capabilities for productivity.',
  'Design direct user-to-Fable task intake that is logged and safe.',
  'Return JSON with summary, priorities, directInboxDesign, implementNow, risks, approved.'
].join(' ');
const out = unwrap(await rpc('fable_authority_proposal',{
  title:'V21 productivity and direct task intake review',
  runFable:true,
  maxOutputChars:100000,
  request,
  context:cap
}));
console.log(JSON.stringify({ok:true,status:out.status,id:out.id,proposalPath:out.proposalPath,summary:out.fableJson?.summary || out.fableText?.slice(0,800),approved:out.fableJson?.approved ?? null},null,2));
