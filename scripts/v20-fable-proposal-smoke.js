import http from 'node:http';
const port = Number(process.env.COMPANION_PORT || 8788);
function rpc(method, params = {}) { const body=JSON.stringify({jsonrpc:'2.0',id:Date.now(),method,params}); return new Promise((resolve,reject)=>{ const req=http.request({hostname:'127.0.0.1',port,path:'/mcp',method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{resolve(JSON.parse(d))}catch(e){reject(e)}})}); req.on('error',reject); req.end(body); }); }
function unwrap(x){ if(x.error) throw new Error(JSON.stringify(x)); return x.result.structuredContent || x.result; }
const out=unwrap(await rpc('tools/call',{name:'fable_authority_proposal',arguments:{title:'V20 live Fable proposal smoke',context:'Return a tiny approval JSON.',runFable:true,maxOutputChars:20000,decidedBy:'Fable5'}}));
console.log(JSON.stringify({ok:out.ok,status:out.status,id:out.record.id,summary:out.proposal.summary||'',approved:out.proposal.approved??null},null,2));
