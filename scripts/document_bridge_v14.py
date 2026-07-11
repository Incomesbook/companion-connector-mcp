from pathlib import Path
import argparse, csv, hashlib, html, json, os, re, shutil, sys, tarfile, urllib.request, zipfile
import xml.etree.ElementTree as ET
ROOT = Path.cwd(); RESULTS = ROOT / 'results'; RESULTS.mkdir(exist_ok=True)
TEXT_EXTS = {'.txt','.md','.log','.json','.jsonl','.csv','.tsv','.html','.htm','.xml','.yaml','.yml','.ini','.cfg','.conf','.js','.ts','.py','.ps1','.cmd','.bat','.css','.sql'}

def sha256_path(p):
    h=hashlib.sha256()
    with Path(p).open('rb') as f:
        for b in iter(lambda:f.read(1024*1024), b''): h.update(b)
    return h.hexdigest()

def safe_name(s): return re.sub(r'[^A-Za-z0-9_.-]+','_', str(s))[:160] or 'resource'
def out_dir(prefix, source):
    d=RESULTS / f"{prefix}_{safe_name(Path(str(source)).stem)}_{hashlib.sha1(str(source).encode('utf-8','replace')).hexdigest()[:8]}"; d.mkdir(parents=True, exist_ok=True); return d
def base_meta(p, extra=None):
    p=Path(p); st=p.stat(); d={'path':str(p),'name':p.name,'ext':p.suffix.lower(),'size':st.st_size,'mtime':st.st_mtime,'sha256':sha256_path(p)}
    if extra: d.update(extra)
    return d
def write_bundle(prefix, source, text, meta):
    d=out_dir(prefix, source); txt=d/'text.md'; js=d/'metadata.json'
    txt.write_text(text, encoding='utf-8', errors='replace')
    js.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
    return {'ok':True,'textPath':str(txt),'jsonPath':str(js),'chars':len(text),**meta}

def strip_tags(s):
    s=re.sub(r'<(script|style)[\s\S]*?</\1>',' ',s,flags=re.I)
    s=re.sub(r'<[^>]+>',' ',s)
    return html.unescape(re.sub(r'\s+',' ',s)).strip()

def extract_links(text):
    links=[]
    for m in re.finditer(r'''(?i)\bhttps?://[^\s"'<>)]+|href=["']([^"']+)["']''', text):
        u=m.group(1) or m.group(0)
        if not u.lower().startswith('href='): links.append({'url':u.strip(),'text':''})
    return links

def xml_texts(data):
    try: root=ET.fromstring(data)
    except Exception: return []
    return [el.text for el in root.iter() if el.tag.split('}')[-1] in {'t','instrText'} and el.text]
def inspect_text_file(p, max_chars):
    text=Path(p).read_bytes().decode('utf-8', errors='replace')
    if Path(p).suffix.lower() in {'.html','.htm'}:
        visible=strip_tags(text); links=extract_links(text)
        return write_bundle('doc_html', str(p), visible[:max_chars], base_meta(p, {'links':links[:500], 'linkCount':len(links), 'truncated':len(visible)>max_chars}))
    return write_bundle('doc_text', str(p), text[:max_chars], base_meta(p, {'truncated':len(text)>max_chars}))

def inspect_docx(p, max_chars):
    parts=[]; images=[]
    with zipfile.ZipFile(p) as z:
        for n in z.namelist():
            if n.startswith('word/media/'): images.append({'name':n,'size':z.getinfo(n).file_size})
            if n == 'word/document.xml' or n.startswith('word/header') or n.startswith('word/footer'):
                parts.extend(xml_texts(z.read(n)))
    text='\n'.join(x for x in parts if str(x).strip())
    return write_bundle('doc_docx', str(p), text[:max_chars], base_meta(p, {'images':images,'imageCount':len(images),'truncated':len(text)>max_chars}))

def inspect_pptx(p, max_chars):
    slides=[]; media=[]
    with zipfile.ZipFile(p) as z:
        for n in sorted(z.namelist()):
            if n.startswith('ppt/media/'): media.append({'name':n,'size':z.getinfo(n).file_size})
            if n.startswith('ppt/slides/slide') and n.endswith('.xml'):
                slides.append({'slide':n,'texts':[x for x in xml_texts(z.read(n)) if str(x).strip()]})
    text='\n\n'.join('# '+s['slide']+'\n'+'\n'.join(s['texts']) for s in slides)
    return write_bundle('doc_pptx', str(p), text[:max_chars], base_meta(p, {'slideCount':len(slides),'media':media,'mediaCount':len(media),'truncated':len(text)>max_chars}))
