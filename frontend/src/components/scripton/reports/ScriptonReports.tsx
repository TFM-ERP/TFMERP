'use client';
/**
 * ScriptonReports — new-OS Reports & Exports workspace inside the shared ScriptonShell. A filterable
 * gallery of generated reports on the left, a live preview + export bar on the right. Replaces the
 * legacy ScriptOnReports trio. Pure presentation: the route page loads the catalog + latest coverage.
 */
import React from 'react';
import ScriptonShell from '@/components/scripton/ScriptonShell';
import { SX_CSS } from '@/components/scripton/shared/sx';

export type SxReport = { key: string; title: string; badge: string; badgeClass: string; meta: string };
export type SxPreviewLine = { label?: string; text: string };
export type SxPreview = { title: string; badge: string; badgeTone: string; lines: SxPreviewLine[] };

const EXTRA = `
.sx.reports .rp-grid{display:grid;grid-template-columns:1.1fr 1fr;gap:16px;min-height:0;flex:1}
@media(max-width:1100px){.sx.reports .rp-grid{grid-template-columns:1fr}}
.sx.reports .rcards{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-content:start;overflow:auto}
.sx.reports .rcard{background:var(--panel);border:1px solid var(--hair);border-radius:12px;padding:13px 14px;cursor:pointer;text-align:start;color:inherit;font:inherit;display:flex;flex-direction:column;gap:6px}
.sx.reports .rcard:hover{border-color:var(--hair2)}
.sx.reports .rcard.on{border-color:rgba(198,164,99,.55);background:rgba(198,164,99,.08)}
.sx.reports .rcard .rt{font-size:13px;font-weight:700;color:var(--cream)}
.sx.reports .rcard .rm{font-size:10.5px;color:var(--faint)}
.sx.reports .rbadge{align-self:flex-start;font-size:10px;font-weight:800;letter-spacing:.4px;padding:2px 8px;border-radius:6px}
.sx.reports .bg-green{background:rgba(87,179,104,.16);color:var(--green)}
.sx.reports .bg-amber{background:rgba(224,162,59,.16);color:var(--amber)}
.sx.reports .bg-red{background:rgba(229,99,95,.16);color:var(--red)}
.sx.reports .bg-blue{background:rgba(91,141,239,.16);color:#a9c4f7}
.sx.reports .preview{background:var(--paper);color:var(--ink);border-radius:12px;padding:22px 24px;overflow:auto;display:flex;flex-direction:column;gap:10px;box-shadow:0 18px 44px -18px rgba(0,0,0,.6)}
.sx.reports .preview h2{font-size:15px;font-weight:800;letter-spacing:.4px;margin:0}
.sx.reports .preview .pl{font-size:13px;line-height:1.6}
.sx.reports .preview .pl b{color:#6b5a2e}
.sx.reports .exbar{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto;padding-top:14px}
`;

type Props = {
  title: string; vp: 'mobile' | 'tablet' | 'desktop'; meta?: string;
  filters: string[]; activeFilter: string; onFilter: (f: string) => void;
  reports: SxReport[]; activeKey?: string; onSelect: (k: string) => void; preview: SxPreview;
  onExport: (fmt: string) => void; onAction: (k: string) => void;
  onNav?: (k: string) => void; onBack?: () => void; toast?: string | null;
};

const toneClass = (c: string) => c === 'green' ? 'bg-green' : c === 'amber' ? 'bg-amber' : c === 'red' ? 'bg-red' : 'bg-blue';

export default function ScriptonReports(props: Props) {
  const { title, vp, meta, filters, activeFilter, onFilter, reports, activeKey, onSelect, preview, onExport, onAction, onNav, onBack, toast } = props;
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SX_CSS + EXTRA }} />
      <ScriptonShell screen="reports" active="reports" vp={vp} onBack={onBack} onNav={onNav}
        topbar={{ scriptScoped: false }} overlay={toast ? <div className="toast">{toast}</div> : null}>
        <div className="main"><div className="content">
          <div className="phead">
            <div>
              <div className="eyebrow">REPORTS</div>
              <h1>{title}</h1>
              <div className="sub">{meta || 'Every report & export, generated from live production data.'}</div>
            </div>
            <button className="btn gold" onClick={() => onAction('new')}>+ New report</button>
          </div>

          <div className="chips">
            {filters.map((f) => <button key={f} className={'chip' + (f === activeFilter ? ' on' : '')} onClick={() => onFilter(f)}>{f}</button>)}
          </div>

          <div className="rp-grid">
            <div className="rcards">
              {reports.map((r) => (
                <button key={r.key} className={'rcard' + (r.key === activeKey ? ' on' : '')} onClick={() => onSelect(r.key)}>
                  <span className={'rbadge ' + toneClass(r.badgeClass)}>{r.badge}</span>
                  <span className="rt">{r.title}</span>
                  <span className="rm">{r.meta}</span>
                </button>
              ))}
            </div>

            <div className="preview">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2>{preview.title}</h2>
                <span className={'rbadge ' + toneClass(preview.badgeTone)} style={{ background: 'rgba(0,0,0,.06)' }}>{preview.badge}</span>
              </div>
              <div style={{ height: 1, background: 'rgba(0,0,0,.1)' }} />
              {preview.lines.map((l, i) => (
                <div className="pl" key={i}>{l.label ? <b>{l.label} </b> : null}{l.text}</div>
              ))}
              <div className="exbar">
                <button className="btn gold" onClick={() => onExport('pdf')}>↧ PDF</button>
                <button className="btn ghost" onClick={() => onExport('xlsx')}>Excel</button>
                <button className="btn ghost" onClick={() => onExport('fdx')}>Final Draft</button>
                <button className="btn ghost" onClick={() => onExport('all')} style={{ marginInlineStart: 'auto' }}>Export all</button>
              </div>
            </div>
          </div>
        </div></div>
      </ScriptonShell>
    </>
  );
}
