from pathlib import Path
import json
ROOT = Path.cwd()
server = ROOT / 'src' / 'server.js'
pkg = ROOT / 'package.json'
text = server.read_text(encoding='utf-8')

# Version bump
text = text.replace("version:'21.0.0'", "version:'22.0.0'")
text = text.replace("version:'21.0.0'", "version:'22.0.0'")
text = text.replace("version:'21.0.0'", "version:'22.0.0'")
text = text.replace("version:'21.0.0'", "version:'22.0.0'")
text = text.replace("\"version\": \"21.0.0\"", "\"version\": \"22.0.0\"")
text = text.replace("version:'21.0.0'", "version:'22.0.0'")
text = text.replace("version:'21.0.0'", "version:'22.0.0'")
text = text.replace("version:'21.0.0'", "version:'22.0.0'")
text = text.replace("version:'21.0.0'", "version:'22.0.0'")
text = text.replace("version:'21.0.0'", "version:'22.0.0'")
text = text.replace("version:'21.0.0'", "version:'22.0.0'")
text = text.replace("version:'21.0.0'", "version:'22.0.0'")
text = text.replace("version:'21.0.0'", "version:'22.0.0'")
text = text.replace("version:'21.0.0'", "version:'22.0.0'")
text = text.replace("version:'21.0.0'", "version:'22.0.0'")
text = text.replace("version:'21.0.0'", "version:'22.0.0'")
text = text.replace("version:'21.0.0'", "version:'22.0.0'")
text = text.replace("version:'21.0.0'", "version:'22.0.0'")
text = text.replace("v21 listening", "v22 listening")
v22_functions = r'''

function fable5ModeManifest(args={}){
  const manifest = {
    ok:true,
    version:'22.0.0',
    mode:'Fable5 Direct Mode',
    triggerWords:['FABLE5:', '@Fable5', 'F5:'],
    primaryTool:'fable5',
    directTools:['fable5','fable_direct_submit','fable_direct_inbox','fable_direct_dashboard','fable_capability_review','fable5_request_chatgpt_help'],
    truth:'An MCP connection cannot replace the ChatGPT model by itself. It can expose tools, resources and prompts. To behave as Fable-first, the ChatGPT app/instructions must route messages to the fable5 tool by default.',
    recommendedAppInstruction:'Use Companion Connector as a Fable5-first transport. For any user message that starts with FABLE5:, @Fable5, F5:, or when the user says direct Fable mode, call the fable5 tool and return Fable5 answer. Do not answer from ChatGPT unless Fable5 requests ChatGPT help or the connector is unavailable.',
    userDirectCommand:'Fable5-Direct.ps1 "your task"',
    dashboard:'Fable5-Direct-Dashboard.ps1'
  };
  const p=assertWritable(path.join(fableDirectDir,'FABLE5_DIRECT_MODE_MANIFEST.json'));
  fs.writeFileSync(p, JSON.stringify(manifest,null,2),'utf8');
  return {...manifest, manifestPath:p};
}
function fableCapabilitiesSnapshot(args={}){
  const tools=listTools().map(t=>({name:t.name,title:t.title,description:t.description,readOnly:!!t.annotations?.readOnlyHint}));
  const docsDir=path.join(ROOT,'docs');
  const docs=fs.existsSync(docsDir)?fs.readdirSync(docsDir).filter(f=>f.toLowerCase().endsWith('.md')||f.toLowerCase().endsWith('.json')).sort():[];
  const snap={ok:true,version:'22.0.0',toolCount:tools.length,tools,docs,directMode:fable5ModeManifest({}), generatedAt:new Date().toISOString()};
  const p=assertWritable(path.join(authorityDir,'V22_FULL_CAPABILITIES_FOR_FABLE.json'));
  fs.writeFileSync(p, JSON.stringify(snap,null,2),'utf8');
  return {...snap,path:p};
}
function fableCapabilityReview(args={}){
  const snap=fableCapabilitiesSnapshot(args);
  return createFableAuthorityProposal({
    title:'V22 full capability review and missing service design',
    context:JSON.stringify(snap,null,2),
    request:'Review every CompanionConnector capability. Return JSON with missingCapabilities, productivityImprovements, directFableModeDesign, priorityPlan, risks, and approved. Focus on what service/function/user ability is still missing.',
    runFable: args.runFable !== false,
    maxOutputChars: Number(args.maxOutputChars||150000),
    decidedBy:'Fable5'
  });
}
'''
marker = "function listTools() { return ["
if 'function fable5ModeManifest' not in text:
    text = text.replace(marker, v22_functions + "\n" + marker)
