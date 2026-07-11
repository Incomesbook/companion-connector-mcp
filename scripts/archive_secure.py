from pathlib import Path
import argparse, json, zipfile, tarfile, shutil
try:
    import py7zr
except Exception:
    py7zr = None
ROOT = Path.cwd(); RESULTS = ROOT / 'results'; RESULTS.mkdir(exist_ok=True)

def safe_join(base: Path, name: str) -> Path:
    p = (base / name).resolve()
    if not str(p).startswith(str(base.resolve())):
        raise ValueError('archive_path_escape_blocked')
    return p

def is_encrypted_zip(info):
    return bool(info.flag_bits & 0x1)
def inspect_archive(path: Path, password=None):
    ext = path.suffix.lower()
    entries = []
    encrypted = False
    if ext == '.zip':
        with zipfile.ZipFile(path) as z:
            for i in z.infolist():
                encrypted = encrypted or is_encrypted_zip(i)
                entries.append({'name': i.filename, 'size': i.file_size, 'compressed': i.compress_size, 'encrypted': is_encrypted_zip(i), 'dir': i.is_dir()})
        return {'ok': True, 'type': 'zip', 'encrypted': encrypted, 'entries': entries}
    if ext == '.7z' and py7zr:
        with py7zr.SevenZipFile(path, mode='r', password=password) as z:
            for i in z.list():
                entries.append({'name': i.filename, 'size': i.uncompressed, 'compressed': i.compressed, 'dir': i.is_directory})
        return {'ok': True, 'type': '7z', 'encrypted': password is not None, 'entries': entries}
    if ext in ['.tar','.gz','.tgz','.bz2','.xz']:
        with tarfile.open(path) as t:
            for i in t.getmembers():
                entries.append({'name': i.name, 'size': i.size, 'dir': i.isdir()})
        return {'ok': True, 'type': 'tar', 'encrypted': False, 'entries': entries}
    return {'ok': False, 'error': 'unsupported_archive_type'}
def extract_archive(path: Path, outdir: Path, password=None, max_files=10000):
    outdir.mkdir(parents=True, exist_ok=True)
    ext = path.suffix.lower(); files = []
    if ext == '.zip':
        pwd = password.encode('utf-8') if password else None
        with zipfile.ZipFile(path) as z:
            infos = z.infolist()
            if len(infos) > max_files: raise ValueError('too_many_archive_entries')
            for info in infos:
                dest = safe_join(outdir, info.filename)
                if info.is_dir(): dest.mkdir(parents=True, exist_ok=True); continue
                dest.parent.mkdir(parents=True, exist_ok=True)
                with z.open(info, pwd=pwd) as src, open(dest, 'wb') as dst:
                    shutil.copyfileobj(src, dst)
                files.append(str(dest))
        return {'ok': True, 'outdir': str(outdir), 'files': files, 'count': len(files)}
    if ext == '.7z' and py7zr:
        with py7zr.SevenZipFile(path, mode='r', password=password) as z:
            z.extractall(path=outdir)
        return {'ok': True, 'outdir': str(outdir), 'files': [str(p) for p in outdir.rglob('*') if p.is_file()], 'count': len([p for p in outdir.rglob('*') if p.is_file()])}
    return {'ok': False, 'error': 'unsupported_or_no_password_support'}
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('command'); ap.add_argument('--path', required=True); ap.add_argument('--password')
    ap.add_argument('--outdir'); ap.add_argument('--max-files', type=int, default=10000)
    args = ap.parse_args()
    path = Path(args.path)
    try:
        if args.command == 'inspect':
            print(json.dumps(inspect_archive(path, args.password), ensure_ascii=False, indent=2))
        elif args.command == 'extract':
            outdir = Path(args.outdir or (RESULTS / ('archive_extract_' + path.stem)))
            print(json.dumps(extract_archive(path, outdir, args.password, args.max_files), ensure_ascii=False, indent=2))
        else:
            print(json.dumps({'ok': False, 'error': 'unknown_command'}))
    except Exception as e:
        print(json.dumps({'ok': False, 'error': str(e)}, ensure_ascii=False, indent=2))
        raise SystemExit(1)
if __name__ == '__main__':
    main()
