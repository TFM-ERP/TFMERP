'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, RefreshCw, Receipt, ExternalLink, Wallet } from 'lucide-react';
import { driverAppApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const fileSrc = (v?: string) => (!v ? '' : (v.startsWith('http') || v.startsWith('data:')) ? v : `${API_ROOT}${v}`);

export default function DriverApprovalsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  /** Why the list is empty. '' means it really is empty; anything else is a failure to say out loud. */
  const [error, setError] = useState('');

  /**
   * A REFUSAL IS NOT AN EMPTY QUEUE.
   *
   * `load` had a .finally and no .catch, so a failed read left `items` at [] and the card below
   * rendered "Nothing pending. All caught up." — a sentence that is false and reassuring at the
   * same time, over a queue nobody managed to read. The only other trace was an unhandled
   * rejection in the console. `review` had the same shape: try/finally with no catch, so a refused
   * approval did nothing visible at all.
   *
   * Both now show THE SERVER'S MESSAGE FIRST. PermissionsGuard names the module it refused on,
   * while axios's own err.message is just "Request failed with status code 403". The claims routes
   * are rentals:2, and Finance Manager, Production Manager and Sales all sit at rentals:1 and can
   * open this page — so the 403 path is reachable, not hypothetical.
   */
  const msg = (e: any, fallback: string) => e?.response?.data?.message || e?.message || fallback;

  const load = () => {
    setLoading(true);
    driverAppApi.pending()
      .then(r => { setItems(r.data || []); setError(''); })
      .catch(e => { setItems([]); setError(msg(e, 'Could not load driver submissions.')); })
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const review = async (id: string, status: string) => {
    setBusy(id);
    let notes: string | undefined;
    if (status === 'REJECTED') { notes = prompt('Reason for rejection (optional):') || undefined; }
    try { await driverAppApi.review(id, status, notes); load(); }
    catch (e: any) { alert(msg(e, 'Could not record that decision.')); }
    finally { setBusy(''); }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="marquee-panel flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Rentals · Approvals</div>
          <h1 className="text-[19px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Driver Submissions</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>Fuel and expenses submitted by drivers, awaiting approval.</p>
        </div>
        <button onClick={load} className="btn-secondary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      <div className="card overflow-hidden">
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> : error ? (
          <div className="p-10 text-center text-sm" style={{ color: '#e5635f' }}>{error}</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">Nothing pending. All caught up.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium w-16 text-center">{s.type}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-800">{s.driverName || 'Driver'} · {formatCurrency(Number(s.amount))}</div>
                  <div className="text-xs text-gray-400">
                    {s.litres ? `${s.litres} L · ` : ''}{s.odometer ? `${s.odometer} km · ` : ''}
                    {new Date(s.createdAt).toLocaleDateString('en-GB')}{s.notes ? ` · ${s.notes}` : ''}
                  </div>
                </div>
                {s.receiptUrl && <a href={fileSrc(s.receiptUrl)} target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-700 text-xs flex items-center gap-1"><Receipt size={13} /> Receipt</a>}
                <button disabled={!!busy} onClick={() => review(s.id, 'APPROVED')} className="p-1.5 rounded hover:bg-green-50 text-gray-400 hover:text-green-600" title="Approve"><CheckCircle2 size={18} /></button>
                <button disabled={!!busy} onClick={() => review(s.id, 'REJECTED')} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500" title="Reject"><XCircle size={18} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
