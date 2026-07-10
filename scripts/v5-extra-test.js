import http from 'node:http';
import fs from 'node:fs';
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
const fakeVideo = path.join(root, 'selftest-video.mp4');
fs.writeFileSync(fakeVideo, Buffer.from('00000018667479706d70343200000000','hex'));
const checks=[];
checks.push(unwrap(await post('tools/call',{name:'fetch_url_text',arguments:{url:'https://example.com',limit:20000}})));
checks.push(unwrap(await post('tools/call',{name:'extract_links_from_url',arguments:{url:'https://example.com',limit:20000}})));
checks.push(unwrap(await post('tools/call',{name:'create_url_snapshot_job',arguments:{url:'https://example.com',title:'example snapshot',limit:20000}})));
checks.push(unwrap(await post('tools/call',{name:'register_video_pointer',arguments:{filePath:fakeVideo,title:'fake media'}})));
checks.push(unwrap(await post('tools/call',{name:'create_media_metadata_job',arguments:{filePath:fakeVideo}})));
checks.push(unwrap(await post('tools/call',{name:'create_handoff_queue_item',arguments:{title:'handoff test',body:'hello'}})));
checks.push(unwrap(await post('tools/call',{name:'list_handoff_queue',arguments:{limit:5}})));
const ok = checks.length === 7 && checks[0].structuredContent.status >= 200 && checks[5].structuredContent.status === 'queued';
console.log(JSON.stringify({ok,count:checks.length,urlStatus:checks[0].structuredContent.status,queueId:checks[5].structuredContent.id}, null, 2));
if(!ok) process.exit(1);
