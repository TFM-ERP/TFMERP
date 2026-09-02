'use client';
/** ScriptON — Protected Export dialog (Phase 5).
 *  Captures recipient details, optionally picks a protection profile, then asks the backend to produce a
 *  recipient-watermarked, permission-locked, audit-logged PDF and streams it down. Self-contained `.rpx` styling.
 *  The caller supplies getBaseHtml() (the reader's buildScriptPrintHtml output) + identity/meta; this dialog never
 *  falls back to an unprotected file — if the server blocks it, the error is surfaced. */
import React from 'react';
import { productionApi } from '@/lib/api';
import { useLocale } from '@/lib/i18n';

const CSS = `
.rpx-ov{position:fixed;inset:0;z-index:120;background:rgba(6,7,10,.66);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:20px}
.rpx{width:min(560px,96vw);max-height:92vh;overflow:auto;background:#14161c;border:1px solid rgba(255,255,255,.13);border-radius:16px;box-shadow:0 30px 80px -20px rgba(0,0,0,.7);color:#E8E6E0;font-family:var(--sx-body)}
.rpx *{box-sizing:border-box}
.rpx .hd{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px 20px;border-bottom:1px solid rgba(255,255,255,.08)}
.rpx .hd h3{font-size:17px;font-weight:800;color:#F4EEE0;letter-spacing:-.3px}
.rpx .hd p{font-size:12px;color:#9aa1ab;margin-top:3px}
.rpx .x{background:none;border:none;color:#9aa1ab;font-size:20px;cursor:pointer;line-height:1}
.rpx .bd{padding:18px 20px;display:flex;flex-direction:column;gap:13px}
.rpx .fld{display:flex;flex-direction:column;gap:6px}
.rpx label{font-size:10.5px;font-weight:700;letter-spacing:.5px;color:#6b727d;text-transform:uppercase}
.rpx input,.rpx select,.rpx textarea{background:#0f1218;border:1px solid rgba(255,255,255,.1);border-radius:9px;color:#E8E6E0;font-size:13px;padding:10px 12px;font-family:inherit;width:100%}
.rpx input:focus,.rpx select:focus,.rpx textarea:focus{outline:none;border-color:rgba(198,164,99,.5)}
.rpx textarea{min-height:62px;resize:vertical;line-height:1.5}
.rpx .row2{display:grid;grid-template-columns:1fr 1fr;gap:11px}
.rpx .note{font-size:11.5px;color:#6b727d;line-height:1.5}
.rpx .err{background:rgba(229,99,95,.12);border:1px solid rgba(229,99,95,.4);color:#f0a6a3;font-size:12.5px;padding:10px 12px;border-radius:9px;line-height:1.5}
.rpx .ok{background:rgba(87,179,104,.12);border:1px solid rgba(87,179,104,.4);color:#9bd6a8;font-size:12.5px;padding:10px 12px;border-radius:9px;line-height:1.5}
.rpx .ok b{color:#E6D2A2;font-family:'Courier Prime',ui-monospace,monospace}
.rpx .warn{color:#e0a23b}
.rpx .ft{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:16px 20px;border-top:1px solid rgba(255,255,255,.08)}
.rpx .btn{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 16px;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;border:1px solid transparent}
.rpx .btn.ghost{background:#1b1e25;border-color:rgba(255,255,255,.1);color:#9aa1ab}
.rpx .btn.gold{background:linear-gradient(180deg,#E6D2A2,#C6A463);color:#1a1509;box-shadow:0 6px 18px -4px rgba(198,164,99,.45)}
.rpx .btn[disabled]{opacity:.55;cursor:default}
.rpx .shield{display:inline-flex;align-items:center;gap:7px;font-size:11px;color:#C6A463;font-weight:700}
`;

