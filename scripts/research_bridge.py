from pathlib import Path
import argparse, hashlib, json, os, re, zipfile, tarfile, time
ROOT = Path.cwd(); RESULTS = ROOT / 'results'; RESULTS.mkdir(exist_ok=True)
TEXT_EXTS={'.txt','.md','.json','.jsonl','.csv','.tsv','.html','.htm','.xml','.yaml','.yml','.ini','.cfg','.conf','.js','.ts','.py','.ps1','.cmd','.bat','.css','.sql','.pine'}
DOC_EXTS={'.pdf','.docx','.pptx','.xlsx','.xlsm','.csv','.html','.htm','.txt','.md'}
MEDIA_EXTS={'.mp4','.mkv','.mov','.avi','.webm','.mp3','.wav','.m4a','.png','.jpg','.jpeg','.gif','.webp'}
ARCHIVE_EXTS={'.zip','.tar','.tgz','.gz'}
URL_RE=re.compile(r'(?i)\bhttps?://[^\s"\'<>)]+' )
PATH_RE=re.compile(r'(?i)([A-Z]:\\[^\r\n"<>|]+|(?:\.\.?[/\\])[^\r\n"<>|]+)')
def safe_name(s): return re.sub(r'[^A-Za-z0-9_.-]+','_', str(s))[:160] or 'resource'
def sha256_file(p):
    h=hashlib.sha256()
    with Path(p).open('rb') as f:
        for b in iter(lambda:f.read(1024*1024), b''): h.update(b)
    return h.hexdigest()
def out_dir(prefix, source):
    d=RESULTS / f"{prefix}_{safe_name(Path(str(source)).stem)}_{hashlib.sha1(str(source).encode('utf-8','replace')).hexdigest()[:8]}"; d.mkdir(parents=True, exist_ok=True); return d
def classify(ext):
    if ext in DOC_EXTS: return 'document'
    if ext in MEDIA_EXTS: return 'media'
    if ext in ARCHIVE_EXTS: return 'archive'
    if ext in TEXT_EXTS: return 'text'
    return 'binary'
def read_small_text(p, limit=2_000_000):
    b=Path(p).read_bytes()[:limit]
    if b.count(0) > 0: return ''
    return b.decode('utf-8', errors='replace')
def walk(root, max_files=200000):
    root=Path(root).resolve(); files=[]; dirs=[]; skipped=[]
    for cur, dnames, fnames in os.walk(root):
        dirs.append(str(Path(cur)))
        for name in fnames:
            p=Path(cur)/name
            try:
                st=p.stat(); ext=p.suffix.lower(); files.append({'index':len(files),'path':str(p.resolve()),'rel':str(p.resolve().relative_to(root)).replace('\\','/'),'name':name,'ext':ext,'type':classify(ext),'size':st.st_size,'mtime':st.st_mtime})
                if len(files)>=max_files: return root,files,dirs,skipped
            except Exception as e: skipped.append({'path':str(p),'error':str(e)})
    return root,files,dirs,skipped
def create_map(folder, max_files=200000, hash_files=False, scan_text=True):
    root,files,dirs,skipped=walk(folder,max_files)
    ext_counts={}; type_counts={}; links=[]; local_refs=[]; imports=[]
    for f in files:
        ext_counts[f['ext']]=ext_counts.get(f['ext'],0)+1; type_counts[f['type']]=type_counts.get(f['type'],0)+1
        if hash_files:
            try: f['sha256']=sha256_file(f['path'])
            except Exception as e: f['hashError']=str(e)
        if scan_text and f['ext'] in TEXT_EXTS and f['size'] <= 5_000_000:
            text=read_small_text(f['path'])
            for u in URL_RE.findall(text)[:200]: links.append({'from':f['rel'],'url':u})
            for r in PATH_RE.findall(text)[:200]: local_refs.append({'from':f['rel'],'ref':r.strip()})
            for m in re.finditer(r'''(?m)^\s*(?:import|from|require|include|source)\b.*$''', text):
                imports.append({'from':f['rel'],'line':m.group(0)[:500]})
    d=out_dir('research_map', str(root)); js=d/'research_map.json'; md=d/'research_map.md'
    obj={'ok':True,'root':str(root),'createdAt':time.strftime('%Y-%m-%dT%H:%M:%S'),'fileCount':len(files),'dirCount':len(dirs),'totalBytes':sum(x['size'] for x in files),'extCounts':ext_counts,'typeCounts':type_counts,'links':links,'localRefs':local_refs,'imports':imports,'files':files,'skipped':skipped}
    js.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
    lines=['# Research map','',f'Root: {root}',f'Files: {len(files)}',f'Dirs: {len(dirs)}',f'Bytes: {obj["totalBytes"]}','','## Types']
    for k,v in sorted(type_counts.items()): lines.append(f'- {k}: {v}')
    lines += ['','## Extensions']
    for k,v in sorted(ext_counts.items(), key=lambda kv:(-kv[1],kv[0])): lines.append(f'- {k or "[none]"}: {v}')
    lines += ['','## Links'] + [f'- {x["from"]} -> {x["url"]}' for x in links[:500]]
    md.write_text('\n'.join(lines),encoding='utf-8')
    return {**obj,'jsonPath':str(js),'mdPath':str(md)}
