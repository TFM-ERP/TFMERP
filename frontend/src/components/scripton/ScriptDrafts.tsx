'use client';
/** ScriptON — Drafts panel for the script reader.
 *
 *  WHY THIS EXISTS. Generation never replaced a draft: `regenerateFeature` writes into a brand-new
 *  ScriptRevision and only moves `activeRevisionId` on a clean finish, so every draft ever produced
 *  is still on file. But the reader loaded the active revision and threw the rest of the list away,
 *  so from the writer's chair eight drafts looked like one draft that kept changing — and a rewrite
 *  read as an overwrite. This panel is the missing evidence: every draft, in order, on the WGA
 *  colour ladder, with what each run actually produced, and one click to read or restore any of them.
 *
 *  Purely presentational. The page owns loading and the active-revision switch.
 */
import React, { useState } from 'react';
import { useLocale } from '@/lib/i18n';

export type DraftRow = {
  id: string;
  revisionLabel?: string | null;
  revisionColor?: string | null;
  colorCode?: string | null;
  revisionRound?: number | null;
  pageCount?: number | null;
  changeSummary?: string | null;
  supersedesId?: string | null;
  isLocked?: boolean | null;
  createdAt?: string | null;
  revisionDate?: string | null;
};

/** The WGA wheel, mirrored from backend/src/production/script/revision-wheel.util.ts, so a row with
 *  no stored `colorCode` (legacy drafts predate the stamp) still shows the right chip. */
const WHEEL_HEX: Record<string, string> = {
  WHITE: '#ffffff', BLUE: '#9ec5ff', PINK: '#ffc0cb', YELLOW: '#fff27a', GREEN: '#b6e7a0',
  GOLDENROD: '#e7c84e', BUFF: '#f3e4c0', SALMON: '#ff9e80', CHERRY: '#d6444a', TAN: '#d8c39a',
};

