import argparse, json, os, re, shutil, subprocess, sys, math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / 'results'
UPLOADS = ROOT / 'uploads'
RESULTS.mkdir(exist_ok=True)
UPLOADS.mkdir(exist_ok=True)

def jprint(obj):
    print(json.dumps(obj, ensure_ascii=False, indent=2))

def run(cmd, timeout=300):
    p = subprocess.run(cmd, text=True, encoding='utf-8', errors='replace', capture_output=True, timeout=timeout)
    return {'cmd': cmd, 'returncode': p.returncode, 'stdout': p.stdout[-4000:], 'stderr': p.stderr[-4000:]}

def toolchain():
    mods = {}
    for m in ['PIL','cv2','pytesseract','numpy','faster_whisper','pandas','openpyxl']:
        try:
            __import__(m); mods[m] = True
        except Exception:
            mods[m] = False
    return { 'ffmpeg': shutil.which('ffmpeg'), 'ffprobe': shutil.which('ffprobe'), 'yt_dlp': shutil.which('yt-dlp'), 'tesseract': shutil.which('tesseract'), 'python': sys.executable, 'modules': mods }
def ffprobe(path):
    exe = shutil.which('ffprobe')
    if not exe: return {'ok': False, 'error': 'ffprobe_not_found'}
    r = run([exe, '-v', 'error', '-show_format', '-show_streams', '-print_format', 'json', str(path)], timeout=120)
    if r['returncode'] != 0: return {'ok': False, **r}
    try: return {'ok': True, 'data': json.loads(r['stdout'])}
    except Exception: return {'ok': True, 'raw': r['stdout']}

def extract_frames(video, interval=10, max_frames=100, outdir=None):
    exe = shutil.which('ffmpeg')
    if not exe: return {'ok': False, 'error': 'ffmpeg_not_found'}
    video = Path(video).resolve()
    outdir = Path(outdir).resolve() if outdir else RESULTS / ('frames_' + video.stem)
    outdir.mkdir(parents=True, exist_ok=True)
    pattern = outdir / 'frame_%06d.jpg'
    vf = f'fps=1/{max(1,float(interval))}'
    r = run([exe, '-hide_banner', '-y', '-i', str(video), '-vf', vf, '-frames:v', str(int(max_frames)), '-q:v', '3', str(pattern)], timeout=900)
    files = sorted(str(p) for p in outdir.glob('frame_*.jpg'))
    return {'ok': r['returncode'] == 0 and len(files) > 0, 'video': str(video), 'outdir': str(outdir), 'count': len(files), 'frames': files, 'ffmpeg': r}

