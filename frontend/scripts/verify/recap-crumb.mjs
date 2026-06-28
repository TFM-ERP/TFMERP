// Verify the script cluster: Home/Slate/Builds (non-script) show NO crumb/ring/V (search·avatars·share
// stay); script screens show the script name. Also checks the rail reads "Settings" and Settings renders.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const FRONTEND='http://localhost:3000', BACKEND='http://localhost:3001/api/v1', BUILD='cmqqg05hb00055aywmsdhaycm';
const res = await fetch(BACKEND+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'admin@tfm.ae',password:'Demo@1234'})});
const { access_token, user } = await res.json();
writeFileSync('scripts/verify/.token.json', JSON.stringify({access_token,user,ts:Date.now()}));
const R = [
  { name:'Home',      route:'/scripton',                   scoped:false },
  { name:'Slate',     route:'/scripton/library',           scoped:false },
  { name:'Build·list',route:'/scripton/studio?tab=builds', scoped:false },
  { name:'Build·open',route:'/scripton/studio?build='+BUILD, scoped:true },
  { name:'Canon',     route:'/scripton/canon',             scoped:true },
  { name:'Doctor',    route:'/scripton/doctor',            scoped:true },
  { name:'Versions',  route:'/scripton/revisions',         scoped:true },
  { name:'Room',      route:'/scripton/notes',             scoped:true },
  { name:'Write',     route:'/scripton/reader',            scoped:true },
];
const b = await chromium.launch({ headless:true });
let allOK=true;
console.log('ROUTE        crumb            ring  V    search avatars  expect    ok');
for (const r of R) {
  const ctx = await b.newContext({ viewport:{width:1440,height:900} });
  const p = await ctx.newPage(); const errs=[];
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,80));}); p.on('pageerror',e=>errs.push('pe:'+e.message.slice(0,80)));
  await p.addInitScript(({t,u})=>{localStorage.setItem('tfm_token',t);localStorage.setItem('tfm_user',u);localStorage.setItem('scripon.osShell','new');},{t:access_token,u:JSON.stringify(user||{})});
  await p.route('**/production/scripton/workspace', async(rt)=>{const rs=await rt.fetch();let j={};try{j=await rs.json();}catch{}await rt.fulfill({response:rs,json:{...j,mode:'team'}});});
  let info={};
  try{ await p.goto(FRONTEND+r.route,{waitUntil:'networkidle',timeout:60000}); await p.waitForSelector('.sxtb',{timeout:30000}); await p.waitForTimeout(2200);
    info = await p.evaluate(()=>({ crumb:(document.querySelector('.sxtb .crumb')?.textContent||'').trim(), ring:!!document.querySelector('.sxtb .ring'), v:!!document.querySelector('.sxtb .vsw'), search:!!document.querySelector('.sxtb .search, .sxtb .sicon'), avatars:!!document.querySelector('.sxtb .avs'), share:!!document.querySelector('.sxtb .share') }));
  }catch(e){ errs.push('h:'+e.message.slice(0,60)); }
  const hasCrumb = !!info.crumb;
  const ok = r.scoped
    ? (hasCrumb && info.share && info.avatars && errs.length===0)            // script: crumb present
    : (!hasCrumb && !info.ring && !info.v && info.share && info.avatars && errs.length===0); // non-script: cluster hidden, keep avatars/share
  if(!ok) allOK=false;
  console.log(`${r.name.padEnd(12)} ${(info.crumb||'—').padEnd(16)} ${String(!!info.ring).padEnd(5)} ${String(!!info.v).padEnd(4)} ${String(!!info.search).padEnd(6)} ${String(!!info.avatars).padEnd(8)} ${(r.scoped?'has-crumb':'no-cluster').padEnd(9)} ${ok?'✅':'❌'}${errs.length?' '+errs[0]:''}`);
  await ctx.close();
}
// rail label + settings renders
const ctx = await b.newContext({ viewport:{width:1440,height:900} }); const p = await ctx.newPage();
await p.addInitScript(({t,u})=>{localStorage.setItem('tfm_token',t);localStorage.setItem('tfm_user',u);localStorage.setItem('scripon.osShell','new');},{t:access_token,u:JSON.stringify(user||{})});
await p.goto(FRONTEND+'/scripton/settings',{waitUntil:'networkidle',timeout:60000}); await p.waitForSelector('.rail',{timeout:30000}); await p.waitForTimeout(1500);
const x = await p.evaluate(()=>({ labels:[...document.querySelectorAll('.rail .ritem .lbl')].map(e=>e.textContent), hasStudio:!!document.querySelector('.rail .ritem.on'), settingsBody:!!document.querySelector('.sx.studio .main'), active:document.querySelector('.rail .ritem.on .lbl')?.textContent }));
const railSettings = x.labels.includes('Settings') && !x.labels.includes('Studio');
console.log(`\nrail labels: ${x.labels.join(', ')}`);
console.log(`rail reads "Settings" (not "Studio"): ${railSettings?'✅':'❌'}  |  /scripton/settings body renders: ${x.settingsBody?'✅':'❌'}  |  active: ${x.active}`);
await b.close();
console.log('\n'+((allOK&&railSettings&&x.settingsBody)?'✅ ALL CRUMB/CLUSTER/RENAME CHECKS PASS':'❌ FAILURES'));
