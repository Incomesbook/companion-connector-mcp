import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const port = Number(process.env.COMPANION_PORT || 8788);
function post(method, params={}) {
  return new Promise((resolve, reject)=>{
    const body = JSON.stringify({jsonrpc:'2.0', id: Math.floor(Math.random()*1e6), method, params});
    const req = http.request({hostname:'127.0.0.1', port, path:'/mcp', method:'POST', headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}}, res=>{
      let data=''; res.on('data', c=>data+=c); res.on('end', ()=>resolve(JSON.parse(data||'{}')));
    }); req.on('error', reject); req.end(body);
  });
}
function unwrap(x){ if(x.error) throw new Error(JSON.stringify(x)); return x.result.structuredContent || x.result; }
const testDir = path.join(process.cwd(),'results','v17_semantic_test');
fs.mkdirSync(testDir,{recursive:true});
fs.writeFileSync(path.join(testDir,'readme.md'),'# Companion Connector MCP\nThis service supports semantic search, live screen snapshots, and Fable handoff.\n','utf8');
fs.writeFileSync(path.join(testDir,'notes.txt'),'Browser automation and human screen OCR are part of V17.\n','utf8');
const win = unwrap(await post('tools/call',{name:'human_list_windows',arguments:{}}));
const active = unwrap(await post('tools/call',{name:'human_active_window',arguments:{}}));
const shot = unwrap(await post('tools/call',{name:'human_screen_snapshot',arguments:{}}));
const ocr = unwrap(await post('tools/call',{name:'human_screen_ocr',arguments:{}}));
const bundle = unwrap(await post('tools/call',{name:'create_readonly_folder_content_bundle',arguments:{folderPath:testDir,chunkChars:1000000,maxFiles:30}}));
const sem = unwrap(await post('tools/call',{name:'create_semantic_index',arguments:{indexPath:bundle.indexPath}}));
const search = unwrap(await post('tools/call',{name:'search_semantic_index',arguments:{indexPath:sem.indexPath,query:'Companion Connector MCP semantic search',limit:5}}));
const ok = win.ok !== false && active.ok !== false && shot.ok && sem.ok && search.ok && search.count > 0;
console.log(JSON.stringify({ok, windows:win.count, active:active.window?.title || null, screenshot:shot.path, ocrChars:ocr.chars, semanticCount:sem.count, searchCount:search.count}, null, 2));
if(!ok) process.exit(1);
