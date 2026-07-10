import http from 'node:http';
const port = Number(process.env.COMPANION_PORT || 8788);
const indexPath = process.env.V9_INDEX_PATH || 'J:\\Setup_VcCode_Workspace\\S04_Shared_Connections\\S04_02_Shared_MCP_Connections\\MCP_Gateway\\CompanionConnector\\results\\ro_content_20260710085101317_dc3cb0b0\\content_index.json';
function post(method, params={}) {
  return new Promise((resolve, reject)=>{
    const body = JSON.stringify({jsonrpc:'2.0', id: Math.floor(Math.random()*1e6), method, params});
    const req = http.request({hostname:'127.0.0.1', port, path:'/mcp', method:'POST', headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}}, res=>{
      let data=''; res.on('data', c=>data+=c); res.on('end', ()=>resolve(JSON.parse(data||'{}')));
    }); req.on('error', reject); req.end(body);
  });
}
function unwrap(x){ if(x.error) throw new Error(JSON.stringify(x)); return x.result; }
const summary = unwrap(await post('tools/call',{name:'create_grounded_fable_folder_summary_file',arguments:{indexPath,maxOutputChars:200000}}));
const received = unwrap(await post('tools/call',{name:'receive_text_file',arguments:{path:summary.structuredContent.summaryPath,limit:200000}}));
const ok = summary.structuredContent.summaryBytes > 0 && received.structuredContent.bytes > 0;
console.log(JSON.stringify({ok,indexPath,summaryPath:summary.structuredContent.summaryPath,summaryBytes:summary.structuredContent.summaryBytes,receivedBytes:received.structuredContent.bytes}, null, 2));
if(!ok) process.exit(1);
