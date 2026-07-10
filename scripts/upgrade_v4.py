from pathlib import Path
p=Path('src/server.js')
txt=p.read_text(encoding='utf-8')
helper=r'''
function listJobs(limit = 100) {
  return fs.readdirSync(jobsDir).filter(x => x.endsWith('.json')).sort().slice(-Math.min(Number(limit)||100, 500)).map(f => JSON.parse(fs.readFileSync(path.join(jobsDir, f), 'utf8')));
}
function listFableRuns(limit = 100) {
  return fs.readdirSync(resultsDir).filter(x => x.includes('_fable_run.json')).sort().slice(-Math.min(Number(limit)||100, 500)).map(f => {
    const p = path.join(resultsDir, f);
    const o = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { id: o.id, promptPath: o.promptPath, exitCode: o.exitCode, resultPath: p, stdoutBytes: Buffer.byteLength(o.stdout || ''), stderrBytes: Buffer.byteLength(o.stderr || '') };
  });
}
'''
helper += r'''
function createQuestionBatch(args = {}) {
  const id = safeId('qbatch');
  const dir = assertWritable(path.join(resultsDir, id));
  fs.mkdirSync(dir, { recursive: true });
  const questions = Array.isArray(args.questions) ? args.questions.map(String) : [String(args.question || '')];
  const context = args.context || '';
  const files = [];
  for (const rid of (Array.isArray(args.resourceIds) ? args.resourceIds : [])) { const r = resourceIndex().find(x => x.id === rid); if (r) files.push(r.path); }
  for (const fp of (Array.isArray(args.filePaths) ? args.filePaths : [])) files.push(fp);
  const unique = [...new Set(files)].map(assertReadable);
  const md = [];
  md.push(`ASK_FABLE5 - Question batch ${args.title || id}`);
  md.push('-NoMap'); md.push(''); md.push('Context:'); md.push(String(context)); md.push('');
  md.push('Questions:'); questions.forEach((q, i) => md.push(`${i + 1}. ${q}`)); md.push('');
  md.push('Attached paths:'); unique.forEach((fp, i) => md.push(`${i + 1}. ${fp}`));
  md.push(''); md.push('Instructions: Answer every question. If a file is referenced, use included text sections or request a follow-up file pointer.');
  for (const fp of unique) {
    const st = fs.statSync(fp); md.push(''); md.push(`## PATH ${fp}`); md.push(`size=${st.size} mtime=${st.mtime.toISOString()}`);
    if (st.isFile() && isTextLike(fp)) { const part = readWholeTextBounded(fp, args.maxBytesPerFile || 250000); md.push(`included_bytes=${part.bytes} truncated=${part.truncated}`); md.push('```text'); md.push(part.text); md.push('```'); }
    else if (st.isFile() && /\.(png|jpe?g|gif)$/i.test(fp)) md.push(`image_meta=${JSON.stringify(detectImage(fp))}`);
  }
  const promptPath = path.join(dir, 'question_batch.md'); fs.writeFileSync(promptPath, md.join('\n'), 'utf8');
  const manifest = { id, title: args.title || id, promptPath, questions, files: unique, createdAt: new Date().toISOString() };
  const manifestPath = path.join(dir, 'manifest.json'); fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  return { batchId: id, promptPath, manifestPath, questions: questions.length, files: unique.length };
}
'''
helper += r'''
function connectorHealthReport() {
  return { ok: true, version: '4.0.0', root: ROOT, port: PORT, tools: listTools().length, resources: resourceIndex().length, jobs: fs.readdirSync(jobsDir).filter(x => x.endsWith('.json')).length, results: fs.readdirSync(resultsDir).length, services: serviceCatalog().length, allowedRoots: CFG.allowedRoots, writeRoot: CFG.writeRoot };
}
function createFableImprovementSurvey() {
  const questions = [
    'What communication or handoff problems did you experience with ChatGPT?',
    'What file-transfer or context-transfer problems did you experience?',
    'What should Companion Connector add for very large questions?',
    'What should Companion Connector add for screenshots and attachments?',
    'What should Companion Connector add for many questions in one task?',
    'What should Companion Connector add for reliability and verification?',
    'What should Companion Connector add for future 21-folder MCP services?',
    'What exact tests should prove the next version is ready?'
  ];
  return createQuestionBatch({ title: 'Fable improvement survey', context: 'Please answer as an implementation checklist for the existing Node CompanionConnector. New files only inside CompanionConnector.', questions, filePaths: [path.join(ROOT, 'README.md'), path.join(ROOT, 'src', 'server.js')], maxBytesPerFile: 500000 });
}
function runQuestionBatch(promptPath, maxOutputChars = 300000) { return runFablePromptFile(promptPath, maxOutputChars); }
function askFableBig(args = {}) {
  const batch = createQuestionBatch({ title: args.title || 'Big Fable question', context: args.context || '', question: args.question || '', questions: args.questions || undefined, resourceIds: args.resourceIds || [], filePaths: args.filePaths || [], maxBytesPerFile: args.maxBytesPerFile || 500000 });
  const run = runQuestionBatch(batch.promptPath, args.maxOutputChars || 300000);
  return { ...batch, fableRun: run };
}
'''
if 'function listJobs(limit = 100)' not in txt:
    txt=txt.replace('function listTools() { return [', helper+'\nfunction listTools() { return [')
