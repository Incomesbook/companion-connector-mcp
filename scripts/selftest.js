import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
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
const root = process.cwd();
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64');
fs.writeFileSync(path.join(root,'selftest.png'), png);
const checks=[];
checks.push(unwrap(await post('initialize',{protocolVersion:'2025-06-18',capabilities:{},clientInfo:{name:'selftest',version:'2.0.0'}})));
checks.push(unwrap(await post('tools/list')));
checks.push(unwrap(await post('resources/list')));
checks.push(unwrap(await post('prompts/list')));
const ptr=unwrap(await post('tools/call',{name:'register_file_pointer',arguments:{filePath:path.join(root,'README.md'),title:'README test'}}));
const rid=ptr.structuredContent.id; checks.push(ptr);
checks.push(unwrap(await post('tools/call',{name:'search',arguments:{query:'README'}})));
checks.push(unwrap(await post('tools/call',{name:'fetch',arguments:{id:rid}})));
checks.push(unwrap(await post('tools/call',{name:'read_file_slice',arguments:{filePath:path.join(root,'README.md'),offset:0,limit:200}})));
const job=unwrap(await post('tools/call',{name:'create_summary_job',arguments:{filePath:path.join(root,'README.md'),maxBytes:1000}})); checks.push(job);
checks.push(unwrap(await post('tools/call',{name:'get_job_status',arguments:{jobId:job.structuredContent.jobId}})));
checks.push(unwrap(await post('tools/call',{name:'create_file_digest_job',arguments:{filePath:path.join(root,'README.md')}})));
checks.push(unwrap(await post('tools/call',{name:'create_directory_inventory_job',arguments:{dirPath:root,maxEntries:30}})));
const img=unwrap(await post('tools/call',{name:'register_image_pointer',arguments:{filePath:path.join(root,'selftest.png'),title:'selftest image'}})); checks.push(img);
checks.push(unwrap(await post('tools/call',{name:'get_image_data',arguments:{id:img.structuredContent.id,includeData:true}})));
checks.push(unwrap(await post('tools/call',{name:'ingest_image_base64',arguments:{base64:png.toString('base64'),mime:'image/png',title:'inline image'}})));
checks.push(unwrap(await post('tools/call',{name:'create_image_inspection_job',arguments:{filePath:path.join(root,'selftest.png')}})));
checks.push(unwrap(await post('tools/call',{name:'list_mcp_services',arguments:{}})));
checks.push(unwrap(await post('tools/call',{name:'describe_mcp_service',arguments:{serviceId:'ai_bridge_8787'}})));
checks.push(unwrap(await post('tools/call',{name:'create_fable_prompt_file',arguments:{title:'Selftest review',body:'Review selftest output.'}})));
checks.push(unwrap(await post('resources/read',{uri:'ui://companion/dashboard.html'})));
const ok=checks.length===20;
console.log(JSON.stringify({ok,count:checks.length,registered:rid,jobId:job.structuredContent.jobId,imageId:img.structuredContent.id},null,2));
if(!ok) process.exit(1);
