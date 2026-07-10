from pathlib import Path
p = Path('src/server.js')
txt = p.read_text(encoding='utf-8')
helper = r'''
function createGroundedFableFolderSummaryFile(args = {}) {
  const bundle = args.indexPath ? null : createReadOnlyFolderContentBundle(args);
  const indexPath = args.indexPath || bundle.indexPath;
  const idx = JSON.parse(fs.readFileSync(assertReadable(indexPath), 'utf8'));
  const extCounts = {};
  const roots = {};
  for (const f of idx.files || []) {
    extCounts[f.ext || '[none]'] = (extCounts[f.ext || '[none]'] || 0) + 1;
    const top = f.rel.includes('/') ? f.rel.split('/')[0] : '[root]';
    roots[top] = (roots[top] || 0) + 1;
  }
  const id = safeId('grounded_fable_summary');
  const promptPath = assertWritable(path.join(resultsDir, `${id}_prompt.md`));
  const lines = ['ASK_FABLE5 - Grounded folder summary', '-NoMap', '', 'STRICT RULES: Use only facts listed in this prompt. Do not invent file names, folders, indicators, scripts, or conclusions. If a detail is not visible, say it is not visible in this compact index. Return Russian summary.', '', `Root: ${idx.root}`, `Files: ${idx.files.length}`, `Text files: ${idx.textFileCount}`, `Binary files: ${idx.binaryFileCount}`, `Chunks: ${idx.totalChunks}`, `Bytes read: ${idx.bytesRead}`, '', 'Extensions:'];
  Object.entries(extCounts).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>lines.push(`- ${k}: ${v}`));
  lines.push('', 'Top-level groups:');
  Object.entries(roots).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>lines.push(`- ${k}: ${v}`));
  lines.push('', 'All file paths from the read-only index:');
  for (const f of idx.files || []) lines.push(`- [${f.index}] ${f.rel} | ext=${f.ext||''} | size=${f.size} | chunks=${(f.chunks||[]).length} | status=${f.readStatus}`);
  fs.writeFileSync(promptPath, lines.join('\n'), 'utf8');
  const run = runFablePromptFile(promptPath, args.maxOutputChars || 200000);
  const summaryPath = assertWritable(path.join(resultsDir, `${id}_FABLE_GROUNDED_SUMMARY.txt`));
  let full = '';
  try { full = JSON.parse(fs.readFileSync(run.resultPath, 'utf8')).stdout || ''; } catch { full = JSON.stringify(run); }
  fs.writeFileSync(summaryPath, full, 'utf8');
  return { summaryId: id, indexPath, promptPath, fableRun: run, summaryPath, summaryBytes: Buffer.byteLength(full) };
}
'''
if 'function createGroundedFableFolderSummaryFile(args' not in txt:
    txt = txt.replace('function listTools() { return [', helper + '\nfunction listTools() { return [')
new_tool = r'''
 { name:'create_grounded_fable_folder_summary_file', title:'Create grounded Fable folder summary file', description:'Create a grounded Fable summary using inline counts and all file paths from the read-only folder index.', inputSchema:{type:'object',properties:{folderPath:{type:'string'},indexPath:{type:'string'},chunkChars:{type:'number'},maxOutputChars:{type:'number'}},required:[]}, outputSchema:{type:'object'}, annotations:{readOnlyHint:false} },
'''
if "name:'create_grounded_fable_folder_summary_file'" not in txt:
    txt = txt.replace("{ name:'get_job_status', title:'Get job status'", new_tool + " { name:'get_job_status', title:'Get job status'")
new_call = r'''
 if (name==='create_grounded_fable_folder_summary_file') return toolResult(createGroundedFableFolderSummaryFile(args));
'''
if "name==='create_grounded_fable_folder_summary_file'" not in txt:
    txt = txt.replace("if (name==='get_job_status')", new_call + " if (name==='get_job_status')")
p.write_text(txt, encoding='utf-8')
print('upgrade_v9_grounded applied')
