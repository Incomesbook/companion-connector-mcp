from pathlib import Path
import json
root = Path.cwd()
server = (root / 'src' / 'server.js').read_text(encoding='utf-8')
required = [
    'fable_authority_proposal',
    'fable_authority_disagreement',
    'fable_authority_dashboard',
    'fable_autopilot_dry_run',
    'fable_autopilot_execute',
    'recordAuthorityToolAction',
]
missing = [x for x in required if x not in server]
pkg = json.loads((root / 'package.json').read_text(encoding='utf-8'))
print(json.dumps({
    'ok': not missing and pkg.get('version') == '20.0.0',
    'version': pkg.get('version'),
    'missing': missing,
    'message': 'V20 is applied in committed source; this script verifies the marker tools.'
}, ensure_ascii=False, indent=2))
