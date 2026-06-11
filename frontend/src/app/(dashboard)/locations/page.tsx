'use client';

import { useState, useEffect, useCallback } from 'react';
import { locationLibraryApi, productionApi } from '@/lib/api';
import {
  MapPin, Plus, Search, X, Image as ImageIcon, Star, ExternalLink,
  Building2, History, DollarSign, Trash2, Edit2, Archive, Save, Shield, Coins, BadgeCheck,
} from 'lucide-react';
import { SecurityTab, PaymentsTab, PermitsTab, DocumentsTab, OpsAdapter } from '@/components/production/LocationOps';

// Master-scope adapter — same ops, run directly on the library asset (standalone, no project).
const masterOps = (): OpsAdapter => ({
  authorities: locationLibraryApi.authorities,
  listSecurity: locationLibraryApi.mSecurity, addSecurity: locationLibraryApi.mAddSecurity, updSecurity: locationLibraryApi.updSecurity, delSecurity: locationLibraryApi.delSecurity,
  listPayments: locationLibraryApi.mPayments, paySummary: locationLibraryApi.mPaySummary, addPayment: locationLibraryApi.mAddPayment, updPayment: locationLibraryApi.updPayment, delPayment: locationLibraryApi.delPayment, markPaid: locationLibraryApi.markPaid,
  listPermits: locationLibraryApi.mPermits, addPermit: locationLibraryApi.mAddPermit, updPermit: locationLibraryApi.updPermit, delPermit: locationLibraryApi.delPermit,
  listDocs: locationLibraryApi.mDocs, addDoc: locationLibraryApi.mAddDoc, updDoc: locationLibraryApi.updDoc, delDoc: locationLibraryApi.delDoc,
  importEmail: productionApi.locations.importEmailMaster,
});

const STATUSES = [
  { value: 'PROSPECT', label: 'Prospect', cls: 'bg-gray-100 text-gray-700' },
  { value: 'LIBRARY', label: 'Library', cls: 'bg-blue-100 text-blue-800' },
  { value: 'PREFERRED', label: 'Preferred', cls: 'bg-green-100 text-green-800' },
  { value: 'RESTRICTED', label: 'Restricted', cls: 'bg-amber-100 text-amber-800' },
  { value: 'BLACKLISTED', label: 'Blacklisted', cls: 'bg-red-100 text-red-800' },
  { value: 'ARCHIVED', label: 'Archived', cls: 'bg-gray-100 text-gray-500' },
];
const CATEGORIES = ['INT', 'EXT', 'STUDIO', 'BACKLOT', 'OTHER'];

