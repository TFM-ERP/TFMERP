'use client';
/** ScriptON — Library "Read script". Renders a developed/promoted script's pageText with the unified
 *  A4 script-paper view (see components/scripton/scriptPaper). ?print=1 opens the A4 Print/Download
 *  document (Save as PDF). Wrapped in the ScriptON rail shell so it keeps ScriptON context. */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productionApi } from '@/lib/api';
import { SxRail } from '@/components/scripton/shared/sx';
import { markScriptonGenerating, clearScriptonGenerating } from '@/components/scripton/useScriptonGenerating';
import { ScriptPaper, buildScriptPrintHtml } from '@/components/scripton/scriptPaper';
import { downloadScriptPdf } from '@/components/scripton/scriptPdf';
import ProtectedExportDialog, { ProtectedExportTarget } from '@/components/scripton/ProtectedExportDialog';
import ScriptDrafts, { type DraftRow } from '@/components/scripton/ScriptDrafts';
import { useLocale, getLocale } from '@/lib/i18n';

type Pg = { page: number; text: string };

// Print the unified A4 script document from an off-screen iframe (no app chrome).
function printScript(text: string, title: string, info?: any): void {
  if (typeof document === 'undefined') return;
  const html = buildScriptPrintHtml(text, title, { ...(info || {}), lang: getLocale() });
  const ifr = document.createElement('iframe');
  ifr.setAttribute('aria-hidden', 'true');
  ifr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(ifr);
  const win = ifr.contentWindow;
  if (!win) { try { window.print(); } catch { /* */ } return; }
  win.document.open(); win.document.write(html); win.document.close();
  let printed = false;
  const go = () => {
    if (printed) return; printed = true;
    try { win.focus(); win.print(); } catch { /* */ }
    setTimeout(() => { try { document.body.removeChild(ifr); } catch { /* */ } }, 60000);
  };
  ifr.onload = () => setTimeout(go, 350);
  setTimeout(go, 1000);
}

/** Keep only what the drafts panel renders. getDocument hands back whole revisions; holding eight
 *  103-page `pageText` blobs in component state to draw a list is pure waste. */
function toDraftRow(r: any): DraftRow {
  return {
    id: String(r.id),
    revisionLabel: r.revisionLabel ?? null,
    revisionColor: r.revisionColor ?? null,
    colorCode: r.colorCode ?? null,
    revisionRound: typeof r.revisionRound === 'number' ? r.revisionRound : null,
    pageCount: typeof r.pageCount === 'number' ? r.pageCount : null,
    changeSummary: r.changeSummary ?? null,
    supersedesId: r.supersedesId ?? null,
    isLocked: !!r.isLocked,
    createdAt: r.createdAt ?? null,
    revisionDate: r.revisionDate ?? null,
  };
}

