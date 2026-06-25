'use client';
/** ScriptON — Review Protection settings panel (Phase 5).
 *  Renders inside the Settings `.sx` content area and manages the workspace-default protection config:
 *  watermark/notice/recipient/permission settings, reusable Profiles, Notice templates, and the export audit log.
 *  Self-contained data layer (productionApi.scripton.reviewProtection); reuses `.sx` classes + a small `.rpp` style block. */
import React from 'react';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

const RPP_CSS = `
.rpp{display:flex;flex-direction:column;gap:14px}
.rpp .tabs{display:flex;gap:6px;flex-wrap:wrap}
.rpp .pill{height:32px;padding:0 13px;border-radius:9px;border:1px solid var(--hair);background:#171a20;color:var(--mute);font-size:12.5px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:7px}
.rpp .pill:hover{color:var(--cream)}
.rpp .pill.on{background:rgba(198,164,99,.13);border-color:rgba(198,164,99,.4);color:var(--gold2)}
.rpp .fld{display:flex;flex-direction:column;gap:6px}
.rpp label{font-size:10.5px;font-weight:700;letter-spacing:.5px;color:var(--faint);text-transform:uppercase}
.rpp input[type=text],.rpp select,.rpp textarea{background:#0f1218;border:1px solid var(--hair);border-radius:9px;color:var(--text);font-size:13px;padding:9px 11px;font-family:inherit;width:100%}
.rpp input[type=text]:focus,.rpp select:focus,.rpp textarea:focus{outline:none;border-color:rgba(198,164,99,.5)}
.rpp textarea{min-height:170px;resize:vertical;line-height:1.55;font-family:'Courier Prime',ui-monospace,monospace;font-size:12px}
.rpp .row2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.rpp .row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.rpp .togline{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--hair)}
.rpp .togline:last-child{border-bottom:none}
.rpp .togline .tt{font-size:13px;color:var(--cream);font-weight:600}
.rpp .togline .td{font-size:11px;color:var(--faint);margin-top:2px}
.rpp .lockchip{font-size:9px;font-weight:800;padding:3px 7px;border-radius:999px;background:rgba(91,141,239,.16);color:var(--blue);text-transform:uppercase;letter-spacing:.4px}
.rpp .deflt{font-size:9px;font-weight:800;padding:3px 7px;border-radius:999px;background:rgba(198,164,99,.16);color:var(--gold2);text-transform:uppercase;letter-spacing:.4px}
.rpp .plist{display:flex;flex-direction:column;gap:8px}
.rpp .prow{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--hair);border-radius:11px;background:#0f1218}
.rpp .prow.act{border-color:rgba(198,164,99,.45);background:rgba(198,164,99,.06)}
.rpp .prow .pn{font-size:13.5px;font-weight:700;color:var(--cream)}
.rpp .prow .pd{font-size:11.5px;color:var(--mute);margin-top:2px;line-height:1.4}
.rpp .small{font-size:11px;color:var(--faint)}
.rpp .status{font-size:12px;color:var(--gold2);min-height:16px}
.rpp .actrow{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
.rpp .lnk{font-size:12px;font-weight:600;color:var(--mute);cursor:pointer;background:none;border:none}
.rpp .lnk:hover{color:var(--cream)}
.rpp .lnk.danger:hover{color:var(--red)}
`;

const PATTERNS = [['single_diagonal', 'Single diagonal'], ['repeated_diagonal', 'Repeated tiled'], ['horizontal_center', 'Horizontal centre']];
const PLACEMENTS = [['dedicated_cover', 'Dedicated cover page'], ['first_page_top', 'First page · top'], ['first_page_bottom', 'First page · bottom']];
const EMAILDISP = [['hidden', 'Hidden'], ['masked', 'Masked'], ['full', 'Full']];
const PRINTPOL = [['allow_protected', 'Allow (protected)'], ['allow_low_resolution', 'Allow · low-res only'], ['blocked', 'Blocked']];
const MODES = [['standard', 'Standard (selectable)'], ['enhanced', 'Enhanced (non-selectable)']];

