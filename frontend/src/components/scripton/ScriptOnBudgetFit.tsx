'use client';
/** ScriptON Doctor — dark-native Budget-fit overlay (replaces the light BudgetFitPanel inside the workspace).
 *  Self-contained, own scrim, namespaced `.sxb`. Wired to scripton.budgetFit / applyBudgetFit. */
import React, { useRef, useState } from 'react';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

const TYPE: Record<string, string> = { CONSOLIDATE: '#5b8def', CUT: '#e5635f', MERGE: '#8b7cf0', CONVERT: '#e0a23b', RECAST: '#57b368', VFX: '#8b7cf0' };
const NUMS: [string, string, string][] = [['targetBudget', 'Target budget', 'e.g. 1200000'], ['days', 'Shoot days', 'e.g. 18'], ['maxLocations', 'Max locations', 'e.g. 6'], ['maxCast', 'Max cast', 'e.g. 6']];
const sgn = (n: number) => (n > 0 ? '+' + n : String(n));

const CSS = `
.sxb{position:fixed;inset:0;z-index:120;font-family:var(--sx-body)}
.sxb *{box-sizing:border-box;margin:0;padding:0}
.sxb .scrim{position:absolute;inset:0;background:rgba(7,8,11,.66);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:28px}
.sxb .panel{width:760px;max-width:96vw;max-height:88vh;overflow:auto;background:linear-gradient(180deg,#16181f,#121419);border:1px solid rgba(255,255,255,.13);border-radius:16px;box-shadow:0 40px 100px -20px rgba(0,0,0,.85);color:#E8E6E0}
.sxb .ph{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.07)}
.sxb .pt{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:700;color:#F4EEE0}
.sxb .pt .i{width:28px;height:28px;border-radius:8px;background:rgba(198,164,99,.14);display:grid;place-items:center;color:#E6D2A2}
.sxb svg{display:block;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sxb .x{width:30px;height:30px;border-radius:8px;border:1px solid rgba(255,255,255,.07);background:#1b1e25;color:#9aa1ab;cursor:pointer;display:grid;place-items:center}
.sxb .bd{padding:16px 18px;display:flex;flex-direction:column;gap:12px}
.sxb .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}
.sxb label{font-size:11px;color:#9aa1ab;display:flex;flex-direction:column;gap:4px}
.sxb input{height:34px;border-radius:9px;background:#1a1d24;border:1px solid rgba(255,255,255,.07);color:#E8E6E0;padding:0 11px;font:inherit;font-size:12.5px;outline:none}
.sxb input:focus{border-color:rgba(198,164,99,.45)}
.sxb .runrow{display:flex;align-items:flex-end;gap:9px}
.sxb .runrow label{flex:1}
.sxb .btn{height:36px;padding:0 16px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:none;white-space:nowrap;background:linear-gradient(180deg,#E6D2A2,#C6A463);color:#1a1509}
.sxb .btn.dis{opacity:.55;cursor:default}
.sxb .empty{font-size:12.5px;color:#6b727d;border:1px dashed rgba(255,255,255,.13);border-radius:12px;padding:22px 16px;text-align:center;line-height:1.6}
.sxb .now{font-size:11px;color:#6b727d}
.sxb .vcard{background:#14161c;border:1px solid rgba(255,255,255,.07);border-radius:13px;padding:14px}
.sxb .vh{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
.sxb .vl{font-size:13.5px;font-weight:700;color:#F4EEE0}
.sxb .sv{font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;background:rgba(87,179,104,.16);color:#57b368}
.sxb .vap{font-size:12px;color:#9aa1ab;margin-bottom:6px;line-height:1.45}
.sxb .vproj{font-size:10.5px;color:#6b727d;margin-bottom:8px}
.sxb .chg{display:flex;align-items:flex-start;gap:8px;font-size:12px;margin-bottom:5px}
.sxb .ctag{font-size:9px;font-weight:800;text-transform:uppercase;padding:2px 6px;border-radius:5px;flex:none;margin-top:1px}
.sxb .ctxt{color:#9aa1ab;line-height:1.4}.sxb .ctxt b{color:#E8E6E0}
.sxb .tro{font-size:11px;color:#e0a23b;background:rgba(224,162,59,.10);border:1px solid rgba(224,162,59,.25);border-radius:8px;padding:6px 9px;margin-top:6px}
.sxb .applyrow{margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sxb .applybtn{font-size:11.5px;font-weight:700;padding:6px 12px;border-radius:9px;border:1px solid rgba(87,179,104,.4);background:rgba(87,179,104,.14);color:#7fd494;cursor:pointer}
.sxb .applied{font-size:11px;color:#57b368}
.sxb .deltawrap{margin-top:5px;font-size:11px;color:#9aa1ab}
.sxb .prog{height:4px;border-radius:4px;background:#23262e;overflow:hidden}.sxb .prog i{display:block;height:100%;background:linear-gradient(90deg,#C6A463,#E6D2A2);transition:width .25s}
`;

