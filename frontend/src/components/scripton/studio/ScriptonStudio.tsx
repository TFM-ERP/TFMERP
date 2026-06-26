'use client';
/**
 * ScriptON · Studio (single-canvas) — route /scripton/settings under the `new`
 * shell flag. Consolidates Settings/Governance + Protected-Export into one
 * cinematic workspace (Figma 38:198): title → left sub-nav → active section.
 * Presentational; the page owns data + the export flows + modals. Drops the
 * old embedded 74px rail/fixed overlay — the OS rail comes from the shell.
 */
import { useState } from 'react';
import { SxRail } from '@/components/scripton/ScriptOnStudio';
import ReviewProtectionPanel from '@/components/scripton/ReviewProtectionPanel';
import { useLocale } from '@/lib/i18n';
import ScriptonTopBar from '@/components/scripton/topbar/ScriptonTopBar';

export type StudioRun = { surface: string; model: string; tokens: string; conf: number; status: string; statusClass: string; when: string };

const SUBNAV: { k: string; label: string; danger?: boolean }[] = [
  { k: 'export', label: 'Export & interop' },
  { k: 'security', label: 'Security & distribution' },
  { k: 'access', label: 'Access & roles' },
  { k: 'integrations', label: 'Integrations' },
  { k: 'ai', label: 'AI governance' },
  { k: 'project', label: 'Project settings' },
  { k: 'danger', label: 'Danger zone', danger: true },
];

const FORMATS = [
  { k: 'fdx', name: 'FDX', sub: 'Final Draft XML', tag: 'round-trip ✓ · industry interchange', live: false },
  { k: 'fountain', name: 'Fountain', sub: 'plain-text', tag: 'round-trip ✓ · open format', live: false },
  { k: 'pdf', name: 'PDF', sub: 'Protected', tag: 'per-recipient watermark · perms', live: true },
  { k: 'word', name: 'Word', sub: 'DOCX', tag: 'editable review copy', live: true },
];

const MEMBERS = [
  { name: 'Qais', role: 'Owner', action: 'Manage' },
  { name: 'Lina', role: 'Producer', action: 'Review · approve' },
  { name: 'Nadia', role: 'Legal', action: 'Compliance gate' },
  { name: 'Studio Vault', role: 'Distribution', action: 'Read · watermarked' },
];

