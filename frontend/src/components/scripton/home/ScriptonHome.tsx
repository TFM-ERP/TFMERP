'use client';
/**
 * ScriptON · Home (OS landing) — route /scripon under the `new` shell flag.
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
import {
  greeting, firstNameOf, subLine, buildSlate, pickContinue, deriveCounts, toActivity,
  type SxCard, type HeroVM, type ActivityItem, type HomeCounts,
} from './scripton-home.logic';

const CSS = `
.sx.home{--bg:#0b0c0f;--panel:#14161c;--panel2:#1a1d24;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;--violet:#8b7cf0;--pink:#d6649a;--red:#e5635f;position:relative;display:flex;flex-direction:column;height:100%;background:radial-gradient(1200px 600px at 50% -8%,#15171d,#0b0c0f 60%);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx.home *{box-sizing:border-box;margin:0;padding:0}
.sx.home:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(700px 280px at 72% -6%,rgba(198,164,99,.09),transparent 70%);z-index:0}
.sx.home svg{display:block}
.sx.home .ico{width:18px;height:18px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sx.home .top{height:60px;flex:0 0 60px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:linear-gradient(180deg,#15181e,#121419);border-bottom:1px solid var(--hair);position:relative;z-index:2}
.sx.home .tl{display:flex;align-items:center;gap:12px}
.sx.home .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;box-shadow:0 4px 14px rgba(198,164,99,.3);cursor:pointer}
.sx.home .proj{font-weight:700;font-size:15.5px;color:var(--cream);font-family:var(--sx-title)}
.sx.home .meta{color:var(--faint);font-size:12px;font-weight:500}
.sx.home .body{flex:1;display:flex;min-height:0;position:relative;z-index:1}
/* Workspace rail (SxRail renders the markup; the host screen styles it) */
.sx.home .rail{width:74px;flex:0 0 74px;background:#0e1015;border-inline-end:1px solid var(--hair);display:flex;flex-direction:column;align-items:center;padding:14px 0;gap:6px;overflow-y:auto}
.sx.home .ritem{width:58px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 0;border-radius:12px;color:var(--faint);cursor:pointer;position:relative;border:none;background:transparent}
.sx.home .ritem .box{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#171a21;border:1px solid var(--hair);color:var(--mute)}
.sx.home .ritem .lbl{font-size:9px;font-weight:600}
.sx.home .ritem:hover .box{border-color:var(--hair2);color:var(--cream)}
.sx.home .ritem.on .box{background:linear-gradient(160deg,var(--gold2),var(--gold));border-color:transparent;color:var(--goldink);box-shadow:0 6px 16px -4px rgba(198,164,99,.5)}
.sx.home .ritem.on .lbl{color:var(--gold2)}
.sx.home .ritem.on:before{content:"";position:absolute;inset-inline-start:-1px;top:14px;bottom:14px;width:3px;border-radius:3px;background:var(--gold)}
.sx.home .main{flex:1;min-width:0;display:flex;flex-direction:column}
.sx.home .content{flex:1;overflow:auto;padding:28px 32px;display:flex;flex-direction:column;gap:22px}
.sx.home .content>*{flex:0 0 auto}/* sections keep natural height; the content scrolls (no flex-shrink squash) */

/* Greeting */
.sx.home .greet h1{font-family:var(--sx-title);font-size:30px;font-weight:500;color:var(--cream);letter-spacing:-.3px;line-height:1.1}
.sx.home .greet .subline{font-size:13.5px;color:var(--mute);margin-top:7px}

/* Continue hero */
.sx.home .hero{display:grid;grid-template-columns:188px 1fr;gap:22px;background:linear-gradient(120deg,#141416 0%,#0E0E10 55%,#1c1407 130%);border:1px solid #232326;border-radius:18px;padding:18px;position:relative;overflow:hidden}
.sx.home .hero:before{content:"";position:absolute;top:-40%;right:-10%;width:340px;height:340px;background:radial-gradient(circle,rgba(201,169,106,.16),transparent 70%);pointer-events:none}
.sx.home .heroposter{height:208px;border-radius:13px;position:relative;display:flex;align-items:flex-end;padding:11px;overflow:hidden}
.sx.home .heroposter .badge{position:absolute;top:11px;left:11px}
.sx.home .heroposter .pill{position:absolute;bottom:11px;inset-inline-start:11px;max-width:calc(100% - 22px)}
.sx.home .herobody{display:flex;flex-direction:column;justify-content:center;gap:9px;min-width:0;position:relative;z-index:1}
.sx.home .eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.7px;color:var(--gold2);text-transform:uppercase}
.sx.home .herotitle{font-family:var(--sx-title);font-size:25px;font-weight:500;color:var(--cream);letter-spacing:-.3px}
.sx.home .herometa{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:12px;color:var(--faint);font-weight:500}
.sx.home .cont{display:flex;align-items:center;gap:9px;font-size:12px;color:var(--mute)}
.sx.home .ring{--p:0;width:34px;height:34px;border-radius:50%;background:conic-gradient(var(--green) calc(var(--p)*1%),#2a2d34 0);display:grid;place-items:center}
.sx.home .ring i{width:26px;height:26px;border-radius:50%;background:#101218;display:grid;place-items:center;font-size:9.5px;font-weight:800;color:var(--cream);font-style:normal}
.sx.home .badge{font-size:10px;font-weight:800;letter-spacing:.4px;padding:4px 9px;border-radius:999px}
.sx.home .pill{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;font-size:10px;font-weight:700;max-width:64%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx.home .pill .d{width:6px;height:6px;border-radius:50%}
.sx.home .btn{display:inline-flex;align-items:center;gap:7px;height:38px;padding:0 16px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;color:var(--text);white-space:nowrap;background:transparent;width:max-content}
.sx.home .btn .ico{width:15px;height:15px}
.sx.home .btn.gold{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700;box-shadow:0 6px 18px -4px rgba(198,164,99,.45),inset 0 1px 0 rgba(255,255,255,.3)}
.sx.home .btn.ghost{background:#1b1e25;border-color:var(--hair);color:var(--text)}
.sx.home .btn.outline{background:#1c1d1a;border-color:rgba(198,164,99,.55);color:var(--gold2)}
.sx.home .btn.full{width:100%;justify-content:flex-start}

/* Two columns: slate + side */
.sx.home .cols{display:grid;grid-template-columns:1.9fr 1fr;gap:22px;align-items:start}
.sx.home .seclabel{font-size:12px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--faint);margin-bottom:12px}
.sx.home .cardgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.sx.home .scard{background:var(--panel);border:1px solid var(--hair);border-radius:14px;overflow:hidden;cursor:pointer;display:flex;flex-direction:column;transition:border-color .15s,transform .15s;text-align:start;position:relative}
.sx.home .scard:hover{border-color:var(--hair2);transform:translateY(-2px)}
.sx.home .cover{height:96px;position:relative;display:flex;align-items:flex-end;padding:10px}
.sx.home .cover .badge{position:absolute;top:10px;left:10px}
.sx.home .cover .rev{position:absolute;top:10px;right:10px}
.sx.home .active-tag{position:absolute;bottom:10px;left:10px;font-size:9px;font-weight:800;letter-spacing:.5px;padding:3px 7px;border-radius:999px;background:rgba(198,164,99,.92);color:#1a1509}
.sx.home .b{padding:11px 12px;display:flex;flex-direction:column;gap:6px}
.sx.home .ti2{font-size:13.5px;font-weight:700;color:var(--cream);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx.home .mrow{display:flex;align-items:center;gap:8px;font-size:10.5px;color:var(--faint);font-weight:500}

/* Side column */
.sx.home .side{display:flex;flex-direction:column;gap:18px}
.sx.home .card{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:15px}
.sx.home .qa{display:flex;flex-direction:column;gap:9px}
.sx.home .feed .lrow{display:flex;gap:11px;padding:9px 0;border-top:1px solid var(--hair)}
.sx.home .feed .lrow:first-of-type{border-top:none}
.sx.home .feed .dot{width:8px;height:8px;border-radius:50%;flex:none;margin-top:4px}
.sx.home .feed .lt{flex:1;font-size:12.5px;color:var(--text);line-height:1.4}
.sx.home .feed .lm{font-size:11px;color:var(--faint);white-space:nowrap}
.sx.home .muted{font-size:12.5px;color:var(--faint);padding:8px 0}

/* Skeletons */
.sx.home .sk{background:linear-gradient(90deg,#16181e,#1c1f27,#16181e);background-size:200% 100%;animation:skp 1.3s ease-in-out infinite;border-radius:10px}
@keyframes skp{0%{background-position:200% 0}100%{background-position:-200% 0}}

/* Tablet: side drops below; slate 2-up */
.sx.home[data-vp="tablet"] .cols{grid-template-columns:1fr}
.sx.home[data-vp="tablet"] .cardgrid{grid-template-columns:repeat(2,1fr)}
.sx.home[data-vp="tablet"] .content{padding:24px 22px}

/* Mobile: single column stacked; hero poster on top; slate 1-up */
.sx.home[data-vp="mobile"] .content{padding:18px 14px;gap:18px}
.sx.home[data-vp="mobile"] .hero{display:flex;flex-direction:column;gap:14px}
.sx.home[data-vp="mobile"] .heroposter{height:150px}
.sx.home[data-vp="mobile"] .cols{grid-template-columns:1fr}
.sx.home[data-vp="mobile"] .cardgrid{grid-template-columns:1fr}
.sx.home[data-vp="mobile"] .greet h1{font-size:24px}
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

  const openScript = (_id?: string) => router.push('/scripon/reader');
  const newBuild = () => router.push('/scripon/studio?tab=builds');
  const importScript = () => router.push('/scripon/library');

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx home" data-vp={vp} dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <div className="top">
          <div className="tl">
            <div className="logo" onClick={onBack} title={t('Back to TFM')}>TFM</div>
            <div className="proj">{t('ScriptON')}</div>
            <span className="meta">{s.loading ? '' : `${s.cards.length} ${t('scripts')}`}</span>
          </div>
        </div>
        <div className="body">
          <SxRail active="home" />
          <div className="main"><div className="content">
            {s.loading ? <HomeSkeleton t={t} /> : <HomeBody s={s} t={t} openScript={openScript} newBuild={newBuild} importScript={importScript} />}
          </div></div>
        </div>
      </div>
    </>
  );
}

function HomeBody({ s, t, openScript, newBuild, importScript }: { s: Ready; t: (k: string) => string; openScript: (id?: string) => void; newBuild: () => void; importScript: () => void }) {
  const { hero, cards, activity, counts } = s;
  const empty = cards.length === 0;
  return (
    <>
      {/* Greeting */}
      <div className="greet">
        <h1>{t(s.greet)}, {s.name}</h1>
        <div className="subline">{subLine(counts)}</div>
      </div>

      {/* Continue hero — or a start CTA when there's nothing yet */}
      {hero ? (
        <div className="hero">
          <button className="heroposter scard" onClick={() => openScript(hero.id)} style={{ background: hero.cover, border: 'none', padding: 11 }}>
            <span className="badge" style={{ background: 'rgba(255,255,255,.10)', color: 'var(--gold2)' }}>{hero.type}</span>
            <span className="pill" style={{ background: 'rgba(0,0,0,.35)', color: 'var(--cream)' }}><span className="d" style={{ background: 'var(--gold)' }} />{hero.version}</span>
          </button>
          <div className="herobody">
            <div className="eyebrow">{t(hero.eyebrow)}</div>
            <div className="herotitle">{hero.title}</div>
            <div className="herometa">
              <span>{hero.format}</span><span>·</span><span>{hero.pages}</span><span>·</span><span>{hero.version}</span>
              {hero.grade && hero.grade !== '—' ? <><span>·</span><span style={{ color: hero.gradeColor, fontWeight: 700 }}>{hero.grade}</span></> : null}
            </div>
            {typeof hero.continuity === 'number' ? (
              <div className="cont"><span className="ring" style={{ ['--p' as any]: hero.continuity }}><i>{hero.continuity}</i></span>{hero.continuity}% {t('canon continuity')}</div>
            ) : null}
            <button className="btn gold" onClick={() => openScript(hero.id)} style={{ marginTop: 4 }}>{t('Continue')} <svg className="ico" viewBox="0 0 24 24" style={{ stroke: '#1a1509' }}><path d="M5 12h14M13 6l6 6-6 6" /></svg></button>
          </div>
        </div>
      ) : (
        <div className="hero" style={{ gridTemplateColumns: '1fr' }}>
          <div className="herobody">
            <div className="eyebrow">{t('YOUR SLATE IS EMPTY')}</div>
            <div className="herotitle">{t('Start your first script')}</div>
            <div className="herometa">{t('Develop a new idea, or import an existing screenplay.')}</div>
            <button className="btn gold" onClick={newBuild} style={{ marginTop: 6 }}>＋ {t('New build')}</button>
          </div>
        </div>
      )}

      {/* Slate + side */}
      <div className="cols">
        <div className="slate">
          <div className="seclabel">{t('Your Slate')}</div>
          {empty ? (
            <div className="card"><div className="muted">{t('No scripts yet — develop or import to get started.')}</div></div>
          ) : (
            <div className="cardgrid">
              {cards.map((c, i) => (
                <button className="scard" key={c.id} onClick={() => openScript(c.id)}>
                  <div className="cover" style={{ background: c.cover }}>
                    <span className="badge" style={{ background: 'rgba(255,255,255,.10)', color: c.typeColor }}>{c.type}</span>
                    <span className="pill rev" style={{ background: 'rgba(0,0,0,.35)', color: c.revColor }}><span className="d" style={{ background: c.revColor }} />{c.rev}</span>
                    {i === 0 ? <span className="active-tag">{t('ACTIVE')}</span> : null}
                  </div>
                  <div className="b"><div className="ti2">{c.title}</div><div className="mrow"><span>{c.pages}</span><span>·</span><span style={{ color: c.gradeColor, fontWeight: 700 }}>{c.grade}</span><span style={{ marginInlineStart: 'auto' }}>{c.updated}</span></div></div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="side">
          <div className="card qa">
            <div className="seclabel" style={{ marginBottom: 4 }}>{t('Quick actions')}</div>
            <button className="btn gold full" onClick={newBuild}>＋ {t('New build')}</button>
            <button className="btn ghost full" onClick={importScript}>↥ {t('Import script')}</button>
          </div>
          <div className="card feed">
            <div className="seclabel" style={{ marginBottom: 4 }}>{t('Activity')}</div>
            {activity.length ? activity.slice(0, 8).map((a, i) => (
              <div className="lrow" key={i}>
                <span className="dot" style={{ background: a.color }} />
                <span className="lt">{a.text}</span>
                <span className="lm">{a.when}</span>
              </div>
            )) : <div className="muted">{t('Nothing yet.')}</div>}
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
        <div className="sk" style={{ height: 32, width: 280 }} />
        <div className="sk" style={{ height: 14, width: 360, marginTop: 10 }} />
      </div>
      <div className="sk" style={{ height: 244, borderRadius: 18 }} />
      <div className="cols">
        <div>
          <div className="seclabel">{t('Your Slate')}</div>
          <div className="cardgrid">{[0, 1, 2, 3, 4, 5].map((i) => <div className="sk" key={i} style={{ height: 168, borderRadius: 14 }} />)}</div>
        </div>
        <div className="side">
          <div className="sk" style={{ height: 120, borderRadius: 14 }} />
          <div className="sk" style={{ height: 220, borderRadius: 14 }} />
        </div>
      </div>
    </>
  );
}