v22_more = r'''
function fable5Direct(args={}){
  return fableDirectSubmit({...args, decidedBy:'Fable5', runNow: args.runNow !== false});
}
function fable5RequestChatGPTHelp(args={}){
  const id=directSafeId('chatgpt_help');
  const rec={id,kind:'fable_requests_chatgpt_help',decidedBy:'Fable5',createdAt:new Date().toISOString(),status:'open',request:String(args.request||''),context:compactDirectText(args.context||'',40000)};
  const dir=assertWritable(path.join(fableDirectDir,'chatgpt_requests'));
  fs.mkdirSync(dir,{recursive:true});
  const p=path.join(dir,`${id}.json`);
  fs.writeFileSync(p,JSON.stringify(rec,null,2),'utf8');
  authorityAppend('fable_requests_chatgpt_help',{decidedBy:'Fable5',requestId:id,path:p,requestPreview:compactDirectText(rec.request,3000)});
  return {ok:true,id,path:p,record:rec};
}
function fable5DirectChat(args={}){
  const task=String(args.message||args.task||'').trim();
  if(!task) throw new Error('message_required');
  return fable5Direct({task,context:args.context||'',maxOutputChars:args.maxOutputChars||120000,runNow:true});
}
'''
if 'function fable5Direct(args={})' not in text:
    text = text.replace("function listTools() { return [", v22_more + "\nfunction listTools() { return [")

tool_block = """
 { name:'fable5', title:'Fable5 direct chat', description:'Directly ask Fable5. Use this as the primary route for FABLE5:, @Fable5 and F5: messages.', inputSchema:{type:'object',properties:{task:{type:'string'},message:{type:'string'},context:{type:'string'},maxOutputChars:{type:'number'},runNow:{type:'boolean'}},required:[]}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'fable5_direct_mode_manifest', title:'Fable5 direct mode manifest', description:'Return exact instructions for making the app route user messages to Fable5 first.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'fable_capability_snapshot', title:'Fable capability snapshot', description:'Create a complete snapshot of all CompanionConnector tools/docs for Fable5 review.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'fable_capability_review', title:'Fable capability review', description:'Show Fable5 all current capabilities and ask what service/function is still missing.', inputSchema:{type:'object',properties:{runFable:{type:'boolean'},maxOutputChars:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'fable5_request_chatgpt_help', title:'Fable requests ChatGPT help', description:'Let Fable5 create a request for ChatGPT assistance instead of ChatGPT initiating Fable.', inputSchema:{type:'object',properties:{request:{type:'string'},context:{type:'string'}},required:['request']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
"""
if "name:'fable5'" not in text:
    text = text.replace("function listTools() { return [\n", "function listTools() { return [\n" + tool_block)
call_block = """
 if (name==='fable5') return toolResult(fable5DirectChat(args));
 if (name==='fable5_direct_mode_manifest') return toolResult(fable5ModeManifest(args));
 if (name==='fable_capability_snapshot') return toolResult(fableCapabilitiesSnapshot(args));
 if (name==='fable_capability_review') return toolResult(fableCapabilityReview(args));
 if (name==='fable5_request_chatgpt_help') return toolResult(fable5RequestChatGPTHelp(args));
"""
if "name==='fable5'" not in text:
    text = text.replace(" if (name==='fable_direct_submit') return toolResult(fableDirectSubmit(args));", call_block + "\n if (name==='fable_direct_submit') return toolResult(fableDirectSubmit(args));")

