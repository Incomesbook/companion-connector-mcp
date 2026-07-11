from pathlib import Path
import argparse, json, os, shutil, subprocess, urllib.request
OLLAMA = os.environ.get('OLLAMA_EXE') or r'C:\Users\IgorK\AppData\Local\Programs\Ollama\ollama.exe'

def list_models():
    try:
        out = subprocess.check_output([OLLAMA, 'list'], text=True, encoding='utf-8', errors='replace', timeout=60)
        return {'ok': True, 'modelsText': out}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

def pull(model):
    r = subprocess.run([OLLAMA, 'pull', model], text=True, encoding='utf-8', errors='replace', capture_output=True, timeout=7200)
    return {'ok': r.returncode == 0, 'model': model, 'stdoutTail': (r.stdout or '')[-4000:], 'stderrTail': (r.stderr or '')[-4000:]}
def chat(model, prompt='Return OK.'):
    body = json.dumps({'model': model, 'messages': [{'role':'user','content': prompt}], 'stream': False}).encode()
    req = urllib.request.Request('http://127.0.0.1:11435/api/chat', data=body, headers={'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=600) as r:
            return {'ok': True, 'response': json.loads(r.read().decode('utf-8', errors='replace'))}
    except Exception as e:
        return {'ok': False, 'error': str(e)}

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('command'); ap.add_argument('--model', default='qwen2.5:3b'); ap.add_argument('--prompt', default='Return OK.')
    a=ap.parse_args()
    if a.command == 'list': res=list_models()
    elif a.command == 'pull': res=pull(a.model)
    elif a.command == 'chat': res=chat(a.model, a.prompt)
    else: res={'ok':False,'error':'unknown_command'}
    print(json.dumps(res, ensure_ascii=False, indent=2))
if __name__ == '__main__': main()
