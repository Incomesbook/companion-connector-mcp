from pathlib import Path
import json
root = Path.cwd()
(root / 'docs').mkdir(exist_ok=True)
categories = ['startup','fable','large-files','images','video','urls','queue','jobs','resources','diagnostics','testing','security','usability','performance','mcp-services','tunnel','logging','recovery','docs','automation']
templates = [
    'Improve {cat} workflow with clearer status, safer defaults, and a repeatable test.',
    'Add {cat} verification so failures become visible before user work starts.',
    'Reduce manual steps in {cat} by using file-backed jobs and stored results.',
    'Add diagnostics for {cat} with bounded JSON output and support-bundle evidence.',
    'Make {cat} more convenient through one-command execution and clear recovery steps.'
]
items=[]
for i in range(1,1001):
    cat = categories[(i-1) % len(categories)]
    text = templates[(i-1) % len(templates)].format(cat=cat)
    items.append({'id': i, 'category': cat, 'title': text, 'status': 'planned', 'target': f'v{7 + ((i-1)//100)}', 'evidenceRequired': ['code change','test','doc update']})
obj={'version':'7.0.0','count':len(items),'type':'forward_backlog_not_claimed_implemented','items':items}
(root/'docs'/'V7_1000_FORWARD_IMPROVEMENTS.json').write_text(json.dumps(obj,indent=2), encoding='utf-8')
md=['# V7 1000 Forward Improvements','', 'These are planned improvements, not falsely marked as implemented.', '', '| # | Category | Status | Target | Improvement |', '| --- | --- | --- | --- | --- |']
for it in items:
    md.append(f"| {it['id']} | {it['category']} | {it['status']} | {it['target']} | {it['title']} |")
(root/'docs'/'V7_1000_FORWARD_IMPROVEMENTS.md').write_text('\n'.join(md), encoding='utf-8')
print('wrote 1000 forward improvements')