# Resources for new app/direct mode
old_res = "function listResources() { return [ { uri:'companion://status', name:'Companion Connector status', mimeType:'application/json' }, { uri:'ui://companion/dashboard.html', name:'Companion dashboard', mimeType:'text/html;profile=mcp-app' }, { uri:'companion://mcp-services', name:'21 MCP service catalog', mimeType:'application/json' }, ...resourceIndex().map(r=>({uri:`companion://resource/${r.id}`, name:r.title||r.id, mimeType:(r.type||'').includes('image')?'application/json':'text/plain'})) ]; }"
new_res = "function listResources() { return [ { uri:'companion://status', name:'Companion Connector status', mimeType:'application/json' }, { uri:'ui://companion/dashboard.html', name:'Companion dashboard', mimeType:'text/html;profile=mcp-app' }, { uri:'companion://mcp-services', name:'21 MCP service catalog', mimeType:'application/json' }, { uri:'companion://fable5-direct-mode', name:'Fable5 Direct Mode instructions', mimeType:'application/json' }, { uri:'companion://fable5-capabilities', name:'Fable5 full capability snapshot', mimeType:'application/json' }, ...resourceIndex().map(r=>({uri:`companion://resource/${r.id}`, name:r.title||r.id, mimeType:(r.type||'').includes('image')?'application/json':'text/plain'})) ]; }"
if old_res in text:
    text = text.replace(old_res, new_res)
else:
    print('WARN resource function not exact')

# V22 resources read hook
old_read = "function readResource(uri) { if(uri==='companion://status') return {contents:[{uri,mimeType:'application/json',text:JSON.stringify({ok:true,root:ROOT,resources:resourceIndex().length,services:MCP_SERVICE_FOLDERS.length},null,2)}]}; if(uri==='ui://companion/dashboard.html') return {contents:[{uri,mimeType:'text/html;profile=mcp-app',text:fs.readFileSync(path.join(webDir,'dashboard.html'),'utf8')}]}; if(uri==='companion://mcp-services') return {contents:[{uri,mimeType:'application/json',text:JSON.stringify(serviceCatalog(),null,2)}]}; const m=String(uri).match(/^companion:\\/\\/resource\\/(.+)$/); if(m) return {contents:[{uri,mimeType:'application/json',text:JSON.stringify(fetchResource(m[1]),null,2)}]}; throw new Error('resource_not_found'); }"
new_read = "function readResource(uri) { if(uri==='companion://status') return {contents:[{uri,mimeType:'application/json',text:JSON.stringify({ok:true,root:ROOT,resources:resourceIndex().length,services:MCP_SERVICE_FOLDERS.length,version:'22.0.0'},null,2)}]}; if(uri==='ui://companion/dashboard.html') return {contents:[{uri,mimeType:'text/html;profile=mcp-app',text:fs.readFileSync(path.join(webDir,'dashboard.html'),'utf8')}]}; if(uri==='companion://mcp-services') return {contents:[{uri,mimeType:'application/json',text:JSON.stringify(serviceCatalog(),null,2)}]}; if(uri==='companion://fable5-direct-mode') return {contents:[{uri,mimeType:'application/json',text:JSON.stringify(fable5ModeManifest({}),null,2)}]}; if(uri==='companion://fable5-capabilities') return {contents:[{uri,mimeType:'application/json',text:JSON.stringify(fableCapabilitiesSnapshot({}),null,2)}]}; const m=String(uri).match(/^companion:\\/\\/resource\\/(.+)$/); if(m) return {contents:[{uri,mimeType:'application/json',text:JSON.stringify(fetchResource(m[1]),null,2)}]}; throw new Error('resource_not_found'); }"
if old_read in text:
    text = text.replace(old_read, new_read)
else:
    print('WARN readResource function not exact')

# Prompt names and generic prompt text
text = text.replace("{name:'handoff_to_fable',title:'Prepare Fable prompt from pointers'}", "{name:'handoff_to_fable',title:'Prepare Fable prompt from pointers'},{name:'fable5_direct_mode',title:'Route this chat to Fable5 first'},{name:'fable5_trigger_words',title:'Use FABLE5 / @Fable5 / F5 trigger words'}")
text = text.replace("Use Companion Connector tools for file pointers, jobs, image metadata, and MCP service catalog.", "Use Companion Connector tools. In Fable5 Direct Mode, route FABLE5, @Fable5, and F5 messages to the fable5 tool and return Fable5 answer with the authority log path. Act as transport unless Fable5 requests help.")

pkg_data = json.loads(pkg.read_text(encoding='utf-8'))
pkg_data['version'] = '22.0.0'
pkg_data.setdefault('scripts', {})['test:v22'] = 'node scripts/v22-direct-mode-test.js'
pkg.write_text(json.dumps(pkg_data, indent=2), encoding='utf-8')
server.write_text(text, encoding='utf-8')
print('upgrade_v22 applied')
