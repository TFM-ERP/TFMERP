// Durable-shell proof: every ScriptON route renders the ONE ScriptonShell. Per route asserts
// (a) chrome identical — rail bbox + flat full-width .sxtb; (b) the route's distinctive BODY
// element exists (catches "screen gone"); (c) correct active rail item; (d) 0 console errors.
// Covers BOTH Build sub-states (?tab=builds list + ?build= open). Room via team-mode override.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const FRONTEND = process.env.FRONTEND || 'http://localhost:3000';
const BACKEND = process.env.BACKEND || 'http://localhost:3001/api/v1';
const BUILD = 'cmqqg05hb00055aywmsdhaycm';
const res = await fetch(BACKEND + '/auth/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email:'admin@tfm.ae', password:'Demo@1234' }) });
const { access_token, user } = await res.json();
writeFileSync('scripts/verify/.token.json', JSON.stringify({ access_token, user, ts: Date.now() }));

const R = [
  { name:'Home',     route:'/scripton',                  body:'.sx.home .main',   active:'Home' },
  { name:'Write',    route:'/scripton/reader',           body:'.sx.write .main',  active:'Write' },
  { name:'Build·list',route:'/scripton/studio?tab=builds', body:'.bld.embedded .grid', active:'Build' },
  { name:'Build·open',route:'/scripton/studio?build='+BUILD, body:'.sx.develop .dvbody', active:'Build' },
  { name:'Canon',    route:'/scripton/canon',            body:'.sx.canon .main',  active:'Canon' },
  { name:'Doctor',   route:'/scripton/doctor',           body:'.sx.doctor .main', active:'Doctor' },
  { name:'Versions', route:'/scripton/revisions',        body:'.sx.vers .main',   active:'Versions' },
  { name:'Room',     route:'/scripton/notes',            body:'.sx.room .main',   active:'Room' },
  { name:'Slate',    route:'/scripton/library',          body:'.cardgrid',        active:'Slate' },
  { name:'Settings', route:'/scripton/settings',         body:'.sx.studio .main', active:'Studio' },
];
const b = await chromium.launch({ headless:true });
let refRail = null, allOK = true;
console.log('ROUTE         sxtb-flat  rail-bbox                 active        body  errors');
for (const r of R) {
  const ctx = await b.newContext({ viewport:{ width:1440, height:900 } });
  const p = await ctx.newPage();
  const errs=[]; p.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,100));}); p.on('pageerror',e=>errs.push('[pageerror] '+e.message.slice(0,140)));
  await p.addInitScript(({t,u})=>{localStorage.setItem('tfm_token',t);localStorage.setItem('tfm_user',u);localStorage.setItem('scripon.osShell','new');},{t:access_token,u:JSON.stringify(user||{})});
  await p.route('**/production/scripton/workspace', async (route)=>{ const rs=await route.fetch(); let j={}; try{j=await rs.json();}catch{} await route.fulfill({response:rs,json:{...j,mode:'team'}}); });
  let info={};
  try {
    await p.goto(FRONTEND+r.route,{waitUntil:'networkidle',timeout:60000});
    await p.waitForSelector('.sxtb',{timeout:30000}); await p.waitForTimeout(1500);
    info = await p.evaluate((r)=>{ const tb=document.querySelector('.sxtb'); const cs=tb&&getComputedStyle(tb); const bb=tb&&tb.getBoundingClientRect(); const rb=document.querySelector('.rail')?.getBoundingClientRect();
      return { flat: !!tb && cs.borderRadius==='0px' && Math.round(bb.width)===1440 && Math.round(bb.height)===56,
        rail: rb?{x:Math.round(rb.x),y:Math.round(rb.y),w:Math.round(rb.width),h:Math.round(rb.height)}:null,
        active: document.querySelector('.rail .ritem.on .lbl')?.textContent||'-', body: !!document.querySelector(r.body) }; }, r);
  } catch(e){ errs.push('[harness] '+e.message.slice(0,90)); }
  if (!refRail && info.rail) refRail = info.rail;
  const rb=info.rail; const railSame = rb && refRail && rb.x===refRail.x && rb.y===refRail.y && rb.w===refRail.w && rb.h===refRail.h;
  const ok = info.flat && railSame && info.active===r.active && info.body && errs.length===0;
  if (!ok) allOK=false;
  console.log(`${r.name.padEnd(13)} ${String(!!info.flat).padEnd(10)} ${(rb?`x${rb.x} y${rb.y} w${rb.w} h${rb.h}`:'none').padEnd(25)} ${String(info.active).padEnd(13)} ${String(!!info.body).padEnd(5)} ${errs.length?('❌ '+errs[0]):'0'} ${ok?'✅':'❌'}`);
  await ctx.close();
}
await b.close();
console.log('\n'+(allOK?'✅ ALL ROUTES: identical shell, correct active item, body present, 0 errors':'❌ FAILURES ABOVE'));
