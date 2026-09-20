'use client';
/** ScriptON — Genre profiles settings panel.
 *  Renders inside the Settings `.sx` content area. Shows the genre length table the planner actually
 *  uses, and lets a human override a row WITHOUT editing the table.
 *
 *  THE TABLE IS READ-ONLY, AND THAT IS THE POINT. Four of its rows are `measured` and carry a corpus
 *  citation - DRAMA's is "79.77 scenes, n=665" out of 1,276 produced films. Editing the number under
 *  that citation would turn the citation into a lie attached to a hand-typed figure. So an override
 *  is a LAYER: the measured value stays visible underneath, the change sits on top with its reason,
 *  and Reset is always available because nothing was destroyed.
 *
 *  Presentational and self-contained: it owns no data layer. The parent passes `rows` (whatever
 *  genreProfileTable(texture, overrides) returned) and `overrides`, and receives every edit through
 *  `onChange`. Reuses `.sx` classes plus a small `.gpp` block, exactly as ReviewProtectionPanel does. */
import React from 'react';
import { useLocale } from '@/lib/i18n';

export type GenreRow = {
  key: string; label: string; sceneDensity: number; defaultPages: number; scenes: number;
  pagesPerScene: number; pagesPerMinute: number; minutes: number;
  provenance: 'measured' | 'derived' | 'default' | 'blended' | 'overridden';
  parent: string; source: string; corpusScenes: number | null; corpusSample: number | null;
  overrodeFrom?: { sceneDensity: number; pagesPerMinute: number; defaultPages: number; provenance: string; source: string };
};
export type GenreOverride = { key: string; sceneDensity?: number; pagesPerMinute?: number; defaultPages?: number; note?: string };

const GPP_CSS = `
.gpp{display:flex;flex-direction:column;gap:14px}
.gpp .lede{font-size:12.5px;color:var(--mute);line-height:1.6;max-width:78ch}
.gpp .lede b{color:var(--cream);font-weight:700}
.gpp .tools{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.gpp .chips{display:flex;gap:6px;flex-wrap:wrap}
.gpp .chip{height:30px;padding:0 11px;border-radius:9px;border:1px solid var(--hair);background:#171a20;color:var(--mute);font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
.gpp .chip:hover{color:var(--cream)}
.gpp .chip.on{background:rgba(198,164,99,.13);border-color:rgba(198,164,99,.4);color:var(--gold2)}
.gpp .tbl{border:1px solid var(--hair);border-radius:12px;overflow:hidden;background:var(--panel)}
.gpp .th,.gpp .tr{display:grid;grid-template-columns:1.5fr .9fr .8fr .8fr 1fr 34px;gap:10px;align-items:center;padding:10px 14px}
.gpp .th{background:#12141a;border-bottom:1px solid var(--hair);font-size:10.5px;font-weight:700;letter-spacing:.9px;color:var(--faint);text-transform:uppercase}
.gpp .tr{border-bottom:1px solid rgba(255,255,255,.04);font-size:13px}
.gpp .tr:last-child{border-bottom:none}
.gpp .tr:hover{background:#161920}
.gpp .tr.edited{background:rgba(198,164,99,.05)}
.gpp .gname{font-weight:700;color:var(--cream);display:flex;align-items:center;gap:8px;min-width:0}
.gpp .gname span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.gpp .num{background:#0f1218;border:1px solid var(--hair);border-radius:8px;color:var(--text);font-size:12.5px;padding:6px 8px;width:100%;font-family:'Courier Prime',ui-monospace,monospace}
.gpp .num:focus{outline:none;border-color:rgba(198,164,99,.5)}
.gpp .num.bad{border-color:var(--red);color:var(--red)}
.gpp .was{font-size:10.5px;color:var(--faint);margin-top:3px;font-family:'Courier Prime',ui-monospace,monospace}
.gpp .prov{font-size:10px;font-weight:700;letter-spacing:.6px;padding:3px 7px;border-radius:6px;text-transform:uppercase;white-space:nowrap}
.gpp .prov.measured{background:rgba(87,179,104,.15);color:var(--green)}
.gpp .prov.derived{background:rgba(224,162,59,.14);color:var(--amber)}
.gpp .prov.blended{background:rgba(91,141,239,.15);color:var(--blue)}
.gpp .prov.overridden{background:rgba(198,164,99,.18);color:var(--gold2)}
.gpp .prov.default{background:rgba(255,255,255,.06);color:var(--faint)}
.gpp .cite{font-size:11px;color:var(--faint);line-height:1.5;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.gpp .rst{width:26px;height:26px;border-radius:7px;border:1px solid var(--hair);background:#171a20;color:var(--faint);cursor:pointer;display:grid;place-items:center;font-size:13px;line-height:1}
.gpp .rst:hover{color:var(--red);border-color:rgba(229,99,95,.4)}
.gpp .rst:disabled{opacity:.25;cursor:default}
.gpp .note{background:#0f1218;border:1px solid var(--hair);border-radius:9px;color:var(--text);font-size:12.5px;padding:8px 10px;width:100%;font-family:inherit}
.gpp .note:focus{outline:none;border-color:rgba(198,164,99,.5)}
.gpp .foot{font-size:11.5px;color:var(--faint);line-height:1.6}
`;

