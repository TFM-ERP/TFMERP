'use client';
/** ScripON — Development Package: the promoted project as a pitch/financing dossier.
 *  Opens by ?doc=<scriptDocumentId>. Aggregates develop stages + coverage + brief via one call.
 *  Shell = the ScripON module rail (SxRail) over a full-bleed frame, matching the approved
 *  design/ScripON-Development-Package.html sample (tabs + header + section nav + sections). */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productionApi } from '@/lib/api';
import { SxRail } from '@/components/scripon/ScripOnStudio';
import { useLocale } from '@/lib/i18n';

type Pkg = any;
const arr = (v: any) => (Array.isArray(v) ? v : []);
const txt = (v: any) => (typeof v === 'string' ? v : '');

function clean(body: string): string {
  let t = String(body || '').trim();
  if (/^[\[{]/.test(t)) { try { const j: any = JSON.parse(t); if (typeof j.output === 'string') return j.output; } catch { /* */ } }
  return t;
}

const FMT_LABEL: any = { MOVIE: 'Feature', FEATURE: 'Feature', FILM: 'Feature', TV_SERIES: 'Series', SERIES: 'Series', LIMITED: 'Limited series', VERTICAL: 'Vertical', SHORT: 'Short', TVC: 'Commercial' };
const FW_LABEL: any = { vogler: "The Hero's Journey", hero: "The Hero's Journey", heros_journey: "The Hero's Journey", save_the_cat: 'Save the Cat', stc: 'Save the Cat', three_act: '3-Act', dan_harmon: 'Story Circle', story_circle: 'Story Circle', sequence: 'Sequence Method', truby: 'Truby 22 Steps', kishotenketsu: 'Kishōtenketsu', sequence_method: 'Sequence Method' };
const fwName = (v: any) => { const k = String(v || '').toLowerCase().replace(/[\s-]+/g, '_'); return v ? (FW_LABEL[k] || v) : ''; };

export default function ScripOnPackagePage() {
  const router = useRouter();
  const { dir, t } = useLocale();
  const [pkg, setPkg] = useState<Pkg | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000); };
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteMode, setPromoteMode] = useState<'existing' | 'new'>('existing');
  const [projects, setProjects] = useState<any[]>([]);
  const [selProject, setSelProject] = useState('');
  const [promoting, setPromoting] = useState(false);

  const openPromote = async () => {
    setPromoteOpen(true); setPromoteMode('existing');
    try { const r: any = await productionApi.projects.list(); const items = r.data?.items ?? (Array.isArray(r.data) ? r.data : []); setProjects(items); if (items[0]) setSelProject(items[0].id); } catch { /* */ }
  };
  const doPromote = async () => {
    const bid = pkg && pkg.build && pkg.build.id; if (!bid) { flash(t('No build to promote yet.')); return; }
    const nm = (pkg.build && pkg.build.name) || (pkg.project && pkg.project.title) || '';
    if (promoteMode === 'new') { setPromoteOpen(false); router.push('/production/projects?promoteBuild=' + encodeURIComponent(bid) + '&scriptTitle=' + encodeURIComponent(nm)); return; }
    if (!selProject) { flash(t('Pick a project to add it to.')); return; }
    setPromoting(true);
    try { const r: any = await productionApi.scripton.development.promoteFromBuild(bid, { target: 'existing', projectId: selProject }); flash(t('Promoted - a WHITE master revision landed in the project.')); setPromoteOpen(false); await load(); if (r && r.data && r.data.projectId) setTimeout(() => router.push('/production/projects/' + r.data.projectId), 700); }
    catch (e: any) { flash(e?.response?.data?.message || t('Promote failed - is the backend running?')); }
    finally { setPromoting(false); }
  };

  const load = async () => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const docId = sp.get('doc') || ''; const projectId = sp.get('project') || '';
      const r: any = await productionApi.scripton.development.getPackage({ docId, projectId });
      setPkg(r.data || null); setLoading(false);
    } catch { setErr(t('Could not load the development package.')); setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const genBible = async () => {
    const pid = pkg && pkg.project && pkg.project.id; if (!pid) return;
    const bid = (pkg && pkg.build && pkg.build.id) || undefined; // build-exact, so the bible isn't built from another build
    setGenBusy(true); flash(t('Writing the character bible…'));
    try { await productionApi.scripton.development.characterBible(pid, bid); await load(); flash(t('Character bible ready.')); }
    catch (e: any) { flash(e?.response?.data?.message || t('Character bible needs an AI key on the server.')); }
    finally { setGenBusy(false); }
  };

  if (loading) return <Shell><div style={{ textAlign: 'center', color: '#6b727d', marginTop: 100 }}>{t('Assembling the package…')}</div></Shell>;
  if (err || !pkg) return <Shell><div style={{ textAlign: 'center', color: '#e9a8a6', marginTop: 100 }}>{err || t('Nothing to show yet.')}</div></Shell>;

  const st = (k: string) => (pkg.stages && pkg.stages[k]) || {};
  const brief: any = pkg.brief || {};
  const sp: any = brief.spine || {};
  const cov: any = pkg.coverage || {};
  const docId = pkg.script && pkg.script.docId;
  const bible: any[] = Array.isArray(pkg.characterBible) ? pkg.characterBible : [];
  const covChars: any[] = arr(cov.characters);
  const chars = bible.length ? bible : covChars;
  const genres = arr(brief.genres);
  const blend = arr(brief.blendLayers);
  const lore = arr(brief.loreSelections);
  const comps = arr(cov.comps).length ? arr(cov.comps) : arr(brief.comps).map((c: any) => (typeof c === 'string' ? { title: c, reason: '' } : c));
  const scenes = arr(st('SCENES').data && st('SCENES').data.scenes);
  const beats = arr(st('BEATS').data && st('BEATS').data.beats);
  const scores: any = cov.scores || {};
  const facts: any = cov.facts || {};
  const setting = Array.isArray(brief.settingPlace) ? brief.settingPlace.join(', ') : txt(brief.settingPlace);

  // ── Robust meta wiring (reads from every available source so cells fill in) ──
  const fmtLabel = FMT_LABEL[String(brief.projectType || '').toUpperCase()] || brief.projectType || 'Feature';
  const isFeature = /feature|movie|film/i.test(String(fmtLabel));
  const pageCount = pkg.script && pkg.script.pageCount;
  const actsLabel = isFeature ? '3-act' : txt(brief.format);
  const fmtCell = [fmtLabel, actsLabel].filter(Boolean).join(' · ');
  const eyebrow = [fmtLabel, actsLabel, (pageCount ? '~' + pageCount + ' pp' : '')].filter(Boolean).join(' · ');
  const framework = fwName(sp.framework || st('BEATS').framework || st('STEP_OUTLINE').framework || brief.framework || brief.beatsFramework) || '—';
  const period = cov.time || brief.settingEra || brief.cultureEra || '';
  const locale = cov.locale || setting || txt(brief.settingCountry) || '';
  const periodLocale = [period, locale].filter(Boolean).join(' · ') || (brief.projectType ? t('Contemporary') : '—');
  const langMarket = [brief.language, brief.country].filter(Boolean).join(' · ') || '—';

  // ── Genre intensity bars (real values from the brief; else derived from genres + blend) ──
  const giRaw: any = brief.genreIntensities && typeof brief.genreIntensities === 'object' ? brief.genreIntensities : null;
  const giList: any[] = giRaw ? Object.keys(giRaw).map((k) => giRaw[k]).filter(Boolean) : [];
  const bars: { label: string; pct: number }[] = giList.length
    ? giList.map((v: any) => ({ label: String(v.name || v.id || 'Genre'), pct: Math.max(8, Math.min(100, typeof v.inf === 'number' ? v.inf : Math.round((((v.p || 0) + (v.ii || 0)) / 8) * 100))) }))
    : [...genres.map((g: any) => ({ label: String(g), pct: 82 })), ...blend.map((b: any) => ({ label: (typeof b === 'string' ? b : (b.name || b.label || 'layer')), pct: 60 }))];

  const meta = [
    [t('Format'), fmtCell || '—'],
    [t('Length'), pageCount ? '~' + pageCount + ' ' + t('pages') : (st('DRAFT').body ? t('Draft') : '—')],
    [t('Period · Locale'), periodLocale],
    [t('Language · Market'), langMarket],
    [t('Framework'), framework],
    [t('Budget tier'), brief.budgetTier || '—'],
    [t('Scenes · Locations'), (facts.sceneCount || scenes.length || '—') + ' · ' + (facts.locationCount || '—')],
    [t('Status'), (pkg.build && pkg.build.status) || t('Promoted')],
  ];

  // ── Investor-grade dossier export (PDF via Chromium render-pdf; Word as an editable .doc). Format-adaptive: the spine follows the build's own ladder. ──
  const STAGE_TITLES: Record<string, string> = { LOGLINE: 'Logline', SYNOPSIS: 'Synopsis', SEASON_ARC: 'Season arc', EPISODE_MAP: 'Episode map', PREMISE: 'Premise', STORY_ENGINE: 'Story engine', BEAT_ENGINE: 'Beat engine', TREATMENT: 'Treatment', BEATS: 'Beats', SCENES: 'Scenes', STEP_OUTLINE: 'Step outline', DRAFT: 'Draft', THESIS: 'Thesis', RESEARCH_PLAN: 'Research plan', RIGHTS_PLAN: 'Rights plan', INTERVIEW_OUTLINE: 'Interview outline', PAPER_EDIT: 'Paper edit', NARRATION: 'Narration', COVERAGE: 'Coverage' };
  const esc = (s: any) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const dossierTitle = (pkg.build && pkg.build.name) || (pkg.project && pkg.project.title) || 'Development package';
  const fileBase = () => (String(dossierTitle).replace(/[^\w؀-ۿ -]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'package');
  const dossierHtml = () => {
    const ladder: string[] = Array.isArray(pkg.ladder) && pkg.ladder.length ? pkg.ladder : Object.keys(pkg.stages || {});
    const spine = ladder.filter((k) => clean(st(k).body)).map((k) => { const b = clean(st(k).body) || ''; return '<div class="rung"><div class="rk">' + esc(STAGE_TITLES[k] || k) + '</div><div class="rb">' + esc(b.slice(0, 1600)) + (b.length > 1600 ? '…' : '') + '</div></div>'; }).join('');
    const charHtml = chars.slice(0, 9).map((c: any) => '<div class="ch"><div class="cn">' + esc(c.name || '') + (c.role ? ' <span class="role">' + esc(c.role) + '</span>' : '') + '</div>' + (c.tagline ? '<div class="tag">' + esc(c.tagline) + '</div>' : '') + (c.coreIdentity ? '<div class="ci">' + esc(c.coreIdentity) + '</div>' : '') + (c.arc ? '<div class="arc">' + esc(c.arc) + '</div>' : '') + '</div>').join('');
    const metaHtml = meta.map(([k, v]: any) => '<tr><td class="mk">' + esc(k) + '</td><td class="mv">' + esc(v) + '</td></tr>').join('');
    const compsHtml = comps.slice(0, 8).map((c: any) => '<li>' + esc(c.title || '') + (c.year ? ' (' + esc(c.year) + ')' : '') + (c.reason || c.rationale ? ' — ' + esc(c.reason || c.rationale) : '') + '</li>').join('');
    const logline = clean(st('LOGLINE').body) || cov.logline || '';
    return '<!doctype html><html dir="' + dir + '"><head><meta charset="utf-8"><style>'
      + 'body{font-family:Georgia,"Times New Roman",serif;color:#1a1a1a;margin:0;padding:42px;max-width:780px}'
      + 'h1{font-size:30px;margin:0 0 4px}.eyebrow{font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9a7b2e;font-family:Arial,sans-serif}'
      + '.logline{font-style:italic;color:#444;font-size:16px;margin:8px 0 20px}'
      + 'h2{font-size:14px;letter-spacing:1px;text-transform:uppercase;color:#9a7b2e;border-bottom:1px solid #ddd;padding-bottom:4px;margin:26px 0 12px;font-family:Arial,sans-serif}'
      + 'table{border-collapse:collapse;width:100%}.mk{color:#888;font-size:11px;text-transform:uppercase;padding:4px 12px 4px 0;font-family:Arial,sans-serif;width:170px;vertical-align:top}.mv{font-weight:bold;padding:4px 0}'
      + '.rung{margin:0 0 13px}.rk{font-weight:bold;color:#9a7b2e;font-size:12px;text-transform:uppercase;font-family:Arial,sans-serif}.rb{white-space:pre-wrap;font-size:13px;color:#333;margin-top:3px;line-height:1.5}'
      + '.ch{margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid #eee}.cn{font-weight:bold;font-size:14px}.role{font-weight:normal;color:#9a7b2e;font-size:11px;text-transform:uppercase}.tag{font-style:italic;color:#666}.ci{font-size:13px;margin-top:2px}.arc{font-size:12px;color:#777;margin-top:2px}'
      + 'li{margin:3px 0;font-size:13px}</style></head><body>'
      + '<div class="eyebrow">' + esc(eyebrow) + '</div><h1>' + esc(dossierTitle) + '</h1>'
      + (logline ? '<div class="logline">' + esc(logline) + '</div>' : '')
      + '<h2>' + esc(t('Overview')) + '</h2><table>' + metaHtml + '</table>'
      + (spine ? '<h2>' + esc(t('Development spine')) + '</h2>' + spine : '')
      + (charHtml ? '<h2>' + esc(t('Characters')) + '</h2>' + charHtml : '')
      + (compsHtml ? '<h2>' + esc(t('Market & Comps')) + '</h2><ul>' + compsHtml + '</ul>' : '')
      + ((cov.synopsis || cov.note) ? '<h2>' + esc(t('Coverage')) + '</h2><div class="rb">' + esc(cov.recommendation ? (t('Verdict') + ': ' + cov.recommendation + '. ') : '') + esc(clean(cov.synopsis) || clean(cov.note) || '') + '</div>' : '')
      + '</body></html>';
  };
  const dlBlob = (blob: Blob, name: string) => { try { const u = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 1500); } catch { /* */ } };
  const doExport = async (kind: 'pdf' | 'doc') => {
    const html = dossierHtml();
    if (kind === 'doc') { dlBlob(new Blob(['﻿' + html], { type: 'application/msword' }), fileBase() + '.doc'); flash(t('Word dossier downloaded.')); return; }
    try { flash(t('Rendering PDF…')); const r: any = await productionApi.scripton.renderPdf(html, fileBase() + '.pdf'); dlBlob(r.data, fileBase() + '.pdf'); flash(t('PDF dossier downloaded.')); }
    catch { dlBlob(new Blob(['﻿' + html], { type: 'application/msword' }), fileBase() + '.doc'); flash(t('PDF renderer unavailable — downloaded Word instead.')); }
  };

  const NAV = [['ov', t('Overview')], ['log', t('Logline & Synopsis')], ['tr', t('Treatment')], ['str', t('Structure')], ['ch', t('Characters')], ['wl', t('World & Lore')], ['gt', t('Genre & Texture')], ['mk', t('Market & Comps')], ['cv', t('Coverage')], ['sc', t('Scenes & Script')]];

  return (
    <Shell>
      <div className="pwrap">
        <div className="frame">
          <div className="ptabs">
            <span className="ptab" onClick={() => router.push('/scripon/library')}>{t('Library')}</span>
            <span className="ptab on">{t('Development Package')}</span>
            <span className="crumb">ScripON › {t('Library')} › {(pkg.build && pkg.build.name) || (pkg.project && pkg.project.title) || t('Project')}</span>
          </div>

          <div className="head">
            <div className="poster">{(pkg.project && pkg.project.title) || t('Project')}</div>
            <div className="htitle">
              <div className="eyebrow">{eyebrow}</div>
              <h2>{(pkg.build && pkg.build.name) || (pkg.project && pkg.project.title) || t('Development package')}</h2>
              <div className="logline">{clean(st('LOGLINE').body) || cov.logline || t('No logline yet.')}</div>
              <div className="chips">
                {genres.map((g: any, i: number) => <span className="chip" key={'g' + i}>{String(g)}</span>)}
                {blend.map((b: any, i: number) => <span className="chip blend" key={'b' + i}>+ {typeof b === 'string' ? b : (b.name || b.label || 'layer')}</span>)}
                {setting ? <span className="chip muted">{setting}</span> : null}
                {brief.language ? <span className="chip muted">{brief.language}</span> : null}
                {brief.country ? <span className="chip muted">{brief.country}</span> : null}
              </div>
            </div>
            <div className="hactions">
              {cov.recommendation ? <span className={'verdict ' + String(cov.recommendation).toLowerCase()}>◆ {cov.recommendation}</span> : null}
              {(pkg.build && pkg.build.id) ? <button className="btn gold" onClick={openPromote} title={t('Snapshot this build into a production project')}>⤴ {t('Promote to production')}</button> : null}
              {(pkg.build && pkg.build.linkedProjectId) ? <span className="linkednote">↳ {t('already promoted')}</span> : null}
              {docId ? <button className="btn outline" onClick={() => router.push('/scripon/script?doc=' + docId)}>▤ {t('Read script')}</button> : null}
              <button className="btn outline" onClick={() => doExport('pdf')} title={t('Investor-grade PDF dossier')}>↓ {t('PDF')}</button>
              <button className="btn outline" onClick={() => doExport('doc')} title={t('Editable Word dossier')}>↓ {t('Word')}</button>
              <button className="btn ghost" onClick={() => router.push('/scripon/library')}>{dir === 'rtl' ? '→' : '←'} {t('Library')}</button>
            </div>
          </div>

          <div className="pbody">
            <div className="snav">{NAV.map(([id, label], i) => <a key={id} href={'#sec-' + id}><span className="num">{String(i + 1).padStart(2, '0')}</span> {label}</a>)}</div>
            <div className="pcontent">

              <section id="sec-ov" className="sec"><div className="sh"><h3>{t('Overview')}</h3></div>
                <div className="metagrid">{meta.map(([k, v], i) => <div className="mcell" key={i}><div className="k">{k}</div><div className="v" style={i === 7 ? { color: 'var(--gold2)' } : undefined}>{String(v)}</div></div>)}</div>
              </section>

              <section id="sec-log" className="sec"><div className="sh"><h3>{t('Logline & Synopsis')}</h3></div>
                <div className="prose"><p style={{ fontStyle: 'italic', color: 'var(--gold2)' }}>{clean(st('LOGLINE').body) || cov.logline || '—'}</p>{(clean(st('SYNOPSIS').body) || cov.synopsis || '').split(/\n{2,}/).filter(Boolean).map((p: string, i: number) => <p key={i}>{p}</p>)}</div>
              </section>

              {(clean(st('TREATMENT').body)) ? (
              <section id="sec-tr" className="sec"><div className="sh"><h3>{t('Treatment')}</h3></div>
                <div className="prose scrollbox">{clean(st('TREATMENT').body).split(/\n{2,}/).filter(Boolean).map((p: string, i: number) => <p key={i}>{p}</p>)}</div>
              </section>) : null}

              {beats.length ? (
              <section id="sec-str" className="sec"><div className="sh"><h3>{t('Structure')}</h3><span className="hint">{framework !== '—' ? framework + ' ' + t('beat map') : t('beat map')}</span></div>
                <div className="beats">{beats.map((b: any, i: number) => <div className="beat" key={i}><div className="bn">{i + 1}</div><div><div className="bt">{b.name || b.beatName || ('Beat ' + (i + 1))}</div><div className="bs">{b.beat || b.purpose || ''}</div></div></div>)}</div>
              </section>) : null}

              <section id="sec-ch" className="sec">
                <div className="sh"><h3>{t('Characters')}</h3>{!bible.length ? <button className="btn gold sm" disabled={genBusy} onClick={genBible}>{genBusy ? t('Writing…') : '✦ ' + t('Generate character bible')}</button> : <span className="hint">{t('character bible')}</span>}</div>
                {chars.length ? (
                  <div className="chars">{chars.map((c: any, i: number) => (
                    <div className="cc" key={i}>
                      <div className="cn">{String(c.name || 'Character').toUpperCase()}</div>
                      {c.tagline ? <div className="ct">"{c.tagline}"</div> : null}
                      <div className="cmeta">{[c.age && (t('Age:') + ' ' + c.age), c.status && (t('Status:') + ' ' + c.status), (c.role && (t('Role:') + ' ' + c.role))].filter(Boolean).map((m: any, j: number) => <span className="mb" key={j}>{m}</span>)}{(!c.role && c.ethnicity) ? <span className="mb">{c.ethnicity}</span> : null}</div>
                      {(c.coreIdentity || c.description) ? <><h5>{t('Core Identity')}</h5><div className="ci">{c.coreIdentity || c.description}</div></> : null}
                      {arr(c.traits).length ? <><h5>{t('Traits')}</h5><ul>{arr(c.traits).map((tr: any, j: number) => <li key={j}>{String(tr)}</li>)}</ul></> : null}
                      {arr(c.function).length ? <><h5>{t('Function')}</h5><ul>{arr(c.function).map((fn: any, j: number) => <li key={j}>{String(fn)}</li>)}</ul></> : null}
                      {c.arc ? <><h5>{t('Arc')}</h5><div className="arc">{c.arc}</div></> : null}
                    </div>))}</div>
                ) : <div className="empty">{t('No characters yet — run coverage, then generate the bible.')}</div>}
                {(!bible.length && covChars.length) ? <div className="hint" style={{ marginTop: 10 }}>{t('Showing basic coverage characters. Generate the bible for taglines, function & arcs.')}</div> : null}
              </section>

              <section id="sec-wl" className="sec"><div className="sh"><h3>{t('World & Lore')}</h3></div>
                <div className="cols2">
                  <div className="card"><div className="ct2">{t('Setting')}</div><div className="cmt">{[setting, brief.settingEra || cov.time, brief.cultureEra].filter(Boolean).join(' · ') || t('Not specified.')}</div></div>
                  <div className="card"><div className="ct2">{t('Lore Atlas · layers')}</div>{lore.length ? <div className="lorechips">{lore.map((l: any, i: number) => <span className="lorechip" key={i}>{typeof l === 'string' ? l : (l.name || l.slug || 'element')}</span>)}</div> : <div className="cmt">{t('No lore layers selected.')}</div>}{brief.loreDensity ? <div className="cmt" style={{ marginTop: 8 }}>{t('Density:')} <b>{brief.loreDensity}</b></div> : null}</div>
                </div>
              </section>

              <section id="sec-gt" className="sec"><div className="sh"><h3>{t('Genre & Texture')}</h3></div>
                <div className="cols2">
                  <div className="card"><div className="ct2">{t('Genre & blend')}</div><div className="chips">{genres.map((g: any, i: number) => <span className="chip" key={i}>{String(g)}</span>)}{blend.map((b: any, i: number) => <span className="chip blend" key={i}>+ {typeof b === 'string' ? b : (b.name || b.label || 'layer')}</span>)}</div>{brief.tone ? <div className="cmt" style={{ marginTop: 10 }}>{t('Tone:')} {brief.tone}</div> : null}</div>
                  {bars.length ? <div className="card"><div className="ct2">{t('Intensity')}</div>{bars.slice(0, 6).map((bar, i) => <div className="gbar" key={i}><span className="gl">{bar.label}</span><span className="track"><i style={{ width: bar.pct + '%' }} /></span><span className="gv">{bar.pct}%</span></div>)}</div>
                  : (sp.theme || brief.projectIntent ? <div className="card"><div className="ct2">{t('Spine')}</div>{sp.theme ? <div className="cmt"><b>{t('Theme:')}</b> {sp.theme}</div> : null}{sp.ending ? <div className="cmt"><b>{t('Ending:')}</b> {sp.ending}</div> : null}{brief.projectIntent ? <div className="cmt"><b>{t('Intent:')}</b> {brief.projectIntent}</div> : null}</div> : null)}
                </div>
              </section>

              <section id="sec-mk" className="sec"><div className="sh"><h3>{t('Market & Comps')}</h3><span className="hint">{t('for the financier conversation')}</span></div>
                <div className="cols2">
                  <div className="card"><div className="ct2">{t('Positioning')}</div><div className="cmt">{[brief.country && (t('Market:') + ' ' + brief.country), brief.language && (t('Language:') + ' ' + brief.language), brief.budgetTier && (t('Budget:') + ' ' + brief.budgetTier), brief.projectIntent && (t('Intent:') + ' ' + brief.projectIntent)].filter(Boolean).join(' · ') || '—'}{cov.comments && cov.comments.marketability ? <div style={{ marginTop: 8 }}>{cov.comments.marketability}</div> : null}</div></div>
                  <div className="card"><div className="ct2">{t('Comparables')}</div>{comps.length ? comps.map((c: any, i: number) => <div className="comp" key={i}><div className="ci3">{c.title}</div><div className="cr">{c.reason || ''}</div></div>) : <div className="cmt">{t('Run market comps in Greenlight.')}</div>}</div>
                </div>
              </section>

              {(Object.keys(scores).length || cov.recommendation) ? (
              <section id="sec-cv" className="sec"><div className="sh"><h3>{t('Coverage')}</h3><span className="hint">{t('studio read')}</span></div>
                <div className="scores">{['premise', 'characters', 'structure', 'marketability'].map((k) => scores[k] != null ? <div className="score" key={k}><div className="sv">{scores[k]}</div><div className="sk">{t(k)}</div></div> : null)}</div>
                {cov.comments ? Object.keys(cov.comments).slice(0, 4).map((k) => <div className="cmt" key={k}><b>{t(k.charAt(0).toUpperCase() + k.slice(1)) + '.'}</b> {cov.comments[k]}</div>) : null}
                {cov.recommendation ? <div className="cmt" style={{ marginTop: 6 }}>{t('Verdict:')} <b style={{ color: 'var(--amber)' }}>{cov.recommendation}</b>{cov.writerRecommendation ? <> · {t('writer')} <b style={{ color: 'var(--amber)' }}>{cov.writerRecommendation}</b></> : null}</div> : null}
              </section>) : null}

              <section id="sec-sc" className="sec"><div className="sh"><h3>{t('Scenes & Script')}</h3></div>
                {scenes.length ? <div className="scn">{scenes.slice(0, 12).map((s: any, i: number) => <div className="scard" key={i}><div className="sl">{s.sceneNumber ? s.sceneNumber + ' · ' : ''}{s.slugline || s.location || 'Scene'}</div>{(s.synopsis || s.purpose) ? <div className="ss">{s.synopsis || s.purpose}</div> : null}</div>)}</div> : <div className="cmt">{t('Scene cards appear once the Scenes stage is generated.')}</div>}
              </section>

            </div>
          </div>
        </div>
      </div>
      {promoteOpen ? (
        <div className="pmscrim" dir={dir} onClick={() => setPromoteOpen(false)}>
          <div className="pmodal" onClick={(e) => e.stopPropagation()}>
            <div className="pmh"><span className="pmt">{t('Promote')} &ldquo;{(pkg.build && pkg.build.name) || 'build'}&rdquo;</span><span className="pmx" onClick={() => setPromoteOpen(false)}>&times;</span></div>
            <div className="pmsub">{t('Snapshot the chosen draft into a production project. The build keeps living in ScripON; this takes a frozen copy.')}</div>
            <div className="pmopt">
              <div className={'pmocard' + (promoteMode === 'existing' ? ' on' : '')} onClick={() => setPromoteMode('existing')}><div className="pmoi">▤</div><div className="pmot">{t('Add to existing')}</div><div className="pmos">{t('Land in a project’s Script Library')}</div></div>
              <div className={'pmocard' + (promoteMode === 'new' ? ' on' : '')} onClick={() => setPromoteMode('new')}><div className="pmoi">+</div><div className="pmot">{t('Start new project')}</div><div className="pmos">{t('Open the New Project wizard, script attached')}</div></div>
            </div>
            {promoteMode === 'existing'
              ? <select className="pmsel" value={selProject} onChange={(e) => setSelProject(e.target.value)}>{projects.length ? projects.map((p: any) => <option key={p.id} value={p.id}>{p.title || p.projectNumber}</option>) : <option value="">{t('No projects yet')}</option>}</select>
              : <div className="pmnew">{t('The New Production Project wizard opens with this script pre-attached as the WHITE draft. You fill currency, country & dates, then Create.')}</div>}
            <div className="pmxfer"><div className="pmxl">{t('WHAT TRANSFERS')}</div>
              <div className="pmxrow"><span className="c">✓</span>{t('Chosen version → first master revision (WHITE draft)')}</div>
              <div className="pmxrow"><span className="c">✓</span>{t('Title · format · genre · logline · creative brief · coverage')}</div>
              <div className="pmxrow"><span className="c">✓</span>{t('Provenance back-link to this build')}</div>
              <div className="pmsnap">{t('Snapshot, not live sync - push an updated draft later as an explicit action.')}</div>
            </div>
            <div className="pmfoot"><button className="btn ghost" onClick={() => setPromoteOpen(false)}>{t('Cancel')}</button><button className="btn gold" disabled={promoting} onClick={doPromote}>{promoting ? t('Promoting...') : (promoteMode === 'new' ? t('Open wizard') + ' ' + (dir === 'rtl' ? '←' : '→') : t('Promote & snapshot'))}</button></div>
          </div>
        </div>
      ) : null}
      {toast ? <div className="ptoast">{toast}</div> : null}
    </Shell>
  );
}

