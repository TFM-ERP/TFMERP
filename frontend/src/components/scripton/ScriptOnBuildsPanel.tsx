'use client';
import { useEffect, useRef, useState } from 'react';
import { productionApi } from '@/lib/api';
import { resolveScriptonProjectId } from '@/components/scripton/useScriptonProject';
import { useLocale } from '@/lib/i18n';

/** Builds — name, save, switch and promote development builds. Folded into Studio as an overlay panel
 *  (was the standalone /scripton/builds). Open loads that build into Studio; Promote snapshots into a project. */
const CSS = `
.bld{--bg:#0b0c0f;--panel:#14161c;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--green:#57b368;--blue:#5b8def;background:radial-gradient(1200px 600px at 50% -8%,#15171d,#0b0c0f 60%);min-height:100vh;color:var(--text);font-family:var(--sx-body)}
.bld *{box-sizing:border-box}
.bld .scr{display:flex;flex-direction:column;height:100vh;position:relative}
.bld .ico{width:18px;height:18px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.bld .top{height:60px;flex:0 0 60px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:linear-gradient(180deg,#15181e,#121419);border-bottom:1px solid var(--hair)}
.bld .tl{display:flex;align-items:center;gap:12px}.bld .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;cursor:pointer}
.bld .proj{font-weight:700;font-size:15.5px;color:var(--cream)}.bld .meta{color:var(--faint);font-size:12px}
.bld .btn{display:inline-flex;align-items:center;gap:7px;height:36px;padding:0 14px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;color:var(--text);background:none}.bld .btn .ico{width:15px;height:15px}
.bld .btn.ghost{background:#1b1e25;border-color:var(--hair);color:var(--mute)}
.bld .btn.gold{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700}
.bld .body{flex:1;display:flex;min-height:0}
.bld .main{flex:1;min-width:0;display:flex;flex-direction:column;padding:24px 30px;gap:18px}
.bld .phead h1{font-size:24px;font-weight:800;color:var(--cream)}.bld .phead .sub{font-size:13px;color:var(--mute);margin-top:4px}
.bld.osnew .phead h1{font-family:var(--sx-title);font-weight:500;letter-spacing:-.3px;font-size:25px}.bld.osnew .top .proj{font-family:var(--sx-title);font-weight:600}
.bld .tbar{display:flex;align-items:center;gap:8px}
.bld .chip{padding:7px 13px;border-radius:999px;font-size:12.5px;font-weight:600;color:var(--mute);background:#171a20;border:1px solid var(--hair);cursor:pointer}.bld .chip.on{background:rgba(198,164,99,.14);border-color:rgba(198,164,99,.45);color:var(--gold2)}
.bld .sections{flex:1;overflow:auto;display:flex;flex-direction:column;gap:26px}
.bld .sect{display:flex;flex-direction:column;gap:12px}
.bld .secth{display:flex;align-items:baseline;gap:9px}
.bld .sectt{font-size:12px;font-weight:800;letter-spacing:.9px;text-transform:uppercase;color:var(--gold2)}
.bld .sectn{font-size:11px;font-weight:700;color:var(--mute);background:rgba(154,161,171,.12);border-radius:999px;padding:1px 8px}
.bld .sects{font-size:11.5px;color:var(--faint)}
.bld .warn{border:1px solid rgba(229,99,95,.5);background:rgba(229,99,95,.08);border-radius:12px;padding:13px 15px;display:flex;flex-direction:column;gap:5px}
.bld .warnt{font-size:13px;font-weight:700;color:#e5635f}
.bld .warns{font-size:11.5px;color:var(--mute);line-height:1.55}
.bld .seg{margin-inline-start:auto;display:inline-flex;background:#15181e;border:1px solid var(--hair);border-radius:9px;padding:3px;gap:2px}
.bld .segb{font-size:12px;font-weight:600;padding:5px 12px;border-radius:7px;cursor:pointer;color:var(--mute);white-space:nowrap}
.bld .segb.on{color:var(--gold2);background:rgba(198,164,99,.16)}
.bld .grid{display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:max-content;gap:16px;align-content:start}
/* WHY grid-auto-rows:max-content, MEASURED — do not drop it back to plain auto rows.
   Every implicit row was resolving to .bc's min-height floor (180px on the live board, 214.925px in
   a harness where the content fit) while the tallest card in the row needed 226-243px. The row never
   sized to its content, so the card ran past its own rounded border and over the card below — the
   footer, pinned by margin-top:auto, landed outside the card entirely. max-content makes the row the
   height of the tallest card in it, in both regimes, which is the rule this board is supposed to obey.
   align-items stays at its stretch default so the OTHER cards in that row fill it: align-items:start
   made each card own its height and left the row ragged while still overlapping (measured: rowOverlap
   12.3px, ragged true). min-width:0 stays — a grid item defaults to min-width:auto, and the identity
   line grew long enough that it could not shrink below its track.
   Verified at 3, 2 and 1 columns, on a card with a two-line wrapped title: spill 0, overlap 0. */
.bld .bc{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px;min-width:0}
.bld .r1{display:flex;align-items:center;justify-content:space-between}
.bld .spill{font-size:10px;font-weight:800;letter-spacing:.4px;padding:4px 9px;border-radius:999px}
.bld .spill.draft{background:rgba(154,161,171,.16);color:var(--mute)}.bld .spill.review{background:rgba(91,141,239,.16);color:#a9c4f7}.bld .spill.greenlit{background:rgba(87,179,104,.16);color:var(--green)}.bld .spill.promoted{background:rgba(198,164,99,.18);color:var(--gold2)}
.bld .when{font-size:11px;color:var(--faint)}
.bld .ident{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:11px;color:var(--faint);margin-top:3px;line-height:1.5;min-width:0;overflow-wrap:anywhere}
.bld .ident .k{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:10.5px;letter-spacing:.3px;color:var(--mute);background:rgba(154,161,171,.12);border-radius:5px;padding:1px 5px}
.bld .ident .sep{opacity:.45}
.bld .ident .nosrc{color:#e5635f;font-weight:600}
.bld .ident .chip-rec{font-size:9.5px;font-weight:800;letter-spacing:.5px;color:var(--gold2);background:rgba(198,164,99,.16);border-radius:4px;padding:1px 5px}
.bld .bc.skel{gap:10px;justify-content:flex-start}
.bld .sk{background:linear-gradient(90deg,rgba(154,161,171,.10) 25%,rgba(154,161,171,.18) 37%,rgba(154,161,171,.10) 63%);background-size:400% 100%;animation:bldsk 1.4s ease infinite;border-radius:6px}
.bld .sk-r1{height:14px;width:38%}.bld .sk-nm{height:18px;width:70%}.bld .sk-id{height:11px;width:88%}.bld .sk-ft{height:12px;width:46%;margin-top:auto}
@keyframes bldsk{0%{background-position:100% 50%}100%{background-position:0 50%}}
.bld .bc.empty{justify-content:center;align-items:flex-start;border-style:dashed}
.bld .nm{font-size:17px;font-weight:800;color:var(--cream);min-width:0;overflow-wrap:anywhere}
.bld .nm-in{width:100%;background:#171a20;border:1px dashed rgba(198,164,99,.45);border-radius:8px;color:var(--cream);font-size:16px;font-weight:700;padding:5px 8px;outline:none}
.bld .nm-in:focus{border-style:solid;border-color:var(--gold2)}
.bld .ident .muted{color:var(--faint)}
.bld .ladder{display:flex;align-items:center;gap:4px}.bld .ladder .d{flex:1;height:5px;border-radius:3px;background:#23262e}.bld .ladder .d.on{background:var(--gold)}
.bld .ft{display:flex;align-items:center;gap:8px;border-top:1px solid var(--hair);padding-top:11px;margin-top:auto}
.bld .mini{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 11px;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;border:1px solid var(--hair);color:var(--mute);background:#171a20}.bld .mini .ico{width:13px;height:13px}.bld .mini.gold{background:rgba(198,164,99,.14);border-color:rgba(198,164,99,.4);color:var(--gold2)}
.bld .linked{font-size:11px;color:var(--gold2)}
.bld .add{border:1px dashed var(--hair);border-radius:14px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--faint);cursor:pointer;min-height:180px}.bld .add:hover{color:var(--gold2);border-color:rgba(198,164,99,.5)}
.bld .scrim{position:fixed;inset:0;background:rgba(6,7,10,.66);display:flex;align-items:center;justify-content:center;z-index:85}
.bld .modal{width:520px;background:#0e1014;border:1px solid rgba(198,164,99,.3);border-radius:16px;padding:22px;display:flex;flex-direction:column;gap:16px}
.bld .mh{display:flex;align-items:center;justify-content:space-between}.bld .mt{font-size:17px;font-weight:800;color:var(--cream)}.bld .mx{color:var(--faint);cursor:pointer;font-size:18px}
.bld .msub{font-size:12px;color:var(--mute);margin-top:-10px}
.bld .opt{display:flex;gap:12px}
.bld .ocard{flex:1;border:1px solid var(--hair);border-radius:12px;padding:13px;cursor:pointer;background:#15181e}.bld .ocard.on{border-color:rgba(198,164,99,.5);background:rgba(198,164,99,.08)}
.bld .ocard .ot{font-size:13px;font-weight:700;color:var(--cream)}.bld .ocard .os{font-size:10.5px;color:var(--faint);margin-top:2px}
.bld select,.bld input{height:38px;border-radius:9px;background:#171a20;border:1px solid var(--hair);color:var(--cream);font-size:12.5px;font-weight:600;padding:0 12px;width:100%;outline:none}
.bld .xfer{background:#15181e;border:1px solid var(--hair);border-radius:11px;padding:12px 13px}.bld .xl{font-size:10px;font-weight:700;letter-spacing:.8px;color:var(--gold);margin-bottom:7px}.bld .xrow{display:flex;gap:8px;font-size:11.5px;color:var(--text);margin-bottom:5px}.bld .xrow .c{color:var(--green);flex:none}.bld .snap{font-size:10.5px;color:var(--faint);font-style:italic}
.bld .mfoot{display:flex;gap:10px;justify-content:flex-end}
.bld .toast{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#0e1014;border:1px solid rgba(198,164,99,.4);color:var(--gold2);font-size:12.5px;padding:10px 16px;border-radius:10px;z-index:90}
@media(max-width:1180px){.bld .grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:760px){.bld .grid{grid-template-columns:1fr}.bld .main{padding:16px}.bld .modal{width:92vw}}
`;
const SPILL: Record<string, string> = { DRAFT: 'draft', REVIEW: 'review', GREENLIT: 'greenlit', PROMOTED: 'promoted' };
const DOTS: Record<string, number> = { DRAFT: 2, REVIEW: 4, GREENLIT: 6, PROMOTED: 8 };
// ABSOLUTE, BECAUSE A RELATIVE DATE IS NOT AN IDENTIFIER.
// Three builds here are called "Jason Quick"; their cards differed only by "6d ago" and "7d ago",
// and both a person and an audit picked the wrong one. That is the same reason a revision slug
// carries a real date. Month names are spelled out rather than left to the locale, which renders
// "Sept" in some ICU versions and "Sep" in others — a card identifier should not drift with a runtime.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const onDate = (d?: string) => { if (!d) return ''; const x = new Date(d); return isNaN(+x) ? '' : x.getDate() + ' ' + MONTHS[x.getMonth()] + ' ' + x.getFullYear(); };
const fmtChars = (n: number) => n >= 1000 ? Math.round(n / 1000) + 'k of writing' : n + ' chars';
const STAGE_LABEL: Record<string, string> = { LOGLINE: 'Logline', PREMISE: 'Premise', THESIS: 'Thesis', SYNOPSIS: 'Synopsis', TREATMENT: 'Treatment', BEATS: 'Beats', SCENES: 'Scenes', STEP_OUTLINE: 'Step outline', DRAFT: 'Draft', COVERAGE: 'Coverage' };
const stageLabel = (k?: string | null) => STAGE_LABEL[String(k || '')] || String(k || '').toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
/** "2026-06-23T…..Z .. 2026-06-26T…..Z" -> "23–26 Jun" */
const spanOf = (iso: string) => { const [a, b] = String(iso || '').split(' .. '); const A = new Date(a), B = new Date(b || a);
  if (isNaN(+A)) return ''; const m = (d: Date) => MONTHS[d.getMonth()];
  return A.getDate() === B.getDate() && m(A) === m(B) ? (A.getDate() + ' ' + m(A)) : (A.getDate() + '–' + B.getDate() + ' ' + m(B)); };
