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
const roots = unwrap(await post('tools/call',{name:'discover_readable_roots',arguments:{}}));
const bundle = unwrap(await post('tools/call',{name:'create_readonly_folder_content_bundle',arguments:{folderPath:target,chunkChars:500000}}));
const intel = unwrap(await post('tools/call',{name:'create_folder_intel_report',arguments:{indexPath:bundle.structuredContent.indexPath,snippetChars:2000}}));
const summary = unwrap(await post('tools/call',{name:'create_fable_folder_summary_file',arguments:{indexPath:bundle.structuredContent.indexPath,intelReportPath:intel.structuredContent.mdPath,maxOutputChars:200000}}));
const received = unwrap(await post('tools/call',{name:'receive_text_file',arguments:{path:summary.structuredContent.summaryPath,limit:200000}}));
const ok = bundle.structuredContent.fileCount > 0 && summary.structuredContent.summaryBytes > 0 && received.structuredContent.bytes > 0;
console.log(JSON.stringify({ok,target,roots:roots.structuredContent.roots.filter(x=>x.readable).map(x=>x.root),fileCount:bundle.structuredContent.fileCount,textFiles:bundle.structuredContent.textFileCount,binaryFiles:bundle.structuredContent.binaryFileCount,chunks:bundle.structuredContent.totalChunks,indexPath:bundle.structuredContent.indexPath,intelReportPath:intel.structuredContent.mdPath,summaryPath:summary.structuredContent.summaryPath,summaryBytes:summary.structuredContent.summaryBytes,receivedBytes:received.structuredContent.bytes}, null, 2));
if(!ok) process.exit(1);
