from pathlib import Path
p=Path('src/server.js')
s=p.read_text(encoding='utf-8')
helpers=r'''
function runLiveBridge(cmd, args={}, timeout=600000){
  const py=process.env.PYTHON || 'python';
  const script=path.join(ROOT,'scripts','live_bridge.py');
  const r=spawnSync(py,['-X','utf8',script,cmd,'--args',JSON.stringify(args||{})],{cwd:ROOT,encoding:'utf8',timeout,maxBuffer:1024*1024*128});
  if(r.error) return {ok:false,error:String(r.error.message||r.error),stdout:r.stdout||'',stderr:r.stderr||''};
  try{return JSON.parse((r.stdout||'').trim()||'{}')}catch{return {ok:false,error:'parse_failed',stdout:r.stdout,stderr:r.stderr,code:r.status}}
}
function runSemanticBridge(cmd,args={},timeout=900000){
  const py=process.env.PYTHON || 'python';
  const script=path.join(ROOT,'scripts','semantic_bridge.py');
  const r=spawnSync(py,['-X','utf8',script,cmd,'--args',JSON.stringify(args||{})],{cwd:ROOT,encoding:'utf8',timeout,maxBuffer:1024*1024*256});
  if(r.error) return {ok:false,error:String(r.error.message||r.error),stdout:r.stdout||'',stderr:r.stderr||''};
  try{return JSON.parse((r.stdout||'').trim()||'{}')}catch{return {ok:false,error:'parse_failed',stdout:r.stdout,stderr:r.stderr,code:r.status}}
}
'''
if 'function runLiveBridge(' not in s:
    s=s.replace("function modelBridge(cmd, args=[], timeout=7200000){ return runPyJson('model_bridge.py', [cmd, ...args], timeout); }\n", "function modelBridge(cmd, args=[], timeout=7200000){ return runPyJson('model_bridge.py', [cmd, ...args], timeout); }\n"+helpers)
tools=r'''
 { name:'human_list_windows', title:'Human list windows', description:'List visible desktop windows for human-style navigation.', inputSchema:{type:'object',properties:{query:{type:'string'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'human_active_window', title:'Human active window', description:'Return active desktop window title and bounds.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'human_focus_window', title:'Human focus window', description:'Focus a desktop window by title substring.', inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'human_screen_snapshot', title:'Human screen snapshot', description:'Capture the current desktop screen into connector results.', inputSchema:{type:'object',properties:{monitor:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'human_screen_ocr', title:'Human screen OCR', description:'OCR the current desktop screen.', inputSchema:{type:'object',properties:{monitor:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'human_live_watch', title:'Human live watch', description:'Capture repeated desktop screenshots and change scores.', inputSchema:{type:'object',properties:{seconds:{type:'number'},interval:{type:'number'},monitor:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'human_mouse_move', title:'Human mouse move', description:'Move the mouse pointer to coordinates.', inputSchema:{type:'object',properties:{x:{type:'number'},y:{type:'number'},duration:{type:'number'}},required:['x','y']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'human_click_xy', title:'Human click XY', description:'Click desktop coordinates.', inputSchema:{type:'object',properties:{x:{type:'number'},y:{type:'number'},clicks:{type:'number'}},required:['x','y']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'human_type_text', title:'Human type text', description:'Type or paste text into focused application.', inputSchema:{type:'object',properties:{text:{type:'string'},paste:{type:'boolean'},interval:{type:'number'}},required:['text']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'human_press_key', title:'Human press key', description:'Press one key or hotkey sequence.', inputSchema:{type:'object',properties:{key:{type:'string'},keys:{type:'array'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'human_scroll', title:'Human scroll', description:'Scroll focused window.', inputSchema:{type:'object',properties:{clicks:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_semantic_index', title:'Create semantic index', description:'Create a lightweight local semantic/token index from a folder content_index.json.', inputSchema:{type:'object',properties:{indexPath:{type:'string'}},required:['indexPath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'search_semantic_index', title:'Search semantic index', description:'Search a lightweight local semantic/token index.', inputSchema:{type:'object',properties:{indexPath:{type:'string'},query:{type:'string'},limit:{type:'number'}},required:['indexPath','query']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
'''
if "name:'human_list_windows'" not in s:
    s=s.replace("{ name:'get_job_status', title:'Get job status'", tools+" { name:'get_job_status', title:'Get job status'")
calls=r'''
 if (name==='human_list_windows') return toolResult(runLiveBridge('list_windows', args, 120000));
 if (name==='human_active_window') return toolResult(runLiveBridge('active_window', args, 120000));
 if (name==='human_focus_window') return toolResult(runLiveBridge('focus_window', args, 120000));
 if (name==='human_screen_snapshot') return toolResult(runLiveBridge('screenshot', args, 180000));
 if (name==='human_screen_ocr') return toolResult(runLiveBridge('screen_ocr', args, 180000));
 if (name==='human_live_watch') return toolResult(runLiveBridge('monitor', args, 900000));
 if (name==='human_mouse_move') return toolResult(runLiveBridge('move', args, 120000));
 if (name==='human_click_xy') return toolResult(runLiveBridge('click', args, 120000));
 if (name==='human_type_text') return toolResult(runLiveBridge('type_text', args, 120000));
 if (name==='human_press_key') return toolResult(runLiveBridge('press_key', args, 120000));
 if (name==='human_scroll') return toolResult(runLiveBridge('scroll', args, 120000));
 if (name==='create_semantic_index') return toolResult(runSemanticBridge('create', { indexPath: assertReadable(args.indexPath) }, 1800000));
 if (name==='search_semantic_index') return toolResult(runSemanticBridge('search', { indexPath: assertReadable(args.indexPath), query: args.query, limit: args.limit || 20 }, 300000));
'''
if "name==='human_list_windows'" not in s:
    s=s.replace("if (name==='get_job_status')", calls+" if (name==='get_job_status')")
s=s.replace("version:'16.0.0'","version:'17.0.0'")
s=s.replace("version:'15.0.0'","version:'17.0.0'")
s=s.replace("version:'14.0.0'","version:'17.0.0'")
s=s.replace("companion-connector v16 listening","companion-connector v17 listening")
p.write_text(s,encoding='utf-8')
print('upgrade_v17 applied')