export default function ScriptOnBudgetFit({ projectId, revisionId, onClose }: { projectId: string; revisionId?: string; onClose: () => void }) {
  const { dir, t } = useLocale();
  const [form, setForm] = useState<any>({ targetBudget: '', currency: 'USD', days: '', maxLocations: '', maxCast: '', notes: '' });
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(0);
  const [applyingIdx, setApplyingIdx] = useState(-1);
  const [appliedMap, setAppliedMap] = useState<any>({});
  const [err, setErr] = useState<string | null>(null);
  const progRef = useRef<any>(null);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const startProg = () => { setProg(6); clearInterval(progRef.current); progRef.current = setInterval(() => setProg((p) => (p < 90 ? p + Math.max(1, Math.round((90 - p) / 12)) : p)), 240); };
  const endProg = (ok: boolean) => { clearInterval(progRef.current); if (ok) { setProg(100); setTimeout(() => setProg(0), 700); } else setProg(0); };

  const run = async () => {
    setBusy(true); setErr(null); startProg();
    try {
      const body: any = { revisionId, currency: form.currency, notes: form.notes };
      for (const k of ['targetBudget', 'days', 'maxLocations', 'maxCast']) if (form[k] !== '' && !isNaN(Number(form[k]))) body[k] = Number(form[k]);
      const r: any = await productionApi.scripton.budgetFit(projectId, body); setRes(r.data); endProg(true);
    } catch (e: any) { endProg(false); setErr(e?.response?.status ? `${t('Budget-fit failed')} (HTTP ${e.response.status}) — ${t('check the backend.')}` : t('Budget-fit failed — backend not reachable on :3001.')); }
    finally { setBusy(false); }
  };
  const apply = async (v: any, i: number) => {
    setApplyingIdx(i); setErr(null);
    try { const r: any = await productionApi.scripton.applyBudgetFit(projectId, { revisionId, variant: v }); setAppliedMap((m: any) => ({ ...m, [i]: r.data })); }
    catch (e: any) { setErr(e?.response?.status ? `${t('Apply failed')} (HTTP ${e.response.status}).` : t('Apply failed — backend not reachable.')); }
    finally { setApplyingIdx(-1); }
  };
  const f = res?.facts || {};

  return (
    <div className="sxb" dir={dir}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="scrim" onClick={onClose}>
        <div className="panel" onClick={(e) => e.stopPropagation()}>
          <div className="ph">
            <div className="pt"><span className="i"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg></span>{t('Budget-fit rewrite')}</div>
            <button className="x" onClick={onClose}><svg width="15" height="15" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg></button>
          </div>
          <div className="bd">
            <div className="grid">
              {NUMS.map(([k, label, ph]) => (<label key={k}>{t(label)}<input type="number" value={form[k]} onChange={(e) => set(k, e.target.value)} placeholder={t(ph)} /></label>))}
            </div>
            <div className="runrow">
              <label style={{ width: 96, flex: 'none' }}>{t('Currency')}<input value={form.currency} onChange={(e) => set('currency', e.target.value)} /></label>
              <label>{t('Notes / must-keeps')}<input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder={t('e.g. keep the rooftop finale')} /></label>
              <button className={'btn' + (busy ? ' dis' : '')} onClick={run} disabled={busy}>{res ? t('Re-plan') : t('Suggest plan')}</button>
            </div>
            {prog > 0 && <div className="prog"><i style={{ width: prog + '%' }} /></div>}
            {err && <div className="tro" style={{ color: '#e5635f', borderColor: 'rgba(229,99,95,.3)', background: 'rgba(229,99,95,.1)' }}>{err}</div>}
            {!res && prog === 0 && !err && <div className="empty">{t("Set a target (budget, days, locations, cast) and get labelled rewrite strategies — what to consolidate, cut, convert or recast — grounded in the script's real scene load. Apply one to branch a new revision.")}</div>}
            {res && (<>
              <div className="now">{t('Now:')} {f.sceneCount || 0} {t('scenes')} · {f.locations || 0} {t('locations')} · {f.night || 0} {t('night')} · {f.pages || 0} {t('pp')}</div>
              {(res.variants || []).map((v: any, i: number) => (
                <div className="vcard" key={i}>
                  <div className="vh"><span className="vl">{v.label || `${t('Option')} ${i + 1}`}</span>{v.savingPct != null && <span className="sv">~{v.savingPct}% {t('saved')}</span>}</div>
                  {v.approach && <div className="vap">{v.approach}</div>}
                  <div className="vproj">{t('Projected:')} {v.projectedScenes ?? '—'} {t('scenes')} · {v.projectedLocations ?? '—'} {t('locations')} · {v.projectedNights ?? '—'} {t('night')}</div>
                  {Array.isArray(v.changes) && v.changes.map((c: any, j: number) => (
                    <div className="chg" key={j}><span className="ctag" style={{ background: (TYPE[c.type] || '#94a3b8') + '22', color: TYPE[c.type] || '#9aa1ab' }}>{c.type || '—'}</span><span className="ctxt">{c.target ? <b>{c.target}: </b> : null}{c.detail}</span></div>
                  ))}
                  {v.tradeoffs && <div className="tro">{t('Trade-off:')} {v.tradeoffs}</div>}
                  <div className="applyrow"><button className="applybtn" onClick={() => apply(v, i)} disabled={applyingIdx === i}>{applyingIdx === i ? t('Applying…') : (appliedMap[i] ? t('Re-apply') : t('Apply → new revision'))}</button>{appliedMap[i] && <span className="applied">{t('Branched')} “{appliedMap[i].label}” · {appliedMap[i].applied} {t('scenes')}</span>}</div>
                  {appliedMap[i] && <div className="deltawrap">Δ {t('scenes')} {sgn(appliedMap[i].delta.scenes)} · {t('locations')} {sgn(appliedMap[i].delta.locations)} · {t('night')} {sgn(appliedMap[i].delta.night)} · {t('pages')} {sgn(appliedMap[i].delta.pages)}. {t('Activate it in Revisions and run Sync-from-script to re-cost.')}</div>}
                </div>
              ))}
            </>)}
          </div>
        </div>
      </div>
    </div>
  );
}