function parseFilename(cd: string): string {
  const s = cd || '';
  const star = /filename\*=UTF-8''([^;]+)/i.exec(s);   // prefer the UTF-8 name so Arabic titles survive
  if (star) { try { return decodeURIComponent(star[1].replace(/"/g, '')); } catch { return star[1]; } }
  const plain = /filename="?([^";]+)"?/i.exec(s);
  return plain ? plain[1] : '';
}

export type ProtectedExportTarget = {
  projectId?: string; scriptDocumentId?: string; revisionId?: string;
  getBaseHtml: () => string; docTitle?: string; lang?: string;
  meta?: { projectTitle?: string; scriptTitle?: string; scriptVersion?: string; exportedBy?: string };
};

export default function ProtectedExportDialog({ open, onClose, target }: { open: boolean; onClose: () => void; target: ProtectedExportTarget | null }) {
  const { t } = useLocale();
  const rp = (productionApi as any).scripton.reviewProtection;
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [role, setRole] = React.useState('');
  const [note, setNote] = React.useState('');
  const [profileId, setProfileId] = React.useState('');
  const [profiles, setProfiles] = React.useState<any[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState('');
  const [ok, setOk] = React.useState<{ copyId?: string; degraded?: string } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setErr(''); setOk(null);
    rp.listProfiles().then((r: any) => setProfiles(Array.isArray(r.data) ? r.data : [])).catch(() => setProfiles([]));
  }, [open]);

  if (!open || !target) return null;

  const submit = async () => {
    setErr(''); setOk(null);
    if (!name.trim() && !email.trim()) { setErr(t('Enter a recipient name or email — protected copies are recipient-specific.')); return; }
    let baseHtml = '';
    try { baseHtml = target.getBaseHtml(); } catch { baseHtml = ''; }
    if (!baseHtml) { setErr(t('Nothing to export yet — open a script first.')); return; }
    setBusy(true);
    try {
      const res: any = await rp.exportProtected({
        projectId: target.projectId, scriptDocumentId: target.scriptDocumentId, revisionId: target.revisionId,
        baseHtml, docTitle: target.docTitle, lang: target.lang, channel: 'download',
        profileId: profileId || undefined,
        recipient: { name: name.trim(), email: email.trim(), company: company.trim(), role: role.trim(), note: note.trim() },
        meta: target.meta || {},
      });
      const blob: Blob = res.data;
      const cd = (res.headers && (res.headers['content-disposition'] || res.headers['Content-Disposition'])) || '';
      const fname = parseFilename(cd) || ((target.meta && target.meta.projectTitle) || 'Script') + '_PROTECTED.pdf';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      const copyId = res.headers && (res.headers['x-copy-id'] || res.headers['X-Copy-Id']);
      const degraded = res.headers && (res.headers['x-protection-degraded'] || res.headers['X-Protection-Degraded']);
      setOk({ copyId, degraded });
    } catch (e: any) {
      let msg = ''; let code = '';
      const data = e && e.response && e.response.data;
      if (data instanceof Blob) { try { const j = JSON.parse(await data.text()); msg = j.message; code = j.code; } catch { /* */ } }
      else if (data) { msg = data.message; code = data.code; }
      const status = e && e.response && e.response.status;
      // Prefer the server's specific message (it carries the exact fix, e.g. the Chromium install command).
      if (!msg) {
        if (code === 'NO_CHROMIUM') msg = t('Chromium for the PDF renderer is not installed on the server. In the backend folder run: npx puppeteer browsers install chrome');
        else if (code === 'NO_PUPPETEER') msg = t('The PDF renderer is not installed on the server. In the backend folder run: npm i puppeteer');
        else if (status === 501) msg = t('The PDF renderer is not ready on the server.');
        else if (code === 'PROTECTION_FAILED' || status === 502) msg = t('Protected render failed and an unprotected fallback is blocked. Nothing was downloaded.');
      }
      if (!msg && !(e && e.response)) msg = t('Couldn’t reach the server (it may be restarting) — please try again in a moment.');
      setErr(msg || t('Protected export failed. Please try again.'));
    } finally { setBusy(false); }
  };

  return (
    <div className="rpx-ov" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="rpx" role="dialog" aria-modal="true">
        <div className="hd">
          <div>
            <h3>{t('Export protected copy')}</h3>
            <p>{t('Recipient-watermarked, permission-locked, and logged. Each copy carries a unique Copy-ID on every page.')}</p>
          </div>
          <button className="x" onClick={() => !busy && onClose()} aria-label={t('Close')}>×</button>
        </div>
        <div className="bd">
          {ok ? (
            <div className="ok">
              {t('Protected copy generated and downloaded.')}{ok.copyId ? <> {t('Copy-ID')} <b>{ok.copyId}</b>.</> : null}
              {ok.degraded ? <div className="warn" style={{ marginTop: 6 }}>{t('Note — some hardening was skipped (server tools unavailable):')} {ok.degraded}. {t('Watermark + recipient trace still applied.')}</div> : null}
            </div>
          ) : (
            <>
              <div className="row2">
                <div className="fld"><label>{t('Recipient name')}</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('Jane Director')} /></div>
                <div className="fld"><label>{t('Recipient email')}</label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@studio.com" /></div>
              </div>
              <div className="row2">
                <div className="fld"><label>{t('Company')}</label><input value={company} onChange={(e) => setCompany(e.target.value)} /></div>
                <div className="fld"><label>{t('Role')}</label><input value={role} onChange={(e) => setRole(e.target.value)} placeholder={t('Investor / Producer / Reader')} /></div>
              </div>
              <div className="fld"><label>{t('Internal note (not printed)')}</label><textarea value={note} onChange={(e) => setNote(e.target.value)} /></div>
              {profiles.length > 0 && (
                <div className="fld"><label>{t('Protection profile')}</label><select value={profileId} onChange={(e) => setProfileId(e.target.value)}><option value="">{t('Workspace default')}</option>{profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              )}
              {err && <div className="err">{err}</div>}
              <div className="note"><span className="shield"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /></svg>{t('FilmOS · ScriptON protection')}</span> — {t('the recipient details above are stamped onto the document and recorded in the export log.')}</div>
            </>
          )}
        </div>
        <div className="ft">
          {ok ? (
            <button className="btn gold" onClick={onClose}>{t('Done')}</button>
          ) : (
            <>
              <button className="btn ghost" onClick={() => !busy && onClose()} disabled={busy}>{t('Cancel')}</button>
              <button className="btn gold" onClick={submit} disabled={busy}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a1509" strokeWidth="2"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /></svg>
                {busy ? t('Generating…') : t('Generate & download')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
