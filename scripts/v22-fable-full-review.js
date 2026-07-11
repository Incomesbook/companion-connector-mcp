import http from 'node:http';
const PORT = Number(process.env.COMPANION_PORT || 8788);
function rpc(method, params={}){
  const body=JSON.stringify({jsonrpc:'2.0',id:Date.now(),method,params});
  return new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port:PORT,path:'/mcp',method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{
      let data=''; res.on('data',c=>data+=c); res.on('end',()=>resolve(JSON.parse(data)));
    }); req.on('error',reject); req.write(body); req.end();
  });
}
function unwrap(x){ if(x.error) throw new Error(JSON.stringify(x)); return x.result.structuredContent || x.result; }
const res = unwrap(await rpc('tools/call',{name:'fable_capability_review',arguments:{runFable:true,maxOutputChars:120000}}));
console.log(JSON.stringify({ok:true,status:res.record?.status, id:res.record?.id, summary:res.record?.proposal?.summary||'', approved:res.record?.proposal?.approved, promptPath:res.promptPath},null,2));
