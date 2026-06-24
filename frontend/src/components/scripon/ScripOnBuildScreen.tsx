'use client';
import React, { useState } from 'react';
import { useLocale } from '@/lib/i18n';

/** TFM cinematic build screen. Phase 1: research + prep stepper. Phase 2 (when `directions` arrive):
 *  the 3-direction pick (FAITHFUL / BOLD / REIMAGINED) shown AFTER the research, BEFORE Develop. No star, no site URLs. */
const CSS = `
.tfmbuild{position:fixed;inset:0;z-index:90;background:#0C0D10;display:flex;align-items:center;justify-content:center;font-family:var(--sx-body);overflow:auto}
.tfmbuild .glowA{position:absolute;top:-320px;left:50%;transform:translateX(-50%);width:1300px;height:900px;pointer-events:none;background:radial-gradient(circle at center,rgba(198,164,99,.20),rgba(198,164,99,.05) 45%,transparent 70%)}
.tfmbuild .glowB{position:absolute;bottom:-240px;right:-120px;width:900px;height:700px;pointer-events:none;background:radial-gradient(circle at center,rgba(94,131,168,.12),transparent 70%)}
.tfmbuild .hair{position:absolute;left:0;right:0;height:1px;background:rgba(198,164,99,.18)}
.tfmbuild .corner{position:absolute;color:#6f654f;font-weight:700;font-size:11px;letter-spacing:4px}
.tfmbuild .card{position:relative;z-index:2;width:520px;max-width:calc(100vw - 36px);padding:34px 38px 30px;border-radius:22px;background:rgba(21,24,29,.62);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(30px);-webkit-backdrop-filter:blur(30px);box-shadow:0 30px 60px -10px rgba(0,0,0,.55);text-align:center}
.tfmbuild .logo{width:56px;height:56px;border-radius:15px;background:linear-gradient(180deg,#E6D2A2,#C6A463);display:grid;place-items:center;margin:0 auto 14px;animation:tfmhalo 2.2s ease-in-out infinite}
.tfmbuild .logo span{color:#15120B;font-weight:900;font-size:18px;letter-spacing:-1.5px}
.tfmbuild .eyebrow{color:#9A7F52;font-weight:700;font-size:11px;letter-spacing:4px;margin-bottom:8px}
.tfmbuild .ptitle{font-family:var(--sx-title);font-size:24px;font-weight:600;color:#F3ECDD;margin-bottom:4px}
.tfmbuild .psub{color:#7c818a;font-size:12.5px;margin-bottom:18px}
.tfmbuild .bar{height:6px;border-radius:6px;background:#23262e;overflow:hidden;position:relative}
.tfmbuild .fill{height:100%;border-radius:6px;background:linear-gradient(90deg,#C6A463,#E6D2A2);transition:width .5s cubic-bezier(.4,0,.2,1);position:relative;overflow:hidden}
.tfmbuild .fill:after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent);transform:translateX(-100%);animation:tfmsh 1.5s linear infinite}
.tfmbuild .prow{display:flex;justify-content:space-between;align-items:baseline;margin:9px 0 14px}
.tfmbuild .stat{font-size:13px;color:#F3ECDD;font-weight:500}.tfmbuild .pct{font-family:"Courier Prime",monospace;font-size:12.5px;color:#E6D2A2;font-weight:700}
.tfmbuild .steps{display:flex;flex-direction:column;gap:7px;text-align:left}
.tfmbuild .step{display:flex;align-items:center;gap:9px;padding:5px 4px;font-size:12.5px}
.tfmbuild .ic{width:20px;height:20px;border-radius:50%;flex:none;display:grid;place-items:center;font-size:11px;font-weight:800}
.tfmbuild .step.done .ic{background:rgba(87,179,104,.18);color:#57b368}.tfmbuild .step.done .lbl{color:#E8E6E0}
.tfmbuild .step.active .ic{background:linear-gradient(160deg,#E6D2A2,#C6A463);color:#15120B}.tfmbuild .step.active .lbl{color:#E6D2A2;font-weight:700}
.tfmbuild .step.wait .ic{background:#1b1e25;color:#6b727d;border:1px solid rgba(255,255,255,.08)}.tfmbuild .step.wait .lbl{color:#7c818a}
.tfmbuild .step.error .ic{background:rgba(229,99,95,.2);color:#e5635f}.tfmbuild .step.error .lbl{color:#e9a8a6}
.tfmbuild .sp{display:inline-block;width:11px;height:11px;border:2px solid rgba(21,18,11,.3);border-top-color:#15120B;border-radius:50%;animation:tfmspin .7s linear infinite}
.tfmbuild .pre{font-size:10.5px;color:#6b727d;margin-top:14px;line-height:1.5}
.tfmbuild .err{margin-top:14px;font-size:12px;color:#e9a8a6;line-height:1.5}
.tfmbuild .cont{margin-top:14px;height:40px;padding:0 18px;border:none;border-radius:11px;background:linear-gradient(180deg,#E6D2A2,#C6A463);color:#15120B;font-weight:800;font-size:13px;cursor:pointer}
/* directions phase */
.tfmbuild .dirwrap{position:relative;z-index:2;width:1430px;max-width:calc(100vw - 40px);padding:30px 24px;text-align:center}
.tfmbuild .dlogo{width:44px;height:44px;border-radius:12px;background:linear-gradient(180deg,#E6D2A2,#C6A463);display:grid;place-items:center;margin:0 auto 12px}.tfmbuild .dlogo span{color:#15120B;font-weight:900;font-size:14px;letter-spacing:-1px}
.tfmbuild .dttl{font-family:var(--sx-title);font-size:26px;font-weight:600;color:#F3ECDD;margin-bottom:5px}
.tfmbuild .dsub{color:#9aa1ab;font-size:13px;margin-bottom:22px}
.tfmbuild .dgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;text-align:left}
.tfmbuild .dcard{background:rgba(21,24,29,.72);border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:18px 18px 16px;display:flex;flex-direction:column;gap:9px;backdrop-filter:blur(20px)}
.tfmbuild .dcard:hover{border-color:rgba(198,164,99,.45)}
.tfmbuild .dlabel{font-size:12px;font-weight:800;letter-spacing:.6px;color:#E6D2A2}
.tfmbuild .dlog{font-size:14px;line-height:1.45;color:#F3ECDD;font-weight:600}
.tfmbuild .drow{font-size:11.5px;line-height:1.5;color:#9aa1ab}.tfmbuild .drow b{color:#C6A463;font-weight:700;margin-right:4px}
.tfmbuild .dpick{margin-top:auto;height:42px;border:1px solid rgba(198,164,99,.5);border-radius:11px;background:transparent;color:#E6D2A2;font-weight:700;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:.18s}
.tfmbuild .dpick:hover{background:rgba(198,164,99,.12);border-color:rgba(198,164,99,.85)}
.tfmbuild .dpick .dar{transition:transform .18s}.tfmbuild .dpick:hover .dar{transform:translateX(3px)}
.tfmbuild .dhead{display:flex;align-items:flex-start;gap:10px}
.tfmbuild .htext{min-width:0}
.tfmbuild .dtitle{font-family:var(--sx-title);font-size:16px;font-weight:600;color:#F3ECDD;line-height:1.25;margin-top:2px}
.tfmbuild .dtools{margin-left:auto;display:flex;align-items:center;gap:11px;flex:none;padding-top:1px}
.tfmbuild .dicon{font-size:18px;line-height:1;color:#9a8456;cursor:pointer;transition:.15s;user-select:none}
.tfmbuild .dicon:hover{color:#E6D2A2;transform:scale(1.12)}
.tfmbuild .dicon.on{color:#E6D2A2}
.tfmbuild .dicon.spin{display:inline-block;animation:tfmspin .7s linear infinite;color:#E6D2A2}
.tfmbuild .dver{display:inline-flex;align-items:center;gap:3px;font-size:10px;color:#9aa1ab;font-weight:600}
.tfmbuild .vnav{background:none;border:none;color:#C6A463;font-size:14px;cursor:pointer;padding:0 2px;line-height:1}
.tfmbuild .vnav:disabled{opacity:.3;cursor:default}
.tfmbuild .dnotebox{display:flex;flex-direction:column;gap:5px;margin:1px 0}
.tfmbuild .dnotebox textarea{width:100%;min-height:50px;resize:vertical;background:#0b0c0f;border:1px solid rgba(198,164,99,.3);border-radius:9px;color:#E8E6E0;font:inherit;font-size:12px;line-height:1.5;padding:8px 9px;outline:none}
.tfmbuild .dnotebox textarea:focus{border-color:rgba(198,164,99,.6)}
.tfmbuild .dnotehint{font-size:10px;color:#7c818a}.tfmbuild .dnotehint b{color:#C6A463}
.tfmbuild .dnote{font-size:10.5px;color:#cdb98a;line-height:1.4}.tfmbuild .dnote b{color:#C6A463}
.tfmbuild .dlog.fade{opacity:.25;transition:opacity .2s}
@keyframes tfmhalo{0%,100%{box-shadow:0 0 0 0 rgba(198,164,99,0)}50%{box-shadow:0 0 26px 4px rgba(198,164,99,.35)}}
@keyframes tfmspin{to{transform:rotate(360deg)}}
@keyframes tfmsh{to{transform:translateX(100%)}}
`;
const FALLBACK_LABELS = ['FAITHFUL', 'RECONCEIVED', 'REINVENTION'];

