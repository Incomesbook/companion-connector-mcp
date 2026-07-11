import http from 'node:http';

const port = Number(process.env.COMPANION_PORT || 8788);
function rpc(method, params = {}) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: Math.floor(Math.random()*1e9), method, params });
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: '/mcp', method: 'POST', headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } }, res => {
      let data=''; res.on('data', c => data+=c); res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject); req.end(body);
  });
}
function unwrap(x){ if(x.error) throw new Error(JSON.stringify(x)); return x.result.structuredContent || x.result; }
async function tool(name,args={}){ return unwrap(await rpc('tools/call',{name,arguments:args})); }

const proposal = await tool('fable_authority_proposal', { title:'V20 test proposal', context:'Test authority log without running Fable.', runFable:false, decidedBy:'Fable5' });
const disagreement = await tool('fable_authority_disagreement', { previousId: proposal.record.id, reason:'test disagreement record only', myPosition:'test', fablePosition:'test', reAsk:false, decidedBy:'ChatGPT' });
const dry = await tool('fable_autopilot_dry_run', { sessionId:'v20_authority_test', task:'dry run only', monitor:1, maxActions:1, planJson:{summary:'dry run plan',confidence:1,actions:[{type:'none',reason:'test dry run'}],needsUser:false,risk:'low'}, decidedBy:'Fable5' });
const dash = await tool('fable_authority_dashboard', { limit:200, decidedBy:'Fable5' });
const log = await tool('fable_authority_decision_log', { limit:20, decidedBy:'Fable5' });
console.log(JSON.stringify({ ok: proposal.ok && disagreement.ok && dry.ok && dash.ok && log.records.length>0, proposalStatus: proposal.status, disagreementId: disagreement.record.id, cyclePath: dry.cyclePath, dashboard: dash.htmlPath, records: log.records.length, byDecider: dash.byDecider }, null, 2));