export default function ScriptOnScriptPage() {
  const router = useRouter();
  const { locale, dir, t } = useLocale();
  const [title, setTitle] = useState('Script');
  const [revLabel, setRevLabel] = useState('WHITE');
  const [text, setText] = useState('');
  const [pages, setPages] = useState<Pg[]>([]);
  const [info, setInfo] = useState<any>({});
  const [docId, setDocId] = useState('');
  const [regening, setRegening] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [dling, setDling] = useState(false);
  const [dlMsg, setDlMsg] = useState<string | null>(null);
  const [revId, setRevId] = useState('');
  const [covWarn, setCovWarn] = useState<string | null>(null);
  const [genErr, setGenErr] = useState<string | null>(null);   // persists until refresh or next run
  const [genPct, setGenPct] = useState<number | null>(null);   // null = indeterminate (planning)
  const [genStat, setGenStat] = useState<string>('');
  const [genMode, setGenMode] = useState<'extend' | 'rewrite' | null>(null);
  const [genHidden, setGenHidden] = useState(false);
  const [cancelling, setCancelling] = useState(false);   // stop requested, waiting for the scene in flight
  const [protReq, setProtReq] = useState(false);
  const [protOpen, setProtOpen] = useState(false);
  // DRAFT HISTORY. getDocument already returns every revision of this script; the reader used to pick
  // activeRevisionId and discard the rest, which is why a rewrite looked like an overwrite.
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [activeRevId, setActiveRevId] = useState('');
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [draftBusy, setDraftBusy] = useState<string | null>(null);
  const [draftMsg, setDraftMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const sp = new URLSearchParams(window.location.search);
        const docParam = sp.get('doc'); const revParam = sp.get('rev'); const doPrint = sp.get('print') === '1';
        if (docParam) setDocId(docParam);
        let revId = revParam || ''; let docTitle = '';
        if (!revId && docParam) {
          // Resolve the revision straight from the document id — never re-guess the project (that showed another build's script).
          const dr: any = await productionApi.script.getDocument(docParam);
          const doc: any = dr.data || {};
          docTitle = doc.title || '';
          const revs: any[] = Array.isArray(doc.revisions) ? doc.revisions : [];
          if (alive) { setDrafts(revs.map(toDraftRow)); setActiveRevId(doc.activeRevisionId || ''); }
          revId = doc.activeRevisionId || (revs[0] && revs[0].id) || '';
        }
        if (!revId) { if (alive) { setErr('Script not found — generate it from the build in ScriptON Studio first.'); setLoading(false); } return; }
        const rv: any = await productionApi.script.getRevision(revId);
        const d: any = rv.data || {};
        const pt: any[] = Array.isArray(d.pageText) ? d.pageText : [];
        if (!alive) return;
        const mapped: Pg[] = pt.length ? pt.map((p: any, idx: number) => ({ page: p.page || idx + 1, text: String(p.text || '') })) : [{ page: 1, text: '(This script has no page text yet.)' }];
        const joined = mapped.map((p) => p.text).join('\n');
        const ttl = docTitle || 'Script';
        const dateStr = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
        const baseInfo: any = { revLabel: d.revisionLabel || 'White Draft', date: dateStr };
        setTitle(ttl); setRevLabel(d.revisionLabel || 'WHITE'); setText(joined); setPages(mapped); setInfo(baseInfo); setRevId(revId); setLoading(false);
        let info2: any = baseInfo;
        if (docParam) {
          try {
            const pk: any = await productionApi.scripton.development.getPackage({ docId: docParam });
            const pd: any = pk.data || {}; const br: any = pd.brief || {}; const cov: any = pd.coverage || {};
            info2 = { ...baseInfo, projectType: br.projectType || null, genres: Array.isArray(br.genres) ? br.genres : null, logline: cov.logline || (pd.stages && pd.stages.LOGLINE && pd.stages.LOGLINE.body) || null };
            if (alive) setInfo(info2);
          } catch { /* keep baseInfo */ }
        }
        if (doPrint) setTimeout(() => printScript(joined, ttl, info2), 650);
      } catch { if (alive) { setErr('Could not load the script.'); setLoading(false); } }
    })();
    return () => { alive = false; };
  }, []);

  // Is Review Protection on for this workspace? If so, the raw Print/Download paths are gated and exports must run
  // through the protected pipeline (recipient watermark + permission-lock + audit). Tolerant: any failure → raw stays.
  useEffect(() => {
    (async () => {
      try { const r: any = await (productionApi as any).scripton.reviewProtection.getSettings(); const s: any = r.data || {}; setProtReq(s.enabled !== false && (!s.config || s.config.noticeRequired !== false)); }
      catch { setProtReq(false); }
    })();
  }, []);

  // ── Draft history ───────────────────────────────────────────────────────────
  /** Re-read the revision list. Called after a generation lands so the new draft appears without a reload. */
  const refreshDrafts = async (id?: string) => {
    const d = id || docId;
    if (!d) return;
    try {
      const dr: any = await productionApi.script.getDocument(d);
      const doc: any = dr.data || {};
      const revs: any[] = Array.isArray(doc.revisions) ? doc.revisions : [];
      setDrafts(revs.map(toDraftRow));
      setActiveRevId(doc.activeRevisionId || '');
    } catch { /* the list stays as it was — never block the reader on it */ }
  };

  /** Fetch one revision's pages and put them on screen. No busy-guard and no messaging of its own —
   *  it is the shared body of "read this draft" and "make this draft current", and the second calls
   *  it while it already holds the busy flag. Returns false if the draft could not be read. */
  const showRevision = async (id: string): Promise<boolean> => {
    try {
      const rv: any = await productionApi.script.getRevision(id);
      const d: any = rv.data || {};
      const pt: any[] = Array.isArray(d.pageText) ? d.pageText : [];
      const mapped: Pg[] = pt.length
        ? pt.map((pp: any, idx: number) => ({ page: pp.page || idx + 1, text: String(pp.text || '') }))
        : [{ page: 1, text: '(This draft has no page text.)' }];
      setPages(mapped);
      setText(mapped.map((pp) => pp.text).join('\n'));
      setRevId(id);
      setRevLabel(d.revisionLabel || 'WHITE');
      setInfo((prev: any) => ({ ...(prev || {}), revLabel: d.revisionLabel || 'White Draft' }));
      setErr(null);
      setCovWarn(null);
      return true;
    } catch { return false; }
  };

  /** Read any draft. Read-only: which draft is CURRENT is a separate, explicit act. */
  const openDraft = async (id: string) => {
    if (!id || draftBusy) return;
    setDraftBusy(id); setDraftMsg(null);
    const ok = await showRevision(id);
    setDraftBusy(null);
    if (!ok) { setDraftMsg(t('Could not open that draft.')); return; }
    setDraftMsg(id === activeRevId ? null : t('Reading an earlier draft. It is not the current one — use “Make current” to switch.'));
  };

  /** Switch which draft the rest of the system reads. Additive: no draft is deleted or rewritten,
   *  and every protected export stays bound to the revision it was produced from. */
  const makeCurrent = async (id: string) => {
    if (!id || !docId || draftBusy) return;
    setDraftBusy(id); setDraftMsg(null);
    try {
      await productionApi.script.setActive(docId, id);
      setActiveRevId(id);
      if (revId !== id) await showRevision(id);
      await refreshDrafts();
      const row = drafts.find((r) => r.id === id);
      setDraftMsg((row?.revisionLabel || t('That draft')) + ' ' + t('is now the current draft.'));
    } catch (e: any) {
      setDraftMsg(e?.response?.data?.message || t('Could not switch the current draft.'));
    } finally { setDraftBusy(null); }
  };

  // A failed/stuck feature write leaves a sentinel page — offer a one-click re-run that polls until real scenes land.
  const looksUnfinished = /being written, scene by scene|did not finish|Regenerating…/i.test(text || '');
  const doRegen = async (mode: 'extend' | 'rewrite' = 'extend') => {
    if (!docId || regening) return;
    // Non-destructive: keep the current pages on screen while it works. The backend writes a NEW revision and only
    // swaps it in when DONE, so a failed/short run never wipes the script. Extend = keep pages + write missing scenes.
    setRegening(true); setCovWarn(null); setGenErr(null); setGenHidden(false); setGenMode(mode); setGenPct(null); setCancelling(false); setGenStat(t('Starting…'));
    // Remember the run OUTSIDE this screen, so the rail can show it from anywhere in ScriptON —
    // and so "Continue in background" stops meaning "the generation disappears".
    markScriptonGenerating(docId);
    try { await productionApi.scripton.development.regenerateFeature(docId, mode); }
    catch (e: any) { setRegening(false); setGenErr(e?.response?.data?.message || t('Could not start generation — check AI Engines & Routing.')); return; }
    // Refresh the visible text as scenes land, and keep polling the progress endpoint until it is actually DONE —
    // not just until the first incremental save (the old bug made a full regen look "finished" after ~3 scenes).
    const refreshText = async () => {
      try {
        const dr: any = await productionApi.script.getDocument(docId);
        const d: any = dr.data || {}; const revs: any[] = Array.isArray(d.revisions) ? d.revisions : [];
        const rid = d.activeRevisionId || (revs[0] && revs[0].id);
        if (rid) {
          const rv: any = await productionApi.script.getRevision(rid);
          const pt: any[] = Array.isArray(rv.data?.pageText) ? rv.data.pageText : [];
          const joined = pt.map((p: any) => String(p.text || '')).join('\n');
          if (joined) {
            setText(joined);
            setPages(pt.map((p: any, idx: number) => ({ page: p.page || idx + 1, text: String(p.text || '') })));
            // The pages on screen now belong to `rid`. Say so, or the header keeps naming the revision
            // we were reading before the run and the "earlier draft" chip reports a false mismatch.
            setRevId(rid);
            if (rv.data?.revisionLabel) setRevLabel(rv.data.revisionLabel);
          }
        }
      } catch { /* keep polling */ }
    };
    // Phase-aware stall guard — the same rule onPromoteScript uses in /scripton/studio/page.tsx.
    // What was here before was a flat wall clock (`Date.now() - started > 600000`) that declared a
    // timeout ten minutes in regardless of what the backend was doing. A feature rewrite is ~110-140
    // scenes at ~15-25s each — 30 to 50 minutes — so that cap fired on EVERY full-length run while the
    // backend was still writing happily. And this poll has no cancel: giving up only stops the watching,
    // so the user saw "timed out" for a job that then finished unseen, and a second click would start a
    // duplicate concurrent run on the same document. Watch the backend heartbeat instead:
    //   * PLANNING maps the whole scene list in ONE long AI call, so no counter can move — never a stall.
    //   * While WRITING, lastActivityAt advances on every scene; only a genuinely cold heartbeat is a stall.
    //   * A dead or restarting backend is caught separately by the unbroken-failure window below.
    const STALL_MS = 420000;   // 7 min of a cold heartbeat while WRITING — one scene's retries + failover can be slow but alive
    const LOST_MS = 60000;     // 1 min of unbroken poll failures — long enough to ride out a backend rebuild/restart
    let lastSt: any = {};
    let lastBeat: any = -1;
    let lastChange = Date.now();
    let errSince = 0;
    let poll: ReturnType<typeof setInterval> | null = null;
    const stop = (msg: string | null) => {
      if (poll) clearInterval(poll);
      poll = null;
      setRegening(false);
      setCancelling(false);
      if (msg) setGenErr(msg);
      // The rail badge exists to tell someone who WALKED AWAY that the draft landed. If the overlay
      // is on screen they have already been told, so clear it; if it was minimised, leave it beating
      // until they come back and click it. The functional updater reads the live value without
      // changing it — `genHidden` captured in this closure would be stale by now.
      setGenHidden((hidden) => { if (!hidden) clearScriptonGenerating(); return hidden; });
      // However the run ended — clean, failed or cancelled — it left a draft on file. Re-read the list
      // so it is visible immediately, rather than after a page reload.
      void refreshDrafts();
    };
    poll = setInterval(async () => {
      let finished = false;
      try {
        const pr: any = await productionApi.scripton.development.scriptProgress(docId);
        lastSt = pr.data || {};
        errSince = 0;
        const total = Number(lastSt.total) || 0;
        const done = Number(lastSt.done) || 0;
        const pageCount = Number(lastSt.pageCount) || 0;
        // The backend sets phase explicitly; the `done === 0` clause only covers an older payload with no phase.
        const planning = lastSt.phase === 'PLANNING' || (lastSt.status === 'GENERATING' && done === 0 && !lastSt.phase);
        const beat = lastSt.lastActivityAt || done;   // advances whenever the backend is alive (planning passes + each scene)
        if (beat !== lastBeat) { lastBeat = beat; lastChange = Date.now(); }
        // Indeterminate spinner while planning — a percentage against a scene total nothing has started yet reads as a stuck 0%.
        setGenPct(planning || total <= 0 ? null : Math.min(99, Math.round((done / total) * 100)));
        setGenStat(planning
          ? t(lastSt.note || 'Planning the scenes — this can take a few minutes on long scripts.')
          : total > 0
            ? (t('Writing scene') + ' ' + Math.min(done + 1, total) + ' ' + t('of') + ' ' + total + (pageCount ? ' · ' + pageCount + ' ' + t('pages') : ''))
            : (pageCount ? (pageCount + ' ' + t('pages so far')) : t('Planning the full arc…')));
        if (lastSt.status === 'DONE' || lastSt.status === 'ERROR' || lastSt.status === 'CANCELLED') finished = true;
        else if (!planning && Date.now() - lastChange > STALL_MS) {
          await refreshText();
          stop(t('Generation stalled — no progress for several minutes. Your current pages are safe. Check your engine in AI Engines & Routing, then try again.'));
          return;
        }
      } catch {
        // Progress unknown — the backend may be mid-restart. Keep polling; only give up once the failures
        // have run unbroken for LOST_MS. A single failed poll must never end a 40-minute run.
        if (!errSince) errSince = Date.now();
        if (Date.now() - errSince > LOST_MS) {
          await refreshText();
          stop(t('Lost contact with the generation service. Your current pages are safe — reload the page to see whether the draft landed.'));
          return;
        }
      }
      await refreshText();
      if (finished) {
        if (lastSt.status === 'ERROR') { stop(lastSt.error || t('Generation failed — see AI Engines & Routing.')); return; }
        // A stop the operator asked for is not a failure: report what was written and leave the
        // current script exactly as it was. The partial draft stays in the revisions list.
        if (lastSt.status === 'CANCELLED') { stop(lastSt.note || t('Generation stopped. Your current script is unchanged.')); return; }
        stop(null);
        setGenPct(100);
        setCovWarn(lastSt && lastSt.coverage === 'SHORT' ? (lastSt.coverageNote || t('This draft may not reach the planned ending — consider regenerating.')) : null);
      }
    }, 3000);
  };

  // Stop a running generation. Cooperative on the backend: the scene in flight finishes first, so the
  // button reports "Stopping…" rather than pretending the run ended the instant it is pressed. The
  // poll keeps running until the backend reports CANCELLED, which is what actually ends the overlay.
  const doCancel = async () => {
    if (!docId || cancelling) return;
    setCancelling(true);
    setGenStat(t('Stopping after the current scene…'));
    try {
      await productionApi.scripton.development.cancelFeature(docId);
    } catch (e: any) {
      setCancelling(false);
      setGenErr(e?.response?.data?.message || t('Could not stop the generation — it is still running.'));
    }
  };

  // Download a real .pdf directly (no OS print dialog). Arabic / load failure falls back to the print document.
  // Default download name = ProjectName_Version_DDMMMYY (e.g. عنترة_WhiteDraft_22JUN26)
  const fileBaseName = () => {
    const d = new Date();
    const m = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][d.getMonth()];
    const date = String(d.getDate()).padStart(2, '0') + m + String(d.getFullYear()).slice(-2);
    const rev = String(revLabel || '').replace(/\(.*?\)/g, '').replace(/\s+/g, '').trim();
    return [String(title || 'Script'), rev, date].filter(Boolean).join('_').replace(/[^\w؀-ۿ\-]+/g, '_');
  };
  const onDownload = async () => {
    if (dling) return; setDling(true); setDlMsg(null);
    const base = fileBaseName();
    const dlInfo: any = { ...(info || {}), fileName: base + '.pdf', docTitle: base };
    try {
      await downloadScriptPdf(text, title, dlInfo);                     // Latin: crisp client-side vector PDF, direct download
    } catch (e: any) {
      if (e && e.code === 'ARABIC') {
        // Arabic: render the print HTML on the server (headless Chromium) → properly-shaped PDF, downloaded directly.
        try {
          const html = buildScriptPrintHtml(text, title, { ...dlInfo, lang: 'ar' });
          const resp: any = await productionApi.scripton.renderPdf(html, base + '.pdf');
          const blob = new Blob([resp.data], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob); const a = document.createElement('a');
          a.href = url; a.download = base + '.pdf'; document.body.appendChild(a); a.click();
          setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
        } catch (se: any) {
          const code = se?.response?.status;
          setDlMsg(code === 501 ? 'Arabic PDF needs Chromium on the server — run: npx puppeteer browsers install chrome. Opening Print for now.'
            : code === 404 ? 'Restart the backend (npm run start:dev) to enable the Arabic PDF route. Opening Print for now.'
            : code === 413 ? 'Script exceeded the server upload limit — restart the backend to apply the raised limit. Opening Print for now.'
            : ('Server PDF unavailable' + (code ? ' (HTTP ' + code + ')' : '') + ' — opening Print; use “Save as PDF”.'));
          printScript(text, title, { ...dlInfo, lang: 'ar' });          // graceful fallback
        }
      } else { printScript(text, title, dlInfo); }
    } finally { setDling(false); }
  };

  const isAr = /[؀-ۿ]/.test(text);
  const exportTarget: ProtectedExportTarget = {
    projectId: undefined,                       // workspace org-default protection config (set in Settings → Review Protection)
    scriptDocumentId: docId || undefined,
    revisionId: revId || undefined,
    getBaseHtml: () => buildScriptPrintHtml(text, title, { ...(info || {}), lang: isAr ? 'ar' : getLocale() }),
    docTitle: fileBaseName(),
    lang: isAr ? 'ar' : 'en',
    meta: { projectTitle: title, scriptTitle: title, scriptVersion: revLabel, exportedBy: '' },
  };

  return (
    <div className="rdroot" dir={dir}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
      .rdroot{--gold:#C6A463;--gold2:#E6D2A2;--goldink:#15120B;--hair:rgba(255,255,255,.08);--faint:#6b727d;--mute:#9aa1ab;position:fixed;inset:0;z-index:50;display:flex;background:radial-gradient(1200px 600px at 50% -8%,#15171d,#0b0c0f 60%);color:#E8E6E0;font-family:var(--sx-body)}
      .rdroot .ico{width:18px;height:18px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
      .rdroot .rail{width:74px;flex:0 0 74px;background:#0e1015;border-right:1px solid var(--hair);display:flex;flex-direction:column;align-items:center;padding:14px 0;gap:6px}
      .rdroot .ritem{width:58px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 0;border-radius:12px;color:var(--faint);position:relative;background:transparent;border:none;cursor:pointer}
      .rdroot .ritem .box{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#171a21;border:1px solid var(--hair);color:var(--mute)}
      .rdroot .ritem .lbl{font-size:9px;font-weight:600}
      .rdroot .ritem:hover .box{border-color:rgba(198,164,99,.4);color:var(--gold2)}
      .rdroot .ritem.on .box{background:linear-gradient(160deg,var(--gold2),var(--gold));border-color:transparent;color:var(--goldink)}
      .rdroot .ritem.on .lbl{color:var(--gold2)}
      .rdroot .ritem.on:before{content:"";position:absolute;left:-1px;top:14px;bottom:14px;width:3px;border-radius:3px;background:var(--gold)}
      .rdroot .rdmain{flex:1;min-width:0;display:flex;flex-direction:column}
      .rdroot .rdhead{flex:0 0 auto;display:flex;align-items:center;gap:12px;padding:12px 18px;background:rgba(12,13,16,.82);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,.07)}
      .rdroot .rdscroll{flex:1;overflow:auto;padding:30px 0 64px}
      .rdspin{animation:rdspin 1s linear infinite}@keyframes rdspin{to{transform:rotate(360deg)}}
      @media (max-width:840px){.rdroot .rail{display:none}}`}</style>
      <SxRail active="reader" />
      <div className="rdmain">
        <div className="rdhead">
          <button onClick={() => router.push('/scripton/library')} style={{ background: '#1b1e25', color: '#9aa1ab', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer' }}>{dir === 'rtl' ? '→' : '←'} {t('Library')}</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, color: '#F3ECDD', fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
            <div style={{ fontSize: 11.5, color: '#6b727d', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{revLabel} &middot; A4</span>
              {revId && activeRevId && revId !== activeRevId
                ? <span title={t('You are reading an earlier draft.')} style={{ fontSize: 9, fontWeight: 800, letterSpacing: .6, textTransform: 'uppercase', color: '#E6D2A2', background: 'rgba(198,164,99,.16)', border: '1px solid rgba(198,164,99,.42)', borderRadius: 5, padding: '1px 6px' }}>{t('earlier draft')}</span>
                : null}
            </div>
          </div>
          {docId && drafts.length ? (
            <button onClick={() => { setDraftMsg(null); setDraftsOpen(true); }} title={t('Every draft of this script — read or restore any of them')} style={{ background: '#1b1e25', color: '#9aa1ab', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span aria-hidden="true">&#9776;</span>{t('Drafts')}
              <span style={{ fontSize: 10.5, fontWeight: 800, color: '#E6D2A2', background: 'rgba(198,164,99,.14)', border: '1px solid rgba(198,164,99,.35)', borderRadius: 999, padding: '0 6px', lineHeight: '15px' }}>{drafts.length}</span>
            </button>
          ) : null}
          {docId ? <button onClick={() => router.push('/scripton/dialect?doc=' + docId)} style={{ background: '#1b1e25', color: '#9aa1ab', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer' }} title="Dialect fidelity & exemplar bank">⌖ {t('Dialect')}</button> : null}
          {looksUnfinished ? <button onClick={() => doRegen('rewrite')} disabled={regening} style={{ background: regening ? '#3a2f1a' : '#5b3d12', color: '#E6D2A2', border: '1px solid rgba(198,164,99,.5)', borderRadius: 9, padding: '8px 12px', fontSize: 12.5, fontWeight: 700, cursor: regening ? 'default' : 'pointer' }} title="Re-run the scene-by-scene feature writer for this script">{regening ? ('⟳ ' + t('Regenerating…')) : ('⟳ ' + t('Retry generation'))}</button> : null}
          {docId && !looksUnfinished ? <button onClick={() => doRegen('extend')} disabled={regening} style={{ background: '#1b1e25', color: '#E6D2A2', border: '1px solid rgba(198,164,99,.4)', borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 700, cursor: regening ? 'default' : 'pointer' }} title="Keep every existing page and write the missing scenes through the ending (preserves your draft)">{regening ? ('⟳ ' + t('Working…')) : ('⟳ ' + t('Complete the script'))}</button> : null}
          {docId && !looksUnfinished ? <button onClick={() => { if (window.confirm(t('Full rewrite: re-write the whole feature from the developed outline. Your current pages are preserved as a prior revision until the new one finishes. Continue?'))) doRegen('rewrite'); }} disabled={regening} style={{ background: '#1b1e25', color: '#9aa1ab', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, padding: '7px 12px', fontSize: 12.5, cursor: regening ? 'default' : 'pointer' }} title="Re-plan and re-write the whole feature from the outline (kept as a new revision)">{t('Full rewrite')}</button> : null}
          {protReq ? (
            <>
              <span title={t('Review Protection is on — raw export is disabled. Manage in Settings → Review Protection.')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#C6A463', fontWeight: 700, padding: '6px 10px', border: '1px solid rgba(198,164,99,.3)', borderRadius: 9, background: 'rgba(198,164,99,.08)' }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 13, height: 13 }}><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" /></svg>{t('Protected')}</span>
              <button onClick={() => setProtOpen(true)} style={{ background: 'linear-gradient(180deg,#E6D2A2,#C6A463)', color: '#15120B', border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }} title={t('Export a recipient-watermarked, permission-locked protected PDF')}>&darr; {t('Protected PDF')}</button>
            </>
          ) : (
            <>
              <button onClick={() => printScript(text, title, info)} style={{ background: '#1b1e25', color: '#9aa1ab', border: '1px solid rgba(255,255,255,.1)', borderRadius: 9, padding: '7px 12px', fontSize: 12.5, cursor: 'pointer' }} title="Open the A4 print document (then Save as PDF)">⎙ {t('Print')}</button>
              <button onClick={() => setProtOpen(true)} style={{ background: '#1b1e25', color: '#C6A463', border: '1px solid rgba(198,164,99,.3)', borderRadius: 9, padding: '7px 12px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }} title={t('Export a recipient-watermarked, permission-locked protected PDF')}>&#x26E8; {t('Protected')}</button>
              <button onClick={onDownload} disabled={dling} style={{ background: 'linear-gradient(180deg,#E6D2A2,#C6A463)', color: '#15120B', border: 'none', borderRadius: 9, padding: '8px 14px', fontSize: 12.5, fontWeight: 700, cursor: dling ? 'default' : 'pointer', opacity: dling ? 0.7 : 1 }} title="Download a real .pdf directly — no print dialog">&darr; {dling ? t('Preparing…') : t('Download PDF')}</button>
            </>
          )}
          {dlMsg ? <div style={{ position: 'fixed', insetInlineEnd: 18, bottom: 18, zIndex: 80, maxWidth: 460, background: '#0e1014', color: '#E6D2A2', border: '1px solid rgba(198,164,99,.45)', borderRadius: 10, padding: '9px 13px', fontSize: 12.5, lineHeight: 1.5 }}>{dlMsg}</div> : null}
        </div>
        <div className="rdscroll">
          {covWarn && !loading && !err ? <div style={{ maxWidth: 820, margin: '0 auto 18px', background: '#2a1e0e', border: '1px solid rgba(224,162,59,.5)', color: '#e7c277', borderRadius: 10, padding: '11px 15px', fontSize: 12.5, lineHeight: 1.55, display: 'flex', alignItems: 'flex-start', gap: 10 }}><span style={{ fontSize: 15, lineHeight: 1 }}>⚠</span><span>{covWarn} {t('Use Regenerate to rebuild the full story.')}</span></div> : null}
          {loading ? <div style={{ textAlign: 'center', color: '#6b727d', marginTop: 90 }}>{t('Loading the script…')}</div>
            : err ? <div style={{ textAlign: 'center', color: '#e9a8a6', marginTop: 90 }}>{err}</div>
              : <ScriptPaper text={text} lang={locale} />}
        </div>
      </div>
      <ProtectedExportDialog open={protOpen} onClose={() => setProtOpen(false)} target={exportTarget} />
      <ScriptDrafts
        open={draftsOpen}
        drafts={drafts}
        activeId={activeRevId}
        readingId={revId}
        busyId={draftBusy}
        message={draftMsg}
        onRead={openDraft}
        onMakeCurrent={makeCurrent}
        onClose={() => setDraftsOpen(false)}
      />

      {/* Cinematic generation overlay — live % from the backend genProgress poll. */}
      {regening && !genHidden ? (
        <div role="status" aria-live="polite" style={{ position: 'fixed', inset: 0, zIndex: 90, display: 'grid', placeItems: 'center', background: 'radial-gradient(900px 500px at 50% -10%,rgba(21,23,29,.96),rgba(8,9,12,.975) 62%)', backdropFilter: 'blur(3px)' }}>
          <div style={{ width: 'min(460px,92vw)', textAlign: 'center', padding: '34px 28px', borderRadius: 18, background: 'rgba(16,18,22,.74)', border: '1px solid rgba(198,164,99,.28)', boxShadow: '0 30px 90px -28px rgba(0,0,0,.85),inset 0 1px 0 rgba(255,255,255,.04)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 2.5, color: '#C6A463', textTransform: 'uppercase' }}>{genMode === 'rewrite' ? t('Full rewrite') : t('Complete the script')}</div>
            <div style={{ width: 134, height: 134, margin: '22px auto 6px' }}>
              {genPct != null ? (
                <div style={{ width: 134, height: 134, borderRadius: '50%', background: `conic-gradient(#E6D2A2 ${genPct * 3.6}deg, rgba(255,255,255,.07) 0)`, display: 'grid', placeItems: 'center', boxShadow: '0 0 36px -6px rgba(198,164,99,.35)' }}>
                  <div style={{ width: 110, height: 110, borderRadius: '50%', background: '#0e1014', display: 'grid', placeItems: 'center' }}>
                    <span style={{ fontSize: 31, fontWeight: 800, color: '#E6D2A2', fontVariantNumeric: 'tabular-nums' }}>{genPct}%</span>
                  </div>
                </div>
              ) : (
                <div className="rdspin" style={{ width: 134, height: 134, borderRadius: '50%', border: '3px solid rgba(255,255,255,.08)', borderTopColor: '#E6D2A2' }} />
              )}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#F3ECDD', marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
            <div style={{ fontSize: 12.5, color: '#9aa1ab', marginTop: 6, minHeight: 18 }}>{genStat || t('Working…')}</div>
            <div style={{ fontSize: 11, color: '#6b727d', marginTop: 14, lineHeight: 1.5 }}>{t('Your current pages stay until the new draft is ready.')}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              <button onClick={() => setGenHidden(true)} style={{ background: '#1b1e25', color: '#9aa1ab', border: '1px solid rgba(255,255,255,.12)', borderRadius: 9, padding: '8px 14px', fontSize: 12, cursor: 'pointer' }}>{t('Continue in background')}</button>
              <button onClick={doCancel} disabled={cancelling} title={t('The scene being written now will finish first.')} style={{ background: cancelling ? '#1b1e25' : '#241211', color: cancelling ? '#6b727d' : '#f2b8b4', border: '1px solid ' + (cancelling ? 'rgba(255,255,255,.12)' : 'rgba(229,99,95,.5)'), borderRadius: 9, padding: '8px 14px', fontSize: 12, cursor: cancelling ? 'default' : 'pointer' }}>{cancelling ? t('Stopping…') : t('Stop generating')}</button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Minimized progress pill (overlay hidden but still generating). */}
      {regening && genHidden ? (
        <button onClick={() => setGenHidden(false)} style={{ position: 'fixed', insetInlineEnd: 18, bottom: 18, zIndex: 90, background: '#0e1014', color: '#E6D2A2', border: '1px solid rgba(198,164,99,.45)', borderRadius: 999, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'center', boxShadow: '0 14px 40px -14px rgba(0,0,0,.7)' }}>
          <span className="rdspin" style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,.15)', borderTopColor: '#E6D2A2' }} />
          {genPct != null ? genPct + '%' : t('Working…')}
        </button>
      ) : null}

      {/* Persistent generation error — stays until refresh or the next run. */}
      {genErr ? (
        <div role="alert" style={{ position: 'fixed', insetInlineStart: '50%', transform: 'translateX(-50%)', bottom: 22, zIndex: 95, maxWidth: 'min(560px,92vw)', background: '#241211', color: '#f2b8b4', border: '1px solid rgba(229,99,95,.55)', borderRadius: 12, padding: '12px 16px', fontSize: 12.5, lineHeight: 1.55, display: 'flex', gap: 10, alignItems: 'flex-start', boxShadow: '0 18px 50px -16px rgba(0,0,0,.7)' }}>
          <span style={{ fontSize: 15, lineHeight: 1 }}>⚠</span>
          <div style={{ flex: 1 }}>{genErr}</div>
          <button onClick={() => setGenErr(null)} style={{ background: 'transparent', color: '#f2b8b4', border: '1px solid rgba(242,184,180,.4)', borderRadius: 7, padding: '2px 8px', fontSize: 12, cursor: 'pointer', flex: '0 0 auto' }}>✕</button>
        </div>
      ) : null}
    </div>
  );
}