function Shell({ children }: { children: any }) {
  const { dir } = useLocale();
  return (
    <div className="pkgroot" dir={dir}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&display=swap');
      .pkgroot{--panel:#14161c;--panel2:#1a1d24;--hair:rgba(255,255,255,.08);--hair2:rgba(255,255,255,.14);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#15120B;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--green:#57b368;--amber:#e0a23b;--red:#e5635f;--violet:#8b7cf0;position:fixed;inset:0;z-index:50;display:flex;background:radial-gradient(1100px 560px at 50% -10%,#15171d,#0b0c0f 60%);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased}
      .pkgroot .ico{width:18px;height:18px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
      .pkgroot .rail{width:74px;flex:0 0 74px;background:#0e1015;border-inline-end:1px solid var(--hair);display:flex;flex-direction:column;align-items:center;padding:14px 0;gap:6px}
      .pkgroot .ritem{width:58px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 0;border-radius:12px;color:var(--faint);position:relative;background:transparent;border:none;cursor:pointer}
      .pkgroot .ritem .box{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#171a21;border:1px solid var(--hair);color:var(--mute)}
      .pkgroot .ritem .lbl{font-size:9px;font-weight:600}
      .pkgroot .ritem:hover .box{border-color:rgba(198,164,99,.4);color:var(--gold2)}
      .pkgroot .ritem.on .box{background:linear-gradient(160deg,var(--gold2),var(--gold));border-color:transparent;color:var(--goldink)}
      .pkgroot .ritem.on .lbl{color:var(--gold2)}
      .pkgroot .ritem.on:before{content:"";position:absolute;inset-inline-start:-1px;top:14px;bottom:14px;width:3px;border-radius:3px;background:var(--gold)}
      .pkgroot .pmain{flex:1;min-width:0;overflow:auto;padding:0 0 70px}
      .pkgroot .pwrap{max-width:none;margin:0;padding:16px 30px}
      .pkgroot .frame{background:#0c0d10;border:1px solid var(--hair2);border-radius:18px;overflow:hidden;box-shadow:0 40px 90px -30px rgba(0,0,0,.8)}
      .pkgroot .ptabs{display:flex;align-items:center;gap:8px;padding:12px 16px;background:linear-gradient(180deg,#101218,#0c0d10);border-bottom:1px solid var(--hair)}
      .pkgroot .ptab{font-size:13px;font-weight:700;color:var(--mute);padding:7px 13px;border-radius:9px;cursor:pointer}
      .pkgroot .ptab.on{color:var(--gold2);background:rgba(198,164,99,.12);border:1px solid rgba(198,164,99,.32)}
      .pkgroot .ptab:not(.on):hover{color:var(--cream)}
      .pkgroot .crumb{margin-inline-start:auto;font-size:11.5px;color:var(--faint)}
      .pkgroot .head{display:flex;gap:18px;align-items:flex-start;padding:20px 24px;border-bottom:1px solid var(--hair);background:linear-gradient(180deg,rgba(198,164,99,.05),transparent 60%)}
      .pkgroot .poster{width:96px;height:132px;border-radius:10px;flex:none;background:linear-gradient(160deg,#2a2418,#15120b);border:1px solid rgba(198,164,99,.3);display:grid;place-items:center;color:var(--gold2);font-family:var(--sx-title);font-size:13px;text-align:center;padding:8px;box-shadow:0 16px 30px -16px rgba(0,0,0,.7)}
      .pkgroot .htitle{flex:1;min-width:0}.pkgroot .eyebrow{font-size:11px;font-weight:800;letter-spacing:2px;text-transform:uppercase;color:var(--gold)}
      .pkgroot .htitle h2{font-family:var(--sx-title);font-weight:600;font-size:30px;color:var(--cream);margin:4px 0 6px;letter-spacing:-.2px}
      .pkgroot .logline{font-size:15px;color:var(--text);line-height:1.5;max-width:680px;font-style:italic}
      .pkgroot .chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
      .pkgroot .chip{font-size:11.5px;color:var(--gold2);background:rgba(198,164,99,.1);border:1px solid rgba(198,164,99,.28);border-radius:99px;padding:4px 11px}
      .pkgroot .chip.muted{color:var(--mute);background:#171a20;border-color:var(--hair)}.pkgroot .chip.blend{color:var(--violet);background:rgba(139,124,240,.1);border-color:rgba(139,124,240,.32)}
      .pkgroot .hactions{display:flex;flex-direction:column;gap:8px;flex:none}
      .pkgroot .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border-radius:11px;padding:10px 15px;font:inherit;font-size:13px;font-weight:700;cursor:pointer;white-space:nowrap}
      .pkgroot .btn.gold{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);border:none}.pkgroot .btn.gold[disabled]{opacity:.6;cursor:default}
      .pkgroot .btn.outline{background:transparent;border:1px solid rgba(198,164,99,.5);color:var(--gold2)}.pkgroot .btn.ghost{background:#171a20;border:1px solid var(--hair);color:var(--mute)}.pkgroot .btn.sm{padding:6px 12px;font-size:12px}
      .pkgroot .verdict{display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:12px;font-weight:800;border-radius:8px;padding:6px 11px;color:var(--amber);background:rgba(224,162,59,.12);border:1px solid rgba(224,162,59,.4)}
      .pkgroot .verdict.recommend{color:var(--green);background:rgba(87,179,104,.12);border-color:rgba(87,179,104,.4)}.pkgroot .verdict.pass{color:var(--red);background:rgba(229,99,95,.12);border-color:rgba(229,99,95,.4)}
      .pkgroot .pbody{display:grid;grid-template-columns:208px 1fr;min-height:560px}
      .pkgroot .snav{padding:16px 10px;display:flex;flex-direction:column;gap:2px;border-inline-end:1px solid var(--hair);background:#0e1015;position:sticky;top:0;align-self:start}
      .pkgroot .snav a{font-size:12.5px;font-weight:600;color:var(--mute);padding:8px 11px;border-radius:9px;text-decoration:none;display:flex;align-items:center;gap:9px}
      .pkgroot .snav a:hover{color:var(--gold2);background:rgba(198,164,99,.1)}.pkgroot .snav .num{font-size:10px;color:var(--faint);width:14px}
      .pkgroot .pcontent{padding:8px 26px 30px;min-width:0}
      .pkgroot .sec{padding:22px 0;border-bottom:1px solid var(--hair)}.pkgroot .sec:last-child{border-bottom:none}
      .pkgroot .sh{display:flex;align-items:center;gap:10px;margin:0 0 14px}.pkgroot .sh h3{font-family:var(--sx-title);font-weight:600;font-size:19px;color:var(--cream);margin:0}
      .pkgroot .hint{font-size:11px;color:var(--faint);margin-inline-start:auto}
      .pkgroot .metagrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
      .pkgroot .mcell{background:var(--panel);border:1px solid var(--hair);border-radius:12px;padding:12px 13px}.pkgroot .mcell .k{font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:var(--faint);margin-bottom:4px}.pkgroot .mcell .v{font-size:14px;font-weight:700;color:var(--cream)}
      .pkgroot .prose{font-family:var(--sx-title);font-size:15px;line-height:1.8;color:#d9d4c6;max-width:760px}.pkgroot .prose p{margin:0 0 14px}
      .pkgroot .scrollbox{max-height:340px;overflow:auto;padding-right:10px}
      .pkgroot .beats{display:flex;flex-direction:column}.pkgroot .beat{display:flex;gap:12px;padding:10px 0;border-top:1px solid var(--hair)}.pkgroot .beat:first-child{border-top:none}
      .pkgroot .beat .bn{width:26px;height:26px;border-radius:50%;background:rgba(198,164,99,.15);color:var(--gold2);display:grid;place-items:center;font-size:11px;font-weight:800;flex:none}
      .pkgroot .beat .bt{font-size:13px;font-weight:700;color:var(--cream)}.pkgroot .beat .bs{font-size:12px;color:var(--mute);margin-top:2px;line-height:1.5}
      .pkgroot .chars{display:grid;grid-template-columns:1fr 1fr;gap:14px}
      .pkgroot .cc{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:16px 17px}
      .pkgroot .cc .cn{font-family:var(--sx-title);font-weight:600;font-size:17px;color:var(--cream);letter-spacing:.3px}
      .pkgroot .cc .ct{font-size:12.5px;color:var(--gold2);font-style:italic;margin:2px 0 8px}
      .pkgroot .cc .cmeta{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}.pkgroot .cc .mb{font-size:10.5px;color:var(--mute);background:#171a20;border:1px solid var(--hair);border-radius:7px;padding:3px 8px}
      .pkgroot .cc h5{font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:var(--faint);margin:11px 0 4px}.pkgroot .cc .ci{font-size:12.5px;color:var(--text);line-height:1.55}
      .pkgroot .cc ul{margin:3px 0 0;padding-inline-start:16px;color:var(--mute);font-size:12px;line-height:1.6}.pkgroot .cc .arc{font-size:12.5px;color:var(--gold2);font-weight:600}
      .pkgroot .cols2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
      .pkgroot .card{background:var(--panel);border:1px solid var(--hair);border-radius:13px;padding:15px 16px}.pkgroot .card .ct2{font-size:12px;font-weight:800;letter-spacing:.4px;color:var(--gold2);text-transform:uppercase;margin-bottom:9px}
      .pkgroot .lorechips{display:flex;flex-wrap:wrap;gap:6px}.pkgroot .lorechip{font-size:11.5px;color:var(--cream);background:rgba(198,164,99,.08);border:1px solid rgba(198,164,99,.25);border-radius:8px;padding:4px 9px}
      .pkgroot .gbar{display:flex;align-items:center;gap:10px;margin:9px 0}.pkgroot .gbar .gl{width:120px;font-size:12px;color:var(--text);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .pkgroot .gbar .track{flex:1;height:7px;border-radius:99px;background:#1b1e25;overflow:hidden}.pkgroot .gbar .track i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--gold),var(--gold2))}
      .pkgroot .gbar .gv{width:42px;text-align:right;font-size:11px;color:var(--gold2);font-weight:700}
      .pkgroot .cmt{font-size:12.5px;color:var(--mute);line-height:1.6;margin:5px 0}.pkgroot .cmt b{color:var(--cream);font-weight:700}
      .pkgroot .comp{display:flex;gap:11px;padding:9px 0;border-top:1px solid var(--hair)}.pkgroot .comp:first-child{border-top:none}.pkgroot .comp .ci3{font-size:13px;font-weight:700;color:var(--cream);width:200px;flex:none}.pkgroot .comp .cr{font-size:12px;color:var(--mute);line-height:1.5}
      .pkgroot .scores{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}.pkgroot .score{background:var(--panel);border:1px solid var(--hair);border-radius:12px;padding:12px;text-align:center}.pkgroot .score .sv{font-family:var(--sx-title);font-size:26px;font-weight:600;color:var(--gold2)}.pkgroot .score .sk{font-size:10px;letter-spacing:.4px;text-transform:uppercase;color:var(--faint);margin-top:2px}
      .pkgroot .scn{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.pkgroot .scard{background:#15171d;border:1px solid var(--hair);border-radius:9px;padding:8px 10px}.pkgroot .scard .sl{font-size:11px;font-weight:700;color:var(--cream)}.pkgroot .scard .ss{font-size:10.5px;color:var(--mute);margin-top:3px;line-height:1.45}
      .pkgroot .empty{color:var(--faint);font-size:13px;padding:14px 2px}
      .pkgroot .ptoast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#1b1e25;border:1px solid var(--hair2);color:var(--cream);font-size:12.5px;padding:10px 16px;border-radius:10px;box-shadow:0 14px 40px -12px rgba(0,0,0,.7);z-index:60}
      .pkgroot .linkednote{font-size:11px;color:var(--gold2);align-self:flex-end}
      .pkgroot .pmscrim{position:fixed;inset:0;background:rgba(6,7,10,.66);display:flex;align-items:center;justify-content:center;z-index:70;padding:20px}
      .pkgroot .pmodal{width:520px;max-width:96vw;background:#0e1014;border:1px solid rgba(198,164,99,.3);border-radius:16px;padding:22px;box-shadow:0 30px 80px rgba(0,0,0,.7);display:flex;flex-direction:column;gap:15px}
      .pkgroot .pmh{display:flex;align-items:center;justify-content:space-between}.pkgroot .pmt{font-size:17px;font-weight:800;color:var(--cream)}.pkgroot .pmx{color:var(--faint);cursor:pointer;font-size:18px;line-height:1}
      .pkgroot .pmsub{font-size:12px;color:var(--mute);margin-top:-8px;line-height:1.5}
      .pkgroot .pmopt{display:flex;gap:12px}
      .pkgroot .pmocard{flex:1;border:1px solid var(--hair);border-radius:12px;padding:13px;cursor:pointer;background:#15181e}.pkgroot .pmocard.on{border-color:rgba(198,164,99,.5);background:rgba(198,164,99,.08)}
      .pkgroot .pmoi{width:30px;height:30px;border-radius:9px;background:rgba(198,164,99,.14);color:var(--gold2);display:grid;place-items:center;margin-bottom:8px;font-size:15px}
      .pkgroot .pmot{font-size:13px;font-weight:700;color:var(--cream)}.pkgroot .pmos{font-size:10.5px;color:var(--faint);margin-top:2px}
      .pkgroot .pmsel{height:38px;border-radius:9px;background:#171a20;border:1px solid var(--hair);color:var(--cream);font:inherit;font-size:12.5px;font-weight:600;padding:0 12px}
      .pkgroot .pmnew{font-size:11.5px;color:var(--mute);line-height:1.55;background:#15181e;border:1px solid var(--hair);border-radius:11px;padding:11px 13px}
      .pkgroot .pmxfer{background:#15181e;border:1px solid var(--hair);border-radius:11px;padding:12px 13px}
      .pkgroot .pmxl{font-size:10px;font-weight:700;letter-spacing:.8px;color:var(--gold);margin-bottom:7px}
      .pkgroot .pmxrow{display:flex;gap:8px;font-size:11.5px;color:var(--text);margin-bottom:5px}.pkgroot .pmxrow .c{color:var(--green);flex:none}
      .pkgroot .pmsnap{font-size:10.5px;color:var(--faint);font-style:italic;margin-top:4px}
      .pkgroot .pmfoot{display:flex;gap:10px;justify-content:flex-end}
      @media(max-width:980px){.pkgroot .pbody{grid-template-columns:1fr}.pkgroot .snav{position:static;flex-direction:row;flex-wrap:wrap;border-right:none;border-bottom:1px solid var(--hair)}.pkgroot .chars,.pkgroot .cols2,.pkgroot .metagrid,.pkgroot .scores,.pkgroot .scn{grid-template-columns:1fr 1fr}}`}</style>
      <SxRail active="library" />
      <div className="pmain">{children}</div>
    </div>
  );
}
