import http from 'node:http';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const port = Number(process.env.COMPANION_PORT || 8788);
function post(method, params={}){return new Promise((resolve,reject)=>{const body=JSON.stringify({jsonrpc:'2.0',id:Math.floor(Math.random()*1e6),method,params});const req=http.request({hostname:'127.0.0.1',port,path:'/mcp',method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve(JSON.parse(data||'{}')))});req.on('error',reject);req.end(body);});}
function unwrap(x){ if(x.error) throw new Error(JSON.stringify(x)); return x.result; }
const py = spawnSync('python', ['-X','utf8','scripts/create_v14_test_assets.py'], { encoding:'utf8' });
if (py.status !== 0) throw new Error(py.stderr || py.stdout);
const assets = JSON.parse(py.stdout);
const root = assets.root;
const f = name => path.join(root, name);
const checks=[];
checks.push(unwrap(await post('tools/call',{name:'document_toolchain_report',arguments:{}})));
checks.push(unwrap(await post('tools/call',{name:'inspect_document_file',arguments:{path:f('sample.txt')}})));
checks.push(unwrap(await post('tools/call',{name:'inspect_document_file',arguments:{path:f('sample.docx')}})));
checks.push(unwrap(await post('tools/call',{name:'inspect_document_file',arguments:{path:f('sample.csv')}})));
checks.push(unwrap(await post('tools/call',{name:'inspect_document_file',arguments:{path:f('sample.pptx')}})));
checks.push(unwrap(await post('tools/call',{name:'inspect_archive_file',arguments:{path:f('sample.zip')}})));
checks.push(unwrap(await post('tools/call',{name:'extract_archive_to_results',arguments:{path:f('sample.zip')}})));
checks.push(unwrap(await post('tools/call',{name:'universal_resource_inspect',arguments:{target:f('sample.docx')}})));
const xlsx = unwrap(await post('tools/call',{name:'inspect_document_file',arguments:{path:f('sample.xlsx')}}));
checks.push(xlsx);
const ok = checks.length === 9 && checks.every(c=>c.structuredContent && c.structuredContent.ok !== false) && checks[5].structuredContent.entryCount >= 2;
console.log(JSON.stringify({ok,count:checks.length,tools:checks[0].structuredContent.modules,archiveEntries:checks[5].structuredContent.entryCount,extractFiles:checks[6].structuredContent.fileCount,xlsxOk:xlsx.structuredContent.ok}, null, 2));
if(!ok) process.exit(1);
