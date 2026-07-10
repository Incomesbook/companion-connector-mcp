from pathlib import Path
p = Path('src/server.js')
t = p.read_text(encoding='utf-8')
old = "function assertReadable(p) { const real = fs.realpathSync(path.resolve(String(p || ''))); if (!CFG.allowedRoots.some(r => isInside(real, r))) throw new Error('path_not_allowed'); return real; }"
new = "function assertReadable(p) { const real = fs.realpathSync(path.resolve(String(p || ''))); const cfgOk = CFG.allowedRoots.some(r => isInside(real, r)); const driveOk = discoverReadableRoots().some(r => r.readable && isInside(real, r.root)); if (!cfgOk && !driveOk) throw new Error('path_not_allowed'); return real; }"
if old not in t:
    raise SystemExit('assertReadable pattern not found')
p.write_text(t.replace(old, new), encoding='utf-8')
print('patched assertReadable for dynamic readable drive roots')
