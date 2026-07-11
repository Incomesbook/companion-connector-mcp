from pathlib import Path
import argparse, json, time, os, sys, hashlib
ROOT = Path.cwd()
RESULTS = ROOT / 'results'
RESULTS.mkdir(exist_ok=True)

def ok(data):
    print(json.dumps({'ok': True, **data}, ensure_ascii=False, indent=2))

def fail(msg):
    print(json.dumps({'ok': False, 'error': str(msg)}, ensure_ascii=False, indent=2))
    return 1
def _wins():
    import pygetwindow as gw
    out=[]
    for w in gw.getAllWindows():
        try:
            if not w.title: continue
            out.append({'title':w.title,'left':w.left,'top':w.top,'width':w.width,'height':w.height,'isActive':w.isActive,'isMinimized':w.isMinimized})
        except Exception:
            pass
    return out

def list_windows(args):
    q=(args.get('query') or '').lower()
    wins=_wins()
    if q: wins=[w for w in wins if q in w['title'].lower()]
    ok({'windows': wins, 'count': len(wins)})

def active_window(args):
    import pygetwindow as gw
    w=gw.getActiveWindow()
    ok({'window': None if not w else {'title':w.title,'left':w.left,'top':w.top,'width':w.width,'height':w.height}})
def focus_window(args):
    import pygetwindow as gw
    q=(args.get('query') or '').lower()
    for w in gw.getAllWindows():
        if q and q in (w.title or '').lower():
            try:
                if w.isMinimized: w.restore()
                w.activate()
                time.sleep(0.4)
                return ok({'focused': w.title})
            except Exception as e:
                return fail(e)
    return fail('window_not_found')

def screenshot(args):
    import mss
    from PIL import Image
    outdir=RESULTS / ('live_screen_' + time.strftime('%Y%m%d_%H%M%S'))
    outdir.mkdir(exist_ok=True)
    with mss.mss() as sct:
        mon=sct.monitors[int(args.get('monitor',1))]
        img=sct.grab(mon)
        im=Image.frombytes('RGB', img.size, img.rgb)
    p=outdir/'desktop.png'
    im.save(p)
    ok({'path': str(p), 'width': im.width, 'height': im.height, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()})
def screen_ocr(args):
    import mss, pytesseract
    from PIL import Image
    with mss.mss() as sct:
        mon=sct.monitors[int(args.get('monitor',1))]
        img=sct.grab(mon)
        im=Image.frombytes('RGB', img.size, img.rgb)
    text=pytesseract.image_to_string(im)
    ok({'text': text, 'chars': len(text)})

def click(args):
    import pyautogui
    x=int(args.get('x')); y=int(args.get('y'))
    pyautogui.click(x,y, clicks=int(args.get('clicks',1)), interval=0.05)
    ok({'clicked': {'x':x,'y':y}})

def move(args):
    import pyautogui
    x=int(args.get('x')); y=int(args.get('y'))
    pyautogui.moveTo(x,y,duration=float(args.get('duration',0.2)))
    ok({'moved': {'x':x,'y':y}})
def type_text(args):
    import pyautogui, pyperclip
    text=str(args.get('text',''))
    if args.get('paste', True):
        pyperclip.copy(text)
        pyautogui.hotkey('ctrl','v')
    else:
        pyautogui.write(text, interval=float(args.get('interval',0.01)))
    ok({'typedChars': len(text), 'paste': bool(args.get('paste', True))})

def press_key(args):
    import pyautogui
    keys=args.get('keys') or args.get('key') or []
    if isinstance(keys, str): keys=[keys]
    if len(keys)>1: pyautogui.hotkey(*keys)
    elif keys: pyautogui.press(keys[0])
    ok({'pressed': keys})

def scroll(args):
    import pyautogui
    pyautogui.scroll(int(args.get('clicks', -5)))
    ok({'scroll': int(args.get('clicks', -5))})
def monitor(args):
    import mss
    from PIL import Image, ImageChops
    seconds=float(args.get('seconds',5)); interval=float(args.get('interval',1))
    outdir=RESULTS / ('live_monitor_' + time.strftime('%Y%m%d_%H%M%S'))
    outdir.mkdir(exist_ok=True)
    paths=[]; diffs=[]; prev=None; start=time.time(); i=0
    with mss.mss() as sct:
        mon=sct.monitors[int(args.get('monitor',1))]
        while time.time()-start <= seconds:
            im=Image.frombytes('RGB', sct.grab(mon).size, sct.grab(mon).rgb)
            p=outdir/f'screen_{i:04d}.png'; im.save(p); paths.append(str(p))
            if prev is not None:
                diff=ImageChops.difference(prev, im).convert('L')
                diffs.append(sum(diff.histogram()[1:]))
            prev=im; i+=1; time.sleep(interval)
    ok({'dir': str(outdir), 'screenshots': paths, 'count': len(paths), 'changeScores': diffs})
def main():
    ap=argparse.ArgumentParser(); ap.add_argument('command'); ap.add_argument('--args', default='{}')
    ns=ap.parse_args(); args=json.loads(ns.args)
    cmds={'list_windows':list_windows,'active_window':active_window,'focus_window':focus_window,'screenshot':screenshot,'screen_ocr':screen_ocr,'click':click,'move':move,'type_text':type_text,'press_key':press_key,'scroll':scroll,'monitor':monitor}
    if ns.command not in cmds: return fail('unknown_command')
    try: cmds[ns.command](args); return 0
    except Exception as e: return fail(e)
if __name__=='__main__':
    raise SystemExit(main())
