'use client';
import { useState } from 'react';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

/** Convert format — maps an existing script's scenes into a new format (series / vertical / short / feature).
 *  Folded into the Doctor as a surface overlay (was the Studio "Format" tab). Works on the bound project's script. */
const C = { scrim: 'rgba(6,7,10,0.85)', panel: '#14161c', band: '#171a20', hair: 'rgba(255,255,255,.08)', gold: '#C6A463', gold2: '#E6D2A2', ink: '#1a1509', cream: '#F4EEE0', text: '#E7E3D8', mut: '#9aa1ab', faint: '#6b727d', gold3: 'rgba(198,164,99,.14)' };
const FORMATS: [string, string][] = [['series', 'Series'], ['vertical', 'Vertical micro-drama'], ['short', 'Short'], ['feature', 'Feature']];

export default function ScriptOnFormatPanel({ projectId, onClose }: { projectId: string | null; onClose: () => void }) {
  const { dir, t } = useLocale();
  const [target, setTarget] = useState('vertical');
  const [result, setResult] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3200); };

  const convert = async () => {
    if (!projectId) { flash(t('Connect a project with a parsed script first.')); return; }
    setBusy(true); flash(t('Converting to') + ' ' + target + '...');
    try { const r: any = await productionApi.scripton.formatConvert(projectId, { targetFormat: target }); const d: any = r.data || {}; setResult(Array.isArray(d.episodes) ? d.episodes : []); flash((d.episodes?.length || 0) + ' ' + target + ' ' + t('episodes.')); }
    catch (e: any) { flash(e?.response?.data?.message || t('Format convert needs a parsed script — import or break one down first.')); }
    finally { setBusy(false); }
  };

  const chip = (on: boolean): React.CSSProperties => ({ padding: '8px 14px', borderRadius: 999, fontSize: 12.5, fontWeight: 600, color: on ? C.gold2 : C.mut, background: on ? C.gold3 : C.band, border: '1px solid ' + (on ? 'rgba(198,164,99,.45)' : C.hair), cursor: 'pointer' });
  const card: React.CSSProperties = { background: C.panel, border: '1px solid ' + C.hair, borderRadius: 13, padding: '14px 16px' };
  const btn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, height: 38, padding: '0 16px', borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', border: 'none', background: 'linear-gradient(180deg,' + C.gold2 + ',' + C.gold + ')', color: C.ink };

  return (
    <div dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 80, background: C.scrim, overflow: 'auto', fontFamily: 'var(--sx-body)' }}>
      <div style={{ maxWidth: 820, margin: '0 auto', padding: '26px 18px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: C.gold, textTransform: 'uppercase' }}>{t('ScriptON · Doctor')}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.cream, marginTop: 4 }}>{t('Convert format')}</div>
            <div style={{ fontSize: 13, color: C.mut }}>{t("Maps the bound script's real scenes into a new format — keep the engine, change the shape.")}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid ' + C.hair, color: C.mut, borderRadius: 10, padding: '6px 12px', cursor: 'pointer', fontSize: 13 }}>{t('Close')}</button>
        </div>

        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 13.5, fontWeight: 700, color: C.cream }}>{t('Convert to')}</span><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: C.gold }}>{t('KEEP THE ENGINE')}</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{FORMATS.map(([k, l]) => <span key={k} style={chip(target === k)} onClick={() => setTarget(k)}>{t(l)}</span>)}</div>
          <div style={{ fontSize: 11.5, color: C.faint }}>{t('Vertical builds the hook → escalation → sting → cliffhanger loop per episode; series/short/feature re-beat the same scenes.')}</div>
          <div><button style={{ ...btn, opacity: busy ? 0.6 : 1 }} onClick={convert} disabled={busy}><svg width="15" height="15" viewBox="0 0 24 24" style={{ stroke: C.ink, strokeWidth: 1.7, fill: 'none' }}><path d="M16 3l5 5-5 5M21 8H9M8 21l-5-5 5-5M3 16h12" /></svg>{busy ? t('Converting...') : t('Convert')}</button></div>
        </div>

        {result.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {result.map((e, i) => (
              <div key={i} style={{ ...card, display: 'flex', gap: 13 }}>
                <div style={{ width: 30, height: 30, borderRadius: 9, background: C.gold3, color: C.gold2, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 12, flex: 'none' }}>{e.ep ?? i + 1}</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {e.hook !== undefined ? (<>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.cream }}>{t('Episode')} {e.ep ?? i + 1}</div>
                    <div style={{ fontSize: 11.5, color: C.mut }}><b style={{ color: C.gold2 }}>{t('Hook:')}</b> {e.hook}</div>
                    {e.escalation && <div style={{ fontSize: 11.5, color: C.mut }}><b style={{ color: C.gold2 }}>{t('Escalation:')}</b> {e.escalation}</div>}
                    {e.sting && <div style={{ fontSize: 11.5, color: C.mut }}><b style={{ color: C.gold2 }}>{t('Sting:')}</b> {e.sting}</div>}
                    {e.cliffhanger && <div style={{ fontSize: 11.5, color: C.mut }}><b style={{ color: C.gold2 }}>{t('Cliffhanger:')}</b> {e.cliffhanger}</div>}
                  </>) : (<>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.cream }}>{e.title || (t('Episode') + ' ' + (e.ep ?? i + 1))}</div>
                    {e.engine && <div style={{ fontSize: 11.5, color: C.mut }}><b style={{ color: C.gold2 }}>{t('Engine:')}</b> {e.engine}</div>}
                    {e.cliffhanger && <div style={{ fontSize: 11.5, color: C.mut }}><b style={{ color: C.gold2 }}>{t('Out:')}</b> {e.cliffhanger}</div>}
                  </>)}
                </div>
              </div>
            ))}
          </div>
        )}
        {result.length === 0 && <div style={{ fontSize: 12, color: C.faint, marginTop: 14, textAlign: 'center' }}>{t('Pick a target and Convert to map your scenes into that format.')}</div>}
      </div>
      {toast && <div style={{ position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#0e1014', border: '1px solid rgba(198,164,99,.4)', color: C.gold2, fontSize: 12.5, padding: '10px 16px', borderRadius: 10, zIndex: 90 }}>{toast}</div>}
    </div>
  );
}
