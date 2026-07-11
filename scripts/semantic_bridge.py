from pathlib import Path
import argparse, json, re, math, hashlib, time
ROOT=Path.cwd(); RESULTS=ROOT/'results'; RESULTS.mkdir(exist_ok=True)
STOP=set('the and for with that this from are you your file files folder import const function return true false null undefined чтобы как это для что или на по из в и не a an to of in is it be as at by or on if else'.split())
def toks(s): return [w.lower() for w in re.findall(r'[A-Za-zА-Яа-я0-9_]{3,}', s) if w.lower() not in STOP]
def vec(s):
    d={}
    for t in toks(s): d[t]=d.get(t,0)+1
    return d
def cosine(a,b):
    if not a or not b: return 0.0
    dot=sum(v*b.get(k,0) for k,v in a.items())
    na=math.sqrt(sum(v*v for v in a.values())); nb=math.sqrt(sum(v*v for v in b.values()))
    return dot/(na*nb) if na and nb else 0.0

def read_index(path):
    p=Path(path)
    if p.name=='content_index.json':
        idx=json.loads(p.read_text(encoding='utf-8'))
        docs=[]
        for f in idx.get('files',[]):
            for ch in f.get('chunks',[]):
                cp=Path(ch['path']); text=cp.read_text(encoding='utf-8', errors='replace')
                docs.append({'rel':f['rel'],'path':str(cp),'fileIndex':f['index'],'chunk':ch.get('chunk'), 'text':text[:200000]})
        return docs
    raise ValueError('unsupported index')
def create(args):
    docs=read_index(args['indexPath'])
    outdir=RESULTS/('semantic_index_'+time.strftime('%Y%m%d_%H%M%S'))
    outdir.mkdir(exist_ok=True)
    entries=[]
    for i,d in enumerate(docs):
        v=vec(d['text'])
        top=sorted(v.items(), key=lambda x:x[1], reverse=True)[:120]
        entries.append({k:d[k] for k in ['rel','path','fileIndex','chunk']})
        entries[-1].update({'id':i,'sha256':hashlib.sha256(d['text'].encode('utf-8','replace')).hexdigest(),'terms':dict(top),'preview':d['text'][:1200]})
    p=outdir/'semantic_index.json'
    p.write_text(json.dumps({'ok':True,'createdAt':time.strftime('%Y-%m-%dT%H:%M:%S'),'source':args['indexPath'],'count':len(entries),'entries':entries}, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'ok':True,'indexPath':str(p),'count':len(entries)}, ensure_ascii=False, indent=2))
def search(args):
    idx=json.loads(Path(args['indexPath']).read_text(encoding='utf-8'))
    qv=vec(args.get('query',''))
    res=[]
    for e in idx.get('entries',[]):
        score=cosine(qv, e.get('terms',{}))
        if score>0: res.append({k:e.get(k) for k in ['id','rel','path','fileIndex','chunk','preview']} | {'score':score})
    res=sorted(res, key=lambda x:x['score'], reverse=True)[:int(args.get('limit',20))]
    print(json.dumps({'ok':True,'count':len(res),'results':res}, ensure_ascii=False, indent=2))

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('command'); ap.add_argument('--args',default='{}')
    ns=ap.parse_args(); args=json.loads(ns.args)
    if ns.command=='create': create(args)
    elif ns.command=='search': search(args)
    else: print(json.dumps({'ok':False,'error':'unknown_command'})); return 1
if __name__=='__main__': raise SystemExit(main())
