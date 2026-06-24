'use client';

/**
 * SYS-UX Phase 2 — Contracts Workspace (NEW route /contracts-workspace; live /contracts untouched).
 * List + document/e-sign panel reusing the "document workspace" chrome, Studio Light.
 * Sample data (defensive) — real contracts wire via contractsApi.
 */
import { useState } from 'react';
import '@/styles/tokens.css';

type Row = { id: string; party: string; type: string; value: string; status: 'Signed' | 'Awaiting' | 'Out for sign' | 'Draft' };
const ROWS: Row[] = [
  { id: 'c1', party: 'L. Haddad', type: 'Cast — Lead', value: '—', status: 'Signed' },
  { id: 'c2', party: 'Mirage Talent', type: 'Agency', value: '—', status: 'Awaiting' },
  { id: 'c3', party: 'Wadi Rim Estate', type: 'Location', value: '$18,000', status: 'Out for sign' },
  { id: 'c4', party: 'Apex Camera Rental', type: 'Vendor', value: '$42,500', status: 'Draft' },
];
const SC: Record<Row['status'], string> = { Signed: 'var(--ok)', Awaiting: 'var(--warn)', 'Out for sign': 'var(--warn)', Draft: 'var(--info)' };

export default function ContractsWorkspace() {
  const [selId, setSelId] = useState('c3');
  const sel = ROWS.find((r) => r.id === selId) || ROWS[0];
  return (
    <div data-theme="studio" style={{ height: 'calc(100vh - 90px)', border: '1px solid var(--border-1)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface-0)', color: 'var(--text-1)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border-1)', background: 'var(--surface-1)' }}>
        <div style={{ display: 'inline-flex', gap: 3, background: 'var(--surface-2)', padding: 3, borderRadius: 999 }}>
          {['Contracts', 'Templates'].map((v, i) => <span key={v} style={{ fontSize: 12, fontWeight: 700, padding: '5px 13px', borderRadius: 999, background: i === 0 ? 'var(--accent)' : 'transparent', color: i === 0 ? 'var(--accent-on)' : 'var(--text-3)' }}>{v}</span>)}
        </div>
        <span style={{ fontSize: 12.5, color: 'var(--text-2)', fontWeight: 600 }}>Contracts · sample</span>
        <span style={{ flex: 1 }} />
        <button style={{ border: 'none', borderRadius: 8, padding: '8px 13px', fontSize: 12.5, fontWeight: 700, background: 'var(--accent)', color: 'var(--accent-on)', cursor: 'pointer' }}>＋ New contract</button>
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, overflow: 'auto', padding: 18 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>{['Party', 'Type', 'Value', 'Status'].map((h) => <th key={h} style={{ textAlign: 'start', padding: '9px 12px', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-3)', fontWeight: 700, borderBottom: '1px solid var(--border-1)' }}>{h}</th>)}</tr></thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.id} onClick={() => setSelId(r.id)} style={{ cursor: 'pointer', background: sel.id === r.id ? 'var(--accent-soft)' : 'transparent' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600, borderBottom: '1px solid var(--border-1)' }}>{r.party}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-2)', borderBottom: '1px solid var(--border-1)' }}>{r.type}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--text-1)', borderBottom: '1px solid var(--border-1)' }}>{r.value}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-1)' }}><span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'var(--surface-2)', color: SC[r.status] }}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <aside style={{ width: 320, flexShrink: 0, borderInlineStart: '1px solid var(--border-1)', background: 'var(--surface-1)', overflow: 'auto', padding: 16 }}>
          <div style={{ background: '#fff', border: '1px solid var(--border-1)', borderRadius: 10, padding: '18px 20px', fontSize: 10.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)', textAlign: 'center' }}>{sel.type.toUpperCase()} AGREEMENT</div>
            <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 9, marginBottom: 12 }}>{sel.party} · Desert Crossing Prod. Ltd</div>
            {[88, 100, 70, 92, 100].map((w, i) => <div key={i} style={{ height: 7, width: `${w}%`, background: 'var(--surface-2)', borderRadius: 3, margin: '5px 0' }} />)}
            <div style={{ marginTop: 16, display: 'flex', gap: 14 }}>
              <div style={{ flex: 1, borderTop: '1.5px solid var(--text-3)', paddingTop: 5, fontSize: 9, color: 'var(--text-3)' }}>{sel.status === 'Signed' ? <span style={{ fontFamily: 'cursive', fontSize: 14, color: 'var(--accent)' }}>{sel.party}</span> : <span style={{ color: 'var(--warn)' }}>Pending…</span>}<br />Counterparty</div>
              <div style={{ flex: 1, borderTop: '1.5px solid var(--text-3)', paddingTop: 5, fontSize: 9, color: 'var(--text-3)' }}><span style={{ fontFamily: 'cursive', fontSize: 14, color: 'var(--accent)' }}>Q. Qandil</span><br />Producer</div>
            </div>
          </div>
          <button style={{ width: '100%', marginTop: 12, border: 'none', borderRadius: 9, padding: 10, fontSize: 13, fontWeight: 700, background: 'var(--accent)', color: 'var(--accent-on)', cursor: 'pointer' }}>{sel.status === 'Signed' ? 'Download PDF' : 'Send for signature'}</button>
        </aside>
      </div>
    </div>
  );
}
