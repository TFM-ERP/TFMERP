'use client';
/**
 * ScriptON · Home (OS landing) — route /scripton under the `new` shell flag.
 * Greet → Continue hero → Your Slate + Activity. Reuses existing project/
 * library/script data; kernel-only bits (continuity %, render activity)
 * degrade gracefully when the kernel is inert on this branch.
 * Self-contained `.sx` shell (top bar + SxRail + main/content), matching the
 * other ScriptON screens and the verified rail cutover.
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { masterScriptApi, productionApi } from '@/lib/api';
import { pickScriptonProject } from '@/components/scripton/useScriptonProject';
import { SxRail } from '@/components/scripton/ScriptOnStudio';
import { useViewport } from '@/components/scripton/useViewport';
import { useLocale } from '@/lib/i18n';
import { useScriptonBack } from '@/components/scripton/useScriptonBack';
import ScriptonTopBar from '@/components/scripton/topbar/ScriptonTopBar';
import ScriptonShell from '@/components/scripton/ScriptonShell';
import {
  greeting, firstNameOf, subLine, buildSlate, pickContinue, deriveCounts, toActivity,
  type SxCard, type HeroVM, type ActivityItem, type HomeCounts,
} from './scripton-home.logic';

const CSS = `
.sx.home{position:relative;display:flex;flex-direction:column;height:100%;background:#0a0b0e;color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx.home *{box-sizing:border-box;margin:0;padding:0}
.sx.home svg{display:block}
.sx.home .ico{width:18px;height:18px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sx.home .top{height:60px;flex:0 0 60px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:linear-gradient(180deg,#15181e,#121419);border-bottom:1px solid var(--hair);position:relative;z-index:2}
.sx.home .tl{display:flex;align-items:center;gap:12px}
.sx.home .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;box-shadow:0 4px 14px rgba(198,164,99,.3);cursor:pointer}
.sx.home .proj{font-weight:700;font-size:15.5px;color:var(--cream);font-family:var(--sx-title)}
.sx.home .meta{color:var(--faint);font-size:12px;font-weight:500}
.sx.home .body{flex:1;display:flex;min-height:0;position:relative;z-index:1}
/* Workspace rail (SxRail renders the markup; the host screen styles it) */
.sx.home .main{flex:1;min-width:0;display:flex;flex-direction:column}
.sx.home .content{flex:1;overflow:auto;padding:28px 40px;display:flex;flex-direction:column;gap:0}
.sx.home .content>*{flex:0 0 auto}/* sections keep natural height; the content scrolls (no flex-shrink squash) */

/* Greeting (node 24:2 / 24:3) */
.sx.home .greet h1{font-family:var(--sx-title);font-size:23px;font-weight:600;color:var(--cream);line-height:1.1;font-variation-settings:"SOFT" 0,"WONK" 1}
.sx.home .greet .subline{font-size:12.5px;color:var(--faint);margin-top:11px}

/* Body grid: left (hero + slate) · right 384px (buttons + activity), gap 36 (node) */
.sx.home .bodygrid{display:grid;grid-template-columns:minmax(0,864px) 384px;gap:36px;align-items:start;margin-top:21px}
.sx.home .lcol{display:flex;flex-direction:column;min-width:0}
.sx.home .rcol{display:flex;flex-direction:column;width:384px}

