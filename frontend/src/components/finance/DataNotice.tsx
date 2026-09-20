'use client';

import { AlertTriangle } from 'lucide-react';

/**
 * A caveat the API attached to a financial report.
 *
 * The backend decides whether one exists — it is derived from the data, not a
 * hardcoded flag, so it disappears on its own once the underlying gap closes.
 * Render it wherever the numbers are shown, including on paper: a receivables
 * report that does not tie to the ledger and does not say so invites someone to
 * reconcile it and conclude the wrong thing.
 */

export interface Notice {
  level?: 'warning' | 'info';
  headline: string;
  detail?: string;
}

export default function DataNotice({ notice, print = false }: { notice?: Notice | null; print?: boolean }) {
  if (!notice?.headline) return null;

  // Print gets ink-on-paper treatment: a border and a rule carry the warning,
  // never colour alone, which disappears in greyscale.
  if (print) {
    return (
      <div
        style={{
          border: '1px solid #999', borderInlineStart: '3px solid #333',
          padding: '6px 10px', margin: '0 0 10px', fontSize: 8,
          lineHeight: 1.45, breakInside: 'avoid', pageBreakInside: 'avoid',
        }}
      >
        <div style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>
          {notice.headline}
        </div>
        {notice.detail && <div style={{ color: '#333' }}>{notice.detail}</div>}
      </div>
    );
  }

  return (
    <div
      role="status"
      className="rounded-lg border px-3 py-2.5 flex items-start gap-2.5"
      style={{ borderColor: '#d97706', background: '#fffbeb' }}
    >
      <AlertTriangle size={16} style={{ color: '#b45309', flexShrink: 0, marginTop: 1 }} aria-hidden />
      <div className="min-w-0">
        <div className="text-[13px] font-semibold" style={{ color: '#92400e' }}>{notice.headline}</div>
        {notice.detail && (
          <div className="text-[12px] mt-0.5 leading-relaxed" style={{ color: '#78350f' }}>{notice.detail}</div>
        )}
      </div>
    </div>
  );
}