type Tab = 'config' | 'profiles' | 'notices' | 'history';

export default function ReviewProtectionPanel({ projectId }: { projectId?: string }) {
  const { t } = useLocale();
  const rp = (productionApi as any).scripton.reviewProtection;
  const [tab, setTab] = React.useState<Tab>('config');
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState('');
  const [enabled, setEnabled] = React.useState(true);
  const [mode, setMode] = React.useState('enhanced');
  const [activeProfileId, setActiveProfileId] = React.useState<string | null>(null);
  const [cfg, setCfg] = React.useState<any>({});
  const [profiles, setProfiles] = React.useState<any[]>([]);
  const [notices, setNotices] = React.useState<any[]>([]);
  const [exports, setExports] = React.useState<any[]>([]);
  const [editNotice, setEditNotice] = React.useState<any>(null);

  const flash = (m: string) => { setStatus(m); window.clearTimeout((flash as any)._t); (flash as any)._t = window.setTimeout(() => setStatus(''), 3600); };
  const set = (k: string, v: any) => setCfg((c: any) => ({ ...c, [k]: v }));

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [s, p, n, x] = await Promise.all([
        rp.getSettings(projectId).catch(() => ({ data: {} })),
        rp.listProfiles().catch(() => ({ data: [] })),
        rp.listNotices().catch(() => ({ data: [] })),
        rp.listExports(projectId).catch(() => ({ data: [] })),
      ]);
      const sd = s.data || {};
      setEnabled(sd.enabled !== false);
      setMode(sd.mode || (sd.config && sd.config.mode) || 'enhanced');
      setActiveProfileId(sd.activeProfileId || null);
      setCfg(sd.config || {});
      setProfiles(Array.isArray(p.data) ? p.data : []);
      setNotices(Array.isArray(n.data) ? n.data : []);
      setExports(Array.isArray(x.data) ? x.data : []);
    } catch { /* keep defaults */ } finally { setLoading(false); }
  }, [projectId]);
  React.useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setStatus(t('Saving…'));
    try { const r = await rp.saveSettings({ projectId: projectId || null, enabled, mode, activeProfileId, config: { ...cfg, mode } }); const sd = r.data || {}; setCfg(sd.config || cfg); flash(t('Protection settings saved.')); }
    catch (e: any) { flash(t('Save failed — check permissions (level 2 required).')); }
  };

  const useProfile = (p: any) => { setActiveProfileId(p.id); if (p.config) { setCfg(p.config); setMode(p.config.mode || mode); } flash(t('Loaded profile — review and Save to apply.')); };
  const duplicateProfile = async (p: any) => {
    try { await rp.saveProfile({ name: (p.name || 'Profile') + ' (copy)', description: p.description, config: p.config }); const n = await rp.listProfiles(); setProfiles(Array.isArray(n.data) ? n.data : profiles); flash(t('Profile duplicated.')); }
    catch { flash(t('Could not duplicate (level 2 required).')); }
  };
  const deleteProfile = async (p: any) => {
    try { await rp.deleteProfile(p.id); const n = await rp.listProfiles(); setProfiles(Array.isArray(n.data) ? n.data : []); flash(t('Profile deleted.')); }
    catch { flash(t('Could not delete this profile.')); }
  };
  const saveNotice = async () => {
    if (!editNotice) return;
    try { await rp.saveNotice({ id: editNotice.isSystem ? undefined : editNotice.id, name: editNotice.name, body: editNotice.body }); const n = await rp.listNotices(); setNotices(Array.isArray(n.data) ? n.data : notices); setEditNotice(null); flash(t('Notice saved.')); }
    catch { flash(t('Could not save notice (level 2 required).')); }
  };
  const deleteNotice = async (n: any) => {
    try { await rp.deleteNotice(n.id); const r = await rp.listNotices(); setNotices(Array.isArray(r.data) ? r.data : []); flash(t('Notice deleted.')); }
    catch { flash(t('Could not delete this notice.')); }
  };

  const TABS: [Tab, string][] = [['config', t('Configuration')], ['profiles', t('Profiles')], ['notices', t('Notices')], ['history', t('Export history')]];
  const noticeOpts = notices.map((n) => [n.slug, n.name]) as [string, string][];

  return (
    <div className="rpp">
      <style dangerouslySetInnerHTML={{ __html: RPP_CSS }} />
      <div className="kpis">
        <div className="panelcard"><div className="eyebrow">{t('PROTECTION')}</div><div style={{ display: 'flex', alignItems: 'center', gap: 11 }}><button className={'toggle' + (enabled ? '' : ' off')} onClick={() => setEnabled((v) => !v)} /><span style={{ fontSize: 12.5, color: 'var(--cream)', fontWeight: 600 }}>{enabled ? t('On — review copies are protected') : t('Off')}</span></div><div className="sub" style={{ fontSize: 11 }}>{t('Recipient-watermarked, permission-locked, audit-logged exports')}</div></div>
        <div className="panelcard"><div className="eyebrow">{t('SECURITY MODE')}</div><select value={mode} onChange={(e) => { setMode(e.target.value); set('mode', e.target.value); }} className="rpp" style={{ background: '#0f1218', border: '1px solid var(--hair)', borderRadius: 9, color: 'var(--text)', fontSize: 13, padding: '9px 11px' }}>{MODES.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select><div className="sub" style={{ fontSize: 11 }}>{t('Enhanced rasterises pages so text cannot be selected or copied')}</div></div>
        <div className="panelcard"><div className="eyebrow">{t('ACTIVE PROFILE')}</div><div style={{ fontSize: 14, fontWeight: 700, color: 'var(--cream)' }}>{(profiles.find((p) => p.id === activeProfileId) || {}).name || t('Default')}</div><div className="sub" style={{ fontSize: 11 }}>{t('Switch presets in the Profiles tab')}</div></div>
      </div>

      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={'pill' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{l}</button>)}</div>
      <div className="status">{status}</div>

      {loading && <div className="panelcard"><span className="small">{t('Loading…')}</span></div>}

      {!loading && tab === 'config' && (
        <>
          <div className="panelcard">
            <div className="eyebrow">{t('WATERMARK')}</div>
            <div className="fld"><label>{t('Primary text')}</label><input type="text" value={cfg.watermarkText || ''} onChange={(e) => set('watermarkText', e.target.value)} placeholder="TESTING COPY — PRIVATE REVIEW ONLY" /></div>
            <div className="fld"><label>{t('Secondary line (supports {recipient_name}, {copy_id})')}</label><input type="text" value={cfg.watermarkSecondaryText || ''} onChange={(e) => set('watermarkSecondaryText', e.target.value)} /></div>
            <div className="row3">
              <div className="fld"><label>{t('Pattern')}</label><select value={cfg.watermarkPattern || 'single_diagonal'} onChange={(e) => set('watermarkPattern', e.target.value)}>{PATTERNS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select></div>
              <div className="fld"><label>{t('Opacity')} · {Math.round((Number(cfg.watermarkOpacity) || 0.1) * 100)}%</label><input type="range" min={5} max={30} value={Math.round((Number(cfg.watermarkOpacity) || 0.1) * 100)} onChange={(e) => set('watermarkOpacity', Number(e.target.value) / 100)} /></div>
              <div className="fld"><label>{t('Rotation')}</label><input type="text" value={String(cfg.watermarkRotation ?? -35)} onChange={(e) => set('watermarkRotation', Number(e.target.value) || 0)} /></div>
            </div>
          </div>

          <div className="panelcard">
            <div className="eyebrow">{t('NOTICE')}</div>
            <div className="row2">
              <div className="fld"><label>{t('Notice template')}</label><select value={cfg.noticeTemplateSlug || ''} onChange={(e) => set('noticeTemplateSlug', e.target.value)}><option value="">{t('— none —')}</option>{noticeOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div className="fld"><label>{t('Placement')}</label><select value={cfg.noticePlacement || 'dedicated_cover'} onChange={(e) => set('noticePlacement', e.target.value)}>{PLACEMENTS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select></div>
            </div>
            <div className="togline"><div><div className="tt">{t('Require notice')}</div><div className="td">{t('Every protected copy carries the legal notice')}</div></div><button className={'toggle' + (cfg.noticeRequired !== false ? '' : ' off')} onClick={() => set('noticeRequired', cfg.noticeRequired === false)} /></div>
          </div>

          <div className="panelcard">
            <div className="eyebrow">{t('RECIPIENT')}</div>
            <div className="row2">
              <div className="fld"><label>{t('Email display')}</label><select value={cfg.recipientEmailDisplay || 'masked'} onChange={(e) => set('recipientEmailDisplay', e.target.value)}>{EMAILDISP.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select></div>
              <div className="fld"><label>{t('Printing policy')}</label><select value={cfg.printingPolicy || 'allow_protected'} onChange={(e) => set('printingPolicy', e.target.value)}>{PRINTPOL.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}</select></div>
            </div>
            <div className="togline"><div><div className="tt">{t('Require recipient')}</div><div className="td">{t('A recipient name or email is mandatory before export')}</div></div><button className={'toggle' + (cfg.requireRecipient !== false ? '' : ' off')} onClick={() => set('requireRecipient', cfg.requireRecipient === false)} /></div>
            <div className="togline"><div><div className="tt">{t('Recipient on every page')}</div><div className="td">{t('Trace footer with Copy-ID + recipient on each page')}</div></div><button className={'toggle' + (cfg.recipientOnEveryPage !== false ? '' : ' off')} onClick={() => set('recipientOnEveryPage', cfg.recipientOnEveryPage === false)} /></div>
          </div>

          <div className="panelcard">
            <div className="eyebrow">{t('PERMISSIONS')}</div>
            {[['restrictCopying', t('Restrict copying'), t('Block copy to clipboard')], ['restrictExtraction', t('Restrict text extraction'), t('Block content extraction')], ['restrictEditing', t('Restrict editing'), t('Block document modification')], ['restrictAnnotations', t('Restrict annotations'), t('Block comment/markup tools')], ['restrictPageAssembly', t('Restrict page assembly'), t('Block insert/delete/rotate pages')], ['sanitizeMetadata', t('Sanitise metadata'), t('Strip identifying document metadata')]].map(([k, ttl, d]) => (
              <div className="togline" key={k as string}><div><div className="tt">{ttl}</div><div className="td">{d}</div></div><button className={'toggle' + ((cfg as any)[k as string] !== false && (k !== 'restrictAnnotations' || (cfg as any)[k as string]) ? '' : ' off')} onClick={() => set(k as string, !(cfg as any)[k as string])} /></div>
            ))}
            <div className="small" style={{ marginTop: 8 }}>{t('Permission flags + non-selectable rasterisation are applied when the server has the required tools (qpdf / poppler); the watermark and trace footer always apply.')}</div>
          </div>

          <div className="actrow"><button className="btn gold" onClick={saveSettings}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M20 6L9 17l-5-5" /></svg>{t('Save protection settings')}</button><button className="btn ghost" onClick={load}>{t('Reset')}</button></div>
        </>
      )}

      {!loading && tab === 'profiles' && (
        <div className="panelcard">
          <div className="eyebrow">{t('PROTECTION PROFILES')}</div>
          <div className="plist">
            {profiles.map((p) => (
              <div className={'prow' + (p.id === activeProfileId ? ' act' : '')} key={p.id}>
                <div style={{ flex: 1 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="pn">{p.name}</span>{p.isSystemProfile && <span className="lockchip">{t('System')}</span>}{p.isDefault && <span className="deflt">{t('Default')}</span>}</div><div className="pd">{p.description}</div></div>
                <div className="actrow">
                  <button className="lnk" onClick={() => useProfile(p)}>{p.id === activeProfileId ? t('Active') : t('Use')}</button>
                  <button className="lnk" onClick={() => duplicateProfile(p)}>{t('Duplicate')}</button>
                  {!p.isSystemProfile && <button className="lnk danger" onClick={() => deleteProfile(p)}>{t('Delete')}</button>}
                </div>
              </div>
            ))}
            {!profiles.length && <span className="small">{t('No profiles yet.')}</span>}
          </div>
        </div>
      )}

      {!loading && tab === 'notices' && (
        <div className="panelcard">
          <div className="eyebrow">{t('NOTICE TEMPLATES')}</div>
          {!editNotice && (
            <div className="plist">
              {notices.map((n) => (
                <div className="prow" key={n.id}>
                  <div style={{ flex: 1 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className="pn">{n.name}</span>{n.isSystem && <span className="lockchip">{t('System')}</span>}{n.isDefault && <span className="deflt">{t('Default')}</span>}</div><div className="pd" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 460 }}>{String(n.body || '').replace(/\n/g, ' ').slice(0, 120)}</div></div>
                  <div className="actrow">
                    <button className="lnk" onClick={() => setEditNotice({ ...n })}>{n.isSystem ? t('View / duplicate') : t('Edit')}</button>
                    {!n.isSystem && <button className="lnk danger" onClick={() => deleteNotice(n)}>{t('Delete')}</button>}
                  </div>
                </div>
              ))}
              <button className="btn ghost" style={{ alignSelf: 'flex-start', marginTop: 6 }} onClick={() => setEditNotice({ name: '', body: '' })}>+ {t('New notice')}</button>
            </div>
          )}
          {editNotice && (
            <>
              {editNotice.isSystem && <div className="small" style={{ marginBottom: 6 }}>{t('This is a system notice — saving creates an editable duplicate.')}</div>}
              <div className="fld"><label>{t('Name')}</label><input type="text" value={editNotice.name || ''} onChange={(e) => setEditNotice({ ...editNotice, name: e.target.value })} /></div>
              <div className="fld"><label>{t('Body (placeholders: {recipient_name} {copy_id} {project_title} {export_datetime}…)')}</label><textarea value={editNotice.body || ''} onChange={(e) => setEditNotice({ ...editNotice, body: e.target.value })} /></div>
              <div className="actrow"><button className="btn gold" onClick={saveNotice}>{t('Save notice')}</button><button className="btn ghost" onClick={() => setEditNotice(null)}>{t('Cancel')}</button></div>
            </>
          )}
        </div>
      )}

      {!loading && tab === 'history' && (
        <div className="gtable" style={{ maxHeight: 360 }}>
          <div className="gthead" style={{ gridTemplateColumns: '1.3fr 1.4fr .8fr .8fr .8fr .7fr' }}><span>{t('COPY ID')}</span><span>{t('RECIPIENT')}</span><span>{t('MODE')}</span><span>{t('CHANNEL')}</span><span>{t('STATUS')}</span><span>{t('WHEN')}</span></div>
          {exports.map((x) => (
            <div className="gtr" key={x.id} style={{ gridTemplateColumns: '1.3fr 1.4fr .8fr .8fr .8fr .7fr' }}>
              <span className="gmodel">{x.copyId}</span>
              <span className="gsf">{x.recipientName || x.recipientEmail || '—'}</span>
              <span className="gtok">{x.mode}</span>
              <span className="gtok">{x.channel}</span>
              <span className={'badge ' + (x.status === 'FAILED' ? 'amber' : 'green')}>{x.status}</span>
              <span className="gwhen">{x.createdAt ? new Date(x.createdAt).toLocaleDateString() : ''}</span>
            </div>
          ))}
          {!exports.length && <div className="gtr"><span className="gsf" style={{ gridColumn: '1/7', color: 'var(--faint)' }}>{t('No protected exports yet.')}</span></div>}
        </div>
      )}
    </div>
  );
}
