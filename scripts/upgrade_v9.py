from pathlib import Path
p = Path('src/server.js')
txt = p.read_text(encoding='utf-8')
helper = r'''
function discoverReadableRoots() {
  const roots = [];
  if (process.platform === 'win32') {
    for (let c = 65; c <= 90; c++) {
      const r = String.fromCharCode(c) + ':\\';
      try { if (fs.existsSync(r)) roots.push({ root: r, readable: true }); } catch { roots.push({ root: r, readable: false }); }
    }
  } else {
    roots.push({ root: '/', readable: true });
  }
  return roots;
}
function fileSnippet(text, max = 3000) {
  const clean = String(text || '').replace(/\r/g, '');
  if (clean.length <= max) return clean;
  const half = Math.floor(max / 2);
  return clean.slice(0, half) + '\n\n...[middle omitted in report; full chunks available in bundle]...\n\n' + clean.slice(-half);
}
function topTermsFromText(text, limit = 30) {
  const stop = new Set('the and for with that this from are you your file files folder import const function return true false null undefined чтобы как это для что или all path data на по из в и не a an to of in is it be as at by or on if else while let var new'.split(/\s+/));
  const map = new Map();
  const m = String(text || '').toLowerCase().match(/[a-zа-я0-9_]{3,}/giu) || [];
  for (const w of m) if (!stop.has(w)) map.set(w, (map.get(w) || 0) + 1);
  return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0, limit).map(([term,count])=>({term,count}));
}
function createFolderIntelReport(args = {}) {
  const index = JSON.parse(fs.readFileSync(assertReadable(args.indexPath), 'utf8'));
  const id = safeId('folder_intel');
  const dir = assertWritable(path.join(resultsDir, id));
  fs.mkdirSync(dir, { recursive: true });
  const extCounts = {};
  const fileReports = [];
  let combinedForTerms = '';
  let processedFiles = 0;
  let processedChunks = 0;
  for (const f of index.files || []) {
    extCounts[f.ext || ''] = (extCounts[f.ext || ''] || 0) + 1;
    const chunks = [];
    let full = '';
    for (const ch of f.chunks || []) {
      const t = fs.readFileSync(assertReadable(ch.path), 'utf8');
      full += t + '\n';
      processedChunks++;
    }
    if (full) combinedForTerms += '\n' + full.slice(0, 20000);
    const headings = (full.match(/^\s{0,3}#{1,6}\s+.+$/gmi) || []).slice(0, 50);
    const lines = full.split(/\n/).filter(x=>x.trim()).length;
    fileReports.push({ index: f.index, rel: f.rel, size: f.size, ext: f.ext, sha256: f.sha256, readStatus: f.readStatus, chunks: (f.chunks||[]).length, nonEmptyLines: lines, headings, snippet: fileSnippet(full, Number(args.snippetChars || 2500)) });
    processedFiles++;
  }
  const topTerms = topTermsFromText(combinedForTerms, 80);
  const report = { id, createdAt: new Date().toISOString(), sourceIndexPath: args.indexPath, root: index.root, fileCount: index.files.length, processedFiles, processedChunks, textFileCount: index.textFileCount, binaryFileCount: index.binaryFileCount, totalChunks: index.totalChunks, bytesRead: index.bytesRead, extCounts, topTerms, fileReports };
  const jsonPath = path.join(dir, 'folder_intel_report.json');
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  const md = ['# Folder intelligence report', '', `Root: ${report.root}`, `Files: ${report.fileCount}`, `Processed files: ${processedFiles}`, `Text chunks: ${processedChunks}`, `Bytes read: ${report.bytesRead}`, '', '## Extensions', ''];
  for (const [k,v] of Object.entries(extCounts).sort()) md.push(`- ${k || '[none]'}: ${v}`);
  md.push('', '## Top terms', '', topTerms.map(x=>`${x.term}(${x.count})`).join(', '), '', '## Files');
  for (const f of fileReports) {
    md.push('', `### [${f.index}] ${f.rel}`, `size=${f.size} chunks=${f.chunks} status=${f.readStatus} sha256=${f.sha256}`);
    if (f.headings.length) md.push('Headings:', ...f.headings.map(h=>`- ${h}`));
    if (f.snippet) md.push('', 'Snippet:', '```text', f.snippet, '```');
  }
  const mdPath = path.join(dir, 'folder_intel_report.md');
  fs.writeFileSync(mdPath, md.join('\n'), 'utf8');
  return { reportId: id, jsonPath, mdPath, processedFiles, processedChunks, topTerms: topTerms.slice(0,20) };
}
'''
if 'function discoverReadableRoots()' not in txt:
    txt = txt.replace('function listTools() { return [', helper + '\nfunction listTools() { return [')
