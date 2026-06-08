'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, FileText, X, Save, ImageIcon, Plus, Trash2, Sparkles, ClipboardPaste } from 'lucide-react';
import { crewApi, uploadFile, assetUrl } from '@/lib/api';
import { NATIONALITIES, COUNTRIES } from '@/lib/countries';
import { cn } from '@/lib/utils';
import DepartmentRolePicker from './DepartmentRolePicker';

function F({ label, k, form, set, type = 'text', span }: any) {
  return (
    <div className={span ? 'col-span-2' : ''}>
      <label className="label">{label}</label>
      <input type={type} className="input w-full" value={form[k] ?? ''} onChange={e => set(k, e.target.value)} />
    </div>
  );
}

// Stable top-level upload field (defining it inside the form would remount it each keystroke).
function DocField({ label, value, onUploaded, note, accept = '.pdf,.jpg,.jpeg,.png,.webp,.heic' }:
  { label: string; value?: string; onUploaded: (url: string) => void; note?: string; accept?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const onFile = async (e: any) => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    setBusy(true); setErr('');
    try { const up = await uploadFile(file); onUploaded(up.url); }
    catch (ex: any) { setErr(ex?.response?.data?.message || ex?.message || 'Upload failed.'); }
    finally { setBusy(false); }
  };
  return (
    <div>
      <label className="label">{label}</label>
      {value ? (
        <div className="flex items-center gap-2 text-sm">
          <a href={assetUrl(value)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700"><FileText size={14} /> View</a>
          <button type="button" onClick={() => onUploaded('')} className="text-gray-300 hover:text-red-500"><X size={14} /></button>
        </div>
      ) : (
        <label className="btn btn-secondary text-xs cursor-pointer inline-flex">
          <Upload size={13} className="mr-1" /> {busy ? 'Uploading…' : 'Attach'}
          <input type="file" accept={accept} className="hidden" onChange={onFile} />
        </label>
      )}
      {err && <p className="text-[10px] text-red-500 mt-0.5">{err}</p>}
      {note && <p className="text-[10px] text-gray-400 mt-0.5">{note}</p>}
    </div>
  );
}

export default function CrewForm({ id }: { id?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<any>({ isLocal: true, status: 'ACTIVE' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const set = (k: string, v: any) => { setSaved(false); setForm((f: any) => ({ ...f, [k]: v })); };
  // V1.2: ERP identity link
  const [pasteOpen, setPasteOpen] = useState(false);
  const mergeSuggestion = (s: any) => setForm((f: any) => ({
    ...f,
    name: f.name || s.name || '',
    department: f.department || s.department || '',
    role: f.role || s.role || '',
    nationality: f.nationality || s.nationality || '',
    email: f.email || s.email || '',
    phone: f.phone || s.phone || '',
    phone2: f.phone2 || s.phone2 || '',
    bio: f.bio || s.bio || '',
    skills: f.skills || s.skills || '',
    links: (Array.isArray(s.links) && s.links.length) ? s.links : (f.links || []),
    credits: (Array.isArray(s.credits) && s.credits.length) ? s.credits : (f.credits || []),
    categories: (Array.isArray(s.categories) && s.categories.length) ? s.categories : (f.categories || []),
    affiliations: (Array.isArray(s.affiliations) && s.affiliations.length) ? s.affiliations : (f.affiliations || []),
  }));

  const [parentUsers, setParentUsers] = useState<any[]>([]);
  const [linkBusy, setLinkBusy] = useState(false);
  useEffect(() => { if (id) crewApi.parentUsers().then(r => setParentUsers(r.data || [])).catch(() => {}); }, [id]);
  const linkParent = async (uid: string) => {
    if (!id) return;
    setLinkBusy(true);
    try { const r = await crewApi.linkParentUser(id, uid || null); setForm((f: any) => ({ ...f, parentSystemUserId: r.data.parentSystemUserId, parentSystemUser: r.data.parentSystemUser })); }
    catch (e: any) { alert(e.response?.data?.message || 'Could not update the ERP link.'); }
    finally { setLinkBusy(false); }
  };

  useEffect(() => {
    if (!id) return;
    crewApi.get(id).then(r => {
      const c = r.data;
      ['passportExpiry', 'visaExpiry', 'emiratesIdExpiry'].forEach(k => { if (c[k]) c[k] = String(c[k]).slice(0, 10); });
      setForm(c);
    }).catch(() => router.push('/production/crew'));
  }, [id]);

  const save = async () => {
    if (!form.name) { setError('Name is required'); return; }
    setSaving(true); setError(''); setSaved(false);
    try {
      const res = id ? await crewApi.update(id, form) : await crewApi.create(form);
      if (!id && res.data?.id) { router.push(`/production/crew/${res.data.id}`); return; } // new → open it
      setSaved(true); // editing → stay and confirm
    } catch (e: any) {
      setError(e.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const local = !!form.isLocal;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header with top-right actions */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/production/crew" className="btn btn-secondary p-1.5"><ArrowLeft size={16} /></Link>
        <h1 className="text-2xl font-bold text-gray-900 flex-1">{id ? 'Edit Crew Member' : 'Add Crew Member'}</h1>
        {!id && <button onClick={() => setPasteOpen(true)} className="btn btn-secondary"><ClipboardPaste size={14} className="mr-1" /> Paste profile</button>}
        <button onClick={save} disabled={saving} className={cn('btn', saved ? 'btn-secondary text-green-600' : 'btn-primary')}><Save size={14} className="mr-1" /> {saving ? 'Saving…' : saved ? 'Saved ✓' : id ? 'Save changes' : 'Add crew member'}</button>
        <Link href="/production/crew" className="btn btn-secondary">{saved ? 'Close' : 'Discard'}</Link>
      </div>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="space-y-5">
        {/* Profile */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Profile</h3>
          <div className="grid grid-cols-2 gap-4">
            <F label="Full name *" k="name" form={form} set={set} />
            <DepartmentRolePicker department={form.department} role={form.role} allowOther={false} onChange={(patch) => setForm((f: any) => ({ ...f, ...patch }))} />
            <div><label className="label">Nationality</label><input list="nat-crew" className="input w-full" value={form.nationality || ''} onChange={e => set('nationality', e.target.value)} /><datalist id="nat-crew">{NATIONALITIES.map((n: string) => <option key={n} value={n} />)}</datalist></div>
            <div><label className="label">Base country</label><select className="input w-full" value={form.baseCountry || ''} onChange={e => set('baseCountry', e.target.value)}><option value="">—</option>{COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            <div><label className="label">Hire type</label><select className="input w-full" value={local ? 'local' : 'abroad'} onChange={e => set('isLocal', e.target.value === 'local')}><option value="local">Local hire (UAE)</option><option value="abroad">Flown in / abroad</option></select></div>
            <F label="Email" k="email" form={form} set={set} />
            <F label="Phone (local)" k="phone" form={form} set={set} />
            <F label="Phone 2 (international / second)" k="phone2" form={form} set={set} />
            {/* Personal photo */}
            <div className="col-span-2 flex items-end gap-3">
              <div className="flex-1"><DocField label="Personal photo (official use)" value={form.photoUrl} onUploaded={(u) => set('photoUrl', u)} accept="image/*" note="Use a real, current photo for official documents — not AI-generated or digitally altered." /></div>
              {form.photoUrl && <img src={assetUrl(form.photoUrl)} alt="" className="w-14 h-14 rounded-lg object-cover border border-gray-200" />}
            </div>
            <F label="Showreel / link" k="reelUrl" form={form} set={set} span />
            <div className="col-span-2"><label className="label">Description / bio</label><textarea className="input w-full h-20 resize-none" value={form.bio || ''} onChange={e => set('bio', e.target.value)} /></div>
          </div>
        </div>

        {/* Professional profile (ADFC reel-scout parity) */}
        <ProfileExtras form={form} set={set} setForm={setForm} />

        {/* ERP identity link (V1.2) — only meaningful once the record exists */}
        {id && (
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">ERP system access</h3>
            <p className="text-[11px] text-gray-400 mb-3">
              Temporary crew don&apos;t get a system login — they appear here for payroll &amp; contracts only.
              Link a parent-system user ONLY for staff who run operations (Line Producer, Key Accountant…).
              <b> Linking grants that person ERP ledger access on their projects; leaving it unlinked means zero ledger access.</b>
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <select className="input w-full max-w-md" disabled={linkBusy} value={form.parentSystemUserId || ''} onChange={e => linkParent(e.target.value)}>
                <option value="">— Not linked (portal / payroll only — no ERP access) —</option>
                {parentUsers.map((u: any) => <option key={u.id} value={u.id}>{`${u.fullName} · ${u.email} · ${String(u.role).replace(/_/g, ' ')}`}</option>)}
              </select>
              <span className={cn('text-xs font-semibold px-2 py-1 rounded', form.parentSystemUserId ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                {form.parentSystemUserId ? 'ERP user linked' : 'Portal-only'}
              </span>
            </div>
          </div>
        )}

        {/* Rate card — SHOOT rate + shared PREP/WRAP rate (prep = wrap, always).
            Both daily & weekly. These pull into budget labour blocks per stage. */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Rate card</h3>
          {(() => {
            const usd = !!(form.dayRateUsd || form.weeklyRateUsd || form.prepWrapDayRateUsd) && !(form.dayRateAed || form.weeklyRateAed || form.prepWrapDayRateAed);
            const sfx = usd ? 'Usd' : 'Aed';
            const R = ({ label, base }: { label: string; base: string }) => (
              <div>
                <label className="label">{label}</label>
                <input type="number" className="input w-full" value={form[`${base}${sfx}`] ?? ''} onChange={e => set(`${base}${sfx}`, e.target.value)} />
              </div>
            );
            return (
              <>
                <div className="mb-3 w-40">
                  <label className="label">Currency</label>
                  <select className="input w-full" value={usd ? 'USD' : 'AED'}
                    onChange={e => {
                      const to = e.target.value === 'USD' ? 'Usd' : 'Aed';
                      if (to === sfx) return;
                      setForm((f: any) => {
                        const n = { ...f };
                        for (const b of ['dayRate', 'weeklyRate', 'prepWrapDayRate', 'prepWrapWeeklyRate']) {
                          n[`${b}${to}`] = f[`${b}${sfx}`] ?? ''; // carry values to the new currency
                          n[`${b}${sfx}`] = '';                   // clear the old one
                        }
                        return n;
                      });
                    }}>
                    <option value="AED">AED</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <R label="Shoot day rate" base="dayRate" />
                  <R label="Shoot weekly rate" base="weeklyRate" />
                  <R label="Prep / Wrap day rate" base="prepWrapDayRate" />
                  <R label="Prep / Wrap weekly rate" base="prepWrapWeeklyRate" />
                </div>
                <p className="text-[10px] text-gray-400 mt-2">Prep and wrap always share one rate. When this person is added to a project budget, the labour block auto-fills Prep/Wrap stages at the prep/wrap rate and Shoot at the shoot rate (daily or weekly per the stage unit).</p>
              </>
            );
          })()}
        </div>

        {/* Identity documents */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Identity documents</h3>
          <div className="grid grid-cols-2 gap-4">
            <F label="Passport number" k="passportNumber" form={form} set={set} />
            <F label="Passport expiry" k="passportExpiry" form={form} set={set} type="date" />
            <DocField label="Passport copy" value={form.passportDocUrl} onUploaded={(u) => set('passportDocUrl', u)} />
            <div />
            {local && <>
              <F label="Visa / residency number" k="visaNumber" form={form} set={set} />
              <F label="Visa / residency expiry" k="visaExpiry" form={form} set={set} type="date" />
              <DocField label="Visa / residency copy" value={form.visaDocUrl} onUploaded={(u) => set('visaDocUrl', u)} />
              <div />
              <F label="Emirates ID" k="emiratesId" form={form} set={set} />
              <F label="Emirates ID expiry" k="emiratesIdExpiry" form={form} set={set} type="date" />
              <DocField label="Emirates ID copy" value={form.emiratesIdDocUrl} onUploaded={(u) => set('emiratesIdDocUrl', u)} />
              <div />
            </>}
          </div>
        </div>

        {/* Banking */}
        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Banking (for payments)</h3>
          <div className="grid grid-cols-2 gap-4">
            <F label="Account name" k="accountName" form={form} set={set} />
            <F label="Bank name" k="bankName" form={form} set={set} />
            <F label="Bank address" k="bankAddress" form={form} set={set} span />
            <F label="Account number" k="accountNumber" form={form} set={set} />
            <F label="IBAN" k="iban" form={form} set={set} />
            <F label="SWIFT / BIC" k="swiftCode" form={form} set={set} />
            {local
              ? <DocField label="IBAN / bank certificate" value={form.ibanDocUrl} onUploaded={(u) => set('ibanDocUrl', u)} note="Bank letter confirming the IBAN — required for UAE payments." />
              : <F label="Routing / sort code" k="routingNumber" form={form} set={set} />}
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <label className="label">Notes</label>
          <textarea className="input w-full h-16 resize-none" value={form.notes || ''} onChange={e => set('notes', e.target.value)} />
        </div>

        <div className="flex gap-3">
          <button onClick={save} disabled={saving} className="btn btn-primary flex-1 justify-center">{saving ? 'Saving…' : saved ? 'Saved ✓' : id ? 'Save changes' : 'Add crew member'}</button>
          <Link href="/production/crew" className="btn btn-secondary flex-1 justify-center">{saved ? 'Close' : 'Discard'}</Link>
        </div>
      </div>

      {pasteOpen && <PasteProfileModal onClose={() => setPasteOpen(false)} onParsed={(s) => { mergeSuggestion(s); setPasteOpen(false); }} />}
    </div>
  );
}

const AFFILIATIONS = ['Emirati Crew & Talent', 'Arabic Production Experience', 'Indian Productions Experience', 'International Productions Experience', 'TVC Productions Experience', 'Unscripted Projects Experience'];

function ProfileExtras({ form, set, setForm }: any) {
  const links: any[] = Array.isArray(form.links) ? form.links : [];
  const credits: any[] = Array.isArray(form.credits) ? form.credits : [];
  const cats: any[] = Array.isArray(form.categories) ? form.categories : [];
  const affs: string[] = Array.isArray(form.affiliations) ? form.affiliations : [];
  const upd = (key: string, arr: any[]) => setForm((f: any) => ({ ...f, [key]: arr }));
  const toggleAff = (a: string) => upd('affiliations', affs.includes(a) ? affs.filter((x) => x !== a) : [...affs, a]);

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Professional profile</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><DocField label="Resume / CV (PDF)" value={form.resumeUrl} onUploaded={(u: string) => set('resumeUrl', u)} accept=".pdf,.doc,.docx" /></div>
          <div className="col-span-2"><label className="label">Special skills & experience</label><textarea className="input w-full h-16 resize-none" value={form.skills || ''} onChange={(e) => set('skills', e.target.value)} placeholder="One per line…" /></div>
        </div>

        {/* Weblinks */}
        <div>
          <div className="flex items-center justify-between"><label className="label mb-0">Weblinks</label><button onClick={() => upd('links', [...links, { label: '', url: '' }])} className="text-xs text-[#8a6d2f] inline-flex items-center gap-1"><Plus size={12} /> Add link</button></div>
          {links.map((l, i) => (
            <div key={i} className="flex gap-2 mt-1">
              <input className="input w-40" placeholder="IMDB / Website…" value={l.label || ''} onChange={(e) => { const a = [...links]; a[i] = { ...a[i], label: e.target.value }; upd('links', a); }} />
              <input className="input flex-1" placeholder="https://…" value={l.url || ''} onChange={(e) => { const a = [...links]; a[i] = { ...a[i], url: e.target.value }; upd('links', a); }} />
              <button onClick={() => upd('links', links.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>

        {/* Credits / previous work */}
        <div>
          <div className="flex items-center justify-between"><label className="label mb-0">Previous work / credits</label><button onClick={() => upd('credits', [...credits, { year: '', title: '', role: '' }])} className="text-xs text-[#8a6d2f] inline-flex items-center gap-1"><Plus size={12} /> Add credit</button></div>
          {credits.map((c, i) => (
            <div key={i} className="flex gap-2 mt-1">
              <input className="input w-20" placeholder="Year" value={c.year || ''} onChange={(e) => { const a = [...credits]; a[i] = { ...a[i], year: e.target.value }; upd('credits', a); }} />
              <input className="input flex-1" placeholder="Title" value={c.title || ''} onChange={(e) => { const a = [...credits]; a[i] = { ...a[i], title: e.target.value }; upd('credits', a); }} />
              <input className="input w-44" placeholder="Role" value={c.role || ''} onChange={(e) => { const a = [...credits]; a[i] = { ...a[i], role: e.target.value }; upd('credits', a); }} />
              <button onClick={() => upd('credits', credits.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>

        {/* Extra role categories */}
        <div>
          <div className="flex items-center justify-between"><label className="label mb-0">Additional roles</label><button onClick={() => upd('categories', [...cats, { department: '', role: '' }])} className="text-xs text-[#8a6d2f] inline-flex items-center gap-1"><Plus size={12} /> Add role</button></div>
          {cats.map((c, i) => (
            <div key={i} className="flex gap-2 mt-1">
              <input className="input w-44" placeholder="Department" value={c.department || ''} onChange={(e) => { const a = [...cats]; a[i] = { ...a[i], department: e.target.value }; upd('categories', a); }} />
              <input className="input flex-1" placeholder="Role" value={c.role || ''} onChange={(e) => { const a = [...cats]; a[i] = { ...a[i], role: e.target.value }; upd('categories', a); }} />
              <button onClick={() => upd('categories', cats.filter((_, j) => j !== i))} className="text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>

        {/* Affiliations */}
        <div>
          <label className="label">Affiliations / experience</label>
          <div className="flex flex-wrap gap-2">
            {AFFILIATIONS.map((a) => (
              <button key={a} onClick={() => toggleAff(a)} className={cn('text-xs px-2.5 py-1 rounded-full border', affs.includes(a) ? 'bg-[#0f172a] text-white border-[#0f172a]' : 'bg-white text-gray-600')}>{a}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PasteProfileModal({ onClose, onParsed }: { onClose: () => void; onParsed: (s: any) => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    setBusy(true); setErr('');
    try { const { data } = await crewApi.parseProfile(text); onParsed(data.suggestion || {}); }
    catch (e: any) { setErr(e?.response?.data?.message || 'Parse failed.'); } finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-5 py-3 flex items-center justify-between"><h2 className="font-semibold text-sm flex items-center gap-2"><Sparkles size={15} className="text-[#0f172a]" /> Paste a crew profile</h2><button onClick={onClose}><X size={18} /></button></div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-500">Paste a crew member&apos;s CV or profile text (your own roster, or someone who has shared it / consented). The AI fills the fields below for you to review — nothing is saved until you click Save.</p>
          <textarea autoFocus className="input w-full h-48 resize-none text-sm" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste name, roles, contacts, description, skills, weblinks, credits…" />
          {err && <div className="text-sm text-red-600">{err}</div>}
        </div>
        <div className="border-t px-5 py-3 flex justify-end gap-2">
          <button onClick={onClose} className="btn btn-secondary">Cancel</button>
          <button onClick={go} disabled={busy || text.trim().length < 10} className="btn btn-primary"><Sparkles size={14} className="mr-1" /> {busy ? 'Reading…' : 'Fill fields'}</button>
        </div>
      </div>
    </div>
  );
}
