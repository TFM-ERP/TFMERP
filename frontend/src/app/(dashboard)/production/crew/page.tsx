'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Clapperboard, Search, Plus, Plane, MapPin, RefreshCw, ArrowUpAZ, ArrowDownZA, Link2 as LinkIcon, Loader2 } from 'lucide-react';
import { crewApi, travelApi, assetUrl } from '@/lib/api';
import TravelIdentityPanel from '@/components/production/TravelIdentityPanel';

const fmtRate = (c: any) => {
  if (c.dayRateUsd) return `$${Number(c.dayRateUsd).toLocaleString()}/day`;
  if (c.dayRateAed) return `AED ${Number(c.dayRateAed).toLocaleString()}/day`;
  if (c.weeklyRateUsd) return `$${Number(c.weeklyRateUsd).toLocaleString()}/wk`;
  if (c.weeklyRateAed) return `AED ${Number(c.weeklyRateAed).toLocaleString()}/wk`;
  return '—';
};

const SORTS: { v: string; l: string }[] = [
  { v: 'name', l: 'Name (alphabetic)' },
  { v: 'department', l: 'Department' },
  { v: 'role', l: 'Role' },
  { v: 'country', l: 'Country' },
];

export default function CrewDirectoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('');
  const [scope, setScope] = useState('');
  const [depts, setDepts] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [view, setView] = useState<'table' | 'dept'>('table');
  const [identityId, setIdentityId] = useState<string | null>(null);
  const [opening, setOpening] = useState('');
  const openTravel = async (crewId: string) => {
    setOpening(crewId);
    try { const r = await travelApi.identityFromCrew(crewId); setIdentityId(r.data?.id); } finally { setOpening(''); }
  };

  const sorted = useMemo(() => {
    const key = (c: any): string => {
      if (sortBy === 'department') return `${c.department || '~'}|${c.role || '~'}|${c.name || ''}`;
      if (sortBy === 'role') return `${c.role || '~'}|${c.name || ''}`;
      if (sortBy === 'country') return `${c.baseCountry || c.nationality || '~'}|${c.name || ''}`;
      return c.name || '';
    };
    const out = [...items].sort((a, b) => key(a).localeCompare(key(b), undefined, { sensitivity: 'base' }));
    return sortDir === 'desc' ? out.reverse() : out;
  }, [items, sortBy, sortDir]);

  const load = () => {
    setLoading(true);
    crewApi.list({ search: q || undefined, department: dept || undefined, scope: scope || undefined })
      .then(r => setItems(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, [q, dept, scope]); // eslint-disable-line
  useEffect(() => { crewApi.departments().then(r => setDepts(r.data || [])).catch(() => {}); }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="marquee-panel flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-[9.5px] font-bold uppercase" style={{ letterSpacing: '.2em', color: 'var(--gold)' }}>Production · People</div>
          <h1 className="text-[20px] font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>Crew Directory</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>{items.length} freelance crew — rate cards, documents and bank details.</p>
        </div>
        <Link href="/production/crew/new" className="btn btn-primary"><Plus size={14} /> Add crew</Link>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search name, role, department…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <select className="input w-48" value={dept} onChange={e => setDept(e.target.value)}><option value="">All departments</option>{depts.map(d => <option key={d}>{d}</option>)}</select>
        <select className="input w-40" value={scope} onChange={e => setScope(e.target.value)}><option value="">Local & abroad</option><option value="local">Local hire</option><option value="abroad">Flown in</option></select>
        <select className="input w-44" value={sortBy} onChange={e => setSortBy(e.target.value)} title="Sort by">{SORTS.map(s => <option key={s.v} value={s.v}>{`Sort: ${s.l}`}</option>)}</select>
        <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} className="btn btn-secondary p-2" title={sortDir === 'asc' ? 'Ascending — click for descending' : 'Descending — click for ascending'}>
          {sortDir === 'asc' ? <ArrowUpAZ size={14} /> : <ArrowDownZA size={14} />}
        </button>
        <button onClick={() => setView(v => v === 'table' ? 'dept' : 'table')} className="btn btn-secondary" title="Toggle view">{view === 'table' ? 'By department' : 'Table'}</button>
        <button onClick={load} className="btn btn-secondary p-2"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
      </div>

      {view === 'dept' && !loading && items.length > 0 ? <DeptView items={sorted} /> : (
      <div className="card overflow-hidden">
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> : items.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No crew yet — add your freelancers.</div>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
              <th className="px-5 py-2.5 text-left">Name</th><th className="px-3 py-2.5 text-left">Department / Role</th><th className="px-3 py-2.5 text-left">Nationality</th><th className="px-3 py-2.5 text-left">Hire</th><th className="px-3 py-2.5 text-left">Access</th><th className="px-3 py-2.5 text-right">Rate</th><th className="px-3 py-2.5 text-left">Contact</th><th className="px-3 py-2.5 text-right">Travel</th>
            </tr></thead>
            <tbody>
              {sorted.map(c => (
                <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="px-5 py-3"><Link href={`/production/crew/${c.id}`} className="font-medium text-gray-800 hover:text-brand-600">{c.name}</Link></td>
                  <td className="px-3 py-3 text-gray-600">{c.department || '—'}{c.role ? ` · ${c.role}` : ''}</td>
                  <td className="px-3 py-3 text-gray-600">{c.baseCountry || c.nationality || '—'}</td>
                  <td className="px-3 py-3"><span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${c.isLocal ? 'bg-teal-50 text-teal-700' : 'bg-blue-50 text-blue-700'}`}>{c.isLocal ? <MapPin size={11} /> : <Plane size={11} />} {c.isLocal ? 'Local' : 'Abroad'}</span></td>
                  <td className="px-3 py-3"><span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${c.parentSystemUserId ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>{c.parentSystemUserId ? 'ERP user' : 'Portal'}</span></td>
                  <td className="px-3 py-3 text-right text-gray-600">{fmtRate(c)}</td>
                  <td className="px-3 py-3 text-xs text-gray-500">{c.phone || c.email || '—'}</td>
                  <td className="px-3 py-3 text-right">
                    <button onClick={() => openTravel(c.id)} disabled={opening === c.id} title="Travel & immigration identity" className="text-[11px] inline-flex items-center gap-1 rounded-lg border border-gray-200 text-gray-600 px-2 py-1 hover:border-[#0f172a] disabled:opacity-40">{opening === c.id ? <Loader2 size={12} className="animate-spin" /> : <Plane size={12} />} Travel</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}

      {identityId && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm" onClick={() => setIdentityId(null)}>
          <div className="w-full max-w-2xl h-full bg-white shadow-2xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <TravelIdentityPanel travelerId={identityId} onClose={() => setIdentityId(null)} />
          </div>
        </div>
      )}
    </div>
  );
}

function DeptView({ items }: { items: any[] }) {
  const groups: Record<string, any[]> = {};
  for (const c of items) { const d = c.department || 'Unassigned'; (groups[d] ||= []).push(c); }
  const depts = Object.keys(groups).sort();
  return (
    <div className="space-y-5">
      {depts.map(d => (
        <div key={d} className="card overflow-hidden">
          <div className="px-5 py-2.5 bg-gray-50 border-b flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">{d}</h3>
            <span className="text-xs text-gray-400">{groups[d].length}</span>
          </div>
          <div className="divide-y">
            {groups[d].map(c => {
              const links: any[] = Array.isArray(c.links) ? c.links : [];
              const credits: any[] = Array.isArray(c.credits) ? c.credits : [];
              const cats: any[] = Array.isArray(c.categories) ? c.categories : [];
              const roles = [c.role, ...cats.map((x: any) => x.role)].filter(Boolean);
              return (
                <div key={c.id} className="px-5 py-3 flex items-start gap-3">
                  {c.photoUrl ? <img src={assetUrl(c.photoUrl)} alt="" className="w-10 h-10 rounded-lg object-cover border" /> : <div className="w-10 h-10 rounded-lg bg-gray-100" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/production/crew/${c.id}`} className="font-medium text-gray-800 hover:text-brand-600">{c.name}</Link>
                      {roles.slice(0, 4).map((r: string, i: number) => <span key={i} className="text-[10px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{r}</span>)}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">{[c.baseCountry || c.nationality, c.phone || c.email].filter(Boolean).join(' · ')}</div>
                    {links.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {links.map((l: any, i: number) => l.url && <a key={i} href={l.url} target="_blank" rel="noreferrer" className="text-[11px] text-blue-600 inline-flex items-center gap-0.5"><LinkIcon size={10} /> {l.label || 'Link'}</a>)}
                      </div>
                    )}
                    {credits.length > 0 && (
                      <div className="text-[11px] text-gray-400 mt-1">
                        <span className="font-medium text-gray-500">{credits.length} credits</span>: {credits.slice(0, 3).map((cr: any) => `${cr.title}${cr.year ? ` (${cr.year})` : ''}`).join(', ')}{credits.length > 3 ? '…' : ''}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-500 shrink-0">{fmtRate(c)}</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
