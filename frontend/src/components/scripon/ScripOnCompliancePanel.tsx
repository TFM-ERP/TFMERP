'use client';
/** ScripON Doctor — Rating & Compliance (P3). Dark overlay; scripton.rating + cultureScreen. Estimates only — boards decide. */
import React, { useEffect, useRef, useState } from 'react';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

const LVL: Record<string, string> = { none: '#6b727d', mild: '#57b368', moderate: '#e0a23b', strong: '#e5635f' };
const SEV: Record<string, string> = { low: '#57b368', med: '#e0a23b', high: '#e5635f' };
const MARKETS = ['GCC / MENA', 'Saudi Arabia (GCAM)', 'UAE', 'United States', 'United Kingdom', 'India (CBFC)', 'China', 'Global'];

const CSS = `
.sxc{position:fixed;inset:0;z-index:120;font-family:var(--sx-body)}
.sxc *{box-sizing:border-box;margin:0;padding:0}
.sxc .scrim{position:absolute;inset:0;background:rgba(7,8,11,.66);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:28px}
.sxc .panel{width:780px;max-width:96vw;max-height:88vh;overflow:auto;background:linear-gradient(180deg,#16181f,#121419);border:1px solid rgba(255,255,255,.13);border-radius:16px;box-shadow:0 40px 100px -20px rgba(0,0,0,.85);color:#E8E6E0}
.sxc .ph{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.07)}
.sxc .pt{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:700;color:#F4EEE0}.sxc .pt .i{width:28px;height:28px;border-radius:8px;background:rgba(198,164,99,.14);display:grid;place-items:center;color:#E6D2A2}
.sxc svg{display:block;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sxc .x{width:30px;height:30px;border-radius:8px;border:1px solid rgba(255,255,255,.07);background:#1b1e25;color:#9aa1ab;cursor:pointer;display:grid;place-items:center}
.sxc .tabs{display:flex;gap:7px;padding:12px 18px 0}
.sxc .tab{padding:8px 14px;border-radius:10px;font-size:12.5px;font-weight:600;color:#9aa1ab;background:#171a20;border:1px solid rgba(255,255,255,.07);cursor:pointer}.sxc .tab.on{background:rgba(198,164,99,.14);border-color:rgba(198,164,99,.45);color:#E6D2A2}
.sxc .bd{padding:14px 18px 18px;display:flex;flex-direction:column;gap:12px}
.sxc .row{display:flex;align-items:flex-end;gap:9px}
.sxc label{font-size:11px;color:#9aa1ab;display:flex;flex-direction:column;gap:4px;flex:1}
.sxc input,.sxc select{height:34px;border-radius:9px;background:#1a1d24;border:1px solid rgba(255,255,255,.07);color:#E8E6E0;padding:0 11px;font:inherit;font-size:12.5px;outline:none}
.sxc .btn{height:36px;padding:0 16px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:none;background:linear-gradient(180deg,#E6D2A2,#C6A463);color:#1a1509}.sxc .btn.dis{opacity:.55;cursor:default}
.sxc .eyebrow{font-size:10.5px;font-weight:700;letter-spacing:1.2px;color:#C6A463}
.sxc .ests{display:grid;grid-template-columns:1fr 1fr;gap:9px}
.sxc .est{background:#14161c;border:1px solid rgba(255,255,255,.07);border-radius:11px;padding:11px 13px}.sxc .estb{font-size:10.5px;color:#6b727d;font-weight:700}.sxc .estc{font-size:18px;font-weight:800;color:#F4EEE0;margin-top:3px}.sxc .estw{font-size:11px;color:#9aa1ab;margin-top:4px;line-height:1.4}
.sxc .drow{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid rgba(255,255,255,.06);font-size:12.5px}.sxc .drow:first-of-type{border-top:none}
.sxc .dl{flex:1;color:#E8E6E0}.sxc .de{font-size:11px;color:#6b727d}
.sxc .pillv{font-size:10px;font-weight:800;text-transform:uppercase;padding:3px 9px;border-radius:999px}
.sxc .flag{background:#14161c;border:1px solid rgba(255,255,255,.07);border-radius:11px;padding:12px 13px;border-inline-start:3px solid #e0a23b}
.sxc .fh{display:flex;align-items:center;gap:8px;margin-bottom:5px}.sxc .ft{font-size:12.5px;font-weight:700;color:#F4EEE0}.sxc .fi{font-size:12px;color:#cdd3da;line-height:1.45}.sxc .fs{font-size:11.5px;color:#9aa1ab;margin-top:5px;line-height:1.45}.sxc .fs b{color:#E6D2A2}
.sxc .empty{font-size:12.5px;color:#6b727d;border:1px dashed rgba(255,255,255,.13);border-radius:12px;padding:20px 16px;text-align:center;line-height:1.6}
.sxc .prog{height:4px;border-radius:4px;background:#23262e;overflow:hidden}.sxc .prog i{display:block;height:100%;background:linear-gradient(90deg,#C6A463,#E6D2A2);transition:width .25s}
.sxc .note{font-size:10.5px;color:#6b727d;text-align:center}
`;