new_tools = r'''
 { name:'create_question_batch', title:'Create question batch', description:'Create a multi-question Fable prompt bundle with attached local resources.', inputSchema:{type:'object',properties:{title:{type:'string'},context:{type:'string'},question:{type:'string'},questions:{type:'array'},resourceIds:{type:'array'},filePaths:{type:'array'},maxBytesPerFile:{type:'number'}},required:['title']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'run_question_batch', title:'Run question batch', description:'Run AskFable on a question batch prompt path.', inputSchema:{type:'object',properties:{promptPath:{type:'string'},maxOutputChars:{type:'number'}},required:['promptPath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'ask_fable_big', title:'Ask Fable big', description:'Create a question batch and run Fable in one call, using file-backed context.', inputSchema:{type:'object',properties:{title:{type:'string'},context:{type:'string'},question:{type:'string'},questions:{type:'array'},resourceIds:{type:'array'},filePaths:{type:'array'},maxBytesPerFile:{type:'number'},maxOutputChars:{type:'number'}},required:['title']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_fable_improvement_survey', title:'Create Fable improvement survey', description:'Create a standard survey asking Fable what to improve next.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'connector_health_report', title:'Connector health report', description:'Return connector capability and artifact counts.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'list_jobs', title:'List jobs', description:'List recent connector job records.', inputSchema:{type:'object',properties:{limit:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'list_fable_runs', title:'List Fable runs', description:'List recent stored Fable run outputs.', inputSchema:{type:'object',properties:{limit:{type:'number'}}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
'''
if "name:'ask_fable_big'" not in txt:
    txt=txt.replace("{ name:'get_job_status', title:'Get job status'", new_tools+" { name:'get_job_status', title:'Get job status'")
new_calls = r'''
 if (name==='create_question_batch') return toolResult(createQuestionBatch(args));
 if (name==='run_question_batch') return toolResult(runQuestionBatch(args.promptPath, args.maxOutputChars));
 if (name==='ask_fable_big') return toolResult(askFableBig(args));
 if (name==='create_fable_improvement_survey') return toolResult(createFableImprovementSurvey());
 if (name==='connector_health_report') return toolResult(connectorHealthReport());
 if (name==='list_jobs') return toolResult({ jobs: listJobs(args.limit) });
 if (name==='list_fable_runs') return toolResult({ runs: listFableRuns(args.limit) });
'''
if "name==='ask_fable_big'" not in txt:
    txt=txt.replace("if (name==='get_job_status')", new_calls+" if (name==='get_job_status')")
txt = txt.replace("version:'3.0.0'", "version:'4.0.0'")
txt = txt.replace("version:'2.0.0'", "version:'4.0.0'")
p.write_text(txt, encoding='utf-8')
print('upgrade_v4.py applied')
