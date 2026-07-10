from pathlib import Path
import argparse, hashlib, json, os, subprocess, sys, time

ROOT = Path.cwd()
SERVER = Path(r'J:\Setup_VcCode_Workspace\S21_Shared_VSCode_Runtime\runtime\VSCodePortable\data\user-data\User\mcp-servers\fable5-connector\server.py')
PYTHON = Path(r'J:\Setup_VcCode_Workspace\S04_Shared_Connections\S04_03_Shared_Program_Connections\python\.venv\Scripts\python.exe')
def sha(s: str) -> str:
    return hashlib.sha256(s.encode('utf-8', errors='replace')).hexdigest()

BAD_MARKERS = [
    'ALL_MIRRORS_FAILED', 'GROQ_API_KEY is not set', 'OPENAI_API_KEY is not set',
    '流量异常', 'Request Entity Too Large', 'Bad Gateway', 'TimeoutError',
    'FUNCTION_PAYLOAD_TOO_LARGE', 'Internal error'
]


def call_fable(prompt: str, timeout: int = 180) -> dict:
    reqs = [
        {"jsonrpc":"2.0","id":1,"method":"initialize","params":{}},
        {"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"ask_fable5","arguments":{"prompt":prompt}}},
    ]
    payload = '\n'.join(json.dumps(x, ensure_ascii=False) for x in reqs) + '\n'
    env = os.environ.copy()
    env.update({'PYTHONUTF8':'1','PYTHONIOENCODING':'utf-8','LC_ALL':'C.UTF-8','LANG':'C.UTF-8'})
    r = subprocess.run([str(PYTHON), str(SERVER)], input=payload, text=True, encoding='utf-8', errors='replace', capture_output=True, timeout=timeout, env=env)
    answer = ''
    err = ''
    for line in (r.stdout or '').splitlines():
        try:
            obj = json.loads(line)
            if obj.get('id') == 2:
                err = json.dumps(obj.get('error'), ensure_ascii=False) if obj.get('error') else ''
                content = obj.get('result', {}).get('content', [])
                if content:
                    answer = content[0].get('text', '')
        except Exception:
            pass
    bad = bool(err) or (not answer.strip()) or any(m in answer for m in BAD_MARKERS)
    return {'ok': not bad, 'text': answer, 'error': err, 'returncode': r.returncode, 'stderr': (r.stderr or '')[-2000:]}

def make_tasks(index_path: Path, out_dir: Path, max_chars: int) -> dict:
    idx = json.loads(index_path.read_text(encoding='utf-8'))
    tasks = []
    for f in idx['files']:
        if f.get('chunks'):
            for ch in f['chunks']:
                text = Path(ch['path']).read_text(encoding='utf-8', errors='replace')
                start = 0
                part = 0
                while start < len(text):
                    piece = text[start:start+max_chars]
                    tasks.append({'taskId': len(tasks)+1, 'fileIndex': f['index'], 'rel': f['rel'], 'chunk': ch['chunk'], 'part': part, 'start': start, 'end': start + len(piece), 'sha256': sha(piece), 'text': piece})
                    start += max_chars
                    part += 1
        else:
            meta = json.dumps(f, ensure_ascii=False)
            tasks.append({'taskId': len(tasks)+1, 'fileIndex': f['index'], 'rel': f['rel'], 'chunk': None, 'part': 0, 'start': 0, 'end': 0, 'sha256': f.get('sha256',''), 'text': meta})
    slim = []
    for t in tasks:
        slim.append({k:v for k,v in t.items() if k != 'text'})
    manifest = {'sourceIndexPath': str(index_path), 'root': idx['root'], 'expectedFiles': len(idx['files']), 'expectedChunks': idx['totalChunks'], 'taskCount': len(tasks), 'maxChars': max_chars, 'tasks': slim}
    (out_dir / 'task_manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    return {'index': idx, 'tasks': tasks, 'manifest': manifest}

def task_prompt(t: dict, root: str, total_tasks: int) -> str:
    return '\n'.join([
        f'FABLE FULL FOLDER MICRO-READ {t["taskId"]}/{total_tasks}',
        f'ROOT: {root}',
        f'FILE_INDEX: {t["fileIndex"]}',
        f'REL_PATH: {t["rel"]}',
        f'CHUNK: {t["chunk"]}',
        f'PART: {t["part"]}',
        f'RANGE: {t["start"]}-{t["end"]}',
        f'PIECE_SHA256: {t["sha256"]}',
        '',
        'Read this piece. Return: READ_OK, the same FILE_INDEX, CHUNK, PART, PIECE_SHA256, and 1-3 Russian bullet notes about content.',
        '```text',
        t['text'],
        '```'
    ])

def run(args):
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    data = make_tasks(Path(args.index), out_dir, args.max_chars)
    tasks = data['tasks']
    root = data['index']['root']
    responses_dir = out_dir / 'micro_responses'
    responses_dir.mkdir(exist_ok=True)
    ok = 0
    fail = 0
    for t in tasks[:args.max_tasks if args.max_tasks else None]:
        out = responses_dir / f"task_{t['taskId']:06d}.json"
        if out.exists():
            old = json.loads(out.read_text(encoding='utf-8'))
            if old.get('ok'):
                ok += 1
                continue
        prompt = task_prompt(t, root, len(tasks))
        result = call_fable(prompt, args.timeout)
        rec = {k:v for k,v in t.items() if k != 'text'}
        rec.update(result)
        rec['promptSha256'] = sha(prompt)
        out.write_text(json.dumps(rec, ensure_ascii=False, indent=2), encoding='utf-8')
        if result['ok']:
            ok += 1
        else:
            fail += 1
            if args.stop_on_fail:
                break
        print(json.dumps({'task': t['taskId'], 'ok': result['ok'], 'okCount': ok, 'failCount': fail}, ensure_ascii=False), flush=True)
    total = args.max_tasks if args.max_tasks else len(tasks)
    status = {'ok': fail == 0 and ok == total, 'okCount': ok, 'failCount': fail, 'attempted': ok + fail, 'required': total, 'totalTasks': len(tasks), 'completeAll': ok == len(tasks) and fail == 0}
    (out_dir / 'micro_status.json').write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(status, ensure_ascii=False, indent=2))
    return 0 if status['ok'] else 1

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--index', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--max-chars', type=int, default=6000)
    ap.add_argument('--max-tasks', type=int, default=0)
    ap.add_argument('--timeout', type=int, default=180)
    ap.add_argument('--stop-on-fail', action='store_true')
    args = ap.parse_args()
    raise SystemExit(run(args))

if __name__ == '__main__':
    main()
