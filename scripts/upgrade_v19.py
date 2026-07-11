from pathlib import Path
p = Path('src/server.js')
txt = p.read_text(encoding='utf-8')
helper = r'''
function compactText(s, n=12000){ s=String(s||''); return s.length>n ? s.slice(0,n)+'\n...[truncated]...' : s; }
function parseJsonLoose(text){
  const s=String(text||'');
  const fence=s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates=[];
  if(fence) candidates.push(fence[1]);
  const first=s.indexOf('{'); const last=s.lastIndexOf('}');
  if(first>=0 && last>first) candidates.push(s.slice(first,last+1));
  for(const c of candidates){ try{return JSON.parse(c)}catch{} }
  return null;
}
function liveAgentDir(sessionId){ const id=String(sessionId||safeId('live_agent')).replace(/[^A-Za-z0-9_\-.]+/g,'_'); const d=assertWritable(path.join(resultsDir,id)); fs.mkdirSync(d,{recursive:true}); return {id,dir:d}; }
function createLiveAgentObservation(args={}){
  const {id,dir}=liveAgentDir(args.sessionId);
  const monitor=Number(args.monitor||1);
  const active=runLiveBridge('active_window',{},120000);
  const windows=runLiveBridge('list_windows',{query:args.windowQuery||''},120000);
  const screen=runLiveBridge('screenshot',{monitor},180000);
  const ocr=runLiveBridge('screen_ocr',{monitor},180000);
  let browser=null;
  if(args.includeBrowser){
    const port=Number(args.port||9222);
    browser={port,tabs:browserBridge('tabs',['--port',String(port)],120000)};
    try{ browser.dom=browserBridge('dom',['--port',String(port),'--index',String(args.browserIndex||0),'--outpath',path.join(dir,'browser_dom.json')],180000); }catch(e){ browser.dom={ok:false,error:String(e.message||e)}; }
  }
  const obs={ok:true,sessionId:id,createdAt:new Date().toISOString(),task:args.task||'',active,windows,screen,ocr,browser};
  const jsonPath=path.join(dir,'observation_'+Date.now()+'.json');
  fs.writeFileSync(jsonPath,JSON.stringify(obs,null,2),'utf8');
  const md=[`# Live agent observation`, `Session: ${id}`, `Task: ${args.task||''}`, `Created: ${obs.createdAt}`, '', '## Active window', '```json', JSON.stringify(active,null,2), '```', '', '## Screen', '```json', JSON.stringify(screen,null,2), '```', '', '## OCR', '```text', compactText(ocr.text||'',20000), '```'];
  if(browser) md.push('', '## Browser', '```json', compactText(JSON.stringify(browser,null,2),20000), '```');
  const mdPath=jsonPath.replace(/\.json$/,'.md'); fs.writeFileSync(mdPath,md.join('\n'),'utf8');
  return {ok:true,sessionId:id,dir,jsonPath,mdPath,activeWindow:active.window?.title||'',screenPath:screen.path||'',ocrChars:(ocr.text||'').length,browserIncluded:!!browser};
}
'''
if 'function createLiveAgentObservation(args' not in txt:
    txt = txt.replace('function listTools() { return [', helper + '\nfunction listTools() { return [')
