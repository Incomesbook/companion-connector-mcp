from pathlib import Path
import argparse, base64, json, os, subprocess, time, urllib.request, urllib.parse
import websocket
try:
    import mss
except Exception:
    mss = None

ROOT = Path.cwd()
RESULTS = ROOT / 'results'
RUNTIME = ROOT / 'runtime'
RESULTS.mkdir(exist_ok=True)
RUNTIME.mkdir(exist_ok=True)
CHROME_PATHS = [
    os.environ.get('CHROME_PATH',''),
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe'),
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
]
def chrome_path():
    for p in CHROME_PATHS:
        if p and Path(p).exists():
            return p
    raise SystemExit(json.dumps({'ok': False, 'error': 'chrome_or_edge_not_found'}))

def http_json(url, data=None, timeout=10):
    body = None if data is None else json.dumps(data).encode('utf-8')
    req = urllib.request.Request(url, data=body, headers={'Content-Type':'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read().decode('utf-8', errors='replace')
        return json.loads(raw) if raw else {}

def tabs(port):
    return http_json(f'http://127.0.0.1:{port}/json')

def version(port):
    return http_json(f'http://127.0.0.1:{port}/json/version')

def new_tab(port, url='about:blank'):
    u = urllib.parse.quote(url, safe=':/?&=#%')
    return http_json(f'http://127.0.0.1:{port}/json/new?{u}')
def choose_tab(port, tab_id=None, index=None):
    ts = tabs(port)
    pages = [t for t in ts if t.get('type') == 'page']
    if tab_id:
        for t in pages:
            if t.get('id') == tab_id:
                return t
    if index is not None and pages:
        return pages[int(index)]
    if pages:
        return pages[0]
    return new_tab(port)

def cdp(tab, method, params=None, timeout=30):
    ws = websocket.create_connection(tab['webSocketDebuggerUrl'], timeout=timeout)
    try:
        msg = {'id': 1, 'method': method, 'params': params or {}}
        ws.send(json.dumps(msg))
        while True:
            res = json.loads(ws.recv())
            if res.get('id') == 1:
                if 'error' in res:
                    raise RuntimeError(json.dumps(res['error']))
                return res.get('result', {})
    finally:
        ws.close()
def start(args):
    port = int(args.port or 9222)
    try:
        v = version(port)
        return {'ok': True, 'alreadyRunning': True, 'port': port, 'version': v}
    except Exception:
        pass
    profile = Path(args.profile or (RUNTIME / f'controlled_chrome_{port}'))
    profile.mkdir(parents=True, exist_ok=True)
    cmd = [chrome_path(), f'--remote-debugging-port={port}', f'--user-data-dir={profile}', '--no-first-run', '--disable-popup-blocking', '--remote-allow-origins=*']
    if args.url:
        cmd.append(args.url)
    subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        try:
            v = version(port)
            return {'ok': True, 'started': True, 'port': port, 'profile': str(profile), 'version': v}
        except Exception:
            time.sleep(0.2)
    return {'ok': False, 'error': 'chrome_debug_port_not_ready', 'port': port}

def navigate(args):
    port = int(args.port or 9222)
    tab = choose_tab(port, args.tabId, args.index)
    cdp(tab, 'Page.enable')
    cdp(tab, 'Page.navigate', {'url': args.url})
    time.sleep(float(args.wait or 1.5))
    return {'ok': True, 'tabId': tab['id'], 'url': args.url}
def screenshot_tab(args):
    port = int(args.port or 9222)
    tab = choose_tab(port, args.tabId, args.index)
    cdp(tab, 'Page.enable')
    data = cdp(tab, 'Page.captureScreenshot', {'format': 'png', 'captureBeyondViewport': bool(args.fullPage)}).get('data','')
    out = Path(args.outpath or (RESULTS / f'browser_tab_{int(time.time())}.png'))
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(base64.b64decode(data))
    return {'ok': True, 'path': str(out), 'tabId': tab['id'], 'url': tab.get('url'), 'bytes': out.stat().st_size}

def desktop_screenshot(args):
    if mss is None:
        return {'ok': False, 'error': 'mss_not_available'}
    out = Path(args.outpath or (RESULTS / f'desktop_screen_{int(time.time())}.png'))
    out.parent.mkdir(parents=True, exist_ok=True)
    with mss.mss() as sct:
        monitor = sct.monitors[int(args.monitor or 1)]
        img = sct.grab(monitor)
        mss.tools.to_png(img.rgb, img.size, output=str(out))
    return {'ok': True, 'path': str(out), 'bytes': out.stat().st_size}
def dom_snapshot(args):
    port = int(args.port or 9222)
    tab = choose_tab(port, args.tabId, args.index)
    js = r"""
    (() => {
      const txt = document.body ? document.body.innerText.slice(0, 200000) : '';
      const q = s => Array.from(document.querySelectorAll(s)).slice(0,200).map((e,i)=>({i, text:(e.innerText||e.value||e.alt||e.title||'').trim().slice(0,500), href:e.href||'', selector:e.id?'#'+CSS.escape(e.id):e.tagName.toLowerCase()}));
      return {title:document.title,url:location.href,text:txt,links:q('a'),buttons:q('button,input[type=button],input[type=submit]'),inputs:q('input,textarea,select'),headings:q('h1,h2,h3,h4')};
    })()
    """
    cdp(tab, 'Runtime.enable')
    res = cdp(tab, 'Runtime.evaluate', {'expression': js, 'returnByValue': True})
    val = res.get('result', {}).get('value', {})
    out = Path(args.outpath or (RESULTS / f'dom_snapshot_{int(time.time())}.json'))
    out.write_text(json.dumps(val, ensure_ascii=False, indent=2), encoding='utf-8')
    return {'ok': True, 'path': str(out), 'title': val.get('title'), 'url': val.get('url'), 'textChars': len(val.get('text','')), 'links': len(val.get('links',[])), 'buttons': len(val.get('buttons',[]))}
def eval_js(args):
    port = int(args.port or 9222)
    tab = choose_tab(port, args.tabId, args.index)
    cdp(tab, 'Runtime.enable')
    res = cdp(tab, 'Runtime.evaluate', {'expression': args.javascript, 'returnByValue': True})
    return {'ok': True, 'result': res.get('result', {}).get('value'), 'description': res.get('result', {}).get('description')}

def click_text(args):
    needle = (args.text or '').lower()
    js = f"""
    (() => {{
      const needle = {json.dumps(needle)};
      const els = Array.from(document.querySelectorAll('a,button,input,textarea,select,[role=button]'));
      const el = els.find(e => ((e.innerText||e.value||e.alt||e.title||'').toLowerCase().includes(needle)));
      if (!el) return {{ok:false,error:'text_not_found'}};
      el.scrollIntoView({{block:'center'}}); el.focus(); el.click();
      return {{ok:true, tag:el.tagName, text:(el.innerText||el.value||'').slice(0,300)}};
    }})()
    """
    return eval_js(argparse.Namespace(port=args.port, tabId=args.tabId, index=args.index, javascript=js))
def type_selector(args):
    text = args.text or ''
    selector = args.selector
    js = f"""
    (() => {{
      const el = document.querySelector({json.dumps(selector)});
      if (!el) return {{ok:false,error:'selector_not_found'}};
      el.scrollIntoView({{block:'center'}}); el.focus();
      el.value = {json.dumps(text)};
      el.dispatchEvent(new Event('input', {{bubbles:true}}));
      el.dispatchEvent(new Event('change', {{bubbles:true}}));
      return {{ok:true, selector:{json.dumps(selector)}, value:el.value}};
    }})()
    """
    return eval_js(argparse.Namespace(port=args.port, tabId=args.tabId, index=args.index, javascript=js))

def press_key(args):
    port = int(args.port or 9222)
    tab = choose_tab(port, args.tabId, args.index)
    key = args.key or 'Enter'
    cdp(tab, 'Input.dispatchKeyEvent', {'type': 'keyDown', 'key': key})
    cdp(tab, 'Input.dispatchKeyEvent', {'type': 'keyUp', 'key': key})
    return {'ok': True, 'key': key}
def monitor(args):
    count = int(args.count or 5); interval = float(args.interval or 1.0)
    outdir = Path(args.outdir or (RESULTS / f'live_browser_{int(time.time())}'))
    outdir.mkdir(parents=True, exist_ok=True)
    shots = []
    for i in range(count):
        try:
            if args.desktop:
                r = desktop_screenshot(argparse.Namespace(outpath=str(outdir / f'screen_{i:04d}.png'), monitor=args.monitor))
            else:
                r = screenshot_tab(argparse.Namespace(port=args.port, tabId=args.tabId, index=args.index, fullPage=False, outpath=str(outdir / f'tab_{i:04d}.png')))
            shots.append(r)
        except Exception as e:
            shots.append({'ok': False, 'error': str(e)})
        time.sleep(interval)
    manifest = {'ok': True, 'outdir': str(outdir), 'count': count, 'shots': shots}
    (outdir / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    return manifest
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('command')
    ap.add_argument('--port', type=int, default=9222)
    ap.add_argument('--url'); ap.add_argument('--profile'); ap.add_argument('--tab-id', dest='tabId')
    ap.add_argument('--index', type=int); ap.add_argument('--wait', type=float); ap.add_argument('--outpath')
    ap.add_argument('--outdir'); ap.add_argument('--full-page', dest='fullPage', action='store_true')
    ap.add_argument('--text'); ap.add_argument('--selector'); ap.add_argument('--javascript'); ap.add_argument('--key')
    ap.add_argument('--count', type=int); ap.add_argument('--interval', type=float); ap.add_argument('--desktop', action='store_true')
    ap.add_argument('--monitor', type=int, default=1)
    args = ap.parse_args()
    cmds = {'start':start, 'tabs':lambda a:{'ok':True,'tabs':tabs(a.port)}, 'new_tab':lambda a:{'ok':True,'tab':new_tab(a.port,a.url or 'about:blank')}, 'navigate':navigate, 'screenshot':screenshot_tab, 'desktop_screenshot':desktop_screenshot, 'dom':dom_snapshot, 'eval':eval_js, 'click_text':click_text, 'type_selector':type_selector, 'press_key':press_key, 'monitor':monitor}
    try:
        print(json.dumps(cmds[args.command](args), ensure_ascii=False, indent=2))
    except Exception as e:
        print(json.dumps({'ok':False,'error':str(e)}, ensure_ascii=False, indent=2))
        raise SystemExit(1)
if __name__ == '__main__':
    main()
