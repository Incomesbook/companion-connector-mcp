from pathlib import Path
import json, collections, sys
idx_path = Path(sys.argv[1])
out_path = Path(sys.argv[2])
idx = json.loads(idx_path.read_text(encoding='utf-8'))
ext = collections.Counter(f.get('ext','') for f in idx['files'])
roots = collections.Counter((f['rel'].split('/')[0] if '/' in f['rel'] else '[root]') for f in idx['files'])
lines = [
    'ASK_FABLE5 - Grounded research_out summary',
    '-NoMap',
    '',
    'STRICT RULES: Use only facts listed in this prompt. Do not invent file names, folders, tools, indicators, or conclusions. If a detail is not visible, say it is not visible in this compact index. Return Russian summary.',
    '',
    f"Root: {idx['root']}",
    f"Files: {len(idx['files'])}",
    f"Text files: {idx['textFileCount']}",
    f"Binary files: {idx['binaryFileCount']}",
    f"Chunks: {idx['totalChunks']}",
    f"Bytes read: {idx['bytesRead']}",
    '',
    'Extensions:'
]
for k, v in ext.most_common():
    lines.append(f"- {k or '[none]'}: {v}")
lines += ['', 'Top-level groups:']
for k, v in roots.most_common():
    lines.append(f"- {k}: {v}")
lines += ['', 'All file paths from the read-only index:']
for f in idx['files']:
    lines.append(f"- [{f['index']}] {f['rel']} | ext={f.get('ext','')} | size={f['size']} | chunks={len(f.get('chunks', []))} | status={f.get('readStatus')}")
out_path.write_text('\n'.join(lines), encoding='utf-8')
print(str(out_path))
