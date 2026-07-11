import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const port = Number(process.env.COMPANION_PORT || 8788);
function post(method, params={}) { return new Promise((resolve,reject)=>{ const body=JSON.stringify({jsonrpc:'2.0',id:Math.floor(Math.random()*1e6),method,params}); const req=http.request({hostname:'127.0.0.1',port,path:'/mcp',method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve(JSON.parse(data||'{}')))}); req.on('error',reject); req.end(body); }); }
function unwrap(x){ if(x.error) throw new Error(JSON.stringify(x)); return x.result.structuredContent || x.result; }
const testDir=path.join(process.cwd(),'results','v18_queue_test'); fs.mkdirSync(testDir,{recursive:true}); fs.writeFileSync(path.join(testDir,'a.txt'),'Queue semantic test file for Companion Connector.','utf8');
const bundle=unwrap(await post('tools/call',{name:'create_readonly_folder_content_bundle',arguments:{folderPath:testDir,chunkChars:1000000,maxFiles:10}}));
const job=unwrap(await post('tools/call',{name:'create_queue_job',arguments:{type:'semantic_index',title:'v18 semantic',payload:{indexPath:bundle.indexPath},priority:1}}));
const run=unwrap(await post('tools/call',{name:'run_queue_once',arguments:{max:1}}));
const health=unwrap(await post('tools/call',{name:'queue_health_report',arguments:{}}));
const safety=unwrap(await post('tools/call',{name:'audit_path_safety',arguments:{path:testDir}}));
const ok = job.status==='queued' && run.ran===1 && run.jobs[0].status==='done' && health.total>=1 && safety.readAllowedByDrive;
console.log(JSON.stringify({ok, job:job.id, ran:run.ran, status:run.jobs[0].status, queue:health.counts, safety:safety.recommendation}, null, 2));
if(!ok) process.exit(1);
