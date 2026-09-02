'use client';
/** ScriptON — Dialect studio. Scores a script's dialect fidelity (markers present / MSA tells leaking),
 *  auto-repairs the dialogue into the chosen dialect, and hosts the native-editable exemplar bank
 *  (few-shot lines that lock generation). Opened by ?doc=<scriptDocumentId>.
 *  Uses the shared `.sx` cinematic shell + SxRail so it stays docked like every other ScriptON screen. */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productionApi } from '@/lib/api';
import { SxRail, SX_CSS } from '@/components/scripton/shared/sx';
import { AR_DIALECTS } from '@/components/scripton/dialects';
import { useLocale } from '@/lib/i18n';
import { useScriptonBack } from '@/components/scripton/useScriptonBack';

type Fid = { score: number; present: string[]; missing: string[]; flags: string[]; variety?: string };
type Ex = { id: string; variety: string; msa?: string; dialect: string; note?: string };

export default function ScriptOnDialectPage() {
  const router = useRouter();
  const { dir, t } = useLocale();
  const onBack = useScriptonBack();
  const [docId, setDocId] = useState('');
  const [variety, setVariety] = useState('ar-EG-cairene');
  const [fid, setFid] = useState<Fid | null>(null);
  const [checking, setChecking] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [exs, setExs] = useState<Ex[]>([]);
  const [form, setForm] = useState<{ msa: string; dialect: string; note: string }>({ msa: '', dialect: '', note: '' });
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3200); };

  const loadExs = async (v: string) => { try { const r: any = await productionApi.scripton.development.listExemplars(v); setExs(Array.isArray(r.data) ? r.data : []); } catch { setExs([]); } };

  const check = async (doc: string) => {
    if (!doc) return; setChecking(true);
    try { const r: any = await productionApi.scripton.development.dialectCheck({ docId: doc }); const d: Fid = r.data || null; setFid(d); if (d && d.variety) { setVariety(d.variety); loadExs(d.variety); } }
    catch { flash(t('Check needs the backend on :3001.')); }
    finally { setChecking(false); }
  };

  useEffect(() => {
    const doc = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('doc') || '') : '';
    setDocId(doc);
    if (doc) check(doc); else loadExs('ar-EG-cairene');
  }, []);

  const repair = async () => {
    if (!docId) { flash(t('Open this from a script to auto-repair.')); return; }
    setRepairing(true); flash(t('Re-writing dialogue into the dialect…'));
    try { const r: any = await productionApi.scripton.development.dialectRepair({ docId }); if (r.data && r.data.score) setFid({ ...(r.data.score), variety }); flash(t('Dialogue repaired — re-scored.')); }
    catch (e: any) { flash(e?.response?.data?.message || t('Repair needs the backend + an AI key.')); }
    finally { setRepairing(false); }
  };

  const addEx = async () => {
    const dialect = form.dialect.trim(); if (!dialect) { flash(t('Type the dialect line.')); return; }
    try { await productionApi.scripton.development.saveExemplar({ variety, dialect, msa: form.msa.trim() || undefined, note: form.note.trim() || undefined }); setForm({ msa: '', dialect: '', note: '' }); await loadExs(variety); flash(t('Exemplar saved.')); }
    catch (e: any) { flash(e?.response?.data?.message || t('Could not save.')); }
  };
  const delEx = async (id: string) => { try { await productionApi.scripton.development.deleteExemplar(id); await loadExs(variety); } catch { /* */ } };

  const score = fid ? fid.score : 0;
  const tone = score >= 80 ? '#6FCF97' : score >= 55 ? '#E0A458' : '#e5635f';
  const card: React.CSSProperties = { background: 'var(--panel,#14161c)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 16 };
  const lab: React.CSSProperties = { fontSize: 11, color: '#6b727d', fontWeight: 600, margin: '0 0 5px' };
  const field: React.CSSProperties = { width: '100%', background: '#0b0c0f', color: '#E8E6E0', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, padding: '8px 10px', fontSize: 13, fontFamily: 'var(--sx-body)' };
  const chip = (txt: string, c: string) => <span key={txt} style={{ display: 'inline-block', fontSize: 12.5, fontFamily: 'var(--sx-body)', background: c + '22', color: c, border: '1px solid ' + c + '55', borderRadius: 7, padding: '3px 9px', margin: '0 4px 4px 0' }}>{txt}</span>;

  return (
    <div className="sx" dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <style dangerouslySetInnerHTML={{ __html: SX_CSS }} />
      <div className="top">
        <div className="tl">
          <div className="logo" onClick={onBack} title={t('Back to TFM')}>TFM</div>
          <div className="proj">{t('Dialect fidelity')}</div>
          <span className="meta">{t('Score · auto-repair · exemplar bank')}</span>
        </div>
        <div className="tr">
          <button className="btn ghost" onClick={() => docId ? router.push('/scripton/script?doc=' + docId) : router.push('/scripton/library')}>{dir === 'rtl' ? '→' : '←'} {t('Reader')}</button>
        </div>
      </div>
      <div className="body">
        <SxRail active="dialect" />
        <div className="main">
          <div className="content">
            <div style={{ maxWidth: 920, margin: '0 auto', width: '100%', display: 'grid', gap: 16 }}>

              {/* Fidelity */}
              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ width: 88, height: 88, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'conic-gradient(' + tone + ' ' + (score * 3.6) + 'deg, rgba(255,255,255,.08) 0)', flexShrink: 0 }}>
                    <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'var(--panel,#14161c)', display: 'grid', placeItems: 'center' }}><span style={{ fontSize: 22, fontWeight: 800, color: tone }}>{fid ? score : '—'}</span></div>
                  </div>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div style={{ fontWeight: 700, color: '#F3ECDD' }}>{t('Dialect fidelity')} {docId ? '' : '· ' + t('open from a script')}</div>
                    <div style={{ fontSize: 12.5, color: '#9aa1ab', marginTop: 3 }}>{checking ? t('Scoring…') : (fid ? (AR_DIALECTS.find((d) => d.id === (fid.variety || variety))?.native || (fid.variety || variety)) : t('No script loaded'))}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button onClick={() => check(docId)} disabled={!docId || checking} style={{ background: '#1b1e25', color: '#E6D2A2', border: '1px solid rgba(198,164,99,.4)', borderRadius: 9, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, cursor: docId ? 'pointer' : 'default' }}>↻ {t('Re-check')}</button>
                      <button onClick={repair} disabled={!docId || repairing} style={{ background: repairing ? '#3a2f1a' : 'linear-gradient(180deg,#E6D2A2,#C6A463)', color: '#15120B', border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, cursor: docId ? 'pointer' : 'default' }}>{repairing ? t('Repairing…') : '⚒ ' + t('Auto-repair dialogue')}</button>
                    </div>
                  </div>
                </div>
                {fid && (
                  <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
                    {fid.present.length ? <div><div style={lab}>{t('Dialect markers present')}</div>{fid.present.map((m) => chip(m, '#6FCF97'))}</div> : null}
                    {fid.missing.length ? <div><div style={lab}>{t('Expected but missing')}</div>{fid.missing.map((m) => chip(m, '#E0A458'))}</div> : null}
                    {fid.flags.length ? <div><div style={lab}>{t('Flags (MSA leaking into dialogue)')}</div>{fid.flags.map((f) => <div key={f} style={{ fontSize: 12.5, color: '#e9a8a6' }}>⚠ {f}</div>)}</div> : null}
                  </div>
                )}
              </div>

              {/* Exemplar bank */}
              <div style={card}>
                <div style={{ fontWeight: 700, color: '#F3ECDD' }}>{t('Exemplar bank')} <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: '#C6A463', marginInlineStart: 8 }}>{t('TEACH THE DIALECT')}</span></div>
                <div style={{ fontSize: 12, color: '#9aa1ab', margin: '4px 0 10px' }}>{t('Vetted colloquial lines used as few-shot — the single biggest lever on authenticity. Add real lines a native would say.')}</div>
                <select value={variety} onChange={(e) => { setVariety(e.target.value); loadExs(e.target.value); }} dir="rtl" style={{ ...field, marginBottom: 10 }}>
                  {AR_DIALECTS.filter((d) => d.id !== 'ar-MSA').map((d) => <option key={d.id} value={d.id}>{d.native} · {d.label}</option>)}
                </select>
                {exs.length ? exs.map((e) => (
                  <div key={e.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid rgba(255,255,255,.06)' }}>
                    <div style={{ flex: 1 }}>
                      <div className="ar" dir="rtl" style={{ fontFamily: 'var(--sx-body)', fontSize: 14, color: '#F4EEE0' }}>{e.dialect}</div>
                      {e.msa ? <div dir="rtl" style={{ fontSize: 11.5, color: '#6b727d', fontFamily: 'var(--sx-body)' }}>{t('from')}: {e.msa}</div> : null}
                      {e.note ? <div style={{ fontSize: 11, color: '#6b727d' }}>{e.note}</div> : null}
                    </div>
                    <button onClick={() => delEx(e.id)} style={{ background: 'transparent', color: '#e5635f', border: '1px solid rgba(229,99,95,.4)', borderRadius: 7, padding: '4px 8px', fontSize: 11.5, cursor: 'pointer' }}>{t('Delete')}</button>
                  </div>
                )) : <div style={{ fontSize: 12.5, color: '#6b727d', padding: '6px 0' }}>{t('No added exemplars yet — seed lines still apply. Add your own below.')}</div>}
                <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                  <div><div style={lab}>{t('Dialect line (required)')}</div><input value={form.dialect} onChange={(e) => setForm({ ...form, dialect: e.target.value })} dir="rtl" placeholder="مثال: وين رايح بهالليل؟ بدّي احكي معك." style={field} /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div><div style={lab}>{t('MSA / meaning (optional)')}</div><input value={form.msa} onChange={(e) => setForm({ ...form, msa: e.target.value })} dir="rtl" placeholder="أين تذهب في هذا الليل؟" style={field} /></div>
                    <div><div style={lab}>{t('Note (optional)')}</div><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={t('e.g. angry register')} style={field} /></div>
                  </div>
                  <button onClick={addEx} style={{ justifySelf: 'start', background: 'rgba(198,164,99,.14)', color: '#C6A463', border: '1px solid rgba(198,164,99,.4)', borderRadius: 9, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>＋ {t('Add exemplar')}</button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
      {toast && <div style={{ position: 'fixed', insetInlineStart: 90, bottom: 18, background: '#0e1014', color: '#E6D2A2', border: '1px solid rgba(198,164,99,.4)', borderRadius: 10, padding: '8px 13px', fontSize: 12.5, zIndex: 70 }}>{toast}</div>}
    </div>
  );
}
