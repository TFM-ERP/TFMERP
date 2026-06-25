'use client';
import { ENDING_TYPES } from './endingTypes';
/** ScriptON Doctor — Rewrite Slate (P2 creative transforms). Dark overlay; scripton.transform / applyTransform.
 *  Kinds: tighten · punchup · genre · ending · humour · intensity. Apply branches an inactive revision. */
import React, { useRef, useState } from 'react';
import { useExitGuard } from './useExitGuard';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

const KINDS: { k: string; label: string }[] = [
  { k: 'tighten', label: 'Tighten' }, { k: 'punchup', label: 'Punch-up dialogue' }, { k: 'genre', label: 'Genre transpose' },
  { k: 'ending', label: 'Re-engineer ending' }, { k: 'humour', label: 'Inject humour' }, { k: 'intensity', label: 'Scene intensity' },
];
const TYPE: Record<string, string> = { REWRITE: '#C6A463', CUT: '#e5635f', ADD: '#57b368', MERGE: '#8b7cf0', RETONE: '#e0a23b', RECONNECT: '#5b8def' };
const sgn = (n: number) => (n > 0 ? '+' + n : String(n));

const CSS = `
.sxr{position:fixed;inset:0;z-index:120;font-family:var(--sx-body)}
.sxr *{box-sizing:border-box;margin:0;padding:0}
.sxr .scrim{position:absolute;inset:0;background:rgba(7,8,11,.66);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:28px}
.sxr .panel{width:760px;max-width:96vw;max-height:88vh;overflow:auto;background:linear-gradient(180deg,#16181f,#121419);border:1px solid rgba(255,255,255,.13);border-radius:16px;box-shadow:0 40px 100px -20px rgba(0,0,0,.85);color:#E8E6E0}
.sxr .ph{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.07)}
.sxr .pt{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:700;color:#F4EEE0}.sxr .pt .i{width:28px;height:28px;border-radius:8px;background:rgba(198,164,99,.14);display:grid;place-items:center;color:#E6D2A2}
.sxr svg{display:block;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sxr .x{width:30px;height:30px;border-radius:8px;border:1px solid rgba(255,255,255,.07);background:#1b1e25;color:#9aa1ab;cursor:pointer;display:grid;place-items:center}
.sxr .bd{padding:16px 18px;display:flex;flex-direction:column;gap:12px}
.sxr .chips{display:flex;gap:7px;flex-wrap:wrap}
.sxr .chip{padding:7px 13px;border-radius:999px;font-size:12.5px;font-weight:600;color:#9aa1ab;background:#171a20;border:1px solid rgba(255,255,255,.07);cursor:pointer}
.sxr .chip.on{background:rgba(198,164,99,.14);border-color:rgba(198,164,99,.45);color:#E6D2A2}
.sxr .optrow{display:flex;align-items:flex-end;gap:9px}
.sxr label{font-size:11px;color:#9aa1ab;display:flex;flex-direction:column;gap:4px;flex:1}
.sxr input,.sxr select{height:34px;border-radius:9px;background:#1a1d24;border:1px solid rgba(255,255,255,.07);color:#E8E6E0;padding:0 11px;font:inherit;font-size:12.5px;outline:none}
.sxr input:focus,.sxr select:focus{border-color:rgba(198,164,99,.45)}
.sxr .btn{height:36px;padding:0 16px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:none;white-space:nowrap;background:linear-gradient(180deg,#E6D2A2,#C6A463);color:#1a1509}
.sxr .btn.dis{opacity:.55;cursor:default}
.sxr .empty{font-size:12.5px;color:#6b727d;border:1px dashed rgba(255,255,255,.13);border-radius:12px;padding:22px 16px;text-align:center;line-height:1.6}
.sxr .vcard{background:#14161c;border:1px solid rgba(255,255,255,.07);border-radius:13px;padding:14px}
.sxr .vh{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px}
.sxr .vl{font-size:13.5px;font-weight:700;color:#F4EEE0}
.sxr .scope{font-size:10px;font-weight:800;padding:3px 9px;border-radius:999px;background:rgba(198,164,99,.16);color:#E6D2A2}
.sxr .vap{font-size:12px;color:#9aa1ab;margin-bottom:8px;line-height:1.45}
.sxr .chg{display:flex;align-items:flex-start;gap:8px;font-size:12px;margin-bottom:5px}
.sxr .ctag{font-size:9px;font-weight:800;text-transform:uppercase;padding:2px 6px;border-radius:5px;flex:none;margin-top:1px}
.sxr .ctxt{color:#9aa1ab;line-height:1.4}.sxr .ctxt b{color:#E8E6E0}
.sxr .tro{font-size:11px;color:#e0a23b;background:rgba(224,162,59,.10);border:1px solid rgba(224,162,59,.25);border-radius:8px;padding:6px 9px;margin-top:6px}
.sxr .applyrow{margin-top:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.sxr .applybtn{font-size:11.5px;font-weight:700;padding:6px 12px;border-radius:9px;border:1px solid rgba(87,179,104,.4);background:rgba(87,179,104,.14);color:#7fd494;cursor:pointer}
.sxr .applied{font-size:11px;color:#57b368}.sxr .dw{margin-top:5px;font-size:11px;color:#9aa1ab}
.sxr .prog{height:4px;border-radius:4px;background:#23262e;overflow:hidden}.sxr .prog i{display:block;height:100%;background:linear-gradient(90deg,#C6A463,#E6D2A2);transition:width .25s}
`;