helper2 = r'''
function createFableFolderSummaryFile(args = {}) {
  const bundle = args.indexPath ? null : createReadOnlyFolderContentBundle(args);
  const indexPath = args.indexPath || bundle.indexPath;
  const intel = args.intelReportPath ? { mdPath: args.intelReportPath } : createFolderIntelReport({ indexPath, snippetChars: args.snippetChars || 2500 });
  const id = safeId('fable_folder_summary');
  const promptPath = assertWritable(path.join(resultsDir, `${id}_prompt.md`));
  const prompt = [`ASK_FABLE5 - Folder summary from read-only bridge`, `-NoMap`, ``, `You are reviewing a complete read-only folder bridge package.`, `Do not request or suggest changing the source folder.`, `The connector has already read all files read-only, created full text chunks, hash-verified binaries, and prepared an intelligence report.`, ``, `Content index path: ${indexPath}`, `Intel report path: ${intel.mdPath}`, ``, `Task: read the provided intel report path and produce a practical summary:`, `1. What this folder is about.`, `2. Main file groups and topics.`, `3. Important scripts/reports/data artifacts.`, `4. TradingView/indicator/research conclusions visible from the files.`, `5. What should be inspected next using chunk search/read tools.`, ``, `Return a clear Russian summary. Mention if more detailed per-file analysis requires reading specific chunk paths from content_index.`].join('\n');
  fs.writeFileSync(promptPath, prompt, 'utf8');
  const run = runFablePromptFile(promptPath, args.maxOutputChars || 250000);
  const summaryPath = assertWritable(path.join(resultsDir, `${id}_FABLE_SUMMARY.txt`));
  let full = '';
  try { full = JSON.parse(fs.readFileSync(run.resultPath, 'utf8')).stdout || ''; } catch { full = JSON.stringify(run); }
  fs.writeFileSync(summaryPath, full, 'utf8');
  return { summaryId: id, indexPath, intelReportPath: intel.mdPath, promptPath, fableRun: run, summaryPath, summaryBytes: Buffer.byteLength(full) };
}
function receiveTextFile(args = {}) {
  const p = assertReadable(args.path);
  const out = boundedText(p, args.offset || 0, args.limit || CFG.maxSliceBytes || 200000);
  return { path: out.path, size: out.size, offset: out.offset, bytes: out.bytes, text: out.text };
}
'''
if 'function createFableFolderSummaryFile(args' not in txt:
    txt = txt.replace('function listTools() { return [', helper2 + '\nfunction listTools() { return [')
new_tools = r'''
 { name:'discover_readable_roots', title:'Discover readable roots', description:'List drive roots that exist on this computer for read-only bridge use.', inputSchema:{type:'object',properties:{}}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
 { name:'create_folder_intel_report', title:'Create folder intelligence report', description:'Build a local intelligence report from a full read-only folder content bundle.', inputSchema:{type:'object',properties:{indexPath:{type:'string'},snippetChars:{type:'number'}},required:['indexPath']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'create_fable_folder_summary_file', title:'Create Fable folder summary file', description:'Run Fable on a read-only folder intel report and store Fable summary as a text file.', inputSchema:{type:'object',properties:{folderPath:{type:'string'},indexPath:{type:'string'},intelReportPath:{type:'string'},chunkChars:{type:'number'},snippetChars:{type:'number'},maxOutputChars:{type:'number'}},required:[]}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
 { name:'receive_text_file', title:'Receive text file', description:'Read a text file produced by CompanionConnector/Fable by path and bounded offset.', inputSchema:{type:'object',properties:{path:{type:'string'},offset:{type:'number'},limit:{type:'number'}},required:['path']}, outputSchema:{type:'object'}, annotations:{readOnlyHint:true} },
'''
if "name:'create_fable_folder_summary_file'" not in txt:
    txt = txt.replace("{ name:'get_job_status', title:'Get job status'", new_tools + " { name:'get_job_status', title:'Get job status'")
new_calls = r'''
 if (name==='discover_readable_roots') return toolResult({ roots: discoverReadableRoots() });
 if (name==='create_folder_intel_report') return toolResult(createFolderIntelReport(args));
 if (name==='create_fable_folder_summary_file') return toolResult(createFableFolderSummaryFile(args));
 if (name==='receive_text_file') return toolResult(receiveTextFile(args));
'''
if "name==='create_fable_folder_summary_file'" not in txt:
    txt = txt.replace("if (name==='get_job_status')", new_calls + " if (name==='get_job_status')")
txt = txt.replace("version:'8.0.0'", "version:'9.0.0'")
txt = txt.replace("version:'7.0.0'", "version:'9.0.0'")
txt = txt.replace("companion-connector v8 listening", "companion-connector v9 listening")
p.write_text(txt, encoding='utf-8')
print('upgrade_v9.py applied')