const EMPTY = {
  name: '', category: 'EXT', subType: '', status: 'LIBRARY', summary: '',
  country: 'United Arab Emirates', region: '', city: '', district: '', fullAddress: '',
  lat: '', lng: '', googleMapsUrl: '', what3words: '',
  accessNotes: '', parkingNotes: '', basecampNotes: '',
  powerNotes: '', internetNotes: '', soundNotes: '',
  ownerName: '', ownerCompany: '', ownerPhone: '', ownerEmail: '',
  restrictions: '', permitAuthority: '', standardFee: '', feeCurrency: 'AED', feeNotes: '',
  nearestHospitalName: '', nearestHospitalPhone: '', safetyNotes: '', notes: '',
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUSES.find((x) => x.value === status);
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${s?.cls || 'bg-gray-100'}`}>{s?.label || status}</span>;
}

const money = (n: any, c = 'AED') => `${c} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

// Graceful image fallback — if a remote photo 404s, swap to a stable seeded placeholder once.
function imgFallback(seed: string) {
  return (e: any) => { const t = e.currentTarget; if (!t.dataset.fb) { t.dataset.fb = '1'; t.src = `https://picsum.photos/seed/${encodeURIComponent(seed)}/640/360`; } };
}

export default function LocationLibraryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null); // form object or null
  const [saving, setSaving] = useState(false);
  const [alerts, setAlerts] = useState<any>(null);

  useEffect(() => { locationLibraryApi.expiring(30).then((r) => setAlerts(r.data)).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        locationLibraryApi.list({ search: search || undefined, status: statusFilter || undefined }),
        locationLibraryApi.stats(),
      ]);
      setItems(list.data || []);
      setStats(st.data);
    } finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => {
    const { data } = await locationLibraryApi.get(id);
    setDetail(data);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...editing };
      ['lat', 'lng', 'standardFee'].forEach((k) => { if (payload[k] === '') payload[k] = null; });
      if (editing.id) await locationLibraryApi.update(editing.id, payload);
      else await locationLibraryApi.create(payload);
      setEditing(null);
      await load();
      if (detail && editing.id === detail.id) await openDetail(detail.id);
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><MapPin className="text-[#0f172a]" /> Master Location Library</h1>
          <p className="text-sm text-gray-500 mt-1">The company&apos;s permanent location intelligence — vetted once, reused across every production.</p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} className="inline-flex items-center gap-2 bg-[#0f172a] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus size={16} /> Add Location
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Preferred" value={stats.byStatus?.PREFERRED || 0} />
          <StatCard label="In Library" value={stats.byStatus?.LIBRARY || 0} />
          <StatCard label="Restricted" value={stats.byStatus?.RESTRICTED || 0} />
          <StatCard label="Media files" value={stats.media} />
        </div>
      )}

      {/* Compliance expiry alerts */}
      {alerts && (alerts.expiredCount > 0 || alerts.expiringCount > 0) && <ComplianceAlerts alerts={alerts} onOpen={openDetail} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, city, address, description…"
            className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Grid */}
      {loading ? <p className="text-gray-400 text-sm py-10 text-center">Loading…</p>
        : items.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed rounded-xl">
            <MapPin className="mx-auto text-gray-300" size={40} />
            <p className="text-gray-500 mt-3">No locations yet. Add one, or run the migration to import your project locations.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((loc) => {
              const primary = loc.media?.[0];
              return (
                <button key={loc.id} onClick={() => openDetail(loc.id)} className="text-left bg-white border rounded-xl overflow-hidden hover:shadow-md transition group">
                  <div className="h-36 bg-gray-100 flex items-center justify-center overflow-hidden">
                    {primary ? <img src={primary.url} alt={loc.name} onError={imgFallback(loc.id)} className="w-full h-full object-cover" />
                      : <ImageIcon className="text-gray-300" size={32} />}
                  </div>
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-sm group-hover:text-[#0f172a]">{loc.name}</h3>
                      <StatusBadge status={loc.status} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">{[loc.city, loc.region, loc.country].filter(Boolean).join(', ') || '—'}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span className="inline-flex items-center gap-1"><History size={12} /> {loc.timesUsed || 0} uses</span>
                      <span className="inline-flex items-center gap-1"><ImageIcon size={12} /> {loc._count?.media || 0}</span>
                      {Number(loc.totalSpentToDate) > 0 && <span className="inline-flex items-center gap-1"><DollarSign size={12} /> {money(loc.totalSpentToDate, loc.feeCurrency)}</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

      {detail && <DetailDrawer loc={detail} onClose={() => setDetail(null)} onEdit={() => setEditing({ ...EMPTY, ...detail })} onChanged={() => openDetail(detail.id)} reloadList={load} />}
      {editing && <EditModal form={editing} setForm={setEditing} onClose={() => setEditing(null)} onSave={save} saving={saving} />}
    </div>
  );
}

function ComplianceAlerts({ alerts, onOpen }: { alerts: any; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  const Row = ({ i }: { i: any }) => (
    <div className="flex items-center justify-between text-sm px-3 py-1.5 border-b last:border-0">
      <span className="truncate"><span className={`text-[10px] px-1.5 py-0.5 rounded mr-2 ${i.expired ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{i.expired ? 'EXPIRED' : `${i.daysLeft}d`}</span>{i.label} · <span className="text-gray-500">{i.locationName}{i.project ? ` (${i.project})` : ''}</span></span>
      <span className="text-xs text-gray-400 shrink-0">{new Date(i.expiryDate).toLocaleDateString()}</span>
    </div>
  );
  return (
    <div className={`mb-5 border rounded-xl ${alerts.expiredCount ? 'border-red-200 bg-red-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium">
        <span className="inline-flex items-center gap-2 text-amber-800">⚠ Compliance expiries — {alerts.expiredCount} expired, {alerts.expiringCount} within {alerts.days} days</span>
        <span className="text-xs text-gray-400">{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <div className="bg-white border-t max-h-64 overflow-y-auto">
          {[...alerts.expired, ...alerts.expiring].slice(0, 40).map((i: any) => <Row key={`${i.kind}-${i.id}`} i={i} />)}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: any }) {
  return (
    <div className="bg-white border rounded-xl p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function DetailDrawer({ loc, onClose, onEdit, onChanged, reloadList }: any) {
  const [mediaUrl, setMediaUrl] = useState('');
  const [adding, setAdding] = useState(false);

  const addMedia = async () => {
    if (!mediaUrl.trim()) return;
    setAdding(true);
    try { await locationLibraryApi.addMedia(loc.id, { url: mediaUrl.trim(), type: 'PHOTO' }); setMediaUrl(''); await onChanged(); }
    finally { setAdding(false); }
  };
  const setPrimary = async (mid: string) => { await locationLibraryApi.setPrimary(mid); await onChanged(); reloadList(); };
  const removeMedia = async (mid: string) => { await locationLibraryApi.removeMedia(mid); await onChanged(); reloadList(); };
  const archive = async () => { if (confirm('Archive this location?')) { await locationLibraryApi.archive(loc.id); await onChanged(); reloadList(); } };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 glass-bar border-b px-5 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">{loc.name}</h2><StatusBadge status={loc.status} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onEdit} className="text-sm inline-flex items-center gap-1 text-gray-600 hover:text-black"><Edit2 size={14} /> Edit</button>
            <button onClick={archive} className="text-sm inline-flex items-center gap-1 text-gray-600 hover:text-red-600"><Archive size={14} /> Archive</button>
            <button onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Media */}
          <Section title="Media" icon={ImageIcon}>
            {loc.media?.length ? (
              <div className="grid grid-cols-3 gap-2">
                {loc.media.map((m: any) => (
                  <div key={m.id} className="relative group rounded-lg overflow-hidden border h-24 bg-gray-100">
                    <img src={m.url} alt={m.caption || ''} onError={imgFallback(m.id)} className="w-full h-full object-cover" />
                    {m.isPrimary && <span className="absolute top-1 left-1 bg-[#0f172a] text-white rounded px-1 text-[10px]">Primary</span>}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition">
                      {!m.isPrimary && <button onClick={() => setPrimary(m.id)} title="Set primary"><Star size={16} className="text-white" /></button>}
                      <button onClick={() => removeMedia(m.id)} title="Remove"><Trash2 size={16} className="text-white" /></button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">No media yet.</p>}
            <div className="flex gap-2 mt-2">
              <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="Paste image URL (upload coming in slice 2)" className="flex-1 border rounded-lg px-3 py-1.5 text-sm" />
              <button onClick={addMedia} disabled={adding} className="text-sm bg-gray-900 text-white px-3 rounded-lg disabled:opacity-50">Add</button>
            </div>
          </Section>

          {loc.summary && <p className="text-sm text-gray-600">{loc.summary}</p>}

          <Section title="Location" icon={MapPin}>
            <Field label="Address" value={loc.fullAddress} />
            <Field label="Area" value={[loc.district, loc.city, loc.region, loc.country].filter(Boolean).join(', ')} />
            {(loc.lat && loc.lng) && <Field label="GPS" value={`${loc.lat}, ${loc.lng}`} />}
            {loc.googleMapsUrl && <a href={loc.googleMapsUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 inline-flex items-center gap-1">Open in Google Maps <ExternalLink size={12} /></a>}
            {loc.what3words && <Field label="what3words" value={loc.what3words} />}
          </Section>

          <Section title="Access & Technical">
            <Field label="Access" value={loc.accessNotes} />
            <Field label="Parking" value={loc.parkingNotes} />
            <Field label="Basecamp" value={loc.basecampNotes} />
            <Field label="Power" value={loc.powerNotes} />
            <Field label="Internet / cellular" value={loc.internetNotes} />
            <Field label="Sound / ambient" value={loc.soundNotes} />
          </Section>

          <Section title="Ownership, Permits & Fee" icon={Building2}>
            <Field label="Owner" value={[loc.ownerName, loc.ownerCompany].filter(Boolean).join(' · ')} />
            <Field label="Owner contact" value={[loc.ownerPhone, loc.ownerEmail].filter(Boolean).join(' · ')} />
            <Field label="Permit authority" value={loc.permitAuthority} />
            <Field label="Standard fee" value={loc.standardFee ? `${money(loc.standardFee, loc.feeCurrency)}/day` : null} />
            <Field label="Restrictions" value={loc.restrictions} />
          </Section>

          <Section title="Safety">
            <Field label="Nearest hospital" value={[loc.nearestHospitalName, loc.nearestHospitalPhone].filter(Boolean).join(' · ')} />
            <Field label="Safety notes" value={loc.safetyNotes} />
          </Section>

          {/* Production history — the two-way accretion */}
          <Section title="Production history" icon={History}>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <Mini label="Times used" value={loc.timesUsed || 0} />
              <Mini label="Total spent" value={money(loc.totalSpentToDate, loc.feeCurrency)} />
              <Mini label="Last used" value={loc.lastUsedAt ? new Date(loc.lastUsedAt).toLocaleDateString() : '—'} />
            </div>
            {loc.usages?.length ? (
              <div className="border rounded-lg divide-y">
                {loc.usages.map((u: any) => (
                  <div key={u.id} className="px-3 py-2 text-sm flex items-center justify-between">
                    <span>{u.project?.title || 'Project'}</span>
                    <span className="text-xs text-gray-400">{u.scenes ? `Sc. ${u.scenes}` : ''} {u.status}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">Not yet linked to any project.</p>}
          </Section>

          {/* Standalone operations — manage security & payments directly on the library asset */}
          <MasterOpsPanel locationId={loc.id} />
        </div>
      </div>
    </div>
  );
}

function MasterOpsPanel({ locationId }: { locationId: string }) {
  const [tab, setTab] = useState<'documents' | 'permits' | 'security' | 'payments'>('documents');
  const a = masterOps();
  const tabs: [string, any][] = [['documents', ImageIcon], ['permits', BadgeCheck], ['security', Shield], ['payments', Coins]];
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5"><Building2 size={13} /> Operations (standalone)</h3>
      <div className="flex border-b text-sm mb-3 flex-wrap">
        {tabs.map(([k, Icon]) => (
          <button key={k} onClick={() => setTab(k as any)} className={`px-3 py-1.5 inline-flex items-center gap-1 capitalize ${tab === k ? 'border-b-2 border-[#0f172a] font-medium' : 'text-gray-500'}`}><Icon size={13} /> {k}</button>
        ))}
      </div>
      {tab === 'documents' && <DocumentsTab id={locationId} a={a} />}
      {tab === 'permits' && <PermitsTab id={locationId} a={a} />}
      {tab === 'security' && <SecurityTab id={locationId} a={a} />}
      {tab === 'payments' && <PaymentsTab id={locationId} a={a} />}
    </div>
  );
}

function Section({ title, icon: Icon, children }: any) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5">{Icon && <Icon size={13} />}{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
function Field({ label, value }: { label: string; value: any }) {
  if (!value) return null;
  return <div className="text-sm"><span className="text-gray-400">{label}: </span><span className="text-gray-800">{value}</span></div>;
}
function Mini({ label, value }: any) {
  return <div className="bg-gray-50 rounded-lg p-2 text-center"><div className="text-[11px] text-gray-400">{label}</div><div className="text-sm font-semibold mt-0.5">{value}</div></div>;
}

function EditModal({ form, setForm, onClose, onSave, saving }: any) {
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const inp = 'w-full border rounded-lg px-3 py-1.5 text-sm';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 glass-bar border-b px-5 py-3 flex items-center justify-between">
          <h2 className="font-semibold">{form.id ? 'Edit location' : 'Add location'}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <L label="Name *" full><input className={inp} value={form.name} onChange={(e) => set('name', e.target.value)} /></L>
          <L label="Category"><select className={inp} value={form.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></L>
          <L label="Sub-type"><input className={inp} value={form.subType} onChange={(e) => set('subType', e.target.value)} placeholder="Villa, Desert, Office…" /></L>
          <L label="Status"><select className={inp} value={form.status} onChange={(e) => set('status', e.target.value)}>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></L>
          <L label="Standard fee / day"><input className={inp} type="number" value={form.standardFee} onChange={(e) => set('standardFee', e.target.value)} /></L>
          <L label="Summary" full><textarea className={inp} rows={2} value={form.summary} onChange={(e) => set('summary', e.target.value)} /></L>
          <L label="Country"><input className={inp} value={form.country} onChange={(e) => set('country', e.target.value)} /></L>
          <L label="Region / Emirate"><input className={inp} value={form.region} onChange={(e) => set('region', e.target.value)} /></L>
          <L label="City"><input className={inp} value={form.city} onChange={(e) => set('city', e.target.value)} /></L>
          <L label="District / area"><input className={inp} value={form.district} onChange={(e) => set('district', e.target.value)} /></L>
          <L label="Full address" full><input className={inp} value={form.fullAddress} onChange={(e) => set('fullAddress', e.target.value)} /></L>
          <L label="Latitude"><input className={inp} value={form.lat} onChange={(e) => set('lat', e.target.value)} /></L>
          <L label="Longitude"><input className={inp} value={form.lng} onChange={(e) => set('lng', e.target.value)} /></L>
          <L label="Google Maps URL" full><input className={inp} value={form.googleMapsUrl} onChange={(e) => set('googleMapsUrl', e.target.value)} /></L>
          <L label="Access notes" full><textarea className={inp} rows={2} value={form.accessNotes} onChange={(e) => set('accessNotes', e.target.value)} /></L>
          <L label="Parking notes" full><input className={inp} value={form.parkingNotes} onChange={(e) => set('parkingNotes', e.target.value)} /></L>
          <L label="Owner name"><input className={inp} value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} /></L>
          <L label="Owner phone"><input className={inp} value={form.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} /></L>
          <L label="Permit authority"><input className={inp} value={form.permitAuthority} onChange={(e) => set('permitAuthority', e.target.value)} /></L>
          <L label="Restrictions"><input className={inp} value={form.restrictions} onChange={(e) => set('restrictions', e.target.value)} /></L>
          <L label="Nearest hospital"><input className={inp} value={form.nearestHospitalName} onChange={(e) => set('nearestHospitalName', e.target.value)} /></L>
          <L label="Hospital phone"><input className={inp} value={form.nearestHospitalPhone} onChange={(e) => set('nearestHospitalPhone', e.target.value)} /></L>
          <L label="Notes" full><textarea className={inp} rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} /></L>
        </div>
        <div className="sticky bottom-0 bg-white border-t px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button onClick={onSave} disabled={saving || !form.name} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#0f172a] text-white rounded-lg disabled:opacity-50"><Save size={15} /> {saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
function L({ label, full, children }: any) {
  return <label className={`text-sm ${full ? 'col-span-2' : ''}`}><span className="block text-xs text-gray-500 mb-1">{label}</span>{children}</label>;
}