function DirCard({ d, i, onPick, onRegen }: { d: any; i: number; onPick?: (x: any) => void; onRegen?: (x: any, note: string) => Promise<any | null> }) {
  const { t } = useLocale();
  const [versions, setVersions] = useState<any[]>([d]);
  const [idx, setIdx] = useState(0);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [appliedNote, setAppliedNote] = useState('');
  const [busy, setBusy] = useState(false);
  const cur = versions[idx] || d;
  const regen = async () => {
    if (!onRegen || busy) return;
    setBusy(true);
    try { const nd = await onRegen(cur, note.trim()); if (nd) { setVersions((v) => { const nv = v.concat([nd]); setIdx(nv.length - 1); return nv; }); if (note.trim()) setAppliedNote(note.trim()); } } catch { /* */ }
    setBusy(false);
  };
  return (
    <div className="dcard">
      <div className="dhead">
        <div className="htext">
          <div className="dlabel">{cur.label || FALLBACK_LABELS[i] || ('DIRECTION ' + (i + 1))}</div>
          {cur.title ? <div className="dtitle">{cur.title}</div> : null}
        </div>
        <div className="dtools">
          {versions.length > 1 ? (<span className="dver"><button className="vnav" disabled={idx === 0} onClick={() => setIdx((x) => Math.max(0, x - 1))}>{'\u2039'}</button>v{idx + 1}/{versions.length}<button className="vnav" disabled={idx === versions.length - 1} onClick={() => setIdx((x) => Math.min(versions.length - 1, x + 1))}>{'\u203a'}</button></span>) : null}
          <span className={'dicon' + (noteOpen ? ' on' : '')} title={t('Add a note to steer this direction')} onClick={() => setNoteOpen((o) => !o)}>+</span>
          <span className={'dicon' + (busy ? ' spin' : '')} title={t('Regenerate this direction (a close new take)')} onClick={regen}>{'\u27f3'}</span>
        </div>
      </div>
      <div className={'dlog' + (busy ? ' fade' : '')}>{cur.logline || cur.summary || ''}</div>
      {appliedNote ? <div className="dnote"><b>{t('Note')} {'\u25b8'}</b> {appliedNote}</div> : null}
      {noteOpen ? (<div className="dnotebox"><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('e.g. make the brother colder \u00b7 more political intrigue \u00b7 lean into the poetry')} /><div className="dnotehint">{t('Type a note, then press')} <b>{'\u27f3'}</b> {t('to regenerate with it.')}</div></div>) : null}
      {cur.keep ? <div className="drow"><b>{t('Keep')}</b>{cur.keep}</div> : null}
      {cur.change ? <div className="drow"><b>{t('Change')}</b>{cur.change}</div> : null}
      {cur.tone ? <div className="drow"><b>{t('Tone')}</b>{cur.tone}</div> : null}
      {cur.risk ? <div className="drow"><b>{t('Risk')}</b>{cur.risk}</div> : null}
      <button className="dpick" onClick={() => onPick && onPick(cur)}>{t('Develop this')} <span className="dar">{'\u2192'}</span></button>
    </div>
  );
}