/** Half the table's lowest to twice its highest — the same band the backend enforces, derived from
 *  the rows themselves so the two can never drift apart. A value outside it is refused, not clamped. */
const bandOf = (rows: GenreRow[], pick: (r: GenreRow) => number) => {
  const v = rows.map(pick).filter((n) => typeof n === 'number' && isFinite(n) && n > 0);
  return v.length ? { lo: Math.min(...v) / 2, hi: Math.max(...v) * 2 } : { lo: 0, hi: Infinity };
};

export default function GenreProfilePanel(props: {
  rows: GenreRow[];
  overrides: GenreOverride[];
  onChange: (next: GenreOverride[]) => void;
  saving?: boolean;
}) {
  const { t } = useLocale();
  const rows = Array.isArray(props.rows) ? props.rows : [];
  const overrides = Array.isArray(props.overrides) ? props.overrides : [];
  const [filter, setFilter] = React.useState<'all' | 'measured' | 'changed'>('all');
  const [open, setOpen] = React.useState<string>('');

  const dBand = React.useMemo(() => bandOf(rows, (r) => (r.overrodeFrom ? r.overrodeFrom.sceneDensity : r.sceneDensity)), [rows]);
  const pBand = React.useMemo(() => bandOf(rows, (r) => (r.overrodeFrom ? r.overrodeFrom.defaultPages : r.defaultPages)), [rows]);

  const ovOf = (key: string) => overrides.find((o) => o && o.key === key);
  const put = (key: string, patch: Partial<GenreOverride>) => {
    const rest = overrides.filter((o) => o && o.key !== key);
    const merged: GenreOverride = { ...(ovOf(key) || { key }), ...patch, key };
    const empty = merged.sceneDensity === undefined && merged.pagesPerMinute === undefined && merged.defaultPages === undefined;
    props.onChange(empty ? rest : rest.concat(merged));
  };
  const reset = (key: string) => props.onChange(overrides.filter((o) => o && o.key !== key));

  const num = (raw: string, band: { lo: number; hi: number }): number | undefined | null => {
    const s = raw.trim();
    if (!s) return undefined;                       // cleared -> drop the override
    const n = Number(s);
    if (!isFinite(n) || n < band.lo || n > band.hi) return null;   // refused
    return n;
  };

  const shown = rows.filter((r) => filter === 'all' || (filter === 'measured' ? r.provenance === 'measured' : !!ovOf(r.key)));
  const changed = overrides.length;

  return (
    <div className="gpp">
      <style>{GPP_CSS}</style>

      <div className="panelcard">
        <div className="eyebrow">{t('GENRE LENGTH PROFILES')}</div>
        <div className="lede" style={{ marginTop: 6 }}>
          {t('How dense a script runs, per genre — scenes per page, and the page target when a brief does not state one.')}{' '}
          <b>{t('The table itself is never edited.')}</b>{' '}
          {t('Four rows are measured against a corpus of 1,276 produced films and carry that citation; the rest inherit a measured parent. A change you make here sits ON TOP as an override — the measured figure stays visible underneath, and Reset restores it.')}
        </div>
      </div>

      <div className="tools">
        <div className="chips">
          {([['all', 'All genres'], ['measured', 'Measured only'], ['changed', 'Changed']] as const).map(([k, lbl]) => (
            <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>
              {t(lbl)}{k === 'changed' && changed ? ' · ' + changed : ''}
            </button>
          ))}
        </div>
        {changed > 0 && (
          <button className="btn ghost" onClick={() => props.onChange([])}>{t('Reset all')}</button>
        )}
      </div>

      <div className="tbl">
        <div className="th">
          <span>{t('Genre')}</span><span>{t('Scenes / page')}</span><span>{t('Pages')}</span>
          <span>{t('Minutes')}</span><span>{t('Where it came from')}</span><span />
        </div>
        {shown.map((r) => {
          const o = ovOf(r.key);
          const was = r.overrodeFrom;
          return (
            <div className={'tr' + (o ? ' edited' : '')} key={r.key}>
              <div className="gname">
                <span title={r.label}>{r.label}</span>
                <span className={'prov ' + r.provenance}>{t(r.provenance)}</span>
              </div>
              <div>
                <input
                  className="num"
                  defaultValue={String(r.sceneDensity)}
                  onBlur={(e) => {
                    const v = num(e.target.value, dBand);
                    if (v === null) { e.target.classList.add('bad'); return; }
                    e.target.classList.remove('bad');
                    put(r.key, { sceneDensity: v });
                  }}
                />
                {was && was.sceneDensity !== r.sceneDensity && <div className="was">{t('was')} {was.sceneDensity}</div>}
              </div>
              <div>
                <input
                  className="num"
                  defaultValue={String(r.defaultPages)}
                  onBlur={(e) => {
                    const v = num(e.target.value, pBand);
                    if (v === null) { e.target.classList.add('bad'); return; }
                    e.target.classList.remove('bad');
                    put(r.key, { defaultPages: v });
                  }}
                />
                {was && was.defaultPages !== r.defaultPages && <div className="was">{t('was')} {was.defaultPages}</div>}
              </div>
              <div style={{ color: 'var(--mute)', fontFamily: "'Courier Prime',ui-monospace,monospace", fontSize: 12.5 }}>
                {r.minutes}′ · {r.scenes} {t('sc')}
              </div>
              <div className="cite" title={r.source} onClick={() => setOpen(open === r.key ? '' : r.key)} style={{ cursor: 'pointer' }}>
                {r.source}
              </div>
              <button className="rst" onClick={() => reset(r.key)} disabled={!o} title={t('Reset to the table value')}>↺</button>

              {open === r.key && (
                <div style={{ gridColumn: '1 / -1', paddingTop: 4 }}>
                  <input
                    className="note"
                    placeholder={t('Why are you changing this? (saved with the override)')}
                    defaultValue={(o && o.note) || ''}
                    onBlur={(e) => o && put(r.key, { note: e.target.value })}
                  />
                  {was && <div className="was" style={{ marginTop: 6 }}>{t('The table still says')}: {was.source}</div>}
                </div>
              )}
            </div>
          );
        })}
        {!shown.length && (
          <div className="tr"><span style={{ gridColumn: '1 / -1', color: 'var(--faint)' }}>{t('Nothing to show for this filter.')}</span></div>
        )}
      </div>

      <div className="foot">
        {t('A value far outside the table’s own range is refused rather than quietly corrected — a squashed typo reads like a measurement. Clear a box to drop that override.')}
        {props.saving ? ' · ' + t('Saving…') : ''}
      </div>
    </div>
  );
}
