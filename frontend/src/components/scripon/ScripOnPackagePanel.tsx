'use client';
import { useEffect, useRef, useState } from 'react';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

/** Coverage package — role types, world/look boards, honest market read, living notes.
 *  Folded into the Doctor as a surface overlay (was the standalone /scripon/package). No performers, no faces. */
const CSS = `
.pkg{--bg:#0b0c0f;--panel:#14161c;--hair:rgba(255,255,255,.07);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--green:#57b368;--amber:#e0a23b;background:radial-gradient(1200px 600px at 50% -8%,#15171d,#0b0c0f 60%);min-height:100vh;color:var(--text);font-family:var(--sx-body)}
.pkg *{box-sizing:border-box}
.pkg .scr{display:flex;flex-direction:column;height:100vh;position:relative}
.pkg .ico{width:18px;height:18px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.pkg .top{height:60px;flex:0 0 60px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:linear-gradient(180deg,#15181e,#121419);border-bottom:1px solid var(--hair)}
.pkg .tl{display:flex;align-items:center;gap:12px}.pkg .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;cursor:pointer}
.pkg .proj{font-weight:700;font-size:15.5px;color:var(--cream)}.pkg .meta{color:var(--faint);font-size:12px}
.pkg .btn{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;color:var(--goldink);background:linear-gradient(180deg,var(--gold2),var(--gold));font-weight:700}.pkg .btn .ico{width:15px;height:15px}
.pkg .btn.ghost{background:#1b1e25;border:1px solid var(--hair);color:var(--mute)}
.pkg .body{flex:1;display:flex;min-height:0}
.pkg .main{flex:1;min-width:0;display:flex;flex-direction:column;padding:20px 26px;gap:14px}
.pkg .phead{display:flex;align-items:flex-end;justify-content:space-between}.pkg .phead h1{font-size:23px;font-weight:800;color:var(--cream)}.pkg .phead .sub{font-size:12.5px;color:var(--mute);margin-top:3px}.pkg .eyebrow{font-size:10px;font-weight:700;letter-spacing:1.1px;color:var(--gold)}
.pkg .grid{flex:1;display:grid;grid-template-columns:1.45fr 1fr;gap:16px;min-height:0;overflow:auto}
.pkg .col{display:flex;flex-direction:column;gap:14px}
.pkg .card{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:15px 16px;display:flex;flex-direction:column;gap:11px}
.pkg .ch{display:flex;align-items:center;justify-content:space-between}.pkg .ch .t{font-size:13px;font-weight:700;color:var(--cream)}
.pkg .role{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--hair)}.pkg .role:first-of-type{border-top:none}
.pkg .rin{width:38px;height:38px;border-radius:10px;flex:none;display:grid;place-items:center;font-weight:800;font-size:15px;color:#0b0c0f}
.pkg .rnm{font-size:13.5px;font-weight:700;color:var(--cream)}.pkg .rmt{font-size:10.5px;color:var(--faint);margin-top:1px}.pkg .rds{font-size:11.5px;color:var(--mute);margin-top:3px}
.pkg .rpc{margin-left:auto;text-align:right}.pkg .rpc .n{font-size:17px;font-weight:800;color:var(--gold2)}.pkg .rpc .l{font-size:8.5px;color:var(--faint)}
.pkg .boards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.pkg .board{border-radius:11px;height:96px;position:relative;overflow:hidden;border:1px solid var(--hair)}.pkg .board .bc{position:absolute;left:0;right:0;bottom:0;padding:8px 9px;background:linear-gradient(0deg,rgba(8,9,12,.85),transparent)}.pkg .bk{font-size:8px;font-weight:800;letter-spacing:.6px;color:rgba(255,255,255,.8)}.pkg .bt{font-size:10.5px;font-weight:600;color:#fff;margin-top:1px}.pkg .rf{position:absolute;top:6px;right:7px;font-size:7.5px;font-family:"Courier Prime",monospace;color:rgba(255,255,255,.6)}
.pkg .note{font-size:10px;color:var(--faint);font-style:italic}
.pkg table{width:100%;border-collapse:collapse;font-size:11px}.pkg th{text-align:left;font-size:8.5px;letter-spacing:.4px;color:var(--faint);text-transform:uppercase;padding:5px 6px;border-bottom:1px solid var(--hair)}.pkg td{padding:6px;border-bottom:1px solid var(--hair);color:var(--mute)}.pkg td b{color:var(--text)}
.pkg .quad{display:grid;grid-template-columns:1fr 1fr;gap:5px}.pkg .qc{border:1px solid var(--hair);border-radius:7px;padding:6px 8px;background:#15181e;font-size:10px}.pkg .ql{color:var(--faint)}.pkg .qv{font-weight:800;margin-top:1px}
.pkg .ranges{display:flex;gap:8px}.pkg .rg{flex:1;border:1px solid var(--hair);border-radius:9px;padding:8px;background:#15181e;text-align:center}.pkg .rgl{font-size:8.5px;font-weight:700;color:var(--faint)}.pkg .rgv{font-size:16px;font-weight:800;color:var(--cream);margin-top:2px}
.pkg .disc{font-size:9.5px;color:var(--faint);font-style:italic}
.pkg .tile{display:flex;align-items:center;gap:10px;background:#171a20;border:1px solid var(--hair);border-radius:10px;padding:10px 12px;cursor:pointer}.pkg .tile:hover{border-color:rgba(198,164,99,.4)}.pkg .ti{width:28px;height:28px;border-radius:8px;background:rgba(198,164,99,.14);color:var(--gold2);display:grid;place-items:center;flex:none}.pkg .ti .ico{width:15px;height:15px}.pkg .tt{font-size:12.5px;font-weight:600;color:var(--cream)}.pkg .ts{font-size:10px;color:var(--faint)}.pkg .go{margin-left:auto;color:var(--faint)}
.pkg .nstat{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--mute)}
.pkg .toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0e1014;border:1px solid rgba(198,164,99,.4);color:var(--gold2);font-size:12.5px;padding:10px 16px;border-radius:10px;z-index:90}
@media(max-width:1100px){.pkg .grid{grid-template-columns:1fr}}
@media(max-width:760px){.pkg .boards{grid-template-columns:repeat(2,1fr)}.pkg .main{padding:16px}}
`;
const RIN_BG = ['linear-gradient(150deg,#d8b465,#a07f37)', 'linear-gradient(150deg,#5b8def,#3f5e9e)', 'linear-gradient(150deg,#8b7cf0,#5d4fb0)', 'linear-gradient(150deg,#57b368,#2c5638)'];
const BOARD_BG = ['linear-gradient(150deg,#2a3550,#0f1622)', 'linear-gradient(150deg,#3a2330,#161019)', 'linear-gradient(150deg,#332c1c,#15120a)', 'linear-gradient(150deg,#1f3329,#0f1713)', 'linear-gradient(150deg,#26283a,#111018)', 'linear-gradient(150deg,#3a2a22,#16100c)'];
const SAMPLE = {
  roles: [{ role: 'SARAH', importance: 'LEAD', ageRange: '30s', gender: 'Female', physicality: 'Coiled, watchful; wary warmth.', scenesPct: 92 }, { role: 'RILEY', importance: 'SUPPORTING', ageRange: '40s', gender: 'Male', physicality: 'Steady, principled foil.', scenesPct: 54 }, { role: 'THE BROKER', importance: 'SUPPORTING', ageRange: '50s', gender: 'Male', physicality: 'Genial menace.', scenesPct: 19 }],
  boards: [{ kind: 'LOCATION', caption: 'Rain-slick downtown' }, { kind: 'MOOD', caption: 'Neon on wet asphalt' }, { kind: 'PALETTE', caption: 'Amber vs cold blue' }, { kind: 'LOCATION', caption: 'Empty parking decks' }, { kind: 'ERA', caption: 'Present-day metropolis' }, { kind: 'MOOD', caption: 'Back-rooms at 3am' }],
  comps: [{ title: 'Nightcrawler', year: 2014, budgetTier: '$8.5M', rationale: 'closest tone+budget' }, { title: 'Drive', year: 2011, budgetTier: '$15M', rationale: 'style-forward, legs' }, { title: 'Good Time', year: 2017, budgetTier: '$2M', rationale: 'micro tonal sibling' }],
  market: { quadrant: { maleUnder25: 'HIGH', maleOver25: 'HIGH', femaleUnder25: 'MEDIUM', femaleOver25: 'MEDIUM' }, ranges: { low: '$6M', mid: '$28M', high: '$70M' }, confidence: 'MEDIUM' },
};

