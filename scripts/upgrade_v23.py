from pathlib import Path
import json
root=Path.cwd()
server=(root/'src'/'server.js').read_text(encoding='utf-8')
ps=(root/'Fable5-Direct.ps1').read_text(encoding='utf-8')
pkg=json.loads((root/'package.json').read_text(encoding='utf-8'))
required=[
    'ValueFromRemainingArguments',
    'charset=utf-8',
    "qwen2.5:3b",
    'requestedModel',
    "version:'23.0.0'",
]
missing=[]
for item in required:
    source = ps if item in ['ValueFromRemainingArguments','charset=utf-8'] else server
    if item not in source:
        missing.append(item)
print(json.dumps({'ok': not missing, 'version': pkg.get('version'), 'missing': missing}, ensure_ascii=False, indent=2))
