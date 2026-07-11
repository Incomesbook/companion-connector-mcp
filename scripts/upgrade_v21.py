from pathlib import Path
import json
root = Path.cwd()
server = (root / 'src' / 'server.js').read_text(encoding='utf-8')
pkg = json.loads((root / 'package.json').read_text(encoding='utf-8'))
markers = [
    'fable_direct_submit',
    'fable_direct_inbox',
    'fable_direct_read',
    'fable_direct_dashboard',
    'function fableDirectSubmit',
    'function fableDirectDashboard'
]
missing = [m for m in markers if m not in server]
print(json.dumps({'ok': not missing, 'version': pkg.get('version'), 'missing': missing, 'message': 'V21 is applied in committed source; this script verifies the marker tools.'}, indent=2))
raise SystemExit(1 if missing else 0)