export default function ScripOnBuildScreen({ title, items, status, error, onContinue, directions, onPick, onRegen, progress, actions }: { title: string; items: { label: string; state: 'done' | 'active' | 'wait' | 'error' }[]; status: string; error?: string | null; onContinue?: () => void; directions?: any[] | null; onPick?: (d: any) => void; onRegen?: (d: any, note: string) => Promise<any | null>; progress?: number | null; actions?: { label: string; primary?: boolean; onClick: () => void }[] | null }) {
  const { dir, t } = useLocale();
  const showDirs = !!(directions && directions.length);
  const total = items.length || 1;
  const done = items.filter((x) => x.state === 'done').length;
  const pct = (typeof progress === 'number' && !isNaN(progress)) ? Math.max(0, Math.min(100, Math.round(progress))) : Math.round((done / total) * 100);
  return (
    <div className="tfmbuild" dir={dir}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="glowA" /><div className="glowB" />
      <div className="hair" style={{ top: 34 }} /><div className="hair" style={{ bottom: 34 }} />
      <span className="corner" style={{ top: 16, left: 30 }}>{t('THE FILM MAKERS · DEVELOPMENT')}</span>
      <span className="corner" style={{ top: 16, right: 30 }}>{showDirs ? t('CHOOSE A DIRECTION') : error ? t('PAUSED') : t('BUILDING')}</span>
      {showDirs ? (
        <div className="dirwrap">
          <div className="dlogo"><span>TFM</span></div>
          <div className="dttl">{title || t('New build')}</div>
          <div className="dsub">{t('Research is done. Three ways to build this — pick one.')} {'\u27f3'} {t('regenerates a direction; + adds a note that steers the next')} {'\u27f3'}.</div>
          <div className="dgrid">
            {directions!.slice(0, 3).map((d: any, i: number) => (<DirCard key={i + '|' + String((d && d.logline) || '').slice(0, 16)} d={d} i={i} onPick={onPick} onRegen={onRegen} />))}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="logo"><span>TFM</span></div>
          <div className="eyebrow">{t('PREPARING YOUR DEVELOPMENT')}</div>
          <div className="ptitle">{title || t('New build')}</div>
          <div className="psub">{t('Researching, reading your source & applying the Lore Atlas')}</div>
          <div className="bar"><div className="fill" style={{ width: pct + '%' }} /></div>
          <div className="prow"><div className="stat">{status}</div><div className="pct">{pct}%</div></div>
          <div className="steps">
            {items.map((it, i) => (
              <div key={i} className={'step ' + it.state}>
                <span className="ic">{it.state === 'done' ? '✓' : it.state === 'active' ? <span className="sp" /> : it.state === 'error' ? '!' : (i + 1)}</span>
                <span className="lbl">{it.label}</span>
              </div>
            ))}
          </div>
          {actions && actions.length ? (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              {actions.map((a, i) => (<button key={i} className="cont" onClick={a.onClick} style={a.primary ? { marginTop: 0 } : { marginTop: 0, background: '#1b1e25', color: '#E8E6E0', border: '1px solid rgba(255,255,255,.12)' }}>{a.label}</button>))}
            </div>
          ) : error ? (<>
            <div className="err">{error}</div>
            <button className="cont" onClick={onContinue}>{t('Continue to Develop')}</button>
          </>) : (
            <div className="pre">{t('Live web research · sacred & represent-with-care guardrails active')}</div>
          )}
        </div>
      )}
    </div>
  );
}