p.write_text(txt, encoding='utf-8')
print('part1')
append = r'''
function createLiveAgentFablePlan(args={}){
  let obsPath=args.observationPath;
  let obsInfo=null;
  if(!obsPath){ obsInfo=createLiveAgentObservation(args); obsPath=obsInfo.jsonPath; }
  obsPath=assertReadable(obsPath);
  const obs=JSON.parse(fs.readFileSync(obsPath,'utf8'));
  const {id,dir}=liveAgentDir(args.sessionId||obs.sessionId||safeId('live_agent'));
  const promptPath=assertWritable(path.join(dir,'fable_live_plan_'+Date.now()+'.md'));
  const prompt=[
    'ASK_FABLE5 - Live agent observe-plan step',
    '-NoMap','',
    'You are Fable5 coordinating CompanionConnector live agent. Return ONLY JSON. No markdown.',
    'Allowed actions: none, browser_navigate, browser_click_text, browser_type_selector, browser_press_key, human_focus_window, human_click_xy, human_type_text, human_press_key, human_scroll.',
    'Schema: {"summary":"...","confidence":0.0,"actions":[{"type":"none","reason":"..."}],"needsUser":false,"risk":"low|medium|high"}',
    'Do not suggest destructive actions. Prefer observation-only when unsure.',
    '',
    `USER_TASK: ${args.task||obs.task||''}`,
    '',
    'OBSERVATION_JSON:',
    '```json',
    compactText(JSON.stringify(obs,null,2), Number(args.maxObservationChars||40000)),
    '```'
  ].join('\n');
  fs.writeFileSync(promptPath,prompt,'utf8');
  const run=runFablePromptFile(promptPath, Number(args.maxOutputChars||120000));
  let text=''; try{text=JSON.parse(fs.readFileSync(run.resultPath,'utf8')).stdout||''}catch{text=JSON.stringify(run)}
  const plan=parseJsonLoose(text) || {summary:'Fable did not return parseable JSON',confidence:0,actions:[{type:'none',reason:'parse_failed'}],needsUser:true,risk:'medium',raw:compactText(text,20000)};
  const planPath=assertWritable(path.join(dir,'fable_live_plan_'+Date.now()+'.json'));
  fs.writeFileSync(planPath,JSON.stringify({ok:true,sessionId:id,observationPath:obsPath,promptPath,fableRun:run,plan,raw:compactText(text,50000)},null,2),'utf8');
  return {ok:true,sessionId:id,observationPath:obsPath,promptPath,planPath,plan};
}
function applyLiveAgentAction(args={}){
  const execute=!!args.execute;
  const action= typeof args.actionJson==='string' ? (parseJsonLoose(args.actionJson)||{}) : (args.action||{});
  const type=String(action.type||args.type||'none');
  const allowed=new Set(['none','browser_navigate','browser_click_text','browser_type_selector','browser_press_key','human_focus_window','human_click_xy','human_type_text','human_press_key','human_scroll']);
  if(!allowed.has(type)) return {ok:false,error:'action_not_allowed',type};
  const rec={ok:true,execute,type,action,createdAt:new Date().toISOString()};
  if(!execute || type==='none') return {...rec,result:{ok:true,dryRun:!execute,noop:type==='none'}};
  let result;
  if(type==='browser_navigate') result=browserBridge('navigate',['--port',String(action.port||9222),'--url',String(action.url||''),'--index',String(action.index||0),'--wait',String(action.wait||1.5)],300000);
  else if(type==='browser_click_text') result=browserBridge('click_text',['--port',String(action.port||9222),'--text',String(action.text||''),'--index',String(action.index||0)],300000);
  else if(type==='browser_type_selector') result=browserBridge('type_selector',['--port',String(action.port||9222),'--selector',String(action.selector||''),'--text',String(action.text||''),'--index',String(action.index||0)],300000);
  else if(type==='browser_press_key') result=browserBridge('press_key',['--port',String(action.port||9222),'--key',String(action.key||'Enter'),'--index',String(action.index||0)],300000);
  else if(type==='human_focus_window') result=runLiveBridge('focus_window',{query:action.query||''},120000);
  else if(type==='human_click_xy') result=runLiveBridge('click',{x:action.x,y:action.y,clicks:action.clicks||1},120000);
  else if(type==='human_type_text') result=runLiveBridge('type_text',{text:action.text||'',paste:action.paste!==false},120000);
  else if(type==='human_press_key') result=runLiveBridge('press_key',{key:action.key,keys:action.keys},120000);
  else if(type==='human_scroll') result=runLiveBridge('scroll',{clicks:action.clicks||-5},120000);
  return {...rec,result};
}
function runLiveAgentCycle(args={}){
  const obs=createLiveAgentObservation(args);
  const plan=createLiveAgentFablePlan({...args,observationPath:obs.jsonPath,sessionId:obs.sessionId});
  const actions=Array.isArray(plan.plan.actions)?plan.plan.actions:[];
  const executed=[];
  const max=Number(args.maxActions||1);
  for(const a of actions.slice(0,max)) executed.push(applyLiveAgentAction({action:a,execute:!!args.execute}));
  let after=null; if(args.afterSnapshot) after=createLiveAgentObservation({sessionId:obs.sessionId,task:'after action',monitor:args.monitor,includeBrowser:args.includeBrowser,port:args.port});
  const cycle={ok:true,sessionId:obs.sessionId,observation:obs,plan,executed,after,execute:!!args.execute};
  const file=assertWritable(path.join(liveAgentDir(obs.sessionId).dir,'cycle_'+Date.now()+'.json'));
  fs.writeFileSync(file,JSON.stringify(cycle,null,2),'utf8');
  return {ok:true,sessionId:obs.sessionId,cyclePath:file,plan:plan.plan,executed,afterSnapshotPath:after?.screenPath||''};
}
'''
if 'function runLiveAgentCycle(args' not in txt:
    txt = txt.replace('function listTools() { return [', append + '\nfunction listTools() { return [')
