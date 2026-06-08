'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { productionApi } from '@/lib/api';

/**
 * Production Globals + Fringe/Overhead profiles for the active budget version.
 * Extracted from the project page so it can live under Project Settings.
 * Self-contained CRUD; calls onChanged() (the project reload) after mutations.
 */
export default function ProjectGlobalsPanel({ activeVersion, fringes = [], onChanged }:
  { activeVersion: any; fringes?: any[]; onChanged?: () => void }) {
  const [adding, setAdding] = useState(false);
  const [ng, setNg] = useState({ key: '', label: '', value: '', unit: 'days' });

  if (!activeVersion) {
    return <p className="text-xs text-gray-400">No active budget version yet — create one in the Budget tab to define production globals.</p>;
  }
  const globals = activeVersion.globals || [];

  const upsert = async () => {
    if (!ng.key || !ng.label || !ng.value) return;
    await productionApi.budget.upsertGlobal(activeVersion.id, {
      key: ng.key.toLowerCase().replace(/\s+/g, '_'),
      label: ng.label,
      value: Number(ng.value),
      unit: ng.unit,
    });
    setAdding(false);
    setNg({ key: '', label: '', value: '', unit: 'days' });
    onChanged?.();
  };
  const update = async (g: any, newValue: number) => {
    await productionApi.budget.upsertGlobal(activeVersion.id, { key: g.key, label: g.label, value: newValue, unit: g.unit });
    onChanged?.();
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Production Globals</h3>
            <p className="text-xs text-gray-400 mt-0.5">Variables referenced in budget formulas (e.g. shoot_days × daily_rate)</p>
          </div>
          <button onClick={() => setAdding(true)} className="btn btn-primary text-xs py-1 px-3"><Plus size={12} className="mr-1" /> Add Global</button>
        </div>

        {adding && (
          <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-100">
            <div className="grid grid-cols-4 gap-2 mb-2">
              <div>
                <label className="label text-xs">Key (variable name)</label>
                <input className="input w-full text-sm font-mono" value={ng.key} onChange={e => setNg(v => ({ ...v, key: e.target.value }))} placeholder="shoot_days" />
              </div>
              <div>
                <label className="label text-xs">Label</label>
                <input className="input w-full text-sm" value={ng.label} onChange={e => setNg(v => ({ ...v, label: e.target.value }))} placeholder="Shoot Days" />
              </div>
              <div>
                <label className="label text-xs">Value</label>
                <input type="number" className="input w-full text-sm" value={ng.value} onChange={e => setNg(v => ({ ...v, value: e.target.value }))} />
              </div>
              <div>
                <label className="label text-xs">Unit</label>
                <select className="input w-full text-sm" value={ng.unit} onChange={e => setNg(v => ({ ...v, unit: e.target.value }))}>
                  {['days', 'weeks', 'hours', 'people', ''].map(u => <option key={u} value={u}>{u || '—'}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={upsert} className="btn btn-primary text-xs py-1">Save Global</button>
              <button onClick={() => setAdding(false)} className="btn btn-secondary text-xs py-1">Cancel</button>
            </div>
          </div>
        )}

        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Variable</th>
              <th className="table-th">Label</th>
              <th className="table-th">Value</th>
              <th className="table-th">Unit</th>
              <th className="table-th"></th>
            </tr>
          </thead>
          <tbody>
            {globals.map((g: any) => (
              <tr key={g.id} className="table-row">
                <td className="table-td font-mono text-purple-700 text-sm">{g.key}</td>
                <td className="table-td text-sm text-gray-700">{g.label}</td>
                <td className="table-td">
                  <input type="number" className="input text-sm py-1 w-24" defaultValue={Number(g.value)}
                    onBlur={e => { if (Number(e.target.value) !== Number(g.value)) update(g, Number(e.target.value)); }} />
                </td>
                <td className="table-td text-sm text-gray-500">{g.unit || '—'}</td>
                <td className="table-td">
                  <button onClick={async () => { await productionApi.budget.deleteGlobal(g.id); onChanged?.(); }} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
            {globals.length === 0 && <tr><td colSpan={5} className="table-td text-sm text-gray-400">No globals yet. Add shoot_days, crew_count, daily_rate… to drive budget formulas.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Fringe Profiles (read-only here; managed via labor/fringe tooling) */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Fringe / Overhead Profiles</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-th">Name</th>
              <th className="table-th">%</th>
              <th className="table-th">Description</th>
            </tr>
          </thead>
          <tbody>
            {fringes.map((f: any) => (
              <tr key={f.id} className="table-row">
                <td className="table-td font-medium text-sm">{f.name}</td>
                <td className="table-td text-sm text-gray-700">{f.percentage}%</td>
                <td className="table-td text-sm text-gray-500">{f.description || '—'}</td>
              </tr>
            ))}
            {fringes.length === 0 && <tr><td colSpan={3} className="table-td text-sm text-gray-400">No fringe profiles.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
