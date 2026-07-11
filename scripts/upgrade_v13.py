from pathlib import Path
p = Path('src/server.js')
txt = p.read_text(encoding='utf-8')
helper = r'''
function runMediaBridge(command, args = {}, timeoutMs = 900000) {
  const script = path.join(ROOT, 'scripts', 'media_bridge.py');
  const py = process.env.PYTHON || 'python';
  const r = spawnSync(py, ['-X','utf8', script, command, '--json', JSON.stringify(args || {})], { encoding:'utf8', timeout: timeoutMs, cwd: ROOT });
  if (r.error) return { ok:false, error:String(r.error.message || r.error), stdout:r.stdout || '', stderr:r.stderr || '' };
  const raw = (r.stdout || '').trim();
  try { return JSON.parse(raw); }
  catch { return { ok:false, parseError:true, exitCode:r.status, stdout:r.stdout || '', stderr:r.stderr || '' }; }
}
function parseLocalLinksFromFile(args = {}) { return runMediaBridge('links_from_file', { path: assertReadable(args.filePath) }, 120000); }
function mediaToolchainReport() { return runMediaBridge('toolchain', {}, 120000); }
'''
if 'function runMediaBridge(command' not in txt:
    txt = txt.replace('function listTools() { return [', helper + '\nfunction listTools() { return [')
new_tools = r'''
 { name:'media_toolchain_report', title:'Media toolchain report', description:'Check ffmpeg, ffprobe, yt-dlp, tesseract and Python media modules.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'extract_video_frames', title:'Extract video frames', description:'Read video file and create sampled frame images under connector results.', inputSchema:{type:'object',properties:{video:{type:'string'},interval:{type:'number'},maxFrames:{type:'number'},outdir:{type:'string'}},required:['video']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_video_contact_sheet', title:'Create video contact sheet', description:'Extract sampled frames and build a contact sheet image for quick visual review.', inputSchema:{type:'object',properties:{video:{type:'string'},interval:{type:'number'},maxFrames:{type:'number'},outpath:{type:'string'},thumbW:{type:'number'},cols:{type:'number'}},required:['video']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'extract_audio_track', title:'Extract audio track', description:'Extract mono 16k wav audio from video or audio media.', inputSchema:{type:'object',properties:{media:{type:'string'},outpath:{type:'string'}},required:['media']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'transcribe_media_audio', title:'Transcribe media audio', description:'Transcribe local audio/video with faster-whisper CPU when model is available.', inputSchema:{type:'object',properties:{media:{type:'string'},model:{type:'string'},language:{type:'string'}},required:['media']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'ocr_image_file', title:'OCR image file', description:'Extract visible text from an image using local Tesseract OCR.', inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'analyze_chart_image', title:'Analyze chart image', description:'OCR and simple line/edge analysis for chart/graph screenshots.', inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'extract_links_from_file', title:'Extract links from file', description:'Extract http/https and markdown links from a local text file.', inputSchema:{type:'object',properties:{filePath:{type:'string'}},required:['filePath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
'''
if "name:'media_toolchain_report'" not in txt:
    txt = txt.replace("{ name:'get_job_status', title:'Get job status'", new_tools + " { name:'get_job_status', title:'Get job status'")
new_calls = r'''
 if (name==='media_toolchain_report') return toolResult(mediaToolchainReport());
 if (name==='extract_video_frames') return toolResult(runMediaBridge('extract_frames', { video: assertReadable(args.video), interval: args.interval || 10, maxFrames: args.maxFrames || 100, outdir: args.outdir }, 1200000));
 if (name==='create_video_contact_sheet') return toolResult(runMediaBridge('video_contact_sheet', { video: assertReadable(args.video), interval: args.interval || 10, maxFrames: args.maxFrames || 50, outpath: args.outpath, thumbW: args.thumbW || 320, cols: args.cols || 5 }, 1200000));
 if (name==='extract_audio_track') return toolResult(runMediaBridge('extract_audio', { media: assertReadable(args.media), outpath: args.outpath }, 1200000));
 if (name==='transcribe_media_audio') return toolResult(runMediaBridge('transcribe', { media: assertReadable(args.media), model: args.model || 'tiny', language: args.language }, 3600000));
 if (name==='ocr_image_file') return toolResult(runMediaBridge('ocr_image', { path: assertReadable(args.path) }, 300000));
 if (name==='analyze_chart_image') return toolResult(runMediaBridge('chart_image', { path: assertReadable(args.path) }, 300000));
 if (name==='extract_links_from_file') return toolResult(parseLocalLinksFromFile(args));
'''
if "name==='media_toolchain_report'" not in txt:
    txt = txt.replace("if (name==='get_job_status')", new_calls + " if (name==='get_job_status')")
txt = txt.replace("version:'12.0.0'", "version:'13.0.0'")
txt = txt.replace("version:'9.0.0'", "version:'13.0.0'")
txt = txt.replace("version:'8.0.0'", "version:'13.0.0'")
txt = txt.replace("companion-connector v9 listening", "companion-connector v13 listening")
txt = txt.replace("companion-connector v8 listening", "companion-connector v13 listening")
p.write_text(txt, encoding='utf-8')
print('upgrade_v13.py applied')
