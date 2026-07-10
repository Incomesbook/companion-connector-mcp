from pathlib import Path
import json, sys
idx = json.load(open(sys.argv[1], encoding='utf-8'))
sizes=[]
total=0
n=0
for f in idx['files']:
    for c in f.get('chunks', []):
        s = Path(c['path']).stat().st_size
        total += s
        sizes.append(s)
        n += 1
print('chunks', n, 'chunk_bytes', total, 'max', max(sizes), 'files', len(idx['files']), 'text', idx['textFileCount'], 'binary', idx['binaryFileCount'])