const CSS = `
.sx.studio{--bg:#0b0c0f;--panel:#14161c;--panel2:#1a1d24;--hair:rgba(255,255,255,.07);--hair2:rgba(255,255,255,.13);--gold:#C6A463;--gold2:#E6D2A2;--goldink:#1a1509;--cream:#F4EEE0;--text:#E8E6E0;--mute:#9aa1ab;--faint:#6b727d;--blue:#5b8def;--green:#57b368;--amber:#e0a23b;--violet:#8b7cf0;--red:#e5635f;position:relative;display:flex;flex-direction:column;height:100%;background:radial-gradient(1200px 600px at 50% -8%,#15171d,#0b0c0f 60%);color:var(--text);font-family:var(--sx-body);-webkit-font-smoothing:antialiased;overflow:hidden}
.sx.studio *{box-sizing:border-box;margin:0;padding:0}
.sx.studio:before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(700px 280px at 72% -6%,rgba(198,164,99,.09),transparent 70%);z-index:0}
.sx.studio svg{display:block}
.sx.studio .ico{width:18px;height:18px;stroke:currentColor;stroke-width:1.7;fill:none;stroke-linecap:round;stroke-linejoin:round}
.sx.studio .top{height:60px;flex:0 0 60px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;background:linear-gradient(180deg,#15181e,#121419);border-bottom:1px solid var(--hair);position:relative;z-index:2}
.sx.studio .tl{display:flex;align-items:center;gap:12px;min-width:0}
.sx.studio .logo{width:30px;height:30px;border-radius:9px;background:linear-gradient(160deg,var(--gold2),var(--gold));display:grid;place-items:center;color:var(--goldink);font-weight:800;font-size:12px;box-shadow:0 4px 14px rgba(198,164,99,.3);cursor:pointer;flex:none}
.sx.studio .proj{font-weight:700;font-size:15.5px;color:var(--cream);font-family:var(--sx-title);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sx.studio .pill{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
.sx.studio .pill .d{width:7px;height:7px;border-radius:50%;flex:none}
.sx.studio .body{flex:1;display:flex;min-height:0;position:relative;z-index:1}
.sx.studio .rail{width:74px;flex:0 0 74px;background:#0e1015;border-inline-end:1px solid var(--hair);display:flex;flex-direction:column;align-items:center;padding:14px 0;gap:6px;overflow-y:auto}
.sx.studio .ritem{width:58px;display:flex;flex-direction:column;align-items:center;gap:5px;padding:8px 0;border-radius:12px;color:var(--faint);cursor:pointer;position:relative;border:none;background:transparent}
.sx.studio .ritem .box{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;background:#171a21;border:1px solid var(--hair);color:var(--mute)}
.sx.studio .ritem .lbl{font-size:9px;font-weight:600}
.sx.studio .ritem:hover .box{border-color:var(--hair2);color:var(--cream)}
.sx.studio .ritem.on .box{background:linear-gradient(160deg,var(--gold2),var(--gold));border-color:transparent;color:var(--goldink);box-shadow:0 6px 16px -4px rgba(198,164,99,.5)}
.sx.studio .ritem.on .lbl{color:var(--gold2)}
.sx.studio .ritem.on:before{content:"";position:absolute;inset-inline-start:-1px;top:14px;bottom:14px;width:3px;border-radius:3px;background:var(--gold)}
.sx.studio .main{flex:1;min-width:0;display:flex;flex-direction:column}
.sx.studio .content{flex:1;overflow:auto;padding:24px 28px;display:flex;flex-direction:column;gap:18px}
.sx.studio .content>*{flex:0 0 auto}
.sx.studio .phead h1{font-family:var(--sx-title);font-size:26px;font-weight:500;color:var(--cream);letter-spacing:-.3px}
.sx.studio .phead .sub{font-size:12.5px;color:var(--mute);margin-top:4px}
.sx.studio .layout{display:grid;grid-template-columns:226px 1fr;gap:20px;align-items:start}

/* Sub-nav */
.sx.studio .subnav{display:flex;flex-direction:column;gap:3px}
.sx.studio .sni{display:flex;align-items:center;gap:9px;padding:10px 13px;border-radius:10px;font-size:13px;font-weight:600;color:var(--mute);cursor:pointer;border:none;background:transparent;text-align:start;width:100%}
.sx.studio .sni:hover{background:#171a20;color:var(--cream)}
.sx.studio .sni.on{background:rgba(198,164,99,.13);color:var(--gold2)}
.sx.studio .sni.danger{color:var(--red)}
.sx.studio .sni.danger.on{background:rgba(229,99,95,.12);color:var(--red)}

/* Panels */
.sx.studio .setmain{display:flex;flex-direction:column;gap:14px;min-width:0}
.sx.studio .panel{background:var(--panel);border:1px solid var(--hair);border-radius:14px;padding:16px}
.sx.studio .pt{font-size:14px;font-weight:700;color:var(--cream)}
.sx.studio .pintro{font-size:12.5px;color:var(--mute);margin:4px 0 14px;line-height:1.5}
.sx.studio .pfoot{font-size:11px;color:var(--faint);margin-top:14px;line-height:1.5}

/* Export cards */
.sx.studio .fmts{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
.sx.studio .fcard{background:var(--panel2);border:1px solid var(--hair);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:7px}
.sx.studio .fname{font-size:16px;font-weight:800;color:var(--cream);font-family:var(--sx-title)}
.sx.studio .fsub{font-size:11px;color:var(--mute);font-weight:600}
.sx.studio .ftag{font-size:10px;color:var(--faint);line-height:1.4;min-height:26px}
.sx.studio .btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:34px;padding:0 13px;border-radius:9px;font-size:12.5px;font-weight:600;cursor:pointer;border:1px solid transparent;white-space:nowrap}
.sx.studio .btn.gold{background:linear-gradient(180deg,var(--gold2),var(--gold));color:var(--goldink);font-weight:700}
.sx.studio .btn.ghost{background:#1b1e25;border-color:var(--hair);color:var(--text)}
.sx.studio .btn.block{width:100%}

/* Rows / toggles / chips */
.sx.studio .srow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid var(--hair)}
.sx.studio .srow:first-of-type{border-top:none}
.sx.studio .sk2{font-size:12.5px;color:var(--cream);font-weight:600}
.sx.studio .ss{font-size:11px;color:var(--faint);margin-top:2px}
.sx.studio .chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:5px 10px;border-radius:999px;background:#171a20;border:1px solid var(--hair);color:var(--mute)}
.sx.studio .chips{display:flex;gap:7px;flex-wrap:wrap}
.sx.studio .seg{display:inline-flex;border:1px solid var(--hair);border-radius:9px;overflow:hidden}
.sx.studio .seg button{padding:6px 12px;font-size:12px;font-weight:600;background:transparent;color:var(--mute);border:none;cursor:pointer}
.sx.studio .seg button.on{background:rgba(198,164,99,.16);color:var(--gold2)}
.sx.studio .tog{width:38px;height:22px;border-radius:999px;background:#23262e;position:relative;cursor:pointer;border:none;flex:none}
.sx.studio .tog.on{background:linear-gradient(180deg,var(--gold2),var(--gold))}
.sx.studio .tog i{position:absolute;top:2px;inset-inline-start:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:inset-inline-start .15s}
.sx.studio .tog.on i{inset-inline-start:18px}
.sx.studio .guard{font-size:11px;color:var(--amber);margin-top:12px;line-height:1.4;display:flex;gap:7px}
.sx.studio .av{width:30px;height:30px;border-radius:50%;background:#2a2310;color:var(--gold2);display:grid;place-items:center;font-weight:800;font-size:12px;flex:none}

/* AI governance */
.sx.studio .kpis3{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.sx.studio .kc{background:var(--panel2);border:1px solid var(--hair);border-radius:12px;padding:13px}
.sx.studio .kc .kl{font-size:10px;color:var(--faint);font-weight:700;letter-spacing:.4px;text-transform:uppercase}
.sx.studio .kc .kv{font-size:18px;font-weight:800;color:var(--cream);margin-top:5px}
.sx.studio .runs{width:100%;border-collapse:collapse;font-size:11.5px}
.sx.studio .runs th{text-align:start;font-size:9.5px;letter-spacing:.4px;color:var(--faint);font-weight:700;padding:7px 8px;border-bottom:1px solid var(--hair);text-transform:uppercase}
.sx.studio .runs td{padding:8px;border-bottom:1px solid var(--hair);color:var(--text)}
.sx.studio .badge{font-size:9px;font-weight:800;letter-spacing:.4px;padding:3px 8px;border-radius:999px}
.sx.studio .badge.green{background:rgba(87,179,104,.16);color:var(--green)}
.sx.studio .badge.amber{background:rgba(224,162,59,.16);color:var(--amber)}
.sx.studio .muted{font-size:12px;color:var(--faint);padding:10px 0}
.sx.studio .toast{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);z-index:9;background:#1b1e25;border:1px solid var(--hair2);color:var(--cream);font-size:12.5px;padding:10px 16px;border-radius:10px;box-shadow:0 14px 40px -12px rgba(0,0,0,.7)}

/* Tablet: sub-nav becomes a top pill row */
.sx.studio[data-vp="tablet"] .layout{grid-template-columns:1fr}
.sx.studio[data-vp="tablet"] .subnav{flex-direction:row;flex-wrap:wrap;gap:6px}
.sx.studio[data-vp="tablet"] .sni{width:auto}
.sx.studio[data-vp="tablet"] .fmts{grid-template-columns:repeat(2,1fr)}
.sx.studio[data-vp="tablet"] .content{padding:20px 18px}
/* Mobile: single column, sub-nav pills scroll, cards 1-up */
.sx.studio[data-vp="mobile"] .content{padding:16px 13px;gap:14px}
.sx.studio[data-vp="mobile"] .layout{grid-template-columns:1fr}
.sx.studio[data-vp="mobile"] .subnav{flex-direction:row;flex-wrap:nowrap;overflow-x:auto;gap:6px;padding-bottom:4px}
.sx.studio[data-vp="mobile"] .sni{width:auto;white-space:nowrap;flex:none}
.sx.studio[data-vp="mobile"] .fmts{grid-template-columns:1fr}
.sx.studio[data-vp="mobile"] .kpis3{grid-template-columns:1fr}
.sx.studio[data-vp="mobile"] .phead h1{font-size:22px}
`;

