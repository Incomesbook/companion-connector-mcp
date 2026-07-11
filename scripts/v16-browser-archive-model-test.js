import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const port = Number(process.env.COMPANION_PORT || 8788);
const root = process.cwd();
function post(method, params={}) {
  return new Promise((resolve, reject)=>{
    const body = JSON.stringify({jsonrpc:'2.0', id: Math.floor(Math.random()*1e6), method, params});
    const req = http.request({hostname:'127.0.0.1', port, path:'/mcp', method:'POST', headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}}, res=>{let data=''; res.on('data', c=>data+=c); res.on('end', ()=>resolve(JSON.parse(data||'{}')));});
    req.on('error', reject); req.end(body);
  });
}
function unwrap(x){ if(x.error) throw new Error(JSON.stringify(x)); return x.result.structuredContent; }
const assets = path.join(root, 'results', 'v16_test_assets'); fs.mkdirSync(assets,{recursive:true});
fs.writeFileSync(path.join(assets,'secret.txt'),'V16 password archive secret file\n','utf8');
spawnSync('python', ['-X','utf8','-c', `import py7zr, pathlib; p=pathlib.Path(r'${assets}'); z=py7zr.SevenZipFile(p/'secret.7z','w',password='pass123'); z.write(p/'secret.txt','secret.txt'); z.close()`], {encoding:'utf8'});
spawnSync('python', ['-X','utf8','-c', `from PIL import Image,ImageDraw; p=r'${path.join(assets,'chart.png')}'; im=Image.new('RGB',(500,300),'white'); d=ImageDraw.Draw(im); d.line((40,250,470,250),fill='black',width=3); d.line((40,30,40,250),fill='black',width=3); d.line((50,230,160,190,260,120,430,60),fill='blue',width=5); d.text((60,20),'Revenue Chart',fill='black'); im.save(p)`], {encoding:'utf8'});
const checks=[];
checks.push(unwrap(await post('tools/call',{name:'browser_start',arguments:{port:9334,url:'https://example.com'}})));
checks.push(unwrap(await post('tools/call',{name:'browser_list_tabs',arguments:{port:9334}})));
checks.push(unwrap(await post('tools/call',{name:'browser_dom_snapshot',arguments:{port:9334,index:0}})));
checks.push(unwrap(await post('tools/call',{name:'browser_screenshot',arguments:{port:9334,index:0}})));
checks.push(unwrap(await post('tools/call',{name:'browser_live_monitor',arguments:{port:9334,index:0,count:2,interval:0.2}})));
checks.push(unwrap(await post('tools/call',{name:'inspect_password_archive',arguments:{path:path.join(assets,'secret.7z'),password:'pass123'}})));
checks.push(unwrap(await post('tools/call',{name:'extract_password_archive_to_results',arguments:{path:path.join(assets,'secret.7z'),password:'pass123',outdir:path.join(root,'results','v16_extract')}})));
checks.push(unwrap(await post('tools/call',{name:'analyze_chart_advanced',arguments:{path:path.join(assets,'chart.png')}})));
checks.push(unwrap(await post('tools/call',{name:'local_model_status',arguments:{}})));
checks.push(unwrap(await post('tools/call',{name:'local_model_chat_test',arguments:{model:'qwen2.5:0.5b',prompt:'Return OK only.'}})));
checks.push(unwrap(await post('tools/call',{name:'get_full_fable_micro_status',arguments:{out:'results/fable_micro_full_review_v16'}})));
const flags = checks.map((x,i)=>({i,ok:x.ok,error:x.error,title:x.title}));
const ok = checks[0].ok && checks[1].ok && checks[2].ok && checks[3].ok && checks[4].ok && checks[5].ok && checks[6].ok && checks[7].ok && checks[8].ok && checks[9].ok && checks[10].ok;
console.log(JSON.stringify({ok,flags,count:checks.length,browser:checks[2].title,shots:checks[4].shots?.length,archiveEntries:checks[5].entries?.length,extracted:checks[6].count,chart:checks[7].lineCounts,modelStatus:checks[8].ok,chatOk:checks[9].ok,microStatusOk:checks[10].ok},null,2));
if(!ok) process.exit(1);

