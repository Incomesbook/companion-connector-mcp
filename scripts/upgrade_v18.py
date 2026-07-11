from pathlib import Path
p=Path('src/server.js')
s=p.read_text(encoding='utf-8')
helpers=r'''
const queueDir = path.join(resultsDir, 'job_queue');
fs.mkdirSync(queueDir, {recursive:true});
function queuePath(id){ return path.join(queueDir, `${String(id)}.json`); }
function createQueueJob(args={}){
  const id=safeId('queue_job');
  const rec={id, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), status:'queued', type:String(args.type||'noop'), priority:Number(args.priority||5), title:String(args.title||args.type||id), payload:args.payload||{}, result:null, error:null};
  fs.writeFileSync(queuePath(id), JSON.stringify(rec,null,2),'utf8');
  return rec;
}
function listQueueJobs(args={}){ const limit=Number(args.limit||50); const arr=fs.readdirSync(queueDir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(queueDir,f),'utf8'))).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).slice(0,limit); return {queueDir,count:arr.length,jobs:arr}; }
'''
if 'const queueDir =' not in s:
    s=s.replace("function runSemanticBridge(cmd,args={},timeout=900000){", helpers+"\nfunction runSemanticBridge(cmd,args={},timeout=900000){")
helpers2=r'''
function saveQueueJob(rec){ rec.updatedAt=new Date().toISOString(); fs.writeFileSync(queuePath(rec.id), JSON.stringify(rec,null,2),'utf8'); return rec; }
function cancelQueueJob(args={}){ const p=queuePath(args.id); if(!fs.existsSync(p)) throw new Error('queue_job_not_found'); const rec=JSON.parse(fs.readFileSync(p,'utf8')); if(rec.status==='running') throw new Error('cannot_cancel_running_job'); rec.status='cancelled'; return saveQueueJob(rec); }
function auditPathSafety(args={}){
  const raw=String(args.path||''); const resolved=raw ? fs.realpathSync(path.resolve(raw)) : '';
  const protectedNames=['_AI_CHATS_ОБЩИЕ','_AI_CHATS_ОБЩИЕ'.normalize('NFC')];
  const protectedHit=protectedNames.some(x=>resolved.includes(x));
  const writableInsideConnector=resolved ? isInside(resolved, ROOT) : false;
  return {path:raw,resolved,protectedHit,writeAllowedByConnector:writableInsideConnector,readAllowedByDrive: resolved ? discoverReadableRoots().some(r=>r.readable && isInside(resolved,r.root)) : false, recommendation: protectedHit ? 'read_only_only_unless_user_explicitly_authorizes' : 'normal_connector_rules'};
}
'''
if 'function cancelQueueJob' not in s:
    s=s.replace("function runSemanticBridge(cmd,args={},timeout=900000){", helpers2+"\nfunction runSemanticBridge(cmd,args={},timeout=900000){")
helpers3=r'''
function runQueueOnce(args={}){
  const jobs=fs.readdirSync(queueDir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(queueDir,f),'utf8'))).filter(j=>j.status==='queued').sort((a,b)=>(a.priority-b.priority)||String(a.createdAt).localeCompare(String(b.createdAt)));
  const max=Number(args.max||1); const ran=[];
  for(const rec of jobs.slice(0,max)){
    rec.status='running'; saveQueueJob(rec);
    try{
      const p=rec.payload||{}; let result={ok:true, noop:true};
      if(rec.type==='screen_snapshot') result=runLiveBridge('screenshot',p,180000);
      else if(rec.type==='screen_ocr') result=runLiveBridge('screen_ocr',p,180000);
      else if(rec.type==='semantic_index') result=runSemanticBridge('create',{indexPath:assertReadable(p.indexPath)},1800000);
      else if(rec.type==='document_inspect') result=runDocumentBridge('inspect',{path:assertReadable(p.path)},900000);
      else if(rec.type==='research_map') result=runResearchBridge('map',{folder:assertReadable(p.folder),maxFiles:p.maxFiles||5000},1800000);
      rec.status='done'; rec.result=result;
    } catch(e){ rec.status='failed'; rec.error=String(e.message||e); }
    saveQueueJob(rec); ran.push(rec);
  }
  return {queueDir, ran:ran.length, jobs:ran};
}
function queueHealthReport(){ const arr=fs.readdirSync(queueDir).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(queueDir,f),'utf8'))); const counts={}; for(const j of arr) counts[j.status]=(counts[j.status]||0)+1; return {queueDir,total:arr.length,counts}; }
'''
if 'function runQueueOnce' not in s:
    s=s.replace("function runSemanticBridge(cmd,args={},timeout=900000){", helpers3+"\nfunction runSemanticBridge(cmd,args={},timeout=900000){")
tools=r'''
 { name:'create_queue_job', title:'Create queue job', description:'Create a durable connector job queue item.', inputSchema:{type:'object',properties:{type:{type:'string'},title:{type:'string'},priority:{type:'number'},payload:{type:'object'}},required:['type']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'list_queue_jobs', title:'List queue jobs', description:'List durable connector queue jobs.', inputSchema:{type:'object',properties:{limit:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'run_queue_once', title:'Run queue once', description:'Run queued jobs once with checkpointed status.', inputSchema:{type:'object',properties:{max:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'cancel_queue_job', title:'Cancel queue job', description:'Cancel a queued connector job.', inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'queue_health_report', title:'Queue health report', description:'Summarize durable queue status counts.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'audit_path_safety', title:'Audit path safety', description:'Check path read/write/protected-path safety before operations.', inputSchema:{type:'object',properties:{path:{type:'string'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
'''
if "name:'create_queue_job'" not in s:
    s=s.replace("{ name:'get_job_status', title:'Get job status'", tools+" { name:'get_job_status', title:'Get job status'")
calls=r'''
 if (name==='create_queue_job') return toolResult(createQueueJob(args));
 if (name==='list_queue_jobs') return toolResult(listQueueJobs(args));
 if (name==='run_queue_once') return toolResult(runQueueOnce(args));
 if (name==='cancel_queue_job') return toolResult(cancelQueueJob(args));
 if (name==='queue_health_report') return toolResult(queueHealthReport());
 if (name==='audit_path_safety') return toolResult(auditPathSafety(args));
'''
if "name==='create_queue_job'" not in s:
    s=s.replace("if (name==='get_job_status')", calls+" if (name==='get_job_status')")
s=s.replace("version:'17.0.0'","version:'18.0.0'")
s=s.replace("companion-connector v17 listening","companion-connector v18 listening")
p.write_text(s,encoding='utf-8')
print('upgrade_v18 applied')