const ago = (d?: string) => { if (!d) return ''; const ms = Date.now() - new Date(d).getTime(); const h = Math.floor(ms / 3.6e6); return h < 1 ? 'just now' : h < 24 ? h + 'h ago' : Math.floor(h / 24) + 'd ago'; };
const SAMPLE = [
  { id: 'b1', name: 'Antara — mythic cut', status: 'GREENLIT', updatedAt: null, linkedProjectId: null },
  { id: 'b2', name: 'The Pulpit', status: 'REVIEW', updatedAt: null, linkedProjectId: null },
  { id: 'b3', name: 'Sand & Glass', status: 'PROMOTED', updatedAt: null, linkedProjectId: 'p1' },
  { id: 'b4', name: 'Oryx — pilot', status: 'DRAFT', updatedAt: null, linkedProjectId: null },
];

export default function ScriptOnBuildsPanel({ projectId, onClose, onNewBuild, railGap = 0, osNew = false, embedded = false, demo = false }: { projectId: string | null; onClose: () => void; onNewBuild?: () => void; railGap?: number; osNew?: boolean; embedded?: boolean; demo?: boolean }) {
  const { dir, t } = useLocale();
  const [builds, setBuilds] = useState<any[] | null>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  const [modal, setModal] = useState<any | null>(null);
  const [target, setTarget] = useState('existing');
  const [destProj, setDestProj] = useState('');
  const [newName, setNewName] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  // THREE STATES, NOT TWO. `view` is the state; `bin` derives from it so every existing reference
  // keeps its meaning. Archive is the door that stops a build having to be BINNED — with a 30-day
  // countdown on it — merely to get it off the active board.
  const [view, setView] = useState<'active' | 'archived' | 'bin'>('active');
  const bin = view === 'bin';
  const archived = view === 'archived';
  const [confirm, setConfirm] = useState<any | null>(null);
  const [briefView, setBriefView] = useState<any | null>(null);
  // THE BRIEF IS FETCHED, NOT CARRIED. The card deliberately has no `brief` — the list would ship
  // 105k characters of source per build otherwise — so this dialog used to read an always-undefined
  // field and told every build it was too old to have settings. It now asks for the one build's
  // brief when it opens, and says plainly when that request fails rather than blaming the build.
  const [briefBusy, setBriefBusy] = useState(false);
  const [briefErr, setBriefErr] = useState<string | null>(null);
  const openSettings = async (b: any) => {
    setBriefErr(null); setBriefView(b);
    if (!b || !b.id || isDemo(b)) return;
    setBriefBusy(true);
    try {
      const r: any = await productionApi.scripton.development.getBuildBrief(b.id);
      const brief = (r && r.data && r.data.brief) || {};
      setBriefView((cur: any) => (cur && cur.id === b.id ? { ...cur, brief } : cur));
    } catch (e: any) {
      setBriefErr(e?.response?.data?.message || e?.message || t('Could not load this build settings.'));
    } finally { setBriefBusy(false); }
  };
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  // IF THE FIX FOR "Untitled" IS THAT HE RENAMES IT, THE CARD SHOULD LET HIM. Eight recovered builds
  // have no title anywhere in their content, and sending him to Settings to name each one is the kind
  // of errand a board exists to avoid.
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const commitName = async (b: any) => {
    const name = editName.trim();
    setEditId(null);
    if (!name || name === String(b.name || '')) return;
    try { await productionApi.scripton.development.renameBuild(b.id, name.slice(0, 120)); flash(t('Renamed.')); }
    catch { flash(t('Could not rename this build.')); }
    await load(projectId || '', view);
  };
  // A LOAD THAT NEVER ANSWERS MUST STILL SAY SO. Without this a hung request looks identical to a
  // slow one, forever — which is precisely how a skeleton board survived a whole evening.
  useEffect(() => {
    if (state !== 'loading') return;
    const t = setTimeout(() => { if (mountedRef.current) setState('failed'); }, 12000);
    return () => clearTimeout(t);
  }, [state]);
  const tt = useRef<any>(null);
  const flash = (m: string) => { setToast(m); clearTimeout(tt.current); tt.current = setTimeout(() => setToast(null), 3200); };

  // THE PANEL MOUNTS BEFORE projectId RESOLVES, and it used to call load('') in that gap — which hits
  // `where = {}` on the server and renders EVERY build in the system, in every project, until the
  // scoped response replaces them. That flash of other people's builds has been reported repeatedly.
  // An unscoped call is now impossible from here: no pid, no request.
  //
  // The second half is ordering. Two loads can be in flight (mount, then projectId resolving, or a
  // fast Active/Bin toggle) and the network decides which lands last. A token makes LAST ISSUED win
  // rather than last arrived, so a stale response cannot overwrite a newer one.
  const reqRef = useRef(0);
  const mountedRef = useRef(true);
  // SET IT TRUE IN THE BODY, NOT ONLY FALSE IN CLEANUP.
  //
  // React 18 dev mounts, cleans up, then remounts. A cleanup-only reset therefore leaves this false
  // for the component's ENTIRE life — every `live()` check fails, setBuilds is never called, the
  // finally never records a state, and the 12s timeout is skipped because it too is guarded by this
  // ref. A 200 carrying 11 builds was fetched and thrown away, and the board sat on skeletons with
  // no error and no timeout. The file reads correctly, which is why it survives review: the bug is
  // in what the effect does NOT do.
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);

  /**
   * THE STATE IS RESOLVED IN A FINALLY, NEVER PER BRANCH.
   *
   * The previous version returned early when it had no pid — and returned WITHOUT setting anything,
   * so `builds` stayed null, which the render reads as "still loading". The board sat on skeletons
   * forever while the network showed 200s. Every early exit here now leaves a decided state behind:
   * a branch that returns without an answer is how a screen lies about what it knows, which is the
   * same defect as the SAMPLE board wearing a different face.
   *
   * It also resolves its OWN workspace. This board is the one screen reached with no build selected,
   * so a null projectId is legitimate rather than an error — and the answer is the hidden ScripON
   * Library, which resolveScriptonProjectId() already returns. Asking for it beats both alternatives:
   * querying with an empty projectId (which the server reads as "every build in the system") and
   * waiting for a prop that is never coming.
   */
  const load = async (pid: string, v: 'active' | 'archived' | 'bin' | boolean = 'active') => {
    const vw: 'active' | 'archived' | 'bin' = v === true ? 'bin' : v === false ? 'active' : v;
    const token = ++reqRef.current;
    const live = () => mountedRef.current && token === reqRef.current;
    if (mountedRef.current) { setState('loading'); }
    let ok = false;
    try {
      const wsid = pid || (await resolveScriptonProjectId()) || '';
      if (!wsid) { if (live()) setBuilds([]); ok = true; return; }
      const r: any = await productionApi.scripton.development.listBuilds(wsid, vw === 'bin', vw);
      if (!live()) return;
      setBuilds(Array.isArray(r.data) ? r.data : []);
      ok = true;
    } catch { /* ok stays false — the finally reports it */ }
    finally { if (live()) setState(ok ? 'ready' : 'failed'); }
  };
  const daysLeft = (d?: string) => { if (!d) return 30; const ms = new Date(d).getTime() + 30 * 86400000 - Date.now(); return Math.max(0, Math.ceil(ms / 86400000)); };
  const isDemo = (b: any) => /^b\d$/.test(String(b && b.id));
  const switchView = (v: 'active' | 'archived' | 'bin') => { setView(v); setFilter('All'); if (projectId) load(projectId, v); };
  const doArchive = async (b: any) => { if (isDemo(b)) { flash(t('Demo build.')); return; } try { await productionApi.scripton.development.archiveBuild(b.id); flash(t('Archived — kept indefinitely, with no countdown.')); if (projectId) await load(projectId, view); } catch { flash(t('Could not archive.')); } };
  const doUnarchive = async (b: any) => { if (isDemo(b)) { flash(t('Demo build.')); return; } try { await productionApi.scripton.development.unarchiveBuild(b.id); flash(t('Back on the active board.')); if (projectId) await load(projectId, view); } catch { flash(t('Could not unarchive.')); } };
  const doRestore = async (b: any) => { if (isDemo(b)) { flash(t('Demo build.')); return; } try { await productionApi.scripton.development.restoreBuild(b.id); flash(t('Restored.')); if (projectId) await load(projectId, view); } catch { flash(t('Could not restore.')); } };
  const doConfirm = async () => { const b = confirm.b; const kind = confirm.kind; setConfirm(null); if (isDemo(b)) { flash(t('Demo build - connect a project.')); return; } try { if (kind === 'purge') { const r: any = await productionApi.scripton.development.purgeBuild(b.id); const d = r?.data?.purged || r?.purged; flash(d && d.chars ? (t('Deleted forever') + ' — ' + d.stageVersions + ' ' + t('draft(s)') + ', ' + Number(d.chars).toLocaleString() + ' ' + t('characters of writing.')) : t('Deleted forever.')); } else { await productionApi.scripton.development.deleteBuild(b.id); flash(t('Moved to bin.')); } if (projectId) await load(projectId, view); } catch { flash(t('Action failed.')); } };
  useEffect(() => {
    let alive = true;
    (async () => {
      try { const pr: any = await productionApi.projects.list(); const ps = pr.data?.items ?? (Array.isArray(pr.data) ? pr.data : []); if (alive) setProjects(ps); } catch { /* */ }
      if (projectId) setDestProj(projectId);
      await load(projectId || '', 'active');   // load resolves the ScripON workspace when there is no projectId
    })();
    return () => { alive = false; };
  }, [projectId]);

  // SAMPLE NEVER RENDERS FOR A REAL USER. It used to fill in whenever `builds` was null, which meant
  // "not fetched yet" — so any session where projectId did not resolve showed four invented builds
  // (Antara / The Pulpit / Sand & Glass / Oryx) and NONE of the writer's own, permanently, with no
  // error and nothing to retry. A fake board is worse than an empty one: an empty board is obviously
  // waiting, a populated one looks like an answer. null now renders as nothing, and SAMPLE is
  // reachable only behind the explicit `demo` prop.
  // THREE STATES, NOT TWO. `builds === null` means NOT FETCHED YET and used to render SAMPLE — four
  // invented builds (Antara / The Pulpit / Sand & Glass / Oryx) shown as if they were the writer's
  // own. On any session where projectId never resolved that fake board was permanent, with no error
  // and nothing to retry, and the names could collide with real work so a fake card and a missing
  // one looked identical. A populated board looks like an answer; only an empty one looks like a
  // question. SAMPLE is now reachable solely through the explicit `demo` prop, which nothing passes.
  const loading = state === 'loading' && !demo;
  const failed = state === 'failed';
  const list = Array.isArray(builds) ? builds : (demo ? SAMPLE : []);
  const shown = list.filter((b) => filter === 'All' || String(b.status || 'DRAFT').toUpperCase() === filter.toUpperCase());
  const isEmpty = !loading && !failed && shown.length === 0;

  // TWO SECTIONS, NOT ONE FLAT RUN.
  //
  // The eleven builds the orphan recovery recreated are not the writer's recent work — they are a
  // repair, and mixing them into one grid is how six cards still called "Name this build" came to
  // sit above the script he had open. Ordering alone fixes today's board; a section makes it
  // structural, so no future maintenance pass can quietly interleave with his work again.
  //
  // The bin is one list: there, everything present is there for the same reason.
  const recovered = shown.filter((b: any) => !!b.recovered);
  const recent = shown.filter((b: any) => !b.recovered);

  // THE BOARD MUST NEVER RENDER FEWER BUILDS THAN IT RECEIVED.
  //
  // It rendered 10 of 11 and said nothing — the same class of failure as SAMPLE and the stuck
  // skeleton: a screen asserting something it does not know. Note which invariant is worth
  // checking. `recent` and `recovered` split on !!b.recovered, so their lengths ALWAYS sum to
  // shown.length; asserting that would pass while a build was still missing. The count that can
  // actually diverge is what arrived versus what reached the DOM, and the one mechanism that loses
  // a card while every array length stays right is a duplicate React key — React keeps the last
  // child with a given key and silently discards the rest.
  const ids = list.map((b: any) => (b && b.id != null ? String(b.id) : ''));
  const dupIds = new Set(ids.filter((id, i) => id && ids.indexOf(id) !== i));
  const noId = ids.filter((id) => !id).length;
  const partitionLost = shown.length - (recent.length + recovered.length);
  const filteredOut = filter === 'All' ? list.length - shown.length : 0;
  const integrity = (dupIds.size || noId || partitionLost || filteredOut)
    ? { received: list.length, distinctIds: new Set(ids.filter(Boolean)).size, dupIds: Array.from(dupIds), noId, partitionLost, filteredOut }
    : null;
  useEffect(() => {
    if (!integrity) return;
    // Loud, with the numbers, because a silent drop is what let this run.
    console.error('[builds] the board received builds it cannot render', integrity,
      list.map((b: any) => ({ id: b && b.id, name: b && b.name, status: b && b.status, recovered: !!(b && b.recovered) })));
  }, [integrity ? JSON.stringify(integrity) : '']);

  const sections: { key: string; header: string; note?: string; items: any[]; showAdd?: boolean }[] =
    view !== 'active' ? [{ key: view, header: '', items: shown }]
      : !recovered.length ? [{ key: 'recent', header: '', items: recent, showAdd: true }]
        : [
          { key: 'recent', header: t('Recent'), note: t('ordered by when you last wrote in them'), items: recent, showAdd: true },
          { key: 'recovered', header: t('Recovered'), note: t('rebuilt from orphaned stages — the writing survived, the source did not'), items: recovered },
        ];

  const openBuild = (id: string) => { if (typeof window !== 'undefined') window.location.assign('/scripton/studio?build=' + id); };
  const openScript = (docId: string) => { if (docId && typeof window !== 'undefined') window.location.assign('/scripton/script?doc=' + docId); };
  const cycleStatus = async (b: any) => { if (isDemo(b)) { flash(t('Demo build - connect a project to manage status.')); return; } const order = ['DRAFT', 'REVIEW', 'GREENLIT']; const cur = String(b.status || 'DRAFT').toUpperCase(); const next = order[(order.indexOf(cur) + 1) % order.length]; try { await productionApi.scripton.development.setBuildStatus(b.id, next); flash(t('Status') + ' \u2192 ' + next.charAt(0) + next.slice(1).toLowerCase()); if (projectId) await load(projectId, view); } catch { flash(t('Could not update status.')); } };
  const openModal = (b: any) => { setModal(b); setTarget('existing'); setNewName(b.name + ' (project)'); };

  const resolveVersion = async (): Promise<string | null> => {
    if (!projectId) return null;
    try { const p: any = await productionApi.scripton.development.pipeline(projectId, modal && modal.id); const stages = Array.isArray(p.data) ? p.data : [];
      for (const kind of ['DRAFT', 'COVERAGE', 'SCENES', 'TREATMENT', 'SYNOPSIS', 'LOGLINE']) { const st = stages.find((s: any) => s.kind === kind && s.currentVersionId); if (st) return st.currentVersionId; }
      const any = stages.find((s: any) => s.currentVersionId); return any ? any.currentVersionId : null;
    } catch { return null; }
  };
  const doPromote = async () => {
    if (String(modal.id).startsWith('b')) { flash(t('Demo build — connect a project to promote.')); setModal(null); return; }
    const vid = await resolveVersion();
    if (!vid) { flash(t('Develop a draft in this build first — no stage version to snapshot yet.')); return; }
    flash(t('Promoting…'));
    try { await productionApi.scripton.development.promoteBuild(vid, { target, projectId: target === 'existing' ? destProj : undefined, name: target === 'new' ? newName : undefined, buildId: modal.id }); flash(t('Promoted — snapshot landed in the project.')); setModal(null); if (projectId) await load(projectId); }
    catch (e: any) { flash(e?.response?.data?.message || t('Promote failed.')); }
  };

  /** One card. Lifted out of the map so the Recent and Recovered sections cannot drift apart. */
  const renderCard = (b: any, i = 0) => { const st = String(b.status || 'DRAFT').toUpperCase(); const dots = DOTS[st] || 2; return (
                <div key={(b && b.id != null && !dupIds.has(String(b.id))) ? String(b.id) : ((b && b.id != null ? String(b.id) : 'noid') + '#' + i)} className="bc">
                  <div className="r1"><span className={'spill ' + (SPILL[st] || 'draft')} title={(st !== 'PROMOTED' && !bin && !isDemo(b)) ? t('Click to advance: Draft \u2192 Review \u2192 Greenlit') : (st === 'PROMOTED' ? t('Promoted to production') : '')} onClick={() => { if (st !== 'PROMOTED' && !bin && !isDemo(b)) cycleStatus(b); }} style={{ cursor: (st !== 'PROMOTED' && !bin && !isDemo(b)) ? 'pointer' : 'default' }}>{st}</span>{b.recovered ? <span className="when" title={t('When this build row was recreated from its orphaned stages')}>{t('recreated') + ' ' + onDate(b.createdAt)}</span> : null}</div>
                  {editId === b.id ? (
                    <input className="nm-in" autoFocus value={editName} placeholder={t('Name this build')}
                      onChange={(e) => setEditName(e.target.value.slice(0, 120))}
                      onBlur={() => commitName(b)}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitName(b); if (e.key === 'Escape') setEditId(null); }} />
                  ) : (
                    <div className="nm" title={bin || isDemo(b) ? undefined : t('Click to rename')}
                      onClick={() => { if (!bin && !isDemo(b)) { setEditName(String(b.name || '')); setEditId(b.id); } }}
                      style={{ cursor: (!bin && !isDemo(b)) ? 'text' : 'default', ...(!String(b.name || '').trim() ? { color: 'var(--faint)', fontStyle: 'italic', fontWeight: 600 } : {}) }}>
                      {String(b.name || '').trim() || t('Name this build')}
                    </div>
                  )}
                  {/* Line 2 — what tells this build from the one above it. Key is OUR CHOICE (no
                      industry convention exists for a development container); the source fingerprint
                      is what makes "different foundation" visible at a glance. */}
                  <div className="ident">
                    {/* JOINED, not prefixed. Prefixing each fragment with a separator leaves a dangling
                        leading dot whenever the first field is absent — demo rows have no shortKey. */}
                    {([
                      b.recovered ? <span key="r" className="chip-rec" title={t('Recovered from an orphaned build — its parent row was deleted and the writing survived.')}>{t('RECOVERED')}</span> : null,
                      b.recovered ? <span key="ro" className="k" title={t('Orphan build id')}>{b.recovered.orphanBuildId}</span> : null,
                      b.recovered && b.recovered.chars ? <span key="rc">{fmtChars(b.recovered.chars)}</span> : null,
                      b.recovered && b.recovered.writtenBetween ? <span key="rw" title={t('When the writing itself was made')}>{t('written') + ' ' + spanOf(b.recovered.writtenBetween)}</span> : null,
                      !b.recovered && b.shortKey ? <span key="k" className="k" title={t('Build key')}>{b.shortKey}</span> : null,
                      !b.recovered && b.createdAt ? <span key="d" title={t('created') + ' ' + ago(b.createdAt)}>{onDate(b.createdAt)}</span> : null,
                      // A MISSING FIELD REMOVES ITS SLOT. `version` renders an em dash when there is
                      // nothing to say, which trailed "no source · —" into nothing; an absent value
                      // must not leave a separator behind it.
                      b.source && !b.source.empty ? <span key="s" title={t('source size and content fingerprint')}>{b.source.label}</span> : null,
                      // Red means "this is WRONG", not "this is absent". A recovered build has no source
                      // because the source died with the parent row — that is its expected state, and the
                      // RECOVERED chip already says so. Kept red for a normally-created build, where an
                      // absent source IS the anomaly that produced a film with an invented cast.
                      b.source && b.source.empty ? <span key="s0" className={b.recovered ? 'muted' : 'nosrc'}
                        title={b.recovered ? t('The original source died with the deleted parent build; only the writing survived.') : t('This build has no source material. Stages generated from it are written from the brief alone.')}>{b.source.label}</span> : null,
                      (b.version && b.version !== '—') ? <span key="v">{b.version}</span> : null,
                    ].filter(Boolean)).flatMap((el, i) => (i ? [<span key={'sep' + i} className="sep">·</span>, el] : [el]))}
                  </div>
                  {/* The dots used to be DOTS[status] — two for every DRAFT build whether it held two
                      stages of work or ten, a second and less accurate copy of the status chip above.
                      They now show how far the ladder actually got, and say so in words. */}
                  <div className="ladder">{Array.from({ length: Math.max(1, b.ladder?.total || 8) }).map((_, i) => (<span key={i} className={'d' + (i < (b.ladder?.done ?? dots) ? ' on' : '')} />))}</div>
                  {/* THE CANON STEP, BESIDE THE LADDER. Every stage is written against it, so a build
                      whose canon is missing or failed cannot generate — and a card that shows only a
                      ladder makes that build look ready. null is LEGACY, not broken: those predate the
                      step and extract on first use. */}
                  {b.canon && b.canon.state && b.canon.state !== 'ready' ? (
                    <div className="ident" style={{ marginTop: 0 }}>
                      <span style={{ color: b.canon.state === 'failed' ? '#e5635f' : 'var(--gold2)', fontWeight: 700 }}>
                        {b.canon.state === 'failed' ? t('Canon failed') : b.canon.state === 'running' ? t('Canon extracting…') : t('Canon queued')}
                      </span>
                      <span className="sep">·</span>
                      <span>{b.canon.state === 'failed' ? String(b.canon.error || t('no reason recorded')).slice(0, 90) : t('stages cannot be written until it is ready')}</span>
                    </div>
                  ) : null}
                  <div className="ident" style={{ marginTop: 0 }}>{b.ladder && b.ladder.total
                    ? (b.ladder.done ? (stageLabel(b.ladder.furthest) + ' · ' + t('stage') + ' ' + b.ladder.done + ' ' + t('of') + ' ' + b.ladder.total) : t('Not started'))
                    : ''}</div>
                  <div className="ft">
                    {bin ? (<>
                      <span className="when" style={{ marginRight: 'auto' }}>{daysLeft(b.deletedAt)}{t('d left in bin')}</span>
                      <span className="mini gold" onClick={() => doRestore(b)}>↩ {t('Restore')}</span>
                      {/* Rescue WITHOUT returning it to the active board — archiving from the bin
                          clears the countdown and leaves it out of the way. */}
                      <span className="mini" onClick={() => doArchive(b)} title={t('Keep it indefinitely, off the active board and out of the bin')}><svg className="ico" viewBox="0 0 24 24"><path d="M3 7h18v13H3zM3 7l2-4h14l2 4M9 12h6" /></svg>{t('Archive')}</span>
                      <span className="mini" onClick={() => setConfirm({ kind: 'purge', b })} style={{ color: '#e5635f', borderColor: 'rgba(229,99,95,.4)' }}>{t('Delete forever')}</span>
                    </>) : archived ? (<>
                      {/* NO COUNTDOWN — there isn't one. Archived is indefinite. */}
                      <span className="mini" onClick={() => openBuild(b.id)}><svg className="ico" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>{t('Open')}</span>
                      <span className="mini gold" onClick={() => doUnarchive(b)} title={t('Put it back on the active board')}>↩ {t('Unarchive')}</span>
                      <span className="mini" title={t('Move to bin')} onClick={() => setConfirm({ kind: 'delete', b })} style={{ marginLeft: 'auto', color: '#e5635f', borderColor: 'rgba(229,99,95,.4)' }}>✖ {t('Delete')}</span>
                    </>) : (<>
                      {(st === 'PROMOTED' || b.linkedScriptId) ? (<>{b.linkedScriptId ? (<span className="mini gold" onClick={() => openScript(b.linkedScriptId)} title={t('Open the promoted script')}><svg className="ico" viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z" /></svg>{t('Open script')}</span>) : null}<span className="mini" onClick={() => openBuild(b.id)} title={t('Open Develop \u2014 refine or re-send to production')}><svg className="ico" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>{t('Develop')}</span></>) : (<><span className="mini" onClick={() => openBuild(b.id)}><svg className="ico" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>{t('Open')}</span>{(st === 'GREENLIT' || st === 'REVIEW') ? (<span className="mini gold" onClick={() => openModal(b)}><svg className="ico" viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>{t('Promote to project')}</span>) : null}</>)}
                      <span className="mini" onClick={() => openSettings(b)} title={t('View saved settings (read-only)')}><svg className="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M19.4 13a7 7 0 000-2l2-1.5-2-3.4-2.3 1a7 7 0 00-1.7-1L15 3h-4l-.4 2.6a7 7 0 00-1.7 1l-2.3-1-2 3.4L6.6 11a7 7 0 000 2l-2 1.5 2 3.4 2.3-1a7 7 0 001.7 1L11 21h4l.4-2.6a7 7 0 001.7-1l2.3 1 2-3.4z" /></svg>{t('Settings')}</span>
                      {/* TWO ACTIONS WHERE THERE WAS ONE. Archive is neutral and destroys nothing;
                          Delete is red and starts a 30-day countdown. A single ✖ meaning both is how
                          work ends up in the bin only because there was nowhere else to put it. */}
                      <span className="mini" style={{ marginInlineStart: 'auto' }} onClick={() => doArchive(b)} title={t('Keep indefinitely, off the board. No countdown, never swept.')}><svg className="ico" viewBox="0 0 24 24"><path d="M3 7h18v13H3zM3 7l2-4h14l2 4M9 12h6" /></svg>{t('Archive')}</span>
                      <span className="mini" title={t('Move to bin — deleted after 30 days')} onClick={() => setConfirm({ kind: 'delete', b })} style={{ color: '#e5635f', borderColor: 'rgba(229,99,95,.4)' }}>✖ {t('Delete')}</span>
                    </>)}
                  </div>
                </div>
  ); };

  return (
    <div className={'bld' + (osNew ? ' osnew' : '') + (embedded ? ' embedded' : '')} dir={dir} style={embedded ? { flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', position: 'relative' } : { position: 'fixed', top: 0, right: 0, bottom: 0, left: railGap, zIndex: 80, overflow: 'auto' }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="scr">
        {/* Embedded in ScriptonShell → the shared top bar provides the chrome; suppress the local bar. */}
        {!embedded && <div className="top"><div className="tl"><div className="logo" onClick={onClose} title={t('Close')}>TFM</div><div className="proj">{t('Development builds')}</div><span className="meta">{t('standalone · unlinked until you promote')}</span></div><div style={{ display: 'flex', gap: 8 }}><div className="btn gold" onClick={onNewBuild || onClose}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M12 5v14M5 12h14" /></svg>{t('New build')}</div>{!osNew ? <div className="btn ghost" onClick={onClose}>{t('Close')}</div> : null}</div></div>}
        <div className="body">
          <div className="main">
            <div className="phead"><h1>{t('Builds')}</h1><div className="sub">{t('Name, save and switch development builds. Open loads a build into Studio; promote a finished build into a project.')}</div></div>
            <div className="tbar">{(bin ? [] : ['All', 'Draft', 'Review', 'Greenlit', 'Promoted']).map((c) => (<span key={c} className={'chip' + (filter === c ? ' on' : '')} onClick={() => setFilter(c)}>{t(c)}</span>))}<span className="seg">{([['active', t('Active')], ['archived', '▤ ' + t('Archived')], ['bin', '✖ ' + t('Bin')]] as const).map(([v, label]) => (<span key={v} className={'segb' + (view === v ? ' on' : '')} onClick={() => switchView(v as any)}>{label}</span>))}</span></div>
            <div className="sections">
              {/* A state grid, and ONLY when there is a state. Left unconditional by the sections
                  change, this rendered an empty <div class="grid"> above every populated board. */}
              {(loading || failed || isEmpty) ? (
              <div className="grid">
              {/* Loading: skeletons, so the board reads as "fetching" and never as "your work is gone". */}
              {loading ? [0, 1, 2].map((i) => (
                <div key={'sk' + i} className="bc skel" aria-hidden>
                  <div className="sk sk-r1" /><div className="sk sk-nm" /><div className="sk sk-id" /><div className="sk sk-ft" />
                </div>
              )) : null}
              {failed ? (
                <div className="bc empty" style={{ borderColor: 'rgba(229,99,95,.5)' }}>
                  <div className="nm" style={{ color: '#e5635f' }}>{t('Could not load your builds.')}</div>
                  <div className="ident">{t('Nothing was deleted — this is a loading failure, not an empty board.')}</div>
                  <div className="ft"><span className="mini gold" onClick={() => load(projectId || '', view)}>{t('Retry')}</span></div>
                </div>
              ) : null}
              {isEmpty ? (
                <div className="bc empty">
                  <div className="nm">{bin ? t('The bin is empty.') : archived ? t('Nothing archived yet.') : t('No builds yet.')}</div>
                  <div className="ident">{bin ? t('Deleted builds appear here for 30 days.') : archived ? t('Archive a build to keep it indefinitely without binning it — no countdown, never swept.') : t('Start one with New build — it will appear here.')}</div>
                </div>
              ) : null}
              </div>
              ) : null}
              {/* THE BOARD SAYS SO WHEN IT CANNOT ACCOUNT FOR WHAT IT WAS GIVEN. */}
              {integrity ? (
                <div className="warn">
                  <div className="warnt">{t('This board received') + ' ' + integrity.received + ' ' + t('builds and cannot account for all of them.')}</div>
                  <div className="warns">
                    {integrity.dupIds.length ? t('Two builds share one id, so the render keeps only one:') + ' ' + integrity.dupIds.join(', ') + '. ' : ''}
                    {integrity.noId ? integrity.noId + ' ' + t('have no id at all.') + ' ' : ''}
                    {integrity.partitionLost ? integrity.partitionLost + ' ' + t('fell outside both sections.') + ' ' : ''}
                    {integrity.filteredOut ? integrity.filteredOut + ' ' + t('were dropped before the sections.') + ' ' : ''}
                    {t('Nothing was deleted — the full list is in the console. Every build is still rendered below.')}
                  </div>
                </div>
              ) : null}
              {sections.map((sec) => (
                <div key={sec.key} className="sect">
                  {sec.header ? (<div className="secth"><span className="sectt">{sec.header}</span><span className="sectn" title={sec.items.map((b: any) => (String(b.name || '(unnamed)') + ' — ' + (b.lastWorkedAt ? new Date(b.lastWorkedAt).toISOString().slice(0, 10) : t('never written')))).join(String.fromCharCode(10))}>{sec.items.length}</span>{sec.note ? <span className="sects">{sec.note}</span> : null}</div>) : null}
                  <div className="grid">
                    {sec.items.map(renderCard)}
                    {sec.showAdd && view === 'active' ? <div className="add" onClick={onNewBuild || onClose}><svg className="ico" viewBox="0 0 24 24" style={{ width: 22, height: 22 }}><path d="M12 5v14M5 12h14" /></svg><div style={{ fontWeight: 600 }}>{t('New build')}</div></div> : null}
                  </div>
                </div>
              ))}
              {bin && !list.length ? <div style={{ gridColumn: '1 / -1', textAlign: 'center', color: 'var(--faint)', fontSize: 13, padding: '40px 0' }}>{t('The bin is empty.')}</div> : null}
            </div>
          </div>
        </div>
        {modal && (
          <div className="scrim" onClick={() => setModal(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="mh"><span className="mt">{t('Promote')} “{modal.name}”</span><span className="mx" onClick={() => setModal(null)}>✕</span></div>
              <div className="msub">{t('Snapshot the chosen draft into a project. The build keeps developing; this takes a frozen copy.')}</div>
              <div className="opt">
                <div className={'ocard' + (target === 'existing' ? ' on' : '')} onClick={() => setTarget('existing')}><div className="ot">{t('Add to existing')}</div><div className="os">{t("Land in a project's Script Library")}</div></div>
                <div className={'ocard' + (target === 'new' ? ' on' : '')} onClick={() => setTarget('new')}><div className="ot">{t('Start new project')}</div><div className="os">{t('Spin a project, seed the script')}</div></div>
              </div>
              {target === 'existing' ? (<select value={destProj} onChange={(e) => setDestProj(e.target.value)}>{projects.map((p) => (<option key={p.id} value={p.id}>{p.name || p.title || p.projectNumber}</option>))}</select>) : (<input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('New project title')} />)}
              <div className="xfer"><div className="xl">{t('WHAT TRANSFERS')}</div><div className="xrow"><span className="c">✓</span>{t('Chosen version → first master revision (WHITE draft)')}</div><div className="xrow"><span className="c">✓</span>{t('Title · format · genre · logline · creative brief · coverage')}</div><div className="xrow"><span className="c">✓</span>{t('Provenance back-link to this build')}</div><div className="snap">{t('Snapshot, not live sync — push an updated draft later as an explicit action.')}</div></div>
              <div className="mfoot"><span className="btn ghost" onClick={() => setModal(null)}>{t('Cancel')}</span><span className="btn gold" onClick={doPromote}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>{t('Promote & snapshot')}</span></div>
            </div>
          </div>
        )}
        {confirm && (
          <div className="scrim" onClick={() => setConfirm(null)}>
            <div className="modal" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
              <div className="mh"><span className="mt">{confirm.kind === 'purge' ? t('Delete forever?') : t('Move to bin?')}</span><span className="mx" onClick={() => setConfirm(null)}>✕</span></div>
              <div className="msub" style={{ marginTop: 0 }}>{confirm.kind === 'purge' ? '“' + confirm.b.name + '”' + t(' will be permanently deleted, and so will every draft written in it — its ladder stages, synopses, treatments and beats. This cannot be undone.') : '“' + confirm.b.name + '”' + t(' moves to the bin and is permanently deleted after 30 days unless you restore it.')}</div>
              <div className="mfoot"><span className="btn ghost" onClick={() => setConfirm(null)}>{t('Cancel')}</span><span className="btn gold" style={confirm.kind === 'purge' ? { background: 'linear-gradient(180deg,#f08a86,#e5635f)', color: '#2a0f0e' } : {}} onClick={doConfirm}>{confirm.kind === 'purge' ? t('Delete forever') : t('Move to bin')}</span></div>
            </div>
          </div>
        )}
        {briefView && (() => {
          const br: any = (briefView && briefView.brief) || {};
          const sp: any = (br && br.spine) || {};
          const sources: any[] = Array.isArray(br.sources) ? br.sources : [];
          const has = br && Object.keys(br).length > 0;
          const row = (k: string, v: any) => { const empty = v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length); return empty ? null : (<div style={{ display: 'flex', gap: 10, padding: '7px 0', borderTop: '1px solid var(--hair)', fontSize: 12.5 }}><span style={{ color: 'var(--faint)', width: 116, flex: 'none' }}>{k}</span><span style={{ color: 'var(--text)' }}>{Array.isArray(v) ? v.join(', ') : String(v)}</span></div>); };
          return (
          <div className="scrim" onClick={() => setBriefView(null)}>
            <div className="modal" style={{ width: 640, maxHeight: '84vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <div className="mh"><span className="mt">{t('Settings')} — {briefView.name}</span><span className="mx" onClick={() => setBriefView(null)}>✕</span></div>
              <div className="msub" style={{ marginTop: 0 }}>{t('Read-only snapshot of the brief you set when you started this build.')}</div>
              {briefBusy ? (<div style={{ color: 'var(--faint)', fontSize: 13, padding: '22px 2px' }}>{t('Loading the saved brief…')}</div>)
                : briefErr ? (<div style={{ color: '#e5635f', fontSize: 13, padding: '22px 2px' }}>{t('Could not load the saved brief.') + ' ' + briefErr}</div>)
                : !has ? (<div style={{ color: 'var(--faint)', fontSize: 13, padding: '22px 2px' }}>{t('This build has no saved brief — nothing was recorded when it was started.')}</div>) : (<div style={{ marginTop: 4 }}>
                {row(t('Mode'), br.mode === 'ORIGINAL' ? t('From scratch') : t('Adapt material'))}
                {row(t('Format'), br.projectType)}
                {row(t('Episodes'), br.episodes)}
                {row(t('Minutes / ep'), br.minutesPerEp)}
                {row(t('Seasons'), br.seasons)}
                {row(t('Genres'), br.genres)}
                {row(t('Tone'), br.tone)}
                {row(t('Framework'), sp.framework || br.framework)}
                {row(t('Ending'), sp.ending)}
                {row(t('Market'), br.country)}
                {row(t('Setting'), Array.isArray(br.settingPlace) ? br.settingPlace.join(', ') : br.settingPlace)}
                {row(t('Era'), br.settingEra || br.cultureEra)}
                {row(t('Lore density'), br.loreDensity)}
                {Array.isArray(br.loreSelections) && br.loreSelections.length ? (<div style={{ padding: '8px 0', borderTop: '1px solid var(--hair)' }}><div style={{ color: 'var(--faint)', fontSize: 12, marginBottom: 6 }}>{t('Lore Atlas')} · {br.loreSelections.length}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{br.loreSelections.slice(0, 50).map((l: any, i: number) => (<span key={i} style={{ fontSize: 11, color: 'var(--gold2)', background: 'rgba(198,164,99,.1)', border: '1px solid rgba(198,164,99,.28)', borderRadius: 99, padding: '3px 9px' }}>{(l && (l.name || l.slug || l.id)) || (typeof l === 'string' ? l : 'element')}</span>))}</div></div>) : null}
                {sources.length ? (<div style={{ padding: '8px 0', borderTop: '1px solid var(--hair)' }}><div style={{ color: 'var(--faint)', fontSize: 12, marginBottom: 6 }}>{t('Sources')} · {sources.length}</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{sources.map((s: any, i: number) => (<span key={i} title={String(s.value || s.name || '')} style={{ fontSize: 11, color: 'var(--mute)', background: '#171a20', border: '1px solid var(--hair)', borderRadius: 8, padding: '4px 9px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: 0.9 }}>{String(s.kind || 'src')}: {String(s.name || s.value || '')}</span>))}</div></div>) : null}
                {br.sourceText ? (<div style={{ padding: '9px 0 2px', borderTop: '1px solid var(--hair)' }}><div style={{ color: 'var(--faint)', fontSize: 12, marginBottom: 6 }}>{t('Source / pasted text')}</div><textarea readOnly value={String(br.sourceText)} style={{ width: '100%', minHeight: 150, maxHeight: 300, background: '#0f1116', border: '1px solid var(--hair)', borderRadius: 10, color: 'var(--mute)', fontSize: 12, lineHeight: 1.5, padding: 10, resize: 'vertical' }} /></div>) : null}
              </div>)}
              <div className="mfoot"><span className="btn ghost" onClick={() => setBriefView(null)}>{t('Close')}</span>{(briefView.id && !isDemo(briefView)) ? (<span className="btn gold" onClick={() => openBuild(briefView.id)}><svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M5 12h14M13 6l6 6-6 6" /></svg>{t('Open Develop')}</span>) : null}</div>
            </div>
          </div>
          ); })()}
        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}