def contact_sheet(frames, outpath=None, thumb_w=320, cols=5):
    from PIL import Image, ImageDraw
    frames = [Path(x) for x in frames]
    imgs = []
    for p in frames:
        im = Image.open(p).convert('RGB')
        h = max(1, int(im.height * (thumb_w / im.width)))
        im.thumbnail((thumb_w, h))
        imgs.append((p, im.copy()))
    rows = math.ceil(len(imgs) / cols) if imgs else 1
    cell_h = max([im.height for _, im in imgs] + [180]) + 26
    sheet = Image.new('RGB', (cols * thumb_w, rows * cell_h), 'white')
    draw = ImageDraw.Draw(sheet)
    for i, (p, im) in enumerate(imgs):
        x = (i % cols) * thumb_w; y = (i // cols) * cell_h
        sheet.paste(im, (x, y + 22)); draw.text((x + 4, y + 4), p.name, fill=(0,0,0))
    outpath = Path(outpath) if outpath else RESULTS / ('contact_sheet.jpg')
    outpath.parent.mkdir(parents=True, exist_ok=True); sheet.save(outpath, quality=88)
    return {'ok': True, 'path': str(outpath), 'frames': len(frames), 'cols': cols}
def extract_audio(media, outpath=None):
    exe = shutil.which('ffmpeg')
    if not exe: return {'ok': False, 'error': 'ffmpeg_not_found'}
    media = Path(media).resolve()
    outpath = Path(outpath).resolve() if outpath else RESULTS / (media.stem + '_audio_16k.wav')
    outpath.parent.mkdir(parents=True, exist_ok=True)
    r = run([exe, '-hide_banner', '-y', '-i', str(media), '-vn', '-ac', '1', '-ar', '16000', str(outpath)], timeout=900)
    return {'ok': r['returncode'] == 0 and outpath.exists(), 'media': str(media), 'audioPath': str(outpath), 'ffmpeg': r}

def transcribe(media, model='tiny', language=None):
    try:
        from faster_whisper import WhisperModel
    except Exception as e:
        return {'ok': False, 'error': 'faster_whisper_not_available', 'detail': str(e)}
    media = Path(media).resolve()
    audio_info = extract_audio(media) if media.suffix.lower() not in ['.wav','.mp3','.m4a','.flac','.ogg'] else {'ok': True, 'audioPath': str(media)}
    if not audio_info.get('ok'): return {'ok': False, 'stage': 'extract_audio', 'audio': audio_info}
    outdir = RESULTS / ('transcript_' + media.stem); outdir.mkdir(exist_ok=True)
    try:
        wm = WhisperModel(model, device='cpu', compute_type='int8')
        segs, info = wm.transcribe(audio_info['audioPath'], language=language)
        rows=[]
        for s in segs:
            rows.append({'start': float(s.start), 'end': float(s.end), 'text': s.text.strip()})
        txt = '\n'.join(f"[{r['start']:.2f}-{r['end']:.2f}] {r['text']}" for r in rows)
        txt_path = outdir / 'transcript.txt'; json_path = outdir / 'transcript.json'
        txt_path.write_text(txt, encoding='utf-8')
        json_path.write_text(json.dumps({'media': str(media), 'audio': audio_info, 'language': getattr(info,'language',None), 'segments': rows}, ensure_ascii=False, indent=2), encoding='utf-8')
        return {'ok': True, 'media': str(media), 'textPath': str(txt_path), 'jsonPath': str(json_path), 'segments': len(rows), 'language': getattr(info,'language',None)}
    except Exception as e:
        return {'ok': False, 'stage': 'whisper', 'error': str(e), 'audio': audio_info}
def ocr_image(path):
    try:
        import pytesseract
        from PIL import Image
    except Exception as e:
        return {'ok': False, 'error': 'ocr_modules_not_available', 'detail': str(e)}
    path = Path(path).resolve()
    try:
        text = pytesseract.image_to_string(Image.open(path))
        out = RESULTS / (path.stem + '_ocr.txt'); out.write_text(text, encoding='utf-8')
        return {'ok': True, 'image': str(path), 'textPath': str(out), 'text': text[:10000], 'chars': len(text)}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

def chart_image(path):
    try:
        import cv2, numpy as np
        from PIL import Image
    except Exception as e:
        return {'ok': False, 'error': 'chart_modules_not_available', 'detail': str(e)}
    path = Path(path).resolve()
    img = cv2.imread(str(path))
    if img is None: return {'ok': False, 'error': 'image_not_readable'}
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 60, 160, apertureSize=3)
    lines = cv2.HoughLinesP(edges, 1, np.pi/180, threshold=80, minLineLength=40, maxLineGap=8)
    horiz=vert=diag=0
    if lines is not None:
        for l in lines[:,0,:]:
            x1,y1,x2,y2 = l
            dx=abs(x2-x1); dy=abs(y2-y1)
            if dy <= max(2, dx*0.08): horiz += 1
            elif dx <= max(2, dy*0.08): vert += 1
            else: diag += 1
    ocr = ocr_image(path)
    return {'ok': True, 'image': str(path), 'width': int(img.shape[1]), 'height': int(img.shape[0]), 'edgePixels': int((edges>0).sum()), 'lineCounts': {'horizontal': horiz, 'vertical': vert, 'diagonal': diag}, 'ocr': ocr}

def links_from_file(path):
    path = Path(path).resolve()
    text = path.read_text(encoding='utf-8', errors='replace')
    urls = sorted(set(re.findall(r'https?://[^\s\)\]\}\"\']+', text)))
    md = re.findall(r'\[([^\]]+)\]\((https?://[^\)]+)\)', text)
    return {'ok': True, 'file': str(path), 'urls': urls[:1000], 'count': len(urls), 'markdownLinks': [{'text': a, 'url': b} for a,b in md[:1000]]}
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd')
    ap.add_argument('--json')
    args = ap.parse_args()
    data = json.loads(args.json) if args.json else {}
    if args.cmd == 'toolchain': jprint(toolchain())
    elif args.cmd == 'ffprobe': jprint(ffprobe(data['path']))
    elif args.cmd == 'extract_frames': jprint(extract_frames(data['video'], data.get('interval',10), data.get('maxFrames',100), data.get('outdir')))
    elif args.cmd == 'contact_sheet': jprint(contact_sheet(data['frames'], data.get('outpath'), data.get('thumbW',320), data.get('cols',5)))
    elif args.cmd == 'video_contact_sheet':
        fr = extract_frames(data['video'], data.get('interval',10), data.get('maxFrames',50), data.get('outdir'))
        if not fr.get('ok'): jprint(fr)
        else: jprint({'frames': fr, 'sheet': contact_sheet(fr['frames'], data.get('outpath'), data.get('thumbW',320), data.get('cols',5))})
    elif args.cmd == 'extract_audio': jprint(extract_audio(data['media'], data.get('outpath')))
    elif args.cmd == 'transcribe': jprint(transcribe(data['media'], data.get('model','tiny'), data.get('language')))
    elif args.cmd == 'ocr_image': jprint(ocr_image(data['path']))
    elif args.cmd == 'chart_image': jprint(chart_image(data['path']))
    elif args.cmd == 'links_from_file': jprint(links_from_file(data['path']))
    else: raise SystemExit('unknown command: '+args.cmd)

if __name__ == '__main__': main()
