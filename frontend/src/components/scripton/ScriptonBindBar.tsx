'use client';
import React, { useRef, useState } from 'react';
import { productionApi, uploadFile } from '@/lib/api';
import { useScriptonProject } from './useScriptonProject';
import { useLocale } from '@/lib/i18n';

/**
 * Floating ScriptON context pill. ScriptON is STANDALONE — it develops in the hidden "ScriptON Library" workspace and
 * is never bound to a production project. You attach to a real project only when you explicitly Promote from the
 * Library (or start a New project). Import drops a script into the Library to develop / adapt. Mounted once in the layout.
 */
const C = {
  shell: '#13151b', panel: '#0e1014', gold: '#C6A463', goldSoft: 'rgba(198,164,99,0.14)',
  bd: 'rgba(198,164,99,0.30)', text: '#E7E3D8', mut: '#8b8f98', warn: '#E0A458', ok: '#6FCF97',
};

export default function ScriptonBindBar() {
  const { selectedId, reload } = useScriptonProject();
  const { dir, t } = useLocale();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const flash = (m: string) => { setMsg(m); window.clearTimeout((flash as any)._t); (flash as any)._t = window.setTimeout(() => setMsg(null), 4200); };

  const onImport = async (file: File | null | undefined) => {
    if (!file) return;
    if (!selectedId) { flash(t('ScriptON Library is still loading — try again in a moment.')); return; }
    setBusy('import'); flash(t('Uploading script…'));
    try {
      const up = await uploadFile(file);
      flash(t('Breaking down (AI)…'));
      await productionApi.breakdown.importScriptFull(selectedId, { fileUrl: up.url, originalName: up.originalName, pagesPerDay: 5 });
      flash(t('Imported into the Library. Reloading…'));
      window.setTimeout(() => window.location.reload(), 700);
    } catch (e: any) {
      flash(e?.response?.data?.message || t('Import failed — needs the backend on :3001 and an AI key for breakdown.'));
    } finally { setBusy(null); if (fileRef.current) fileRef.current.value = ''; }
  };

  const pill: React.CSSProperties = {
    position: 'fixed', insetInlineStart: 16, bottom: 16, zIndex: 60, display: 'flex', alignItems: 'center', gap: 8,
    background: C.shell, color: C.text, border: `1px solid ${C.bd}`, borderRadius: 999, padding: '7px 12px',
    fontSize: 12.5, cursor: 'pointer', boxShadow: '0 8px 28px rgba(0,0,0,0.45)', fontFamily: 'var(--sx-body)',
  };
  const dot: React.CSSProperties = { width: 8, height: 8, borderRadius: 999, background: C.ok, flexShrink: 0 };
  const card: React.CSSProperties = {
    position: 'fixed', insetInlineStart: 16, bottom: 60, zIndex: 61, width: 330, maxWidth: 'calc(100vw - 32px)',
    background: C.panel, color: C.text, border: `1px solid ${C.bd}`, borderRadius: 14, padding: 14,
    boxShadow: '0 16px 48px rgba(0,0,0,0.55)', fontFamily: 'var(--sx-body)',
  };
  const btn: React.CSSProperties = {
    width: '100%', textAlign: 'start', background: C.goldSoft, color: C.gold, border: `1px solid ${C.bd}`,
    borderRadius: 10, padding: '9px 11px', fontSize: 12.5, cursor: 'pointer', marginTop: 8,
  };

  return (
    <>
      <div style={pill} dir={dir} onClick={() => setOpen((v) => !v)} title={t('ScriptON — standalone Library workspace')} aria-label={t('ScriptON workspace')}>
        <span style={dot} />
        <span style={{ color: C.text, fontWeight: 500 }}>{t('ScriptON Library')}</span>
        <span style={{ color: C.mut }}>{open ? '▾' : '▴'}</span>
      </div>

      {open && (
        <div style={card} dir={dir} role="dialog" aria-label={t('ScriptON workspace')}>
          <div style={{ fontSize: 12, color: C.mut, marginBottom: 2 }}>{t('ScriptON develops in')}</div>
          <div style={{ fontSize: 14, color: C.text, fontWeight: 600 }}>
            {t('The ScriptON Library')} <span style={{ color: C.ok, fontWeight: 500, fontSize: 12 }}>· {t('standalone')}</span>
          </div>
          <div style={{ fontSize: 11.5, color: C.mut, marginTop: 6, lineHeight: 1.5 }}>
            {t('Every build starts from scratch here — not tied to any production project. You attach to a project only when you')} <b style={{ color: C.text }}>{t('Promote')}</b> {t('from the Library.')}
          </div>

          <input ref={fileRef} type="file" accept=".pdf,.fdx,.fountain,.txt,.docx" style={{ display: 'none' }} onChange={(e) => onImport(e.target.files?.[0])} />
          <button style={{ ...btn, opacity: busy ? 0.6 : 1 }} disabled={!!busy} onClick={() => fileRef.current?.click()}>
            {busy === 'import' ? t('Working…') : '↧  ' + t('Import a script to develop')}
          </button>

          <a href="/production/projects" style={{ ...btn, display: 'block', background: 'transparent', textDecoration: 'none' }}>
            +  {t('New production project (full form)')}
          </a>

          <button style={{ ...btn, background: 'transparent', color: C.mut }} onClick={() => { reload(); flash(t('Refreshed.')); }}>
            ⟳  {t('Refresh')}
          </button>

          <div style={{ fontSize: 11, color: C.mut, marginTop: 10, lineHeight: 1.5 }}>
            {t('AI actions (coverage, diagnose, rewrite, develop…) need the backend running on :3001 with an AI key configured.')}
          </div>
          {msg && <div style={{ fontSize: 11.5, color: C.gold, marginTop: 8 }}>{msg}</div>}
        </div>
      )}
      {!open && msg && (
        <div dir={dir} style={{ position: 'fixed', insetInlineStart: 16, bottom: 58, zIndex: 60, background: C.panel, color: C.gold, border: `1px solid ${C.bd}`, borderRadius: 10, padding: '7px 11px', fontSize: 11.5, maxWidth: 330, fontFamily: 'var(--sx-body)' }}>{msg}</div>
      )}
    </>
  );
}
