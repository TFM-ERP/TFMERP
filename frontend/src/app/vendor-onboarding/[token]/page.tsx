'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Building2, Upload, CheckCircle, Loader2, ShieldCheck, FileText } from 'lucide-react';

// Public page — no auth. Talks to the token-gated public onboarding API directly.
const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1');
const NAVY = '#1a1a2e', GOLD = '#0f172a';

export default function VendorOnboardingPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<any>(null);
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState<any>({
    name: '', tradeName: '', category: '', contactName: '', phone: '', email: '',
    address: '', city: '', country: 'United Arab Emirates',
    trn: '', vatId: '', iban: '', bankName: '', bankAccount: '', swiftCode: '',
    trnCertUrl: '', tradeLicenseUrl: '', notes: '',
  });
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  useEffect(() => {
    fetch(`${API_ROOT}/public/vendor-onboarding/info/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setInfo).catch(() => setInvalid(true)).finally(() => setLoading(false));
  }, [token]);

  const uploadDoc = useCallback(async (field: 'trnCertUrl' | 'tradeLicenseUrl', file: File) => {
    const fd = new FormData(); fd.append('file', file); fd.append('token', String(token));
    const res = await fetch(`${API_ROOT}/public/vendor-onboarding/upload`, { method: 'POST', body: fd });
    if (!res.ok) { alert('Upload failed — please try a smaller PDF or image.'); return; }
    const data = await res.json();
    set(field, data.url);
  }, [token]);

  const submit = async () => {
    if (!form.name && !form.tradeName) { alert('Please enter your company name.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`${API_ROOT}/public/vendor-onboarding/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, token }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || 'Submission failed'); }
      setDone(true);
    } catch (e: any) { alert(e.message || 'Could not submit. The link may have expired.'); }
    finally { setSaving(false); }
  };

  const Field = ({ label, k, type = 'text', req = false, ph = '', full = false }: any) => (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{label}{req && <span style={{ color: '#dc2626' }}> *</span>}</label>
      <input type={type} value={form[k]} placeholder={ph} onChange={e => set(k, e.target.value)}
        style={{ width: '100%', height: 38, border: '1px solid #d1d5db', borderRadius: 8, padding: '0 10px', fontSize: 14, marginTop: 2 }} />
    </div>
  );

  const DocUpload = ({ label, field }: { label: string; field: 'trnCertUrl' | 'tradeLicenseUrl' }) => (
    <div>
      <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>{label}</label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, border: '1px dashed #cbd5e1', borderRadius: 8, padding: '0 10px', fontSize: 13, color: form[field] ? '#15803d' : '#6b7280', cursor: 'pointer', marginTop: 2 }}>
        {form[field] ? <><CheckCircle size={15} /> Uploaded</> : <><Upload size={15} /> Choose PDF / image</>}
        <input type="file" accept=".pdf,image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadDoc(field, f); }} />
      </label>
    </div>
  );

  const wrap: any = { minHeight: '100vh', background: '#f3f4f6', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' };
  const card: any = { maxWidth: 680, margin: '0 auto', background: '#fff', borderRadius: 14, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' };

  if (loading) return <div style={wrap}><div style={{ ...card, padding: 40, textAlign: 'center', color: '#9ca3af' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /></div></div>;

  if (invalid) return (
    <div style={wrap}><div style={{ ...card, padding: 40, textAlign: 'center' }}>
      <ShieldCheck size={32} color="#dc2626" style={{ margin: '0 auto 10px' }} />
      <h2 style={{ fontSize: 18, fontWeight: 700, color: NAVY }}>Link invalid or expired</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginTop: 6 }}>Please ask your production contact to send you a fresh onboarding link.</p>
    </div></div>
  );

  if (done) return (
    <div style={wrap}><div style={{ ...card, padding: 48, textAlign: 'center' }}>
      <CheckCircle size={40} color="#16a34a" style={{ margin: '0 auto 12px' }} />
      <h2 style={{ fontSize: 20, fontWeight: 700, color: NAVY }}>Thank you!</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginTop: 8 }}>Your details have been submitted to <strong>{info?.projectTitle}</strong> for review. The production team will confirm your vendor account shortly. You can close this page.</p>
    </div></div>
  );

  return (
    <div style={wrap}>
      <div style={card}>
        <div style={{ background: NAVY, color: '#fff', padding: '20px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Building2 size={22} color={GOLD} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Vendor Onboarding</div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{info?.projectTitle}{info?.projectNumber ? ` · ${info.projectNumber}` : ''} — The Film Makers FZ LLC</div>
            </div>
          </div>
        </div>
        <div style={{ padding: 28 }}>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 18 }}>Please provide your company details and banking information so we can set you up as an approved vendor. Fields marked * are required.</p>

          <SectionLabel>Company</SectionLabel>
          <div style={grid}>
            <Field label="Company name" k="name" req ph="Legal entity name" />
            <Field label="Trading name" k="tradeName" />
            <Field label="Category" k="category" ph="Equipment, Catering, Post…" />
            <Field label="TRN (Tax Reg. No.)" k="trn" />
            <Field label="VAT ID" k="vatId" />
            <Field label="Country" k="country" />
          </div>

          <SectionLabel>Primary contact</SectionLabel>
          <div style={grid}>
            <Field label="Contact name" k="contactName" />
            <Field label="Phone" k="phone" type="tel" />
            <Field label="Email" k="email" type="email" full />
            <Field label="Address" k="address" full />
            <Field label="City" k="city" />
          </div>

          <SectionLabel>Banking (for payments)</SectionLabel>
          <div style={grid}>
            <Field label="IBAN" k="iban" full ph="AE00 0000 0000 0000 0000 000" />
            <Field label="Bank name" k="bankName" />
            <Field label="Account number" k="bankAccount" />
            <Field label="SWIFT / BIC" k="swiftCode" />
          </div>

          <SectionLabel>Documents</SectionLabel>
          <div style={grid}>
            <DocUpload label="TRN / VAT certificate" field="trnCertUrl" />
            <DocUpload label="Trade licence" field="tradeLicenseUrl" />
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Notes (optional)</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: 10, fontSize: 14, marginTop: 2 }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, fontSize: 11, color: '#9ca3af' }}>
            <ShieldCheck size={14} /> Your information is sent securely and only used to set up your vendor account.
          </div>
          <button onClick={submit} disabled={saving}
            style={{ width: '100%', marginTop: 14, height: 44, background: saving ? '#9ca3af' : GOLD, color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: saving ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} {saving ? 'Submitting…' : 'Submit for review'}
          </button>
        </div>
      </div>
    </div>
  );
}

const grid: any = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 };
function SectionLabel({ children }: { children: any }) {
  return <div style={{ fontSize: 11, fontWeight: 700, color: '#1a1a2e', textTransform: 'uppercase', letterSpacing: 0.5, margin: '20px 0 8px', borderBottom: '1px solid #eef0f3', paddingBottom: 4 }}>{children}</div>;
}