/* Continue hero (node 24:4) */
.sx.home .hero{display:flex;align-items:center;gap:0;background:#181b22;border:1px solid rgba(198,164,99,.25);border-radius:16px;padding:19px;position:relative;overflow:hidden;min-height:150px}
.sx.home .heroposter{width:92px;height:110px;flex:0 0 92px;border-radius:9px;border:1px solid rgba(198,164,99,.3);background:linear-gradient(130deg,#2b2414 0%,#17140d 71%);position:relative;display:grid;place-items:center;cursor:pointer}
.sx.home .heroposter .mono{font-family:var(--sx-title);font-size:44px;font-weight:600;color:var(--gold2);font-variation-settings:"SOFT" 0,"WONK" 1;line-height:1}
.sx.home .herobody{display:flex;flex-direction:column;justify-content:center;gap:0;min-width:0;flex:1;padding-inline-start:21px}
.sx.home .eyebrow{font-size:9.5px;font-weight:600;letter-spacing:1px;color:var(--gold);text-transform:uppercase}
.sx.home .herotitle{font-family:var(--sx-title);font-size:26px;font-weight:600;color:var(--cream);font-variation-settings:"SOFT" 0,"WONK" 1;margin-top:5px}
.sx.home .herometa{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;color:var(--mute);font-weight:400;margin-top:9px}
.sx.home .cont{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--green);font-weight:500;margin-top:9px}
.sx.home .ring{--p:0;width:14px;height:14px;border-radius:50%;background:conic-gradient(var(--green) calc(var(--p)*1%),#2a2d34 0);flex:none}
.sx.home .heroact{flex:0 0 auto;padding-inline-start:21px}
.sx.home .btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:42px;padding:0 16px;border-radius:11px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;color:var(--text);white-space:nowrap;background:transparent}
.sx.home .btn .ico{width:15px;height:15px}
.sx.home .btn.gold{background:#e6d2a2;color:#15120b;font-weight:600}
.sx.home .btn.cont{width:150px;height:42px}
.sx.home .btn.ghost{border-color:var(--hair2);color:var(--mute);font-weight:500}

/* Top-right button row (node 26:2 / 26:4) */
.sx.home .btnrow{display:grid;grid-template-columns:184px 184px;gap:16px}
.sx.home .btnrow .btn{width:184px}

/* Section kicker (node 25:2 / 26:7) — gold caps */
.sx.home .seclabel{font-size:9.5px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:var(--gold)}

/* Your Slate (node 25:*) */
.sx.home .slate{margin-top:24px}
.sx.home .cardgrid{display:grid;grid-template-columns:repeat(3,272px);gap:16px;margin-top:18px}
.sx.home .scard{width:272px;background:var(--panel);border:1px solid var(--hair);border-radius:14px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;transition:border-color .15s,transform .15s;text-align:start;position:relative}
.sx.home .scard.active{border:1.5px solid rgba(198,164,99,.35)}
.sx.home .scard:hover{border-color:var(--hair2);transform:translateY(-2px)}
.sx.home .cover{height:84px;position:relative;display:flex;align-items:flex-start;padding:18px}
.sx.home .cover .mono{font-family:var(--sx-title);font-size:34px;font-weight:600;color:rgba(255,255,255,.92);font-variation-settings:"SOFT" 0,"WONK" 1;line-height:1}
.sx.home .active-tag{position:absolute;top:12px;inset-inline-end:12px;font-size:8.5px;font-weight:600;letter-spacing:.4px;padding:3px 8px;border-radius:999px;background:#e6d2a2;color:#15120b}
.sx.home .b{padding:11px 15px 0;display:flex;flex-direction:column}
.sx.home .ti2{font-size:14px;font-weight:600;color:var(--cream);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx.home .typepill{display:inline-flex;align-items:center;height:20px;padding:0 9px;border-radius:999px;background:rgba(255,255,255,.06);font-size:10px;font-weight:500;color:var(--mute);margin-top:10px;width:max-content}
.sx.home .mrow{display:flex;align-items:center;gap:9px;margin-top:13px}
.sx.home .gradepill{display:inline-flex;align-items:center;height:18px;padding:0 7px;border-radius:6px;font-size:10px;font-weight:600}
.sx.home .mrow .when{font-size:10.5px;color:var(--faint);font-weight:400}

/* Activity panel (node 26:6) */
.sx.home .card{background:#0c0d11;border:1px solid var(--hair);border-radius:14px;padding:15px 19px}
.sx.home .feed{margin-top:16px}
.sx.home .feed .seclabel{margin-bottom:0}
.sx.home .feed .lrow{display:grid;grid-template-columns:8px 1fr;gap:10px;padding-top:28px}
.sx.home .feed .dot{width:8px;height:8px;border-radius:50%;flex:none;margin-top:3px}
.sx.home .feed .lt{font-size:12px;font-weight:500;color:var(--cream);line-height:1.2}
.sx.home .feed .lm{font-size:10px;color:var(--faint);margin-top:4px}
.sx.home .feed .foot{font-size:10px;color:var(--faint);margin-top:33px}
.sx.home .muted{font-size:12px;color:var(--faint);padding:14px 0}

/* Skeletons */
.sx.home .sk{background:linear-gradient(90deg,#16181e,#1c1f27,#16181e);background-size:200% 100%;animation:skp 1.3s ease-in-out infinite;border-radius:10px}
@keyframes skp{0%{background-position:200% 0}100%{background-position:-200% 0}}

/* Tablet: side drops below; slate 2-up */
.sx.home[data-vp="tablet"] .bodygrid{grid-template-columns:1fr}
.sx.home[data-vp="tablet"] .rcol{width:auto}
.sx.home[data-vp="tablet"] .cardgrid{grid-template-columns:repeat(2,minmax(0,272px))}
.sx.home[data-vp="tablet"] .content{padding:24px 22px}

/* Mobile: single column stacked; hero wraps; slate 1-up */
.sx.home[data-vp="mobile"] .content{padding:18px 14px}
.sx.home[data-vp="mobile"] .bodygrid{grid-template-columns:1fr;gap:18px}
.sx.home[data-vp="mobile"] .rcol{width:auto}
.sx.home[data-vp="mobile"] .hero{flex-wrap:wrap}
.sx.home[data-vp="mobile"] .heroact{padding-inline-start:0;margin-top:14px;width:100%}
.sx.home[data-vp="mobile"] .btnrow{grid-template-columns:1fr 1fr}
.sx.home[data-vp="mobile"] .btnrow .btn{width:100%}
.sx.home[data-vp="mobile"] .cardgrid{grid-template-columns:minmax(0,272px)}
.sx.home[data-vp="mobile"] .herotitle{font-size:21px}
`;

type Ready = {
  loading: false; name: string; greet: string; counts: HomeCounts;
  hero: HeroVM | null; cards: SxCard[]; activity: ActivityItem[];
};
type State = { loading: true } | Ready;

export default function ScriptonHome() {
  const router = useRouter();
  const vp = useViewport();
  const { dir, t } = useLocale();
  const onBack = useScriptonBack();
  const [s, setS] = useState<State>({ loading: true });

  useEffect(() => {
    let alive = true;
    (async () => {
      let master: any[] = [], dev: any[] = [], notesCount = 0, coverage: any[] = [];
      try {
        const mr: any = await masterScriptApi.list();
        const md = mr?.data; master = Array.isArray(md) ? md : (md?.items ?? md?.scripts ?? []);
      } catch { /* none */ }
      try {
        const pr: any = await productionApi.projects.list();
        const projects = pr.data?.items ?? (Array.isArray(pr.data) ? pr.data : []);
        const proj = pickScriptonProject(projects);
        if (proj?.id) {
          try { const sr: any = await productionApi.script.list(proj.id); dev = Array.isArray(sr.data) ? sr.data : (sr.data?.items ?? []); } catch { /* none */ }
          try { const nr: any = await productionApi.scripton.notes(proj.id); const arr = Array.isArray(nr.data) ? nr.data : []; notesCount = arr.filter((n: any) => !n.resolved).length; } catch { /* none */ }
          try { const cr: any = await productionApi.scripton.latestCoverage(proj.id); if (cr?.data) coverage = [cr.data]; } catch { /* none */ }
        }
      } catch { /* none */ }

      if (!alive) return;
      const now = Date.now();
      const slate = buildSlate({ master, dev, now });
      const hero = pickContinue(slate);
      const counts = deriveCounts({ scriptCount: slate.cards.length, notesCount, kernelInert: true });
      const revisions = [...dev, ...master].flatMap((sc: any) => (sc.revisions || []).map((r: any) => ({ ...r, scriptTitle: sc.title || sc.name }))).filter((r: any) => r.createdAt);
      const activity = toActivity({ revisions, coverage, now });
      let user: any = {};
      try { user = JSON.parse(localStorage.getItem('tfm_user') || '{}'); } catch { /* ignore */ }
      setS({ loading: false, name: firstNameOf(user), greet: greeting(new Date()), counts, hero, cards: slate.cards, activity });
    })();
    return () => { alive = false; };
  }, []);

  const openScript = (_id?: string) => router.push('/scripton/reader');
  const newBuild = () => router.push('/scripton/studio?tab=builds');
  const importScript = () => router.push('/scripton/library');

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <ScriptonShell screen="home" active="home" vp={vp} onBack={onBack}>
          <div className="main"><div className="content">
            {s.loading ? <HomeSkeleton t={t} /> : <HomeBody s={s} t={t} openScript={openScript} newBuild={newBuild} importScript={importScript} />}
          </div></div>
      </ScriptonShell>
    </>
  );
}

// Tint behind the grade pill, keyed to the recommendation (node 25:11 green / 25:29 amber).
function gradeTint(g: string): string {
  const u = (g || '').toUpperCase();
  if (u === 'RECOMMEND') return 'rgba(87,179,104,.16)';
  if (u === 'CONSIDER') return 'rgba(224,162,59,.16)';
  if (u === 'PASS') return 'rgba(229,99,95,.16)';
  return 'rgba(255,255,255,.06)';
}

function HomeBody({ s, t, openScript, newBuild, importScript }: { s: Ready; t: (k: string) => string; openScript: (id?: string) => void; newBuild: () => void; importScript: () => void }) {
  const { hero, cards, activity, counts } = s;
  const empty = cards.length === 0;
  const initial = (txt: string) => (txt || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <>
      {/* Greeting (node 24:2 / 24:3) */}
      <div className="greet">
        <h1>{t(s.greet)}, {s.name}</h1>
        <div className="subline">{subLine(counts)}</div>
      </div>

      {/* Body grid: left = hero + slate · right = button row + activity */}
      <div className="bodygrid">
        <div className="lcol">
          {/* Continue hero — or a start CTA when there's nothing yet */}
          {hero ? (
            <div className="hero">
              <button className="heroposter" onClick={() => openScript(hero.id)}>
                <span className="mono">{initial(hero.title)}</span>
              </button>
              <div className="herobody">
                <div className="eyebrow">{t(hero.eyebrow)}</div>
                <div className="herotitle">{hero.title}</div>
                <div className="herometa">
                  <span>{hero.format}</span><span>·</span><span>{hero.pages}</span><span>·</span><span>{hero.version}</span>
                  {hero.grade && hero.grade !== '—' ? <><span>·</span><span style={{ color: hero.gradeColor, fontWeight: 600 }}>{hero.grade}</span></> : null}
                </div>
                {typeof hero.continuity === 'number' ? (
                  <div className="cont"><span className="ring" style={{ ['--p' as any]: hero.continuity }} />{hero.continuity}% {t('canon continuity')}</div>
                ) : null}
              </div>
              <div className="heroact">
                <button className="btn gold cont" onClick={() => openScript(hero.id)}>{t('Continue')} <span aria-hidden>→</span></button>
              </div>
            </div>
          ) : (
            <div className="hero" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              <div className="herobody" style={{ paddingInlineStart: 0 }}>
                <div className="eyebrow">{t('YOUR SLATE IS EMPTY')}</div>
                <div className="herotitle">{t('Start your first script')}</div>
                <div className="herometa">{t('Develop a new idea, or import an existing screenplay.')}</div>
              </div>
              <button className="btn gold cont" onClick={newBuild} style={{ marginTop: 14 }}>＋ {t('New build')}</button>
            </div>
          )}

          {/* Your Slate (node 25:*) */}
          <div className="slate">
            <div className="seclabel">{t('Your Slate')}</div>
            {empty ? (
              <div className="card" style={{ marginTop: 18 }}><div className="muted">{t('No scripts yet — develop or import to get started.')}</div></div>
            ) : (
              <div className="cardgrid">
                {cards.map((c, i) => (
                  <button className={'scard' + (i === 0 ? ' active' : '')} key={c.id} onClick={() => openScript(c.id)}>
                    <div className="cover" style={{ background: c.cover }}>
                      <span className="mono">{initial(c.title)}</span>
                      {i === 0 ? <span className="active-tag">{t('ACTIVE')}</span> : null}
                    </div>
                    <div className="b">
                      <div className="ti2">{c.title}</div>
                      <span className="typepill">{c.type}</span>
                      <div className="mrow">
                        {c.grade && c.grade !== '—'
                          ? <span className="gradepill" style={{ color: c.gradeColor, background: gradeTint(c.grade) }}>{c.grade}</span>
                          : <span className="gradepill" style={{ color: c.revColor, background: 'rgba(255,255,255,.06)' }}>{c.rev}</span>}
                        <span className="when">{c.pages !== '—' ? `${c.pages} · ` : ''}{c.updated}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: button row + activity (node 26:*) */}
        <div className="rcol">
          <div className="btnrow">
            <button className="btn gold" onClick={newBuild}>＋ {t('New build')}</button>
            <button className="btn ghost" onClick={importScript}>↥ {t('Import script')}</button>
          </div>
          <div className="card feed" style={{ marginTop: 14 }}>
            <div className="seclabel">{t('Activity')}</div>
            {activity.length ? activity.slice(0, 8).map((a, i) => (
              <div className="lrow" key={i}>
                <span className="dot" style={{ background: a.color, marginTop: 5 }} />
                <span>
                  <span className="lt" style={{ display: 'block' }}>{a.text}</span>
                  <span className="lm" style={{ display: 'block' }}>{a.when}</span>
                </span>
              </div>
            )) : <div className="muted">{t('Nothing yet.')}</div>}
            {activity.length ? <div className="foot">{t('Every render, decision, note & share is recorded.')}</div> : null}
          </div>
        </div>
      </div>
    </>
  );
}

function HomeSkeleton({ t }: { t: (k: string) => string }) {
  return (
    <>
      <div className="greet">
        <div className="sk" style={{ height: 26, width: 240 }} />
        <div className="sk" style={{ height: 13, width: 320, marginTop: 11 }} />
      </div>
      <div className="bodygrid">
        <div className="lcol">
          <div className="sk" style={{ height: 150, borderRadius: 16 }} />
          <div className="slate">
            <div className="seclabel">{t('Your Slate')}</div>
            <div className="cardgrid">{[0, 1, 2].map((i) => <div className="sk" key={i} style={{ height: 182, borderRadius: 14 }} />)}</div>
          </div>
        </div>
        <div className="rcol">
          <div className="sk" style={{ height: 42, borderRadius: 11 }} />
          <div className="sk" style={{ height: 480, borderRadius: 14, marginTop: 14 }} />
        </div>
      </div>
    </>
  );
}
