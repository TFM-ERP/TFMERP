'use client';

import { useEffect, useState } from 'react';
import { X, Plus, Trash2, Save, User } from 'lucide-react';
import { productionApi, crewApi } from '@/lib/api';
import { formatCurrency, cn } from '@/lib/utils';

export const UNIT_TYPES = ['Day', 'Week', 'Month', 'Hour', 'Flat', 'Allow', 'Each', 'Package'];
const STAGES = ['PREP', 'SHOOT', 'WRAP', 'POST'];
const STAGE_LABEL: Record<string, string> = { PREP: 'Prep', SHOOT: 'Shoot', WRAP: 'Wrap', POST: 'Post' };

/** Edits a budget labour line as a per-person block of prep/shoot/wrap/post stages. */
export default function LaborBlockEditor({ line, currency = 'AED', onClose, onSaved }:
  { line: any; currency?: string; onClose: () => void; onSaved: () => void }) {
  const money = (n: any) => formatCurrency(Number(n || 0), currency);
  const [directory, setDirectory] = useState<any[]>([]);
  const [crewMemberId, setCrewMemberId] = useState<string>(line.crewMemberId || '');
  const [member, setMember] = useState<any>(null);
  const [rows, setRows] = useState<any[]>(Array.isArray(line.stages) && line.stages.length
    ? line.stages.map((s: any) => ({ ...s }))
    : [{ stage: 'PREP', qty: '', unit: 'Day', rate: '' }]);
  const [busy, setBusy] = useState(false);

  useEffect(() => { crewApi.list({}).then(r => setDirectory(r.data || [])).catch(() => {}); }, []);
  useEffect(() => {
    if (!crewMemberId) { setMember(null); return; }
    crewApi.get(crewMemberId).then(r => setMember(r.data)).catch(() => setMember(directory.find(d => d.id === crewMemberId) || null));
  }, [crewMemberId]);

  // When a crew member is picked, build PREP / SHOOT / WRAP stages from the card:
  // shoot at the shoot rate, prep and wrap BOTH at the shared prep/wrap rate.
  useEffect(() => {
    if (!member) return;
    const usd = currency === 'USD';
    const shootDay = Number(usd ? member.dayRateUsd : member.dayRateAed) || 0;
    const pwDay = Number(usd ? member.prepWrapDayRateUsd : member.prepWrapDayRateAed) || shootDay;
    if (!shootDay && !pwDay) return;
    setRows(rs => {
      const pristine = rs.every(r => !Number(r.qty) && !Number(r.rate));
      if (pristine) {
        return [
          { stage: 'PREP', qty: '', unit: 'Day', rate: pwDay ? String(pwDay) : '' },
          { stage: 'SHOOT', qty: '', unit: 'Day', rate: shootDay ? String(shootDay) : '' },
          { stage: 'WRAP', qty: '', unit: 'Day', rate: pwDay ? String(pwDay) : '' },
        ];
      }
      // otherwise fill any empty Day-rate cells stage-appropriately
      return rs.map(r => {
        if (Number(r.rate) || r.unit !== 'Day') return r;
        const v = (r.stage === 'PREP' || r.stage === 'WRAP') ? pwDay : shootDay;
        return v ? { ...r, rate: String(v) } : r;
      });
    });
  }, [member]); // eslint-disable-line react-hooks/exhaustive-deps

  // rate from the member's card — stage-aware: PREP/WRAP share one rate, SHOOT has
  // its own; both available as Day or Week (project currency).
  const cardRate = (unit: string, stage?: string) => {
    if (!member) return null;
    const usd = currency === 'USD';
    const prepWrap = stage === 'PREP' || stage === 'WRAP';
    if (unit === 'Day') {
      if (prepWrap) return (usd ? member.prepWrapDayRateUsd : member.prepWrapDayRateAed) ?? (usd ? member.dayRateUsd : member.dayRateAed);
      return usd ? member.dayRateUsd : member.dayRateAed;
    }
    if (unit === 'Week') {
      if (prepWrap) return (usd ? member.prepWrapWeeklyRateUsd : member.prepWrapWeeklyRateAed) ?? (usd ? member.weeklyRateUsd : member.weeklyRateAed);
      return usd ? member.weeklyRateUsd : member.weeklyRateAed;
    }
    return null;
  };

  const setRow = (i: number, patch: any) => setRows(rs => rs.map((r, j) => {
    if (j !== i) return r;
    const next = { ...r, ...patch };
    // auto-fill rate from card when unit OR stage changes (stage-aware: prep/wrap vs shoot)
    if (patch.unit !== undefined || patch.stage !== undefined) {
      const cr = cardRate(next.unit, next.stage);
      if (cr != null) next.rate = String(Number(cr));
    }
    return next;
  }));
  const addRow = () => setRows(rs => [...rs, { stage: 'SHOOT', qty: '', unit: 'Week', rate: '' }]);
  const delRow = (i: number) => setRows(rs => rs.filter((_, j) => j !== i));

  const computed = rows.map(r => ({ ...r, amount: (Number(r.qty) || 0) * (Number(r.rate) || 0) }));
  const subtotal = computed.reduce((s, r) => s + r.amount, 0);

  const save = async () => {
    setBusy(true);
    try {
      const stages = computed.filter(r => Number(r.qty) > 0).map(r => ({ stage: r.stage, qty: Number(r.qty), unit: r.unit, rate: Number(r.rate) || 0, amount: r.amount }));
      await productionApi.budget.updateItem(line.id, { crewMemberId: crewMemberId || null, stages });
      onSaved();
    } catch (e: any) { alert(e.response?.data?.message || 'Save failed.'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900">Labour block — {line.subTitle || line.description}</h3>
            <p className="text-xs text-gray-400">Break this person's cost into prep / shoot / wrap / post, each with its own days & rate.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Crew member link */}
        <div className="mb-3">
          <label className="label text-xs flex items-center gap-1"><User size={12} /> Crew member (auto-fills rate card)</label>
          <select className="input text-sm w-full" value={crewMemberId} onChange={e => setCrewMemberId(e.target.value)}>
            <option value="">— Not linked (enter rates manually) —</option>
            {directory.map(d => <option key={d.id} value={d.id}>{d.name}{d.role ? ` · ${d.role}` : ''}</option>)}
          </select>
          {member && (() => {
            const usd = currency === 'USD';
            const v = (k: string) => member[`${k}${usd ? 'Usd' : 'Aed'}`];
            return (
              <p className="text-[11px] text-gray-400 mt-1">
                Rate card — Shoot: {v('dayRate') ? `${money(v('dayRate'))}/day` : '—'} · {v('weeklyRate') ? `${money(v('weeklyRate'))}/wk` : '—'}
                &nbsp;&nbsp;Prep/Wrap: {v('prepWrapDayRate') ? `${money(v('prepWrapDayRate'))}/day` : 'same as shoot'} · {v('prepWrapWeeklyRate') ? `${money(v('prepWrapWeeklyRate'))}/wk` : ''}
              </p>
            );
          })()}
        </div>

        {/* Stage rows */}
        <table className="w-full text-sm">
          <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase border-b border-gray-100">
            <th className="py-1.5 text-left">Stage</th><th className="py-1.5 text-right">Qty</th><th className="py-1.5 text-left pl-3">Unit</th>
            <th className="py-1.5 text-right">Rate ({currency})</th><th className="py-1.5 text-right">Amount</th><th></th>
          </tr></thead>
          <tbody>
            {computed.map((r, i) => (
              <tr key={i} className="border-b border-gray-50">
                <td className="py-1.5">
                  <select className="input text-xs h-7 py-0" value={r.stage} onChange={e => setRow(i, { stage: e.target.value })}>{STAGES.map(s => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select>
                </td>
                <td className="py-1.5 text-right"><input type="number" className="input text-xs h-7 py-0 w-16 text-right" value={r.qty} onChange={e => setRow(i, { qty: e.target.value })} /></td>
                <td className="py-1.5 pl-3"><select className="input text-xs h-7 py-0" value={r.unit} onChange={e => setRow(i, { unit: e.target.value })}>{UNIT_TYPES.map(u => <option key={u}>{u}</option>)}</select></td>
                <td className="py-1.5 text-right"><input type="number" className="input text-xs h-7 py-0 w-24 text-right" value={r.rate} onChange={e => setRow(i, { rate: e.target.value })} /></td>
                <td className="py-1.5 text-right font-medium text-gray-800">{money(r.amount)}</td>
                <td className="py-1.5 text-right"><button onClick={() => delRow(i)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan={4} className="py-2 text-right font-semibold text-gray-700">Line subtotal</td><td className="py-2 text-right font-bold text-gray-900">{money(subtotal)}</td><td /></tr>
          </tfoot>
        </table>

        <div className="flex items-center justify-between mt-3">
          <button onClick={addRow} className="btn btn-secondary text-xs"><Plus size={12} className="mr-1" /> Add stage</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-secondary text-xs">Cancel</button>
            <button onClick={save} disabled={busy} className="btn btn-primary text-xs"><Save size={13} className="mr-1" /> {busy ? 'Saving…' : 'Save block'}</button>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">Tip: a few days → use <b>Day</b> (daily rate); a week or more → use <b>Week</b> (weekly rate). The rate auto‑fills from the card; you can override it.</p>
      </div>
    </div>
  );
}
