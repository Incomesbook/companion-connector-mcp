import http from 'node:http';
const port = Number(process.env.COMPANION_PORT || 8788);
function post(method, params={}) {
  return new Promise((resolve, reject)=>{
    const body = JSON.stringify({jsonrpc:'2.0', id: Math.floor(Math.random()*1e6), method, params});
    const req = http.request({hostname:'127.0.0.1', port, path:'/mcp', method:'POST', headers:{'content-type':'application/json','accept':'application/json, text/event-stream','content-length':Buffer.byteLength(body)}}, res=>{
      let data=''; res.on('data', c=>data+=c); res.on('end', ()=>resolve({status:res.statusCode, data: JSON.parse(data||'{}')}));
    });
    req.on('error', reject); req.end(body);
  });
}
function unwrap(x){ if(x.status!==200 || x.data.error) throw new Error(JSON.stringify(x)); return x.data.result; }
const checks = [];
checks.push(unwrap(await post('initialize', {protocolVersion:'2025-06-18', capabilities:{}, clientInfo:{name:'selftest', version:'1.0.0'}})));
checks.push(unwrap(await post('tools/list')));
checks.push(unwrap(await post('resources/list')));
const ptr = unwrap(await post('tools/call', {name:'register_file_pointer', arguments:{filePath: process.cwd() + '\\README.md', title:'README test'}}));
const rid = ptr.structuredContent.id;
checks.push(ptr);
checks.push(unwrap(await post('tools/call', {name:'search', arguments:{query:'README'}})));
checks.push(unwrap(await post('tools/call', {name:'fetch', arguments:{id:rid}})));
checks.push(unwrap(await post('tools/call', {name:'read_file_slice', arguments:{filePath: process.cwd() + '\\README.md', offset:0, limit:200}})));
const job = unwrap(await post('tools/call', {name:'create_summary_job', arguments:{filePath: process.cwd() + '\\README.md', maxBytes:1000}}));
checks.push(job);
checks.push(unwrap(await post('tools/call', {name:'get_job_status', arguments:{jobId: job.structuredContent.jobId}})));
checks.push(unwrap(await post('resources/read', {uri:'ui://companion/dashboard.html'})));
console.log(JSON.stringify({ok:true, count:checks.length, registered:rid, jobId:job.structuredContent.jobId}, null, 2));