def linked_resources(file_path, inspect=False):
    p=Path(file_path).resolve(); text=read_small_text(p, 10_000_000)
    urls=[{'url':u} for u in URL_RE.findall(text)]
    refs=[]
    for r in PATH_RE.findall(text):
        raw=r.strip(); q=Path(raw)
        if not q.is_absolute(): q=(p.parent/raw).resolve()
        refs.append({'raw':raw,'path':str(q),'exists':q.exists(),'type':'dir' if q.exists() and q.is_dir() else ('file' if q.exists() else 'missing')})
    d=out_dir('linked_resources', str(p)); js=d/'linked_resources.json'
    obj={'ok':True,'source':str(p),'urlCount':len(urls),'localRefCount':len(refs),'urls':urls,'localRefs':refs}
    js.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
    return {**obj,'jsonPath':str(js)}

def intake_bundle(folder):
    m=create_map(folder, hash_files=False, scan_text=True)
    d=out_dir('project_intake', folder); js=d/'intake.json'; md=d/'intake.md'
    obj={'ok':True,'root':m['root'],'fileCount':m['fileCount'],'dirCount':m['dirCount'],'totalBytes':m['totalBytes'],'typeCounts':m['typeCounts'],'extCounts':m['extCounts'],'linkCount':len(m['links']),'localRefCount':len(m['localRefs']),'researchMapJson':m['jsonPath'],'researchMapMd':m['mdPath']}
    js.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8')
    lines=['# Project intake bundle','',f'Root: {obj["root"]}',f'Files: {obj["fileCount"]}',f'Dirs: {obj["dirCount"]}',f'Bytes: {obj["totalBytes"]}',f'Research map: {m["jsonPath"]}','','## Type counts']
    for k,v in sorted(obj['typeCounts'].items()): lines.append(f'- {k}: {v}')
    md.write_text('\n'.join(lines),encoding='utf-8')
    return {**obj,'jsonPath':str(js),'mdPath':str(md)}
def main():
    ap=argparse.ArgumentParser(); sub=ap.add_subparsers(dest='cmd', required=True)
    a=sub.add_parser('research-map'); a.add_argument('--folder',required=True); a.add_argument('--max-files',type=int,default=200000); a.add_argument('--hash-files',action='store_true'); a.add_argument('--no-scan-text',action='store_true')
    a=sub.add_parser('linked-resources'); a.add_argument('--path',required=True)
    a=sub.add_parser('intake-bundle'); a.add_argument('--folder',required=True)
    args=ap.parse_args()
    try:
        if args.cmd=='research-map': out=create_map(args.folder,args.max_files,args.hash_files,not args.no_scan_text)
        elif args.cmd=='linked-resources': out=linked_resources(args.path)
        elif args.cmd=='intake-bundle': out=intake_bundle(args.folder)
        else: out={'ok':False,'error':'unknown_cmd'}
    except Exception as e: out={'ok':False,'error':type(e).__name__+': '+str(e)}
    print(json.dumps(out,ensure_ascii=False,indent=2))
if __name__=='__main__': main()
