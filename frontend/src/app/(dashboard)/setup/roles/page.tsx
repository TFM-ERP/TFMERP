'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, Save, RefreshCw } from 'lucide-react';
import { permissionsApi } from '@/lib/api';

const LEVELS = [
  { v: 0, label: 'None' },
  { v: 1, label: 'View' },
  { v: 2, label: 'Edit' },
  { v: 3, label: 'Manage' },
];
const LVL_CLS: Record<number, string> = {
  0: 'text-gray-400', 1: 'text-blue-600', 2: 'text-amber-600', 3: 'text-green-600',
};
const roleLabel = (r: string) => r.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

export default function RolesPage() {
  const [modules, setModules] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Record<string, number>>>({});
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    setLoading(true);
    permissionsApi.matrix().then(r => {
      setModules(r.data.modules); setRoles(r.data.roles); setMatrix(r.data.matrix); setDirty(new Set());
    }).catch((e) => setMsg(e.response?.status === 403 ? 'Only administrators can edit permissions.' : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const setLevel = (role: string, module: string, level: number) => {
    setMatrix(m => ({ ...m, [role]: { ...m[role], [module]: level } }));
    setDirty(d => new Set(d).add(role));
  };

  const saveAll = async () => {
    setSaving(true); setMsg('');
    try {
      for (const role of dirty) await permissionsApi.setRole(role, matrix[role]);
      setMsg('Saved. Users see changes on their next login or refresh.');
      setDirty(new Set());
      setTimeout(() => setMsg(''), 5000);
    } catch (e: any) {
      setMsg(e.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 w-full">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center"><ShieldCheck size={18} className="text-brand-600" /></div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Roles &amp; Permissions</h1>
            <p className="text-sm text-gray-500">What each role can see and do per module. Controls the sidebar and page access.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {msg && <span className="text-sm text-green-600">{msg}</span>}
          <button onClick={load} className="btn-secondary"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Reload</button>
          <button onClick={saveAll} disabled={saving || dirty.size === 0} className="btn-primary"><Save size={14} /> {saving ? 'Saving…' : `Save${dirty.size ? ` (${dirty.size})` : ''}`}</button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
        <span>Levels:</span>
        {LEVELS.map(l => <span key={l.v} className={LVL_CLS[l.v]}>{l.label}</span>)}
        <span className="text-gray-400">· None hides the module entirely.</span>
      </div>

      {loading ? <div className="card h-64 animate-pulse bg-gray-50" /> : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50">Role</th>
                {modules.map(m => <th key={m} className="px-2 py-2.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide" title={m === 'travel_pii' ? 'Travel passport/visa/ID visibility' : undefined}>{m === 'travel_pii' ? 'Travel PII' : m}</th>)}
              </tr>
            </thead>
            <tbody>
              {roles.map(role => {
                const admin = role === 'SYSTEM_ADMIN';
                return (
                  <tr key={role} className="border-b border-gray-50 hover:bg-gray-50/40">
                    <td className="px-4 py-2 font-medium text-gray-800 whitespace-nowrap sticky left-0 bg-white">{roleLabel(role)}{admin && <span className="ml-1 text-[10px] text-gray-400">(full)</span>}</td>
                    {modules.map(m => {
                      const val = admin ? 3 : (matrix[role]?.[m] ?? 0);
                      return (
                        <td key={m} className="px-2 py-1.5 text-center">
                          <select disabled={admin} value={val} onChange={e => setLevel(role, m, Number(e.target.value))}
                            className={`text-xs rounded border border-gray-200 bg-white px-1 py-1 ${LVL_CLS[val]} ${admin ? 'opacity-50' : ''}`}>
                            {LEVELS.map(l => <option key={l.v} value={l.v}>{l.label}</option>)}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-400 mt-3">System Admin always has full access. Changes apply on each user's next login or page refresh.</p>
    </div>
  );
}
