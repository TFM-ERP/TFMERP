'use client';

/**
 * SYS-UX Phase 2 — Finance MODULE HOME (parallel route /finance-workspace; live finance pages untouched).
 * Full home: KPI strip + three working views — Cost report (budget vs actual) · Top sheet ·
 * Cash position (live petty-cash floats). Wired to productionApi.budget + productionApi.costing
 * with sample fallback. Logical CSS + i18n (t()) so it mirrors AND translates under Arabic.
 */
import { useEffect, useState } from 'react';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';
import '@/styles/tokens.css';

type Row = { name: string; budget: number; actual: number; committed: number };

const SAMPLE_ROWS: Row[] = [
  { name: 'Cast', budget: 850000, actual: 612000, committed: 700000 },
  { name: 'Camera & grip', budget: 600000, actual: 348000, committed: 410000 },
  { name: 'Locations', budget: 300000, actual: 273000, committed: 285000 },
  { name: 'Transport', budget: 200000, actual: 208000, committed: 215000 },
  { name: 'Art dept', budget: 400000, actual: 176000, committed: 210000 },
  { name: 'Post', budget: 400000, actual: 120000, committed: 150000 },
];

const fmtMoney = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : a >= 1e3 ? `$${Math.round(n / 1e3)}k` : `$${Math.round(n)}`;
  return n < 0 ? s.replace('$', '−$') : s;
};
const barColor = (pct: number) => (pct > 100 ? 'var(--danger)' : pct >= 90 ? 'var(--warn)' : 'var(--ok)');

function normalizeRows(data: any): Row[] | null {
  const arr = data?.categories ?? data?.sections ?? data?.rows ?? data?.lines ?? (Array.isArray(data) ? data : null);
  if (!Array.isArray(arr) || !arr.length) return null;
  const rows = arr.map((r: any) => ({
    name: r.name ?? r.category ?? r.label ?? r.description ?? '—',
    budget: Number(r.budget ?? r.budgetAmount ?? r.budgeted ?? r.estimate ?? 0),
    actual: Number(r.actual ?? r.actualAmount ?? r.spent ?? r.cost ?? 0),
    committed: Number(r.committed ?? r.committedAmount ?? r.commitment ?? r.eta ?? 0),
  })).filter((r: Row) => r.name && (r.budget || r.actual || r.committed));
  return rows.length ? rows : null;
}

