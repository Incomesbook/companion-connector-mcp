from pathlib import Path
import json, subprocess, sys, time, hashlib

INDEX_PATH = Path(sys.argv[1])
OUT_ROOT = Path(sys.argv[2])
MAX_BATCH_BYTES = int(sys.argv[3]) if len(sys.argv) > 3 else 2500000
FABLE_PS1 = Path(r'J:\Setup_VcCode_Workspace\S04_Shared_Connections\S04_03_Shared_Program_Connections\TOOLS\AskFable\Invoke-FableConsult.ps1')
OUT_ROOT.mkdir(parents=True, exist_ok=True)
idx = json.loads(INDEX_PATH.read_text(encoding='utf-8'))
BATCH_DIR = OUT_ROOT / 'batch_prompts'
RESP_DIR = OUT_ROOT / 'batch_responses'
BATCH_DIR.mkdir(exist_ok=True)
RESP_DIR.mkdir(exist_ok=True)
def sha_text(s: str) -> str:
    return hashlib.sha256(s.encode('utf-8', errors='replace')).hexdigest()

def run_fable(prompt_path: Path, out_path: Path):
    cmd = ['pwsh','-NoLogo','-NoProfile','-ExecutionPolicy','Bypass','-File',str(FABLE_PS1),'-NoMap','-PromptFile',str(prompt_path.resolve()),'-MaxOutputChars','120000','-PrintFull']
    r = subprocess.run(cmd, cwd=str(OUT_ROOT.resolve()), text=True, encoding='utf-8', errors='replace', capture_output=True, timeout=900)
    out_path.write_text((r.stdout or '') + ('\nSTDERR:\n' + r.stderr if r.stderr else ''), encoding='utf-8')
    return {'prompt': str(prompt_path), 'response': str(out_path), 'exit': r.returncode, 'stdout_bytes': len((r.stdout or '').encode('utf-8')), 'stderr_bytes': len((r.stderr or '').encode('utf-8'))}

def file_header(f):
    return f"\n\n===== FILE [{f['index']}] {f['rel']} =====\nsize={f['size']} sha256={f['sha256']} chunks={len(f.get('chunks', []))} status={f.get('readStatus')}\n"

items = []
for f in idx['files']:
    if f.get('chunks'):
        for c in f['chunks']:
            text = Path(c['path']).read_text(encoding='utf-8', errors='replace')
            items.append({'kind':'text_chunk','file':f,'chunk':c,'text':text})
    else:
        items.append({'kind':'binary_or_metadata','file':f,'text':''})
batches = []
cur = []
cur_bytes = 0
seen_files = set()
for it in items:
    f = it['file']
    if it['kind'] == 'text_chunk':
        block = file_header(f) + f"CHUNK {it['chunk']['chunk']} path={it['chunk']['path']} chars={len(it['text'])}\n```text\n{it['text']}\n```\n"
    else:
        block = file_header(f) + 'BINARY_OR_NON_TEXT_FILE: content not converted to text; metadata and sha256 included above.\n'
    b = len(block.encode('utf-8', errors='replace'))
    if cur and cur_bytes + b > MAX_BATCH_BYTES:
        batches.append(cur)
        cur = []
        cur_bytes = 0
    cur.append((it, block))
    cur_bytes += b
    seen_files.add(f['index'])
if cur:
    batches.append(cur)

