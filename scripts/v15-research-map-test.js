import http from 'node:http';
import { spawnSync } from 'node:child_process';
const port = Number(process.env.COMPANION_PORT || 8788);
function post(method, params={}){return new Promise((resolve,reject)=>{const body=JSON.stringify({jsonrpc:'2.0',id:Math.floor(Math.random()*1e6),method,params});const req=http.request({hostname:'127.0.0.1',port,path:'/mcp',method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve(JSON.parse(data||'{}')))});req.on('error',reject);req.end(body);});}
function unwrap(x){ if(x.error) throw new Error(JSON.stringify(x)); return x.result; }
const py = spawnSync('python', ['-X','utf8','scripts/create_v14_test_assets.py'], { encoding:'utf8' });
if (py.status !== 0) throw new Error(py.stderr || py.stdout);
const root = JSON.parse(py.stdout).root;
const checks=[];
checks.push(unwrap(await post('tools/call',{name:'create_folder_research_map',arguments:{folder:root}})));
checks.push(unwrap(await post('tools/call',{name:'inspect_linked_resources_from_file',arguments:{path:root+'\\sample.txt'}})));
checks.push(unwrap(await post('tools/call',{name:'create_project_intake_bundle',arguments:{folder:root}})));
const ok = checks.length === 3 && checks.every(c=>c.structuredContent && c.structuredContent.ok) && checks[0].structuredContent.fileCount >= 5 && checks[1].structuredContent.urlCount >= 1;
console.log(JSON.stringify({ok,count:checks.length,fileCount:checks[0].structuredContent.fileCount,typeCounts:checks[0].structuredContent.typeCounts,urlCount:checks[1].structuredContent.urlCount,intake:checks[2].structuredContent.jsonPath}, null, 2));
if(!ok) process.exit(1);