export default function FinanceWorkspace() {
  const { t } = useLocale();
  const [rows, setRows] = useState<Row[]>(SAMPLE_ROWS);
  const [floats, setFloats] = useState<any[]>([]);
  const [project, setProject] = useState('Desert Crossing');
  const [versionName, setVersionName] = useState('Working');
  const [live, setLive] = useState(false);
  const [view, setView] = useState<'cost' | 'topsheet' | 'cash'>('cost');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pr: any = await productionApi.projects.list();
        const projects = pr.data?.items ?? (Array.isArray(pr.data) ? pr.data : []);
        const p0 = projects[0];
        if (p0?.title || p0?.name) setProject(p0.title || p0.name);
        const pid = p0?.id;
        if (!pid) return;
        productionApi.costing.floats(pid).then((fr: any) => { if (alive) setFloats(Array.isArray(fr.data) ? fr.data : (fr.data?.items ?? [])); }).catch(() => {});
        const lc: any = await productionApi.budget.lifecycle(pid);
        const versions = lc.data?.versions ?? lc.data?.items ?? (Array.isArray(lc.data) ? lc.data : []);
        const v = versions.find((x: any) => x.status === 'WORKING' || x.status === 'ACTIVE' || x.isActive) ?? versions[0];
        const vid = v?.id;
        if (v?.versionName || v?.name) setVersionName(v.versionName || v.name);
        if (!vid) return;
        const bva: any = await productionApi.budget.budgetVsActual(vid);
        if (!alive) return;
        const norm = normalizeRows(bva.data);
        if (norm) { setRows(norm); setLive(true); }
      } catch { /* keep sample */ }
    })();
    return () => { alive = false; };
  }, []);

  const totals = rows.reduce((a, r) => ({ budget: a.budget + r.budget, actual: a.actual + r.actual, committed: a.committed + r.committed }), { budget: 0, actual: 0, committed: 0 });
  const variance = totals.budget - totals.committed;
  const KPI: [string, string, string?][] = [
    ['Budget', fmtMoney(totals.budget)],
    ['Actual', fmtMoney(totals.actual)],
    ['Committed', fmtMoney(totals.committed), 'var(--warn)'],
    ['Variance', fmtMoney(variance), variance < 0 ? 'var(--danger)' : 'var(--ok)'],
  ];

  // Cash position — live petty-cash floats (costing), defensive to unknown shapes
  const floatBal = (f: any) => Number(f.balance ?? f.remaining ?? ((Number(f.openingAmount) || 0) - (Number(f.spent) || 0))) || 0;
  const pettyOnHand = floats.reduce((s, f) => s + floatBal(f), 0);
  const pettyOpening = floats.reduce((s, f) => s + (Number(f.openingAmount) || 0), 0);
  const openFloats = floats.filter((f) => !f.status || String(f.status).toUpperCase() !== 'CLOSED').length;
  const haveCash = floats.length > 0;
  const CASH: [string, string, string][] = [
    ['Petty cash on hand', haveCash ? fmtMoney(pettyOnHand) : '—', haveCash ? 'var(--ok)' : 'var(--text-3)'],
    ['Open floats', haveCash ? String(openFloats) : '0', 'var(--text-1)'],
    ['Pending POs', fmtMoney(totals.committed - totals.actual), 'var(--warn)'],
    ['Float opening total', haveCash ? fmtMoney(pettyOpening) : '—', 'var(--text-2)'],
  ];

  const Tab = (v: 'cost' | 'topsheet' | 'cash', label: string) => (
    <button key={v} onClick={() => setView(v)} style={{ border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '5px 13px', borderRadius: 999, background: view === v ? 'var(--accent)' : 'transparent', color: view === v ? 'var(--accent-on)' : 'var(--text-3)' }}>{t(label)}</button>
  );

  const th = { textAlign: 'start' as const, padding: '9px 12px', fontSize: 10.5, textTransform: 'uppercase' as const, letterSpacing: '.04em', color: 'var(--text-3)', fontWeight: 700, borderBottom: '1px solid var(--border-1)' };
  const thNum = { ...th, textAlign: 'end' as const };
  const td = { padding: '9px 12px', borderBottom: '1px solid var(--border-1)', fontSize: 12.5 };
  const tdNum = { ...td, textAlign: 'end' as const, fontVariantNumeric: 'tabular-nums' as const };

  return (
    <div data-theme="studio" style={{ height: 'calc(100vh - 90px)', border: '1px solid var(--border-1)', borderRadius: 12, overflow: 'hidden', background: 'var(--surface-0)', color: 'var(--text-1)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border-1)', background: 'var(--surface-1)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <h1 style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-.01em' }}>{t('Finance')}</h1>
          <span style={{ fontSize: 12.5, color: 'var(--text-3)' }}>{project} · {versionName}{live ? '' : ' · ' + t('sample')}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginTop: 12 }}>
          {KPI.map(([k, v, c]) => (
            <div key={k} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-1)', borderRadius: 10, padding: '9px 12px' }}>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-3)', fontWeight: 700 }}>{t(k)}</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 3, color: (c as string) || 'var(--text-1)' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid var(--border-1)', background: 'var(--surface-1)', flexShrink: 0 }}>
        <div style={{ display: 'inline-flex', gap: 3, background: 'var(--surface-2)', padding: 3, borderRadius: 999 }}>
          {Tab('cost', 'Cost report')}
          {Tab('topsheet', 'Top sheet')}
          {Tab('cash', 'Cash position')}
        </div>
        <span style={{ flex: 1 }} />
        <button style={{ border: '1px solid var(--border-1)', borderRadius: 8, padding: '8px 13px', fontSize: 12.5, fontWeight: 700, background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer' }}>{t('Export')}</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 22 }}>
        {view === 'cost' && (
          <div style={{ border: '1px solid var(--border-1)', borderRadius: 12, padding: '16px 18px', background: 'var(--surface-1)' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 12 }}>{t('Budget vs actual — by department')}</div>
            {rows.map((r) => {
              const pct = r.budget ? (r.actual / r.budget) * 100 : 0;
              return (
                <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '9px 0', fontSize: 12 }}>
                  <span style={{ width: 130, color: 'var(--text-2)' }}>{r.name}</span>
                  <span style={{ flex: 1, height: 14, background: 'var(--surface-2)', borderRadius: 7, overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${Math.min(pct, 100)}%`, background: barColor(pct), borderRadius: 7 }} />
                  </span>
                  <span style={{ width: 52, textAlign: 'end', color: barColor(pct), fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{Math.round(pct)}%</span>
                  <span style={{ width: 132, textAlign: 'end', color: 'var(--text-1)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(r.actual)} / {fmtMoney(r.budget)}</span>
                </div>
              );
            })}
          </div>
        )}

        {view === 'topsheet' && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>{t('Category')}</th><th style={thNum}>{t('Budget')}</th><th style={thNum}>{t('Committed')}</th><th style={thNum}>{t('Actual')}</th><th style={thNum}>{t('Variance')}</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const v = r.budget - r.committed;
                return (
                  <tr key={r.name}>
                    <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
                    <td style={tdNum}>{fmtMoney(r.budget)}</td>
                    <td style={tdNum}>{fmtMoney(r.committed)}</td>
                    <td style={tdNum}>{fmtMoney(r.actual)}</td>
                    <td style={{ ...tdNum, color: v < 0 ? 'var(--danger)' : 'var(--ok)', fontWeight: 700 }}>{fmtMoney(v)}</td>
                  </tr>
                );
              })}
              <tr>
                <td style={{ ...td, fontWeight: 800, borderTop: '2px solid var(--border-2)' }}>{t('Total')}</td>
                <td style={{ ...tdNum, fontWeight: 800, borderTop: '2px solid var(--border-2)' }}>{fmtMoney(totals.budget)}</td>
                <td style={{ ...tdNum, fontWeight: 800, borderTop: '2px solid var(--border-2)' }}>{fmtMoney(totals.committed)}</td>
                <td style={{ ...tdNum, fontWeight: 800, borderTop: '2px solid var(--border-2)' }}>{fmtMoney(totals.actual)}</td>
                <td style={{ ...tdNum, fontWeight: 800, color: variance < 0 ? 'var(--danger)' : 'var(--ok)', borderTop: '2px solid var(--border-2)' }}>{fmtMoney(variance)}</td>
              </tr>
            </tbody>
          </table>
        )}

        {view === 'cash' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {CASH.map(([k, v, c]) => (
                <div key={k} style={{ background: 'var(--surface-2)', border: '1px solid var(--border-1)', borderRadius: 12, padding: 13 }}>
                  <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--text-3)', fontWeight: 700, letterSpacing: '.05em' }}>{t(k)}</div>
                  <div style={{ fontSize: 21, fontWeight: 800, marginTop: 4, color: c }}>{v}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 14 }}>{haveCash ? `Live · ${floats.length} petty-cash float${floats.length === 1 ? '' : 's'} from Costing.` : 'No petty-cash floats yet — add them in Costing. Pending POs derive from committed − actual.'}</div>
          </div>
        )}
      </div>
    </div>
  );
}
