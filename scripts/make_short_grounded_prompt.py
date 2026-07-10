from pathlib import Path
import json, collections, sys
idx = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
out = Path(sys.argv[2])
ext = collections.Counter(f.get('ext','') for f in idx['files'])
groups = collections.defaultdict(list)
for f in idx['files']:
    top = f['rel'].split('/')[0] if '/' in f['rel'] else '[root]'
    groups[top].append(f)
lines = [
    'ASK_FABLE5 - Summarize folder from exact read-only index',
    '-NoMap',
    '',
    'Return Russian summary. Use only listed facts. Do not invent.',
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
for k, v in ext.most_common(25):
    lines.append(f"- {k or '[none]'}: {v}")
lines += ['', 'Groups and sample files:']
for k, fs in sorted(groups.items(), key=lambda kv: len(kv[1]), reverse=True):
    lines.append(f"## {k}: {len(fs)} files")
    for f in fs[:25]:
        lines.append(f"- {f['rel']} ({f.get('ext','')}, {f['size']} bytes)")
    lines.append('')
out.write_text('\n'.join(lines), encoding='utf-8')
print(str(out), out.stat().st_size)
