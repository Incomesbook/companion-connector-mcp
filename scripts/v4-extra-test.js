import http from 'node:http';
import path from 'node:path';
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
const root = process.cwd();
const checks=[];
checks.push(unwrap(await post('tools/call',{name:'connector_health_report',arguments:{}})));
checks.push(unwrap(await post('tools/call',{name:'create_question_batch',arguments:{title:'V4 batch',context:'test context',questions:['What failed before?','How improve?'],filePaths:[path.join(root,'README.md')],maxBytesPerFile:10000}})));
checks.push(unwrap(await post('tools/call',{name:'run_question_batch',arguments:{promptPath:checks[1].structuredContent.promptPath,maxOutputChars:20000}})));
checks.push(unwrap(await post('tools/call',{name:'create_fable_improvement_survey',arguments:{}})));
checks.push(unwrap(await post('tools/call',{name:'ask_fable_big',arguments:{title:'V4 big test',question:'Answer OK if this works.',filePaths:[path.join(root,'README.md')],maxBytesPerFile:10000,maxOutputChars:20000}})));
checks.push(unwrap(await post('tools/call',{name:'list_jobs',arguments:{limit:10}})));
checks.push(unwrap(await post('tools/call',{name:'list_fable_runs',arguments:{limit:10}})));
const ok = checks.length === 7 && checks[2].structuredContent.status === 'completed' && checks[4].structuredContent.fableRun.status === 'completed';
console.log(JSON.stringify({ok,count:checks.length,batch:checks[1].structuredContent.batchId,bigRun:checks[4].structuredContent.fableRun.status}, null, 2));
if(!ok) process.exit(1);
