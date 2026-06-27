const BE = 'http://localhost:3001/api/v1';
const DOC = 'cmqqiliff00005avskb2syjbw';
const login = async () => { const r = await fetch(`${BE}/auth/login`, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ email:'admin@tfm.ae', password:'Demo@1234' }) }); const j = await r.json(); return j.access_token || ''; };
let tok = await login();
const trig = await fetch(`${BE}/production/scripton/development/script/${DOC}/regenerate`, { method:'POST', headers:{'content-type':'application/json', authorization:`Bearer ${tok}`}, body: JSON.stringify({ mode:'rewrite' }) });
const tj = await trig.json();
console.log('TRIGGERED rev', tj.revisionId, 'total', tj.total);
const t0 = Date.now();
let planningStart = t0, writingStart = 0, lastPhase = '', lastLAA = 0, falseStallWouldFire = false;
while (true) {
  await new Promise(r => setTimeout(r, 5000));
  let pr = await fetch(`${BE}/production/scripton/development/script-progress/${DOC}`, { headers:{ authorization:`Bearer ${tok}` } });
  if (pr.status === 401) { tok = await login(); continue; }
  const d = await pr.json().catch(()=>({}));
  const el = Math.round((Date.now()-t0)/1000);
  if (d.phase !== lastPhase) { console.log(`[${el}s] phase → ${d.phase} | done ${d.done||0}/${d.total||'?'} | pages ${d.pageCount||0}`); if (d.phase === 'WRITING' && !writingStart) writingStart = Date.now(); lastPhase = d.phase; }
  // would the OLD 240s no-new-pages guard have fired during planning? (done stuck at 0 for >240s)
  if ((d.phase === 'PLANNING') && (Date.now()-planningStart > 240000)) falseStallWouldFire = true;
  if ((d.done||0) % 10 === 0 && (d.done||0) > 0 && (d.lastActivityAt||0) !== lastLAA) { console.log(`[${el}s] writing ${d.done}/${d.total} | pages ${d.pageCount}`); }
  lastLAA = d.lastActivityAt || 0;
  if (d.status === 'DONE') { console.log(`[${el}s] DONE | scenes(done) ${d.done} | pages ${d.pageCount} | note: ${d.coverageNote||''}`); console.log(`planning≈${writingStart?Math.round((writingStart-t0)/1000):'?'}s | original-240s-guard-would-false-fire: ${falseStallWouldFire}`); break; }
  if (d.status === 'ERROR') { console.log(`[${el}s] ERROR: ${d.error}`); break; }
  if (el > 1800) { console.log('timeout 30min'); break; }
}