function dotColor(r: DraftRow): string {
  const hex = String(r.colorCode || '').trim();
  if (/^#[0-9a-f]{3,8}$/i.test(hex)) return hex;
  const key = String(r.revisionColor || '').trim().toUpperCase();
  return WHEEL_HEX[key] || '#8d939c';
}

/** "1 Sep 2026, 21:04" — the writer's own locale, no assumptions about it. */
function stamp(r: DraftRow): string {
  const raw = r.revisionDate || r.createdAt;
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
      + ', ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch { return d.toISOString().slice(0, 16).replace('T', ' '); }
}

const CSS = `
.sdrf{--gold:#C6A463;--gold2:#E6D2A2;--goldink:#15120B;--hair:rgba(255,255,255,.08);--faint:#6b727d;--mute:#9aa1ab;--cream:#F3ECDD;--green:#57b368}
.sdrf .scrim{position:fixed;inset:0;z-index:96;background:rgba(6,7,10,.58);backdrop-filter:blur(2px);border:none;padding:0;cursor:default}
.sdrf .pane{position:fixed;inset-block:0;inset-inline-end:0;z-index:97;width:min(420px,94vw);display:flex;flex-direction:column;background:#0e1015;border-inline-start:1px solid var(--hair);box-shadow:-30px 0 90px -30px rgba(0,0,0,.9);font-family:var(--sx-body);color:#E8E6E0}
.sdrf .ph{flex:0 0 auto;display:flex;align-items:center;gap:10px;padding:15px 17px;border-bottom:1px solid var(--hair)}
.sdrf .ph h2{font-size:14.5px;font-weight:800;color:var(--cream);margin:0}
.sdrf .ph .n{font-size:11px;color:var(--faint);font-weight:600}
.sdrf .x{margin-inline-start:auto;background:transparent;border:1px solid rgba(255,255,255,.12);color:var(--mute);border-radius:8px;width:28px;height:28px;font-size:13px;cursor:pointer;line-height:1}
.sdrf .x:hover{border-color:rgba(198,164,99,.45);color:var(--gold2)}
.sdrf .note{flex:0 0 auto;padding:11px 17px;font-size:11.5px;line-height:1.55;color:var(--faint);border-bottom:1px solid var(--hair);background:rgba(198,164,99,.04)}
.sdrf .list{flex:1;overflow:auto;padding:9px}
.sdrf .row{display:flex;gap:11px;width:100%;text-align:start;padding:12px;border-radius:11px;border:1px solid transparent;background:transparent;cursor:pointer;color:inherit;font:inherit}
.sdrf .row:hover{background:#171a21}
.sdrf .row.reading{background:rgba(198,164,99,.09);border-color:rgba(198,164,99,.38)}
.sdrf .dot{flex:none;width:13px;height:13px;border-radius:50%;margin-top:3px;box-shadow:0 0 0 3px rgba(255,255,255,.05),inset 0 0 0 1px rgba(0,0,0,.28)}
.sdrf .b{flex:1;min-width:0}
.sdrf .l1{display:flex;align-items:baseline;gap:7px}
.sdrf .lbl{font-size:12.8px;font-weight:700;color:var(--cream);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sdrf .tag{flex:none;font-size:8.5px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;padding:2px 6px;border-radius:5px}
.sdrf .tag.cur{background:rgba(87,179,104,.16);color:#8fd39c;border:1px solid rgba(87,179,104,.4)}
.sdrf .tag.rd{background:rgba(198,164,99,.16);color:var(--gold2);border:1px solid rgba(198,164,99,.42)}
.sdrf .l2{font-size:10.5px;color:var(--faint);margin-top:3px}
.sdrf .l3{font-size:11px;color:var(--mute);margin-top:5px;line-height:1.45}
.sdrf .acts{display:flex;gap:7px;margin-top:9px;flex-wrap:wrap}
.sdrf .mini{font-size:10.5px;font-weight:700;padding:5px 10px;border-radius:8px;cursor:pointer;background:#1b1e25;border:1px solid rgba(198,164,99,.36);color:var(--gold2)}
.sdrf .mini:hover{border-color:rgba(198,164,99,.7)}
.sdrf .mini[disabled]{opacity:.5;cursor:default}
.sdrf .empty{padding:38px 20px;text-align:center;font-size:12.5px;color:var(--faint);line-height:1.6}
.sdrf .msg{flex:0 0 auto;padding:10px 17px;font-size:11.5px;line-height:1.5;border-top:1px solid var(--hair);color:var(--gold2);background:rgba(198,164,99,.07)}
`;

export default function ScriptDrafts(props: {
  open: boolean;
  drafts: DraftRow[];
  activeId: string;
  readingId: string;
  busyId?: string | null;
  message?: string | null;
  onRead: (id: string) => void;
  onMakeCurrent: (id: string) => void;
  onClose: () => void;
}) {
  const { dir, t } = useLocale();
  const [confirmId, setConfirmId] = useState('');
  if (!props.open) return null;

  const close = () => { setConfirmId(''); props.onClose(); };
  const rows = Array.isArray(props.drafts) ? props.drafts : [];

  return (
    <div className="sdrf" dir={dir}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <button className="scrim" aria-label={t('Close drafts')} onClick={close} />
      <aside className="pane" role="dialog" aria-label={t('Drafts')}>
        <div className="ph">
          <h2>{t('Drafts')}</h2>
          <span className="n">{rows.length} {rows.length === 1 ? t('draft') : t('drafts')}</span>
          <button className="x" onClick={close} aria-label={t('Close')}>&#x2715;</button>
        </div>
        <div className="note">
          {t('Every generation is kept. A rewrite writes a new draft and only becomes current when it finishes cleanly — nothing is ever overwritten, and exports stay bound to the draft they came from.')}
        </div>
        <div className="list">
          {!rows.length ? (
            <div className="empty">{t('No drafts on file yet. The first generation will appear here.')}</div>
          ) : rows.map((r) => {
            const isActive = r.id === props.activeId;
            const isReading = r.id === props.readingId;
            const busy = props.busyId === r.id;
            const label = String(r.revisionLabel || t('Untitled draft'));
            const when = stamp(r);
            const pages = typeof r.pageCount === 'number' && r.pageCount > 0
              ? (r.pageCount + ' ' + (r.pageCount === 1 ? t('page') : t('pages'))) : '';
            const meta = [when, pages].filter(Boolean).join('  ·  ');
            return (
              <div key={r.id} className={'row' + (isReading ? ' reading' : '')} role="group">
                <span className="dot" style={{ background: dotColor(r) }} aria-hidden="true" />
                <div className="b">
                  <div className="l1">
                    <span className="lbl" title={label}>{label}</span>
                    {isActive ? <span className="tag cur">{t('current')}</span> : null}
                    {isReading && !isActive ? <span className="tag rd">{t('reading')}</span> : null}
                    {r.isLocked ? <span className="tag rd" title={t('Locked')}>&#128274;</span> : null}
                  </div>
                  {meta ? <div className="l2">{meta}</div> : null}
                  {r.changeSummary ? <div className="l3">{r.changeSummary}</div> : null}
                  <div className="acts">
                    {!isReading ? (
                      <button className="mini" onClick={() => { setConfirmId(''); props.onRead(r.id); }} disabled={busy}>
                        {busy ? t('Opening…') : t('Read this draft')}
                      </button>
                    ) : null}
                    {!isActive && confirmId !== r.id ? (
                      <button className="mini" onClick={() => setConfirmId(r.id)} disabled={busy}>{t('Make current')}</button>
                    ) : null}
                    {!isActive && confirmId === r.id ? (
                      <>
                        <button className="mini" onClick={() => { setConfirmId(''); props.onMakeCurrent(r.id); }} disabled={busy}>
                          {busy ? t('Switching…') : t('Yes — make current')}
                        </button>
                        <button className="mini" style={{ borderColor: 'rgba(255,255,255,.14)', color: '#9aa1ab' }} onClick={() => setConfirmId('')} disabled={busy}>
                          {t('Cancel')}
                        </button>
                      </>
                    ) : null}
                  </div>
                  {!isActive && confirmId === r.id ? (
                    <div className="l3" style={{ color: '#9aa1ab' }}>
                      {t('This only changes which draft the rest of the system reads. Every other draft stays exactly where it is.')}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        {props.message ? <div className="msg">{props.message}</div> : null}
      </aside>
    </div>
  );
}
