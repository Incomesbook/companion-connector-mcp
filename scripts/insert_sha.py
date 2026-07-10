from pathlib import Path
p = Path('scripts/run_fable_micro_full_folder_review.py')
t = p.read_text(encoding='utf-8')
needle = 'BAD_MARKERS = [\n'
insert = "def sha(s: str) -> str:\n    return hashlib.sha256(s.encode('utf-8', errors='replace')).hexdigest()\n\n"
if insert not in t:
    t = t.replace(needle, insert + needle)
p.write_text(t, encoding='utf-8')
print('inserted sha')
