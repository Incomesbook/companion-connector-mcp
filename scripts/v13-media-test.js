import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const port = Number(process.env.COMPANION_PORT || 8788);
const root = process.cwd();
function post(method, params={}) { return new Promise((resolve,reject)=>{ const body=JSON.stringify({jsonrpc:'2.0',id:Math.floor(Math.random()*1e6),method,params}); const req=http.request({hostname:'127.0.0.1',port,path:'/mcp',method:'POST',headers:{'content-type':'application/json','content-length':Buffer.byteLength(body)}},res=>{let data='';res.on('data',c=>data+=c);res.on('end',()=>resolve(JSON.parse(data||'{}')));}); req.on('error',reject); req.end(body); }); }
function unwrap(x){ if(x.error) throw new Error(JSON.stringify(x)); return x.result; }
const mediaDir = path.join(root,'results','v13_test_media'); fs.mkdirSync(mediaDir,{recursive:true});
const video = path.join(mediaDir,'test_video.mp4');
try { execFileSync('ffmpeg',['-hide_banner','-y','-f','lavfi','-i','testsrc=duration=3:size=320x240:rate=10','-f','lavfi','-i','sine=frequency=440:duration=3','-c:v','libx264','-c:a','aac','-pix_fmt','yuv420p',video],{stdio:'ignore'}); } catch(e) { console.error('ffmpeg sample video failed',e.message); }
const img = path.join(mediaDir,'ocr_test.png');
execFileSync('python',['-X','utf8','-c',`from PIL import Image,ImageDraw; im=Image.new('RGB',(400,180),'white'); d=ImageDraw.Draw(im); d.text((20,40),'TEST CHART 123',fill=(0,0,0)); d.line((20,140,360,140),fill=(0,0,0),width=3); d.line((20,140,20,20),fill=(0,0,0),width=3); im.save(r'${img}')`]);
const linkFile = path.join(mediaDir,'links.md'); fs.writeFileSync(linkFile,'Link: https://example.com\n[OpenAI](https://openai.com)');
const checks=[];
checks.push(unwrap(await post('tools/call',{name:'media_toolchain_report',arguments:{}})));
checks.push(unwrap(await post('tools/call',{name:'create_video_contact_sheet',arguments:{video,interval:1,maxFrames:4}})));
checks.push(unwrap(await post('tools/call',{name:'extract_audio_track',arguments:{media:video}})));
checks.push(unwrap(await post('tools/call',{name:'transcribe_media_audio',arguments:{media:video,model:'tiny'}})));
checks.push(unwrap(await post('tools/call',{name:'ocr_image_file',arguments:{path:img}})));
checks.push(unwrap(await post('tools/call',{name:'analyze_chart_image',arguments:{path:img}})));
checks.push(unwrap(await post('tools/call',{name:'extract_links_from_file',arguments:{filePath:linkFile}})));
const ok = checks.length===7 && checks[0].structuredContent.ffmpeg && checks[1].structuredContent.sheet?.ok && checks[2].structuredContent.ok && checks[3].structuredContent.ok && checks[4].structuredContent.ok && checks[6].structuredContent.count>=2;
console.log(JSON.stringify({ok,count:checks.length,toolchain:checks[0].structuredContent,frames:checks[1].structuredContent.frames?.count,audio:checks[2].structuredContent.audioPath,transcriptOk:checks[3].structuredContent.ok,ocrChars:checks[4].structuredContent.chars,chart:checks[5].structuredContent.lineCounts,links:checks[6].structuredContent.count},null,2));
if(!ok) process.exit(1);