def inspect_xlsx(p, max_rows):
    try: import openpyxl
    except Exception as e: return {'ok':False,'error':'openpyxl_unavailable: '+str(e), **base_meta(p)}
    wb=openpyxl.load_workbook(p, read_only=True, data_only=True); lines=[]; sheets=[]
    for ws in wb.worksheets:
        lines.append('# Sheet: '+ws.title); rows=0
        for row in ws.iter_rows(values_only=True):
            if rows>=max_rows: break
            lines.append('\t'.join('' if v is None else str(v) for v in row)); rows += 1
        sheets.append({'name':ws.title,'maxRow':ws.max_row,'maxColumn':ws.max_column,'previewRows':rows}); lines.append('')
    return write_bundle('doc_xlsx', str(p), '\n'.join(lines), base_meta(p, {'sheets':sheets,'sheetCount':len(sheets)}))

def inspect_pdf(p, max_chars):
    texts=[]; engine=None; pages=0
    for mod in ['fitz','pypdf','PyPDF2']:
        try:
            if mod=='fitz':
                import fitz; doc=fitz.open(str(p)); engine='pymupdf'; pages=doc.page_count; texts=[page.get_text() for page in doc]
            elif mod=='pypdf':
                import pypdf; r=pypdf.PdfReader(str(p)); engine='pypdf'; pages=len(r.pages); texts=[pg.extract_text() or '' for pg in r.pages]
            else:
                import PyPDF2; r=PyPDF2.PdfReader(str(p)); engine='PyPDF2'; pages=len(r.pages); texts=[pg.extract_text() or '' for pg in r.pages]
            break
        except Exception: pass
    if not engine: return {'ok':False,'error':'pdf_engine_unavailable_or_failed',**base_meta(p)}
    text='\n\n'.join(texts)
    return write_bundle('doc_pdf', str(p), text[:max_chars], base_meta(p, {'engine':engine,'pages':pages,'truncated':len(text)>max_chars}))
def inspect_csv(p, max_rows):
    sample=Path(p).read_text(encoding='utf-8', errors='replace').splitlines(); rows=[]; header=[]
    dialect=csv.Sniffer().sniff('\n'.join(sample[:20])) if sample else csv.excel
    with Path(p).open('r', encoding='utf-8', errors='replace', newline='') as f:
        for i,row in enumerate(csv.reader(f,dialect)):
            if i==0: header=row
            if i<max_rows: rows.append(row)
            else: break
    text='\n'.join('\t'.join(map(str,r)) for r in rows)
    return write_bundle('doc_csv', str(p), text, base_meta(p, {'header':header,'previewRows':len(rows)}))

def inspect_document(path, max_chars=1000000, max_rows=500):
    p=Path(path).resolve(); ext=p.suffix.lower()
    if ext in TEXT_EXTS - {'.csv','.tsv'}: return inspect_text_file(p,max_chars)
    if ext in {'.csv','.tsv'}: return inspect_csv(p,max_rows)
    if ext=='.docx': return inspect_docx(p,max_chars)
    if ext=='.pptx': return inspect_pptx(p,max_chars)
    if ext in {'.xlsx','.xlsm'}: return inspect_xlsx(p,max_rows)
    if ext=='.pdf': return inspect_pdf(p,max_chars)
    return {'ok':False,'error':'unsupported_document_type',**base_meta(p)}
def archive_manifest(path, max_entries=100000):
    p=Path(path).resolve(); entries=[]; kind=None
    if zipfile.is_zipfile(p):
        kind='zip'
        with zipfile.ZipFile(p) as z:
            for i,info in enumerate(z.infolist()):
                if i>=max_entries: break
                entries.append({'name':info.filename,'size':info.file_size,'compressed':info.compress_size,'isDir':info.is_dir(),'crc':info.CRC})
    elif tarfile.is_tarfile(p):
        kind='tar'
        with tarfile.open(p) as t:
            for i,info in enumerate(t.getmembers()):
                if i>=max_entries: break
                entries.append({'name':info.name,'size':info.size,'isDir':info.isdir(),'type':str(info.type)})
    else: return {'ok':False,'error':'unsupported_archive_type',**base_meta(p)}
    d=out_dir('archive_manifest',str(p)); js=d/'manifest.json'
    res={'ok':True,'kind':kind,'entryCount':len(entries),'entries':entries,**base_meta(p)}
    js.write_text(json.dumps(res,ensure_ascii=False,indent=2),encoding='utf-8')
    return {**res,'jsonPath':str(js)}

def safe_target(base, name):
    target=(base/name).resolve()
    if not str(target).startswith(str(base.resolve())): raise RuntimeError('path_traversal_blocked')
    return target
