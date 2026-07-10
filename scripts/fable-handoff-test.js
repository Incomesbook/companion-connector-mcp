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
const transcript = unwrap(await post('tools/call', {name:'ingest_chat_transcript', arguments:{title:'handoff smoke', text:'User asks for a stronger companion connector. Confirm Fable handoff works.'}}));
const bundle = unwrap(await post('tools/call', {name:'create_fable_bundle', arguments:{title:'Handoff smoke test', question:'Answer OK if this bundle is readable.', resourceIds:[transcript.structuredContent.id], includeFullText:true, maxBytesPerFile:10000}}));
const run = unwrap(await post('tools/call', {name:'run_fable_bundle', arguments:{bundlePath:bundle.structuredContent.bundlePath, maxOutputChars:20000}}));
console.log(JSON.stringify({ok:true, transcriptId:transcript.structuredContent.id, bundlePath:bundle.structuredContent.bundlePath, run:run.structuredContent}, null, 2));
if (run.structuredContent.status !== 'completed') process.exit(1);
