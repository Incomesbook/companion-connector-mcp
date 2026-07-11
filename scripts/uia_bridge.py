import argparse, json, time, sys
from pywinauto import Desktop

def emit(x): print(json.dumps(x, ensure_ascii=False, indent=2))

def _safe_text(c):
    try: return (c.window_text() or c.element_info.name or '').strip()
    except Exception: return ''

def _find_windows(query):
    d=Desktop(backend='uia')
    q=(query or '').lower()
    out=[]
    for w in d.windows():
        try:
            t=w.window_text() or ''
            if not q or q in t.lower(): out.append(w)
        except Exception: pass
    return out

def dump(args):
    wins=_find_windows(args.query)
    res=[]
    for w in wins[:args.max_windows]:
        rec={'title':_safe_text(w),'items':[]}
        stack=[w]; seen=0
        while stack and seen<args.max_nodes:
            c=stack.pop(0); seen+=1
            try:
                txt=_safe_text(c)
                typ=c.element_info.control_type
                if txt:
                    rec['items'].append({'type':typ,'text':txt[:args.max_text],'autoId':c.element_info.automation_id,'class':c.element_info.class_name})
                stack.extend(c.children())
            except Exception: pass
        rec['itemCount']=len(rec['items'])
        res.append(rec)
    emit({'ok':True,'query':args.query,'windows':res,'count':len(res)})

def click_text(args):
    for w in _find_windows(args.window):
        try:
            for c in w.descendants():
                txt=_safe_text(c)
                if args.text.lower() in txt.lower():
                    c.click_input(); time.sleep(args.wait)
                    emit({'ok':True,'clicked':txt,'window':_safe_text(w)})
                    return
        except Exception: pass
    emit({'ok':False,'error':'text_not_found','text':args.text,'window':args.window})

def read_chat(args):
    # Click title if requested, then dump UIA text around current ChatGPT/Edge/Chrome window.
    if args.title:
        click_args=argparse.Namespace(text=args.title, window=args.window or 'ChatGPT', wait=2.0)
        try: click_text(click_args)
        except Exception: pass
    time.sleep(args.wait)
    # Prefer an open conversation window, then ChatGPT Classic.
    queries=[args.title, 'ChatGPT Classic', 'ChatGPT', 'Codex Chat Watch']
    seen=set(); wins=[]
    for q in queries:
        if not q or q in seen: continue
        seen.add(q)
        wins.extend(_find_windows(q))
    items=[]
    for w in wins[:3]:
        try:
            wt=_safe_text(w)
            for c in w.descendants():
                txt=_safe_text(c)
                if txt:
                    items.append({'window':wt,'type':c.element_info.control_type,'text':txt[:args.max_text]})
                    if len(items)>=args.max_items: break
        except Exception: pass
        if len(items)>=args.max_items: break
    # Deduplicate in order.
    out=[]; ss=set()
    for it in items:
        key=(it['window'],it['type'],it['text'])
        if key not in ss:
            ss.add(key); out.append(it)
    emit({'ok':True,'title':args.title,'items':out,'itemCount':len(out),'plainText':'\n'.join([x['text'] for x in out])})

def main():
    p=argparse.ArgumentParser(); sub=p.add_subparsers(dest='cmd')
    a=sub.add_parser('dump'); a.add_argument('--query',default='ChatGPT'); a.add_argument('--max-nodes',type=int,default=5000); a.add_argument('--max-windows',type=int,default=3); a.add_argument('--max-text',type=int,default=2000)
    a=sub.add_parser('click_text'); a.add_argument('--text',required=True); a.add_argument('--window',default='ChatGPT'); a.add_argument('--wait',type=float,default=2)
    a=sub.add_parser('read_chat'); a.add_argument('--title',default=''); a.add_argument('--window',default='ChatGPT'); a.add_argument('--wait',type=float,default=3); a.add_argument('--max-items',type=int,default=800); a.add_argument('--max-text',type=int,default=4000)
    ns=p.parse_args()
    if ns.cmd=='dump': dump(ns)
    elif ns.cmd=='click_text': click_text(ns)
    elif ns.cmd=='read_chat': read_chat(ns)
    else: emit({'ok':False,'error':'unknown_command'})
if __name__=='__main__': main()