def safe_extract_archive(path, max_files=20000, max_bytes=2000000000):
    p=Path(path).resolve(); d=out_dir('archive_extract',str(p)); files=[]; total=0
    if zipfile.is_zipfile(p):
        with zipfile.ZipFile(p) as z:
            for i,info in enumerate(z.infolist()):
                if i>=max_files or info.is_dir(): continue
                total += info.file_size
                if total > max_bytes: break
                target=safe_target(d, info.filename); target.parent.mkdir(parents=True,exist_ok=True)
                with z.open(info) as src, target.open('wb') as dst: shutil.copyfileobj(src,dst)
                files.append({'name':info.filename,'path':str(target),'size':info.file_size})
    elif tarfile.is_tarfile(p):
        with tarfile.open(p) as t:
            for i,info in enumerate(t.getmembers()):
                if i>=max_files or not info.isfile(): continue
                total += info.size
                if total > max_bytes: break
                target=safe_target(d, info.name); target.parent.mkdir(parents=True,exist_ok=True); src=t.extractfile(info)
                if src:
                    with target.open('wb') as dst: shutil.copyfileobj(src,dst)
                files.append({'name':info.name,'path':str(target),'size':info.size})
    else: return {'ok':False,'error':'unsupported_archive_type',**base_meta(p)}
    js=d/'extract_manifest.json'; res={'ok':True,'extractDir':str(d),'fileCount':len(files),'bytes':total,'files':files,**base_meta(p)}
    js.write_text(json.dumps(res,ensure_ascii=False,indent=2),encoding='utf-8')
    return {**res,'jsonPath':str(js)}
def web_snapshot(url, max_chars=500000):
    req=urllib.request.Request(url, headers={'User-Agent':'CompanionConnector/14.0'})
    with urllib.request.urlopen(req, timeout=30) as r:
        body=r.read(min(max_chars*4, 20_000_000)); ctype=r.headers.get('content-type',''); final=r.geturl()
    text=body.decode('utf-8', errors='replace')
    m=re.search(r'<title[^>]*>([\s\S]*?)</title>', text, re.I); title=html.unescape(strip_tags(m.group(1))) if m else ''
    links=extract_links(text); visible=strip_tags(text); d=out_dir('web_snapshot',url)
    html_path=d/'page.html'; txt_path=d/'text.md'; js_path=d/'metadata.json'
    html_path.write_bytes(body); txt_path.write_text(visible[:max_chars],encoding='utf-8')
    meta={'ok':True,'url':url,'finalUrl':final,'contentType':ctype,'title':title,'htmlPath':str(html_path),'textPath':str(txt_path),'links':links[:1000],'linkCount':len(links),'chars':len(visible),'truncated':len(visible)>max_chars}
    js_path.write_text(json.dumps(meta,ensure_ascii=False,indent=2),encoding='utf-8')
    return {**meta,'jsonPath':str(js_path)}

def report_toolchain():
    mods={}
    for m in ['fitz','pypdf','PyPDF2','openpyxl','PIL','bs4','pandas','docx']:
        try: __import__(m); mods[m]=True
        except Exception: mods[m]=False
    cmds={c:shutil.which(c) for c in ['python','ffmpeg','ffprobe','yt-dlp','tesseract']}
    return {'ok':True,'python':sys.executable,'modules':mods,'commands':cmds}
def main():
    ap=argparse.ArgumentParser(); sub=ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('toolchain')
    a=sub.add_parser('inspect-document'); a.add_argument('--path',required=True); a.add_argument('--max-chars',type=int,default=1000000); a.add_argument('--max-rows',type=int,default=500)
    a=sub.add_parser('archive-manifest'); a.add_argument('--path',required=True); a.add_argument('--max-entries',type=int,default=100000)
    a=sub.add_parser('extract-archive'); a.add_argument('--path',required=True); a.add_argument('--max-files',type=int,default=20000); a.add_argument('--max-bytes',type=int,default=2000000000)
    a=sub.add_parser('web-snapshot'); a.add_argument('--url',required=True); a.add_argument('--max-chars',type=int,default=500000)
    args=ap.parse_args()
    try:
        if args.cmd=='toolchain': out=report_toolchain()
        elif args.cmd=='inspect-document': out=inspect_document(args.path,args.max_chars,args.max_rows)
        elif args.cmd=='archive-manifest': out=archive_manifest(args.path,args.max_entries)
        elif args.cmd=='extract-archive': out=safe_extract_archive(args.path,args.max_files,args.max_bytes)
        elif args.cmd=='web-snapshot': out=web_snapshot(args.url,args.max_chars)
        else: out={'ok':False,'error':'unknown_cmd'}
    except Exception as e:
        out={'ok':False,'error':type(e).__name__+': '+str(e)}
    print(json.dumps(out,ensure_ascii=False,indent=2))
if __name__=='__main__': main()
