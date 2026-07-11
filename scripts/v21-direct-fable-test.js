import http from 'node:http';
function rpc(name,args={}){
  return new Promise((resolve,reject)=>{
    const body=JSON.stringify({jsonrpc:'2.0',id:Date.now(),method:'tools/call',params:{name,arguments:args}});
    const req=http.request({hostname:'127.0.0.1',port:8788,path:'/mcp',method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{
      let data=''; res.on('data',d=>data+=d); res.on('end',()=>resolve(JSON.parse(data)));
    });
    req.on('error',reject); req.write(body); req.end();
  });
}
function unwrap(x){ if(x.error) throw new Error(JSON.stringify(x)); return x.result.structuredContent || x.result; }
const submit=unwrap(await rpc('fable_direct_submit',{task:'Return a tiny V21 direct inbox OK response.',context:'Smoke test',runNow:true,maxOutputChars:20000}));
const inbox=unwrap(await rpc('fable_direct_inbox',{limit:5}));
const read=unwrap(await rpc('fable_direct_read',{id:submit.task.id}));
const dash=unwrap(await rpc('fable_direct_dashboard',{limit:10}));
const ok = submit.ok && submit.task.status==='answered' && inbox.count>=1 && read.record.id===submit.task.id && !!dash.htmlPath;
console.log(JSON.stringify({ok,taskId:submit.task.id,status:submit.task.status,inboxCount:inbox.count,dashboard:dash.htmlPath,replyChars:(submit.task.replyText||'').length},null,2));
if(!ok) process.exit(1);