export type StudioProps = {
  title: string; revisionLabel: string; revisionColor: string;
  companyName: string; model: string; promptSet: string; confidence: number; humanApproval: boolean;
  runs: StudioRun[]; runsMeta: string; projectId: string | null;
  onExport: (kind: 'fdx' | 'fountain' | 'pdf' | 'word') => void;
  onAction: (k: string) => void; onNav: (k: string) => void; onBack: () => void;
  toast?: string | null; vp: 'mobile' | 'tablet' | 'desktop';
  settings?: any; onSaveSettings?: (patch: any) => void; mode?: 'team' | 'solo';
};

export default function ScriptonStudio(props: StudioProps) {
  const { dir, t } = useLocale();
  const [section, setSection] = useState('export');
  const Tog = ({ on, onClick }: { on: boolean; onClick?: () => void }) => (
    <button className={'tog' + (on ? ' on' : '')} onClick={onClick} aria-pressed={on}><i /></button>
  );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="sx studio" data-vp={props.vp} dir={dir} style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
        <ScriptonTopBar vp={props.vp} onBack={props.onBack} />
        <div className="body">
          <SxRail active="studio" />
          <div className="main"><div className="content">
            <div className="phead"><h1>{t('Studio')}</h1><div className="sub">{t('Export · interop · security · access · settings')}</div></div>

            <div className="layout">
              <div className="subnav">
                {SUBNAV.map((s) => (
                  <button key={s.k} className={'sni' + (s.k === section ? ' on' : '') + (s.danger ? ' danger' : '')} onClick={() => setSection(s.k)}>{t(s.label)}</button>
                ))}
              </div>

              <div className="setmain">
                {section === 'export' && (
                  <div className="panel">
                    <div className="pt">{t('Export & interop')}</div>
                    <div className="pintro">{t('Round-trip with the formats production actually uses. FDX is the credibility floor.')}</div>
                    <div className="fmts">
                      {FORMATS.map((f) => (
                        <div className="fcard" key={f.k}>
                          <div className="fname">{f.name}</div>
                          <div className="fsub">{t(f.sub)}</div>
                          <div className="ftag">{t(f.tag)}</div>
                          <button className={'btn block ' + (f.live ? 'gold' : 'ghost')} onClick={() => props.onExport(f.k as any)}>{t('Export')}</button>
                        </div>
                      ))}
                    </div>
                    <div className="pfoot">{t('Imports: FDX · Fountain · Celtx · Word · PDF (+OCR). The protected PDF carries the per-recipient forensic watermark + access log used in the Room.')}</div>
                  </div>
                )}

                {section === 'security' && (
                  <div className="panel">
                    <div className="pt">{t('Security & distribution')}</div>
                    <div className="pintro">{t('Per-recipient watermarking, permission locks and the export access log — applied to every protected copy.')}</div>
                    <ReviewProtectionPanel projectId={props.projectId || undefined} />
                    <div className="guard"><span>⚠</span>{t('No unprotected fallback — if protection fails, the export is blocked, never downgraded.')}</div>
                  </div>
                )}

                {section === 'access' && (
                  <div className="panel">
                    <div className="pt">{t('Access & roles')}</div>
                    <div className="pintro">{t('Who can review, approve and receive distribution copies.')}</div>
                    {MEMBERS.map((m) => (
                      <div className="srow" key={m.name}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="av">{m.name[0]}</div>
                          <div><div className="sk2">{m.name} · {t(m.role)}</div></div>
                        </div>
                        <span className="chip">{t(m.action)}</span>
                      </div>
                    ))}
                    <div className="srow"><div><div className="sk2">{t('SSO / SAML')}</div><div className="ss">{t('Single sign-on for the studio domain')}</div></div><Tog on={false} onClick={() => props.onAction('subnav')} /></div>
                    <div className="srow"><div><div className="sk2">{t('Audit log')}</div><div className="ss">{t('Record every access, export and role change')}</div></div><Tog on onClick={() => props.onAction('subnav')} /></div>
                  </div>
                )}

                {section === 'ai' && (
                  <>
                    <div className="panel">
                      <div className="pt">{t('AI governance')}</div>
                      <div className="pintro">{t('One gateway · every model call logged, gated and human-approvable.')} <span style={{ color: 'var(--faint)' }}>{props.runsMeta}</span></div>
                      <div className="kpis3">
                        <div className="kc"><div className="kl">{t('Active model')}</div><div className="kv">{props.model}</div><div className="ss">{props.promptSet}</div></div>
                        <div className="kc"><div className="kl">{t('Confidence gate')}</div><div className="kv">{Math.round((props.confidence || 0) * 100)}%</div><div className="ss">{t('below this, route to human')}</div></div>
                        <div className="kc"><div className="kl">{t('Human approval')}</div><div className="kv">{props.humanApproval ? t('Required') : t('Off')}</div><div className="ss">{t('applied rewrites need sign-off')}</div></div>
                      </div>
                    </div>
                    <div className="panel">
                      <div className="pt">{t('AI engines')}</div>
                      <div className="pintro">{t('The system models behind every ScriptON flow — manage them here without leaving the OS.')}</div>
                      <div className="srow"><div><div className="sk2">{t('System LLM engines')}</div><div className="ss">{t('Providers, keys, routing & fallbacks for every text generation')}</div></div><button className="btn ghost" onClick={() => props.onAction('llm-engines')}>{t('Manage')} →</button></div>
                      <div className="srow"><div><div className="sk2">{t('Audio engines')}</div><div className="ss">{t('Speech / TTS providers for table reads, narration & dubbing')}</div></div><button className="btn ghost" onClick={() => props.onAction('audio-engines')}>{t('Manage')} →</button></div>
                    </div>
                    <div className="panel">
                      <div className="pt">{t('Recent runs')}</div>
                      <div style={{ overflowX: 'auto', marginTop: 10 }}>
                        <table className="runs">
                          <thead><tr><th>{t('Surface')}</th><th>{t('Model')}</th><th>{t('Tokens')}</th><th>{t('Conf')}</th><th>{t('Status')}</th><th>{t('When')}</th></tr></thead>
                          <tbody>
                            {props.runs.map((r, i) => (
                              <tr key={i}><td>{r.surface}</td><td>{r.model}</td><td>{r.tokens}</td><td>{Math.round((r.conf || 0) * 100)}%</td><td><span className={'badge ' + (r.statusClass || 'amber')}>{r.status}</span></td><td>{r.when}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}

                {section === 'project' && (
                  <div className="panel">
                    <div className="pt">{t('Project settings')}</div>
                    <div className="pintro">{t('Name, language and the defaults new builds & exports inherit.')}</div>
                    <div className="srow"><div><div className="sk2">{t('Workspace name')}</div><div className="ss">{t('Shown across ScriptON')}</div></div>
                      <input defaultValue={props.settings?.name || ''} onBlur={(e) => props.onSaveSettings?.({ name: e.target.value })} style={{ background: '#15181e', border: '1px solid var(--hair)', borderRadius: 8, padding: '7px 10px', color: 'var(--text)', minWidth: 200 }} /></div>
                    <div className="srow"><div><div className="sk2">{t('Language')}</div><div className="ss">{t('UI + new script default')}</div></div>
                      <select defaultValue={props.settings?.language || 'en'} onChange={(e) => props.onSaveSettings?.({ language: e.target.value })} style={{ background: '#15181e', border: '1px solid var(--hair)', borderRadius: 8, padding: '7px 10px', color: 'var(--text)' }}><option value="en">English</option><option value="ar">العربية</option></select></div>
                    <div className="srow"><div><div className="sk2">{t('Collaboration')}</div><div className="ss">{(props.settings?.collabMode === 'SOLO' || (props.settings?.collabMode !== 'TEAM' && props.mode === 'solo')) ? t('Solo — just you (no sign-offs, Room hidden)') : t('Team — approval workflow + Room on')}</div></div>
                      <select defaultValue={props.settings?.collabMode || 'AUTO'} onChange={(e) => props.onSaveSettings?.({ collabMode: e.target.value })} style={{ background: '#15181e', border: '1px solid var(--hair)', borderRadius: 8, padding: '7px 10px', color: 'var(--text)' }}><option value="AUTO">{t('Auto (follows membership)')}</option><option value="TEAM">{t('Team')}</option><option value="SOLO">{t('Solo')}</option></select></div>
                    <div className="srow"><div><div className="sk2">{t('Default revision color')}</div><div className="ss">{t('Applied to new revisions')}</div></div>
                      <input type="color" defaultValue={props.settings?.defaults?.revisionColor || '#5b8def'} onBlur={(e) => props.onSaveSettings?.({ defaults: { ...(props.settings?.defaults || {}), revisionColor: e.target.value } })} /></div>
                  </div>
                )}

                {(section === 'integrations' || section === 'danger') && (
                  <div className="panel">
                    <div className="pt">{section === 'integrations' ? t('Integrations') : t('Danger zone')}</div>
                    <div className="pintro">{section === 'danger' ? t('Irreversible actions for this workspace.') : t('Connect tools and tune this workspace.')}</div>
                    <div className="srow">
                      <div><div className="sk2" style={section === 'danger' ? { color: 'var(--red)' } : undefined}>{section === 'integrations' ? t('Storage, calendars & comms') : t('Delete workspace')}</div><div className="ss">{t('This section ships in the next phase.')}</div></div>
                      <button className={'btn ' + (section === 'danger' ? 'ghost' : 'ghost')} onClick={() => props.onAction('subnav')} style={section === 'danger' ? { borderColor: 'rgba(229,99,95,.4)', color: 'var(--red)' } : undefined}>{section === 'danger' ? t('Delete…') : t('Configure')}</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div></div>
        </div>
        {props.toast && <div className="toast">{props.toast}</div>}
      </div>
    </>
  );
}
