import http from 'node:http';
const PORT = Number(process.env.COMPANION_PORT || 8788);
function rpc(method, params={}){
  const body=JSON.stringify({jsonrpc:'2.0',id:Date.now()+Math.random(),method,params});
  return new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port:PORT,path:'/mcp',method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{
      let data=''; res.on('data',c=>data+=c); res.on('end',()=>resolve(JSON.parse(data)));
    }); req.on('error',reject); req.write(body); req.end();
  });
}
function unwrap(x){ if(x.error) throw new Error(JSON.stringify(x)); return x.result.structuredContent || x.result; }
const tool = async (name,args={}) => unwrap(await rpc('tools/call',{name,arguments:args}));
const manifest = await tool('fable5_direct_mode_manifest',{});
const snap = await tool('fable_capability_snapshot',{});
const direct = await tool('fable5',{message:'V22 direct mode smoke. Return OK and one sentence.', maxOutputChars:20000});
const help = await tool('fable5_request_chatgpt_help',{request:'Smoke request from Fable5 to ChatGPT help queue',context:'V22 test'});
console.log(JSON.stringify({ok:true, triggerWords:manifest.triggerWords, tools:snap.toolCount, directStatus:direct.task.status, helpId:help.id},null,2));