export default function ScriptOnRewriteSlate({ projectId, revisionId, onClose, initialKind }: { projectId: string; revisionId?: string; onClose: () => void; initialKind?: string }) {
  const { dir, t } = useLocale();
  const [kind, setKind] = useState(initialKind || 'tighten');
  const [opt, setOpt] = useState<any>({ targetGenre: '', endingType: 'bittersweet', humourStyle: '', intensity: 'up', notes: '' });
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [prog, setProg] = useState(0);
  const [applyingIdx, setApplyingIdx] = useState(-1);
  const [appliedMap, setAppliedMap] = useState<any>({});
  const [err, setErr] = useState<string | null>(null);
  const progRef = useRef<any>(null);
  const set = (k: string, v: any) => setOpt((o: any) => ({ ...o, [k]: v }));
  const startProg = () => { setProg(6); clearInterval(progRef.current); progRef.current = setInterval(() => setProg((p) => (p < 90 ? p + Math.max(1, Math.round((90 - p) / 12)) : p)), 240); };
  const endProg = (ok: boolean) => { clearInterval(progRef.current); if (ok) { setProg(100); setTimeout(() => setProg(0), 700); } else setProg(0); };

  const run = async () => {
    setBusy(true); setErr(null); setRes(null); startProg();
    try { const r: any = await productionApi.scripton.transform(projectId, { revisionId, kind, ...opt }); setRes(r.data); endProg(true); }
    catch (e: any) { endProg(false); setErr(e?.response?.status ? `${t('Rewrite failed (HTTP')} ${e.response.status}) — ${t('check the backend.')}` : t('Rewrite failed — backend not reachable on :3001.')); }
    finally { setBusy(false); }
  };
  const apply = async (v: any, i: number) => {
    setApplyingIdx(i); setErr(null);
    try { const r: any = await productionApi.scripton.applyTransform(projectId, { revisionId, kind, variant: v }); setAppliedMap((m: any) => ({ ...m, [i]: r.data })); }
    catch (e: any) { setErr(e?.response?.status ? `${t('Apply failed (HTTP')} ${e.response.status}).` : t('Apply failed — backend not reachable.')); }
    finally { setApplyingIdx(-1); }
  };

  const { requestClose, guard } = useExitGuard(onClose, { dirty: () => !!res || applyingIdx >= 0, title: t('Discard this rewrite slate?'), body: t('Your generated approaches will be cleared. Any revision you already applied is saved and stays in Revisions.') });

  return (
    <div className="sxr" dir={dir}><style dangerouslySetInnerHTML={{ __html: CSS }} />
      {guard}
      <div className="scrim" onClick={requestClose}>
        <div className="panel" onClick={(e) => e.stopPropagation()}>
          <div className="ph"><div className="pt"><span className="i"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg></span>{t('Rewrite slate')}</div><button className="x" onClick={requestClose}><svg width="15" height="15" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg></button></div>
          <div className="bd">
            <div className="chips">{KINDS.map((k) => <button key={k.k} className={'chip' + (k.k === kind ? ' on' : '')} onClick={() => { setKind(k.k); setRes(null); }}>{t(k.label)}</button>)}</div>
            <div className="optrow">
              {kind === 'genre' && <label>{t('Target genre')}<input value={opt.targetGenre} onChange={(e) => set('targetGenre', e.target.value)} placeholder={t('e.g. neo-noir thriller')} /></label>}
              {kind === 'ending' && <label>{t('Ending type')}<select value={opt.endingType} onChange={(e) => set('endingType', e.target.value)}>{ENDING_TYPES.map((en) => <option key={en.id} value={en.id}>{en.label}</option>)}</select></label>}
              {kind === 'humour' && <label>{t('Humour style')}<input value={opt.humourStyle} onChange={(e) => set('humourStyle', e.target.value)} placeholder={t('e.g. dry / satire / dark / absurdist')} /></label>}
              {kind === 'intensity' && <label>{t('Direction')}<select value={opt.intensity} onChange={(e) => set('intensity', e.target.value)}><option value="up">{t('Dial up')}</option><option value="down">{t('Dial down')}</option></select></label>}
              <label>{t('Notes / must-keeps')}<input value={opt.notes} onChange={(e) => set('notes', e.target.value)} placeholder={t('e.g. keep the rooftop finale')} /></label>
              <button className={'btn' + (busy ? ' dis' : '')} onClick={run} disabled={busy}>{res ? t('Re-generate') : t('Generate approaches')}</button>
            </div>
            {prog > 0 && <div className="prog"><i style={{ width: prog + '%' }} /></div>}
            {err && <div className="tro" style={{ color: '#e5635f', borderColor: 'rgba(229,99,95,.3)', background: 'rgba(229,99,95,.1)' }}>{err}</div>}
            {!res && prog === 0 && !err && <div className="empty">{t('Pick a transform, set an option, and get three labelled approaches — grounded in the real scenes. Apply one to branch a new revision (non-destructive; the original stays active).')}</div>}
            {res && (res.variants || []).map((v: any, i: number) => (
              <div className="vcard" key={i}>
                <div className="vh"><span className="vl">{v.label || `${t('Approach')} ${i + 1}`}</span>{v.scope && <span className="scope">{v.scope}</span>}</div>
                {v.approach && <div className="vap">{v.approach}</div>}
                {Array.isArray(v.changes) && v.changes.map((c: any, j: number) => (<div className="chg" key={j}><span className="ctag" style={{ background: (TYPE[c.type] || '#94a3b8') + '22', color: TYPE[c.type] || '#9aa1ab' }}>{c.type || '—'}</span><span className="ctxt">{c.target ? <b>{c.target}: </b> : null}{c.detail}</span></div>))}
                {v.tradeoffs && <div className="tro">{t('Trade-off:')} {v.tradeoffs}</div>}
                <div className="applyrow"><button className="applybtn" onClick={() => apply(v, i)} disabled={applyingIdx === i}>{applyingIdx === i ? t('Applying…') : (appliedMap[i] ? t('Re-apply') : t('Apply → new revision'))}</button>{appliedMap[i] && <span className="applied">{t('Branched')} “{appliedMap[i].label}” · {appliedMap[i].applied} {t('scenes')}</span>}</div>
                {appliedMap[i] && <div className="dw">Δ {t('scenes')} {sgn(appliedMap[i].delta.scenes)} · {t('locations')} {sgn(appliedMap[i].delta.locations)} · {t('night')} {sgn(appliedMap[i].delta.night)} · {t('pages')} {sgn(appliedMap[i].delta.pages)}. {t('Activate it in Revisions and run Sync-from-script to re-cost.')}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