export default function ScripOnCompliancePanel({ projectId, revisionId, onClose }: { projectId: string; revisionId?: string; onClose: () => void }) {
  const { dir, t } = useLocale();
  const [tab, setTab] = useState<'rating' | 'culture'>('rating');
  const [target, setTarget] = useState('');
  const [market, setMarket] = useState(MARKETS[0]);
  const [rt, setRt] = useState<any>(null);
  const [cu, setCu] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const progRef = useRef<any>(null);
  const startProg = () => { setProg(6); clearInterval(progRef.current); progRef.current = setInterval(() => setProg((p) => (p < 90 ? p + Math.max(1, Math.round((90 - p) / 12)) : p)), 240); };
  const endProg = (ok: boolean) => { clearInterval(progRef.current); if (ok) { setProg(100); setTimeout(() => setProg(0), 700); } else setProg(0); };

  const runRating = async () => {
    setBusy(true); setErr(null); startProg();
    try { const r: any = await productionApi.scripton.rating(projectId, { revisionId, targetCert: target || undefined }); setRt(r.data); endProg(true); }
    catch (e: any) { endProg(false); setErr(e?.response?.status ? `${t('Rating failed (HTTP')} ${e.response.status}).` : t('Rating failed — backend not reachable on :3001.')); }
    finally { setBusy(false); }
  };
  const runCulture = async () => {
    setBusy(true); setErr(null); startProg();
    try { const r: any = await productionApi.scripton.cultureScreen(projectId, { revisionId, market }); setCu(r.data); endProg(true); }
    catch (e: any) { endProg(false); setErr(e?.response?.status ? `${t('Culture screen failed (HTTP')} ${e.response.status}).` : t('Culture screen failed — backend not reachable on :3001.')); }
    finally { setBusy(false); }
  };
  useEffect(() => { runRating(); /* auto-run rating on open */ /* eslint-disable-next-line */ }, []);

  return (
    <div className="sxc" dir={dir}><style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="scrim" onClick={onClose}>
        <div className="panel" onClick={(e) => e.stopPropagation()}>
          <div className="ph"><div className="pt"><span className="i"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /></svg></span>{t('Rating & compliance')}</div><button className="x" onClick={onClose}><svg width="15" height="15" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
          <div className="tabs"><button className={'tab' + (tab === 'rating' ? ' on' : '')} onClick={() => setTab('rating')}>{t('Rating')}</button><button className={'tab' + (tab === 'culture' ? ' on' : '')} onClick={() => setTab('culture')}>{t('Culture screen')}</button></div>
          <div className="bd">
            {prog > 0 && <div className="prog"><i style={{ width: prog + '%' }} /></div>}
            {err && <div className="empty" style={{ color: '#e5635f', borderColor: 'rgba(229,99,95,.3)' }}>{err}</div>}
            {tab === 'rating' && (<>
              <div className="row"><label>{t('Target certificate (optional)')}<input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={t('e.g. PG-13 / 15 / PG15')} /></label><button className={'btn' + (busy ? ' dis' : '')} onClick={runRating} disabled={busy}>{rt ? t('Re-estimate') : t('Estimate rating')}</button></div>
              {rt && (<>
                <div className="eyebrow">{t('CERTIFICATE ESTIMATES')}</div>
                <div className="ests">{(rt.estimates || []).map((e: any, i: number) => <div className="est" key={i}><div className="estb">{e.board}</div><div className="estc">{e.cert}</div><div className="estw">{e.why}</div></div>)}</div>
                <div className="eyebrow" style={{ marginTop: 4 }}>{t('CONTENT DESCRIPTORS')}</div>
                <div>{(rt.descriptors || []).map((d: any, i: number) => <div className="drow" key={i}><span className="pillv" style={{ background: (LVL[String(d.level).toLowerCase()] || '#6b727d') + '22', color: LVL[String(d.level).toLowerCase()] || '#9aa1ab' }}>{d.level}</span><span className="dl">{d.category}{d.evidence ? <> — <span className="de">{d.evidence}</span></> : null}</span>{d.scene != null && <span className="de">{t('Sc')} {d.scene}</span>}</div>)}</div>
                {rt.targetPlan && rt.targetPlan.minimalEdits && rt.targetPlan.minimalEdits.length > 0 && (<><div className="eyebrow" style={{ marginTop: 4 }}>{t('TO REACH')} {String(rt.targetPlan.cert || target).toUpperCase()} — {t('MINIMAL EDITS')}</div><div>{rt.targetPlan.minimalEdits.map((m: any, i: number) => <div className="drow" key={i}><span className="pillv" style={{ background: 'rgba(198,164,99,.16)', color: '#E6D2A2' }}>{m.type}</span><span className="dl">{m.change}</span>{m.scene != null && <span className="de">{t('Sc')} {m.scene}</span>}</div>)}</div></>)}
              </>)}
              {!rt && prog === 0 && <div className="empty">{t('Estimate the certificate per board (MPA · BBFC · GCAM · UAE) with content descriptors. Add a target to get the minimal edits to reach it.')}</div>}
              <div className="note">{t('Estimates only — classification boards make the final decision.')}</div>
            </>)}
            {tab === 'culture' && (<>
              <div className="row"><label>{t('Target market')}<select value={market} onChange={(e) => setMarket(e.target.value)}>{MARKETS.map((m) => <option key={m}>{m}</option>)}</select></label><button className={'btn' + (busy ? ' dis' : '')} onClick={runCulture} disabled={busy}>{cu ? t('Re-screen') : t('Run screen')}</button></div>
              {cu && (<>
                <div className="row" style={{ alignItems: 'center' }}><div className="eyebrow">{t('VERDICT')} · {cu.market}</div><span className="pillv" style={{ marginInlineStart: 'auto', background: cu.verdict === 'PASS' ? 'rgba(87,179,104,.16)' : cu.verdict === 'REWORK' ? 'rgba(229,99,95,.16)' : 'rgba(224,162,59,.16)', color: cu.verdict === 'PASS' ? '#57b368' : cu.verdict === 'REWORK' ? '#e5635f' : '#e0a23b' }}>{cu.verdict}</span></div>
                {(cu.flags || []).map((f: any, i: number) => <div className="flag" key={i} style={{ borderInlineStartColor: SEV[String(f.severity).toLowerCase()] || '#e0a23b' }}><div className="fh"><span className="pillv" style={{ background: (SEV[String(f.severity).toLowerCase()] || '#e0a23b') + '22', color: SEV[String(f.severity).toLowerCase()] || '#e0a23b' }}>{f.severity}</span><span className="ft">{f.category}</span>{f.scene != null && <span className="de" style={{ marginInlineStart: 'auto' }}>{t('Sc')} {f.scene}</span>}</div><div className="fi">{f.issue}</div>{f.suggestion && <div className="fs"><b>{t('Fix:')}</b> {f.suggestion}</div>}</div>)}
                {(!cu.flags || cu.flags.length === 0) && <div className="empty" style={{ borderColor: 'rgba(87,179,104,.3)', color: '#57b368' }}>{t('No flags for')} {cu.market}.</div>}
              </>)}
              {!cu && prog === 0 && <div className="empty">{t('Screen the script against the cultural, religious, legal and censorship norms of a target market — flagged scenes with constructive fixes.')}</div>}
            </>)}
          </div>
        </div>
      </div>
    </div>
  );
}