export default function ScripOnPackagePanel({ projectId, onClose }: { projectId: string | null; onClose: () => void }) {
  const { dir, t } = useLocale();
  const [data, setData] = useState<any | null>(null);
  const [noteCount, setNoteCount] = useState<number | null>(null);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const tt = useRef<any>(null);
  const flash = (m: string) => { setToast(m); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(null), 3200); };

  const load = async (pid: string) => { try { const r: any = await productionApi.scripton.lookbookData(pid); setData(r.data || {}); } catch { setData({}); } try { const n: any = await productionApi.scripton.notes(pid); setNoteCount(Array.isArray(n.data) ? n.data.length : 0); } catch { /* */ } };
  useEffect(() => { if (projectId) void load(projectId); }, [projectId]);

  const gen = async (kind: string) => {
    if (!projectId) { flash(t('Connect a project with a script first.')); return; }
    setBusy(kind); flash(t('Generating') + ' ' + kind + '…');
    try {
      if (kind === 'roles') await productionApi.scripton.roleProfiles(projectId);
      else if (kind === 'boards') await productionApi.scripton.lookboard(projectId);
      else if (kind === 'market') await productionApi.scripton.marketRead(projectId);
      await load(projectId); flash(t('Done.'));
    } catch (e: any) { flash(e?.response?.data?.message || t('Failed - needs the backend + an AI key.')); }
    finally { setBusy(''); }
  };
  const exportLookbook = () => { if (!projectId) { flash(t('Connect a project first.')); return; } window.open('/print/lookbook?projectId=' + projectId, '_blank'); };

  const live = !!(data && ((data.roles || []).length || (data.boards || []).length || data.market));
  const roles = (data?.roles && data.roles.length) ? data.roles : SAMPLE.roles;
  const boards = (data?.boards && data.boards.length) ? data.boards : SAMPLE.boards;
  const comps = (data?.comps && data.comps.length) ? data.comps : SAMPLE.comps;
  const market = data?.market || SAMPLE.market; const quad = market.quadrant || {}; const ranges = market.ranges || {};
  const qc = (l: string, v: any) => { const s = String(v || '—').toUpperCase(); const clr = s === 'HIGH' ? 'var(--green)' : s.indexOf('MED') === 0 ? 'var(--amber)' : 'var(--mute)'; return (<div className="qc"><div className="ql">{l}</div><div className="qv" style={{ color: clr }}>{s}</div></div>); };

  return (
    <div className="pkg" dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 80, overflow: 'auto' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="scr">
        <div className="top"><div className="tl"><div className="logo" onClick={onClose} title={t('Close')}>TFM</div><div className="proj">{t('Coverage package')}</div><span className="meta">{live ? t('live') : t('demo')} · {t('no performers')}</span></div><div style={{ display: 'flex', gap: 8 }}><div className="btn" onClick={exportLookbook}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>{t('Assemble lookbook PDF')}</div><div className="btn ghost" onClick={onClose}>{t('Close')}</div></div></div>
        <div className="body">
          <div className="main">
            <div className="phead"><div><h1>{t('Coverage package')}</h1><div className="sub">{t('Character types, world boards and an honest market read — no performers, no faces — assembled for the lookbook.')}</div></div><div className="eyebrow">{t('NO PERFORMERS · LICENSED ON EXPORT')}</div></div>
            <div className="grid">
              <div className="col">
                <div className="card">
                  <div className="ch"><span className="t">{t('Character types')}</span><span className="eyebrow">{t('NO PERFORMERS · SCENES-%')}</span></div>
                  {roles.slice(0, 5).map((r: any, i: number) => (<div key={i} className="role"><div className="rin" style={{ background: RIN_BG[i % RIN_BG.length] }}>{String(r.role || 'R').charAt(0)}</div><div><div className="rnm">{r.role}</div><div className="rmt">{[r.importance, r.ageRange, r.gender].filter(Boolean).join(' · ')}</div><div className="rds">{r.physicality || r.arc || ''}</div></div><div className="rpc"><div className="n">{r.scenesPct != null ? r.scenesPct + '%' : '—'}</div><div className="l">{t('SCENES')}</div></div></div>))}
                </div>
                <div className="card">
                  <div className="ch"><span className="t">{t('World & look boards')}</span><span className="eyebrow">{t('NO FACES · PLAN')}</span></div>
                  <div className="boards">{boards.slice(0, 6).map((b: any, i: number) => (<div key={i} className="board" style={{ background: BOARD_BG[i % BOARD_BG.length] }}><span className="rf">REF</span><div className="bc"><div className="bk">{b.kind || 'MOOD'}</div><div className="bt">{b.caption || ''}</div></div></div>))}</div>
                  <div className="note">{t('Plan only — images bound to licensed sources (Unsplash · Pexels · Wikimedia) on export. No faces.')}</div>
                </div>
              </div>
              <div className="col">
                <div className="card">
                  <div className="ch"><span className="t">{t('Market read')}</span><span className="eyebrow">{t('HONEST · ESTIMATES')}</span></div>
                  <table><tbody><tr><th>{t('Comp')}</th><th>{t('Yr')}</th><th>{t('Tier')}</th><th>{t('Note')}</th></tr>{comps.slice(0, 4).map((c: any, i: number) => (<tr key={i}><td><b>{c.title || c.name}</b></td><td>{c.year || ''}</td><td>{c.budgetTier || ''}</td><td>{c.rationale || c.reason || (c.metrics && c.metrics.metric) || ''}</td></tr>))}</tbody></table>
                  <div className="quad">{qc(t('Male <25'), quad.maleUnder25)}{qc(t('Male 25+'), quad.maleOver25)}{qc(t('Female <25'), quad.femaleUnder25)}{qc(t('Female 25+'), quad.femaleOver25)}</div>
                  <div className="ranges"><div className="rg"><div className="rgl">P10</div><div className="rgv">{ranges.low || '—'}</div></div><div className="rg"><div className="rgl">P50</div><div className="rgv">{ranges.mid || '—'}</div></div><div className="rg"><div className="rgl">P90</div><div className="rgv">{ranges.high || '—'}</div></div></div>
                  <div className="disc">{t('Confidence')} {market.confidence || '—'} · {t('comps by theme + budget band, not plot · no guarantee.')}</div>
                </div>
                <div className="card">
                  <div className="ch"><span className="t">{t('Generate')}</span><span className="eyebrow">{t('ON THIS SCRIPT')}</span></div>
                  <div className="tile" onClick={() => gen('roles')}><div className="ti"><svg className="ico" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></svg></div><div><div className="tt">{t('Role types')}</div><div className="ts">{t('character briefs · no performers')}</div></div><span className="go">{busy === 'roles' ? '…' : '↻'}</span></div>
                  <div className="tile" onClick={() => gen('boards')}><div className="ti"><svg className="ico" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 14l5-5 4 4 3-3 6 6" /></svg></div><div><div className="tt">{t('Look-board plan')}</div><div className="ts">{t('world · location · palette')}</div></div><span className="go">{busy === 'boards' ? '…' : '↻'}</span></div>
                  <div className="tile" onClick={() => gen('market')}><div className="ti"><svg className="ico" viewBox="0 0 24 24"><path d="M3 3v18h18M7 14l3-3 3 3 5-6" /></svg></div><div><div className="tt">{t('Market read')}</div><div className="ts">{t('comps · quadrant · ranges')}</div></div><span className="go">{busy === 'market' ? '…' : '↻'}</span></div>
                </div>
                <div className="card">
                  <div className="ch"><span className="t">{t('Living notes')}</span><span className="eyebrow">{t('SCENE-ANCHORED')}</span></div>
                  <div className="nstat"><span>{noteCount != null ? noteCount : '—'} {t('notes across the script')}</span></div>
                  <div className="note">{t('Anchored to durable scene IDs — survive rewrites; flagged stale when their scene changes. Manage in the Doctor coverage view.')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}