manifest = {'sourceIndexPath': str(INDEX_PATH), 'root': idx['root'], 'fileCount': len(idx['files']), 'textFileCount': idx['textFileCount'], 'binaryFileCount': idx['binaryFileCount'], 'totalChunks': idx['totalChunks'], 'bytesRead': idx['bytesRead'], 'batchCount': len(batches), 'maxBatchBytes': MAX_BATCH_BYTES, 'startedAt': time.strftime('%Y-%m-%dT%H:%M:%S'), 'batches': []}
for i, batch in enumerate(batches, 1):
    files = sorted(set(x[0]['file']['index'] for x in batch))
    body = []
    body.append(f'ASK_FABLE5 - Full folder review batch {i} of {len(batches)}')
    body.append('-NoMap')
    body.append('')
    body.append('You are Fable5. Read this batch as part of a complete read-only folder review.')
    body.append('Use only this batch content. Do not invent file names or claims. Source folder must not be modified.')
    body.append('Return Russian notes: purpose, important files, trading/TradingView/Pine findings, scripts, data, risks, what this batch contains.')
    body.append(f"Folder root: {idx['root']}")
    body.append(f"Whole folder coverage: files={len(idx['files'])}, textFiles={idx['textFileCount']}, binaryFiles={idx['binaryFileCount']}, chunks={idx['totalChunks']}, bytesRead={idx['bytesRead']}")
    body.append(f'Batch file indexes: {files[:200]}')
    body.append('')
    for _, block in batch:
        body.append(block)
    prompt_text = '\n'.join(body)
    prompt_path = BATCH_DIR / f'batch_{i:04d}_of_{len(batches):04d}.md'
    resp_path = RESP_DIR / f'batch_{i:04d}_response.txt'
    prompt_path.write_text(prompt_text, encoding='utf-8')
    info = {'batch': i, 'prompt': str(prompt_path), 'response': str(resp_path), 'files': files, 'promptBytes': len(prompt_text.encode('utf-8')), 'promptSha256': sha_text(prompt_text)}
    print(json.dumps({'running_batch': i, 'of': len(batches), 'promptBytes': info['promptBytes']}, ensure_ascii=False), flush=True)
    run_info = run_fable(prompt_path, resp_path)
    info.update(run_info)
    manifest['batches'].append(info)
    (OUT_ROOT / 'progress_manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
responses = []
for b in manifest['batches']:
    p = Path(b['response'])
    text = p.read_text(encoding='utf-8', errors='replace') if p.exists() else ''
    responses.append(f"\n\n===== BATCH {b['batch']} RESPONSE =====\nfiles={b['files']}\n{text}")
merge_prompt = OUT_ROOT / 'FINAL_FABLE_MERGE_PROMPT.md'
merge_body = [
    'ASK_FABLE5 - Final full folder conclusion from all batch reviews',
    '-NoMap','',
    'You are Fable5. Create the final Russian conclusion text file for the folder review.',
    'Use only batch responses below. Do not invent facts. Mention coverage counts and limits.',
    f"Folder root: {idx['root']}",
    f"Coverage: files={len(idx['files'])}, textFiles={idx['textFileCount']}, binaryFiles={idx['binaryFileCount']}, chunks={idx['totalChunks']}, bytesRead={idx['bytesRead']}, batches={len(batches)}",
    '',
    'Required sections: 1) What this folder is, 2) Main groups of files, 3) TradingView/Pine/indicator materials, 4) scripts and extraction pipeline, 5) audio/image/doc extracted data, 6) risks/gaps, 7) what to inspect next.',
    ''.join(responses)
]
merge_prompt.write_text('\n'.join(merge_body), encoding='utf-8')
final_resp = OUT_ROOT / 'FABLE_FINAL_CONCLUSION_RAW.txt'
final_info = run_fable(merge_prompt, final_resp)
final_txt = final_resp.read_text(encoding='utf-8', errors='replace')
final_out = OUT_ROOT / 'FABLE_FULL_FOLDER_CONCLUSION.txt'
final_out.write_text(final_txt, encoding='utf-8')
manifest['final'] = {'mergePrompt': str(merge_prompt), 'rawResponse': str(final_resp), 'finalConclusion': str(final_out), 'finalInfo': final_info}
manifest['finishedAt'] = time.strftime('%Y-%m-%dT%H:%M:%S')
manifest['coverage'] = {'filesSeen': len(seen_files), 'expectedFiles': len(idx['files']), 'allFilesSeen': len(seen_files) == len(idx['files'])}
(OUT_ROOT / 'progress_manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'ok': True, 'finalConclusion': str(final_out), 'batches': len(batches), 'coverage': manifest['coverage']}, ensure_ascii=False, indent=2))
