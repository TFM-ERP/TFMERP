'use client';

/**
 * SYS-UX Phase 3 — saved views DEMO (NEW route /saved-views-demo).
 * A mock Invoices table toolbar with the SavedViews widget; applying a view updates the
 * active filter chips. Proves the component; real tables adopt it per-module later.
 */
import { useState } from 'react';
import SavedViews from '@/components/workspace/SavedViews';
import '@/styles/tokens.css';

export default function SavedViewsDemo() {
  const [query, setQuery] = useState<Record<string, any>>({ status: 'all' });
  const chips = Object.entries(query).filter(([, v]) => v !== undefined && v !== 'all');

  return (
    <div data-theme="studio" style={{ minHeight: 'calc(100vh - 90px)', borderRadius: 12, border: '1px solid var(--border-1)', background: 'var(--surface-0)', color: 'var(--text-1)', fontFamily: 'var(--font-sans)', padding: 22 }}>
      <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', fontWeight: 700 }}>Phase 3 · Saved views</div>
      <h1 style={{ fontSize: 23, fontWeight: 800, letterSpacing: '-.02em', margin: '4px 0 14px' }}>Finance · Invoices</h1>

      {/* toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <SavedViews module="finance/invoices" query={query} onApply={(q) => setQuery(q)} />
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', flex: 1 }}>
          {chips.length === 0 ? <span style={{ fontSize: 12, color: 'var(--text-3)' }}>No filters · all invoices</span>
            : chips.map(([k, v]) => (
              <span key={k} style={{ fontSize: 11.5, fontWeight: 600, padding: '5px 10px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent)' }}>{k}: {String(v)}</span>
            ))}
        </div>
        <button onClick={() => setQuery({ status: 'all' })} style={{ fontSize: 12, color: 'var(--text-3)', background: 'transparent', border: '1px solid var(--border-1)', borderRadius: 8, padding: '7px 11px', cursor: 'pointer' }}>Clear</button>
      </div>

      {/* mock table */}
      <div style={{ border: '1px solid var(--border-1)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface-1)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>{['Invoice', 'Client', 'Amount', 'Status'].map((h) => (
              <th key={h} style={{ textAlign: 'start', padding: '10px 14px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-3)', fontWeight: 700, borderBottom: '1px solid var(--border-1)' }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {[['INV-2041', 'Mirage Studios', '$24,000', 'overdue'], ['INV-2042', 'Aqaba Film Comm.', '$8,500', 'unpaid'], ['INV-2043', 'Star MENA', '$13,200', 'unpaid'], ['INV-2044', 'Apex Rental', '$2,100', 'paid']]
              .filter((r) => query.status === 'all' || !query.status || r[3] === query.status)
              .filter((r) => !query.min || parseFloat(r[2].replace(/[^0-9.]/g, '')) >= query.min)
              .map((r) => (
                <tr key={r[0]} style={{ borderBottom: '1px solid var(--border-1)' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: 'var(--accent)' }}>{r[0]}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-2)' }}>{r[1]}</td>
                  <td style={{ padding: '10px 14px', color: 'var(--text-1)', fontWeight: 600 }}>{r[2]}</td>
                  <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--surface-2)', color: r[3] === 'overdue' ? 'var(--danger)' : r[3] === 'paid' ? 'var(--ok)' : 'var(--warn)' }}>{r[3]}</span></td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 12 }}>Open <b>Views</b> → apply a saved filter (the table + chips update), or <b>Save current view</b> to store your own. Wired to <code style={{ fontFamily: 'var(--font-mono)' }}>/me/saved-views</code>; sample views until the backend is up.</p>
    </div>
  );
}
