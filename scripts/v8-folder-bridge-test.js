import http from 'node:http';
const port = Number(process.env.COMPANION_PORT || 8788);
const target = process.env.TARGET_RESEARCH_OUT || 'J:\\ПРОЕКТЫ\\G01_All_About_Trading\\G01_P09_All_for_TradingView\\G01_P09_01_Project\\TradingView_INDICATORS\\IGOR_ENTER2\\research_out';
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
const checks=[];
checks.push(unwrap(await post('tools/call',{name:'folder_explorer',arguments:{folderPath:target}})));
const manifest = unwrap(await post('tools/call',{name:'create_readonly_folder_manifest',arguments:{folderPath:target,maxFiles:200000}}));
checks.push(manifest);
const audit = unwrap(await post('tools/call',{name:'audit_readonly_folder_manifest',arguments:{manifestPath:manifest.structuredContent.manifestPath}}));
checks.push(audit);
const bundle = unwrap(await post('tools/call',{name:'create_readonly_folder_content_bundle',arguments:{manifestPath:manifest.structuredContent.manifestPath,chunkChars:500000}}));
checks.push(bundle);
const search = unwrap(await post('tools/call',{name:'search_folder_content_bundle',arguments:{indexPath:bundle.structuredContent.indexPath,query:'IGOR',maxResults:5}}));
checks.push(search);
let firstText = null;
if (bundle.structuredContent.totalChunks > 0) {
  firstText = unwrap(await post('tools/call',{name:'read_folder_bundle_chunk',arguments:{indexPath:bundle.structuredContent.indexPath,fileIndex:0,chunk:0}}));
  checks.push(firstText);
}
const ok = manifest.structuredContent.fileCount > 0 && audit.structuredContent.ok === true && bundle.structuredContent.fileCount === manifest.structuredContent.fileCount && bundle.structuredContent.bytesRead === manifest.structuredContent.totalBytes;
console.log(JSON.stringify({ok,target,checks:checks.length,fileCount:manifest.structuredContent.fileCount,totalBytes:manifest.structuredContent.totalBytes,textFiles:bundle.structuredContent.textFileCount,binaryFiles:bundle.structuredContent.binaryFileCount,chunks:bundle.structuredContent.totalChunks,manifestPath:manifest.structuredContent.manifestPath,indexPath:bundle.structuredContent.indexPath,guidePath:bundle.structuredContent.guidePath}, null, 2));
if(!ok) process.exit(1);
