'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { masterScriptApi, assetUrl } from '@/lib/api';
import { ScrollText, Plus, Search, X, Trash2, Save, Upload, FileText, Layers, History, Link2, Palette, Loader2, ExternalLink } from 'lucide-react';

const STATUSES = [
  { value: 'DEVELOPMENT', label: 'Development', cls: 'bg-amber-100 text-amber-800' },
  { value: 'ACTIVE', label: 'Active', cls: 'bg-green-100 text-green-800' },
  { value: 'ARCHIVED', label: 'Archived', cls: 'bg-gray-100 text-gray-500' },
];
const KINDS = ['FEATURE', 'SERIES', 'SHORT', 'OTHER'];
const EMPTY = { title: '', logline: '', kind: 'FEATURE', writer: '', status: 'DEVELOPMENT', summary: '' };

function StatusBadge({ status }: { status: string }) {
  const s = STATUSES.find((x) => x.value === status);
  return <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${s?.cls || 'bg-gray-100'}`}>{s?.label || status}</span>;
}

export default function ScriptLibraryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, st] = await Promise.all([
        masterScriptApi.list({ search: search || undefined, status: statusFilter || undefined }),
        masterScriptApi.stats(),
      ]);
      setItems(list.data || []);
      setStats(st.data);
    } finally { setLoading(false); }
  }, [search, statusFilter]);
  useEffect(() => { load(); }, [load]);

  const openDetail = async (id: string) => { const { data } = await masterScriptApi.get(id); setDetail(data); };

  const save = async () => {
    setSaving(true);
    try {
      if (editing.id) await masterScriptApi.update(editing.id, editing);
      else await masterScriptApi.create(editing);
      setEditing(null);
      await load();
      if (detail && editing.id === detail.id) await openDetail(detail.id);
    } finally { setSaving(false); }
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><ScrollText className="text-[#0f172a]" /> Script Library</h1>
          <p className="text-sm text-gray-500 mt-1">The company&apos;s master scripts — develop once, link into any project. Palettes &amp; saved voices carry across.</p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })} className="inline-flex items-center gap-2 bg-[#0f172a] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90">
          <Plus size={16} /> New script
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <StatCard label="Total" value={stats.total} />
          <StatCard label="Active" value={stats.byStatus?.ACTIVE || 0} />
          <StatCard label="In development" value={stats.byStatus?.DEVELOPMENT || 0} />
          <StatCard label="Revisions" value={stats.revisions} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, writer, logline…" className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? <p className="text-gray-400 text-sm py-10 text-center">Loading…</p>
        : items.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed rounded-xl">
            <ScrollText className="mx-auto text-gray-300" size={40} />
            <p className="text-gray-500 mt-3">No library scripts yet. Create one, or promote a project script into the library from its ScriptON tab.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((m) => (
              <button key={m.id} onClick={() => openDetail(m.id)} className="text-left bg-white border rounded-xl p-4 hover:shadow-md transition group">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-sm group-hover:text-[#0f172a] flex items-center gap-1.5"><FileText size={15} className="text-gray-400" /> {m.title}</h3>
                  <StatusBadge status={m.status} />
                </div>
                {m.logline && <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{m.logline}</p>}
                <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{m.kind}</span>
                  <span className="inline-flex items-center gap-1"><Layers size={12} /> {m._count?.revisions || 0}</span>
                  <span className="inline-flex items-center gap-1"><Link2 size={12} /> {m._count?.linkedDocs || 0}</span>
                  <span className="inline-flex items-center gap-1"><History size={12} /> {m.timesUsed || 0} uses</span>
                </div>
                {m.writer && <p className="text-[11px] text-gray-400 mt-2">Written by {m.writer}</p>}
              </button>
            ))}
          </div>
        )}

      {detail && <DetailDrawer m={detail} onClose={() => setDetail(null)} onEdit={() => setEditing({ ...EMPTY, ...detail })} onChanged={() => openDetail(detail.id)} reloadList={load} />}
      {editing && <EditModal form={editing} setForm={setEditing} onClose={() => setEditing(null)} onSave={save} saving={saving} />}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: any }) {
  return <div className="bg-white border rounded-xl p-3"><div className="text-xs text-gray-500">{label}</div><div className="text-xl font-semibold mt-1">{value}</div></div>;
}

function DetailDrawer({ m, onClose, onEdit, onChanged, reloadList }: any) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [revLabel, setRevLabel] = useState('Draft');
  const [revColor, setRevColor] = useState('#e2e8f0');

  const upload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file); fd.append('revisionLabel', revLabel || 'Draft'); fd.append('colorCode', revColor);
      await masterScriptApi.addRevision(m.id, fd);
      await onChanged(); reloadList();
    } catch (e: any) { alert(e?.response?.data?.message || 'Upload failed.'); }
    finally { setUploading(false); }
  };
  const delRev = async (id: string) => { if (confirm('Delete this revision?')) { await masterScriptApi.removeRevision(id); await onChanged(); reloadList(); } };
  const del = async () => { if (confirm('Delete this library script? Linked projects keep their copies but lose the link.')) { await masterScriptApi.remove(m.id); reloadList(); onClose(); } };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white h-full overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2"><h2 className="font-semibold">{m.title}</h2><StatusBadge status={m.status} /></div>
          <div className="flex items-center gap-3">
            <button onClick={onEdit} className="text-sm text-gray-600 hover:text-black">Edit</button>
            <button onClick={del} className="text-sm text-gray-600 hover:text-red-600 inline-flex items-center gap-1"><Trash2 size={14} /> Delete</button>
            <button onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        <div className="p-5 space-y-6">
          {m.logline && <p className="text-sm text-gray-600">{m.logline}</p>}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Mini label="Kind" value={m.kind} />
            <Mini label="Writer" value={m.writer || '—'} />
            <Mini label="Times used" value={m.timesUsed || 0} />
          </div>

          {/* Revisions */}
          <Section title="Revisions" icon={Layers}>
            <div className="flex flex-wrap items-end gap-2 mb-3">
              <label className="text-xs text-gray-500">Label<input value={revLabel} onChange={(e) => setRevLabel(e.target.value)} className="block border rounded-lg px-2 py-1 text-sm mt-0.5 w-28" /></label>
              <label className="text-xs text-gray-500">Colour<input type="color" value={revColor} onChange={(e) => setRevColor(e.target.value)} className="block w-9 h-8 rounded border mt-0.5" /></label>
              <input ref={fileRef} type="file" accept="application/pdf,.pdf,.fdx" className="hidden" onChange={(e) => upload(e.target.files?.[0] || null)} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1.5 bg-[#0f172a] text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Upload PDF / FDX
              </button>
            </div>
            {(m.revisions || []).length === 0 ? <p className="text-sm text-gray-400">No revisions yet.</p> : (
              <div className="border rounded-lg divide-y">
                {m.revisions.map((r: any) => (
                  <div key={r.id} className="px-3 py-2 text-sm flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full border" style={{ background: r.colorCode || '#e2e8f0' }} />
                    <span className="font-medium">{r.revisionLabel}</span>
                    <span className="text-xs text-gray-400">{r.pageCount} pages · {new Date(r.createdAt).toLocaleDateString()}</span>
                    <div className="ml-auto flex items-center gap-3">
                      {r.pdfUrl && <a href={assetUrl(r.pdfUrl)} target="_blank" rel="noreferrer" className="text-blue-600 inline-flex items-center gap-1 text-xs">Open <ExternalLink size={11} /></a>}
                      <button onClick={() => delRev(r.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Palettes */}
          <PaletteEditor m={m} onChanged={onChanged} />

          {/* Linked projects */}
          <Section title="Linked projects" icon={Link2}>
            {(m.linkedDocs || []).length === 0 ? <p className="text-sm text-gray-400">Not linked into any project yet. Use “New script” inside a project&apos;s ScriptON tab to link this.</p> : (
              <div className="border rounded-lg divide-y">
                {m.linkedDocs.map((d: any) => (
                  <a key={d.id} href={`/production/projects/${d.projectId}?tab=script`} className="px-3 py-2 text-sm flex items-center justify-between hover:bg-gray-50">
                    <span>{d.title}</span>
                    <span className="text-xs text-gray-400">{new Date(d.createdAt).toLocaleDateString()} <ExternalLink size={11} className="inline" /></span>
                  </a>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function PaletteEditor({ m, onChanged }: any) {
  const [cats, setCats] = useState<any[]>(Array.isArray(m.tagPalette) ? m.tagPalette : []);
  const [voices, setVoices] = useState<any[]>(Array.isArray(m.voicePalette) ? m.voicePalette : []);
  const [saving, setSaving] = useState(false);
  const addCat = () => setCats([...cats, { key: `TAG${cats.length + 1}`, label: 'New tag', color: '#0ea5e9', sortOrder: cats.length }]);
  const addVoice = () => setVoices([...voices, { character: 'CHARACTER', voiceURI: '', rate: 1, pitch: 1 }]);
  const save = async () => {
    setSaving(true);
    try { await masterScriptApi.setPalette(m.id, { tagPalette: cats, voicePalette: voices }); await onChanged(); }
    finally { setSaving(false); }
  };
  return (
    <Section title="Reusable palettes" icon={Palette}>
      <p className="text-xs text-gray-400 mb-2">Tag categories and saved character voices stored here are inherited by every project that links this script.</p>
      <div className="space-y-1.5 mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Tag categories</p>
        {cats.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="color" value={c.color || '#0ea5e9'} onChange={(e) => { const n = [...cats]; n[i] = { ...c, color: e.target.value }; setCats(n); }} className="w-7 h-7 rounded border p-0.5" />
            <input value={c.label} onChange={(e) => { const n = [...cats]; n[i] = { ...c, label: e.target.value }; setCats(n); }} className="flex-1 border rounded px-2 py-1 text-sm" />
            <input value={c.key} onChange={(e) => { const n = [...cats]; n[i] = { ...c, key: e.target.value.toUpperCase() }; setCats(n); }} className="w-24 border rounded px-2 py-1 text-xs font-mono" />
            <button onClick={() => setCats(cats.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
          </div>
        ))}
        <button onClick={addCat} className="text-xs text-gray-500 hover:text-black inline-flex items-center gap-1"><Plus size={12} /> Add category</button>
      </div>
      <div className="space-y-1.5 mb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Saved voices</p>
        {voices.map((v, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={v.character} onChange={(e) => { const n = [...voices]; n[i] = { ...v, character: e.target.value.toUpperCase() }; setVoices(n); }} placeholder="CHARACTER" className="flex-1 border rounded px-2 py-1 text-sm" />
            <input value={v.voiceURI || ''} onChange={(e) => { const n = [...voices]; n[i] = { ...v, voiceURI: e.target.value }; setVoices(n); }} placeholder="voice URI / name" className="flex-1 border rounded px-2 py-1 text-xs" />
            <button onClick={() => setVoices(voices.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
          </div>
        ))}
        <button onClick={addVoice} className="text-xs text-gray-500 hover:text-black inline-flex items-center gap-1"><Plus size={12} /> Add voice</button>
      </div>
      <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 bg-[#0f172a] text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save palettes
      </button>
    </Section>
  );
}

function Section({ title, icon: Icon, children }: any) {
  return <div><h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5">{Icon && <Icon size={13} />}{title}</h3>{children}</div>;
}
function Mini({ label, value }: any) {
  return <div className="bg-gray-50 rounded-lg p-2 text-center"><div className="text-[11px] text-gray-400">{label}</div><div className="text-sm font-semibold mt-0.5">{value}</div></div>;
}

function EditModal({ form, setForm, onClose, onSave, saving }: any) {
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const inp = 'w-full border rounded-lg px-3 py-1.5 text-sm';
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-5 py-3 flex items-center justify-between"><h2 className="font-semibold">{form.id ? 'Edit script' : 'New library script'}</h2><button onClick={onClose}><X size={18} /></button></div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <L label="Title *" full><input className={inp} value={form.title} onChange={(e) => set('title', e.target.value)} /></L>
          <L label="Kind"><select className={inp} value={form.kind} onChange={(e) => set('kind', e.target.value)}>{KINDS.map((k) => <option key={k}>{k}</option>)}</select></L>
          <L label="Status"><select className={inp} value={form.status} onChange={(e) => set('status', e.target.value)}>{STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select></L>
          <L label="Writer" full><input className={inp} value={form.writer} onChange={(e) => set('writer', e.target.value)} /></L>
          <L label="Logline" full><textarea className={inp} rows={2} value={form.logline} onChange={(e) => set('logline', e.target.value)} /></L>
          <L label="Summary" full><textarea className={inp} rows={3} value={form.summary} onChange={(e) => set('summary', e.target.value)} /></L>
        </div>
        <div className="border-t px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
          <button onClick={onSave} disabled={saving || !form.title} className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[#0f172a] text-white rounded-lg disabled:opacity-50"><Save size={15} /> {saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
function L({ label, full, children }: any) {
  return <label className={`text-sm ${full ? 'col-span-2' : ''}`}><span className="block text-xs text-gray-500 mb-1">{label}</span>{children}</label>;
}