newtools = r'''
 { name:'live_agent_observe', title:'Live agent observe', description:'Capture desktop/browser observation package for Fable/ChatGPT live agent loop.', inputSchema:{type:'object',properties:{sessionId:{type:'string'},task:{type:'string'},monitor:{type:'number'},includeBrowser:{type:'boolean'},port:{type:'number'},browserIndex:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'live_agent_fable_plan', title:'Live agent Fable plan', description:'Ask Fable to produce a JSON action plan from a live observation.', inputSchema:{type:'object',properties:{sessionId:{type:'string'},task:{type:'string'},observationPath:{type:'string'},includeBrowser:{type:'boolean'},port:{type:'number'},maxObservationChars:{type:'number'},maxOutputChars:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'live_agent_apply_action', title:'Live agent apply action', description:'Apply one safe allowlisted live-agent action; dry-run unless execute=true.', inputSchema:{type:'object',properties:{action:{type:'object'},actionJson:{type:'string'},type:{type:'string'},execute:{type:'boolean'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'live_agent_cycle', title:'Live agent cycle', description:'Observe screen, ask Fable for plan, optionally execute safe action, and log the cycle.', inputSchema:{type:'object',properties:{sessionId:{type:'string'},task:{type:'string'},monitor:{type:'number'},includeBrowser:{type:'boolean'},port:{type:'number'},execute:{type:'boolean'},afterSnapshot:{type:'boolean'},maxActions:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
'''
if "name:'live_agent_cycle'" not in txt:
    txt = txt.replace(" { name:'get_job_status'", newtools + " { name:'get_job_status'")
newcalls = r'''
 if (name==='live_agent_observe') return toolResult(createLiveAgentObservation(args));
 if (name==='live_agent_fable_plan') return toolResult(createLiveAgentFablePlan(args));
 if (name==='live_agent_apply_action') return toolResult(applyLiveAgentAction(args));
 if (name==='live_agent_cycle') return toolResult(runLiveAgentCycle(args));
'''
if "name==='live_agent_cycle'" not in txt:
    txt = txt.replace(" if (name==='get_job_status')", newcalls + " if (name==='get_job_status')")
for old in ['18.0.0','17.0.0','16.0.0']:
    txt=txt.replace("version:'"+old+"'","version:'19.0.0'").replace('version:"'+old+'"','version:"19.0.0"').replace('"version": "'+old+'"','"version": "19.0.0"')
txt=txt.replace('companion-connector v18 listening','companion-connector v19 listening').replace('companion-connector v17 listening','companion-connector v19 listening').replace('companion-connector v16 listening','companion-connector v19 listening')
p.write_text(txt, encoding='utf-8')
print('part2')
