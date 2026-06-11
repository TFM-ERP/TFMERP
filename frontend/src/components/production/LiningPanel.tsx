'use client';

import { useState, useEffect, useCallback } from 'react';
import { productionApi } from '@/lib/api';
import { Clapperboard, X, Plus, Trash2, Loader2, CircleDot, Timer, Flag, Coins, Camera, Sparkles } from 'lucide-react';
import { Btn, Chip } from './ui';

const inp = 'rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-slate-900 outline-none';
const money = (n: any, c = 'AED') => `${c} ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
const TAKE_TONE: Record<string, string> = { OK: 'slate', REJECT: 'risk', CIRCLE: 'money' };
// SYS-13b P4 — default camera palette (A…Z); on-screen by default.
const CAM_COLORS = ['#0ea5e9', '#f97316', '#22c55e', '#a855f7', '#ef4444', '#eab308', '#14b8a6', '#ec4899'];
const nextCamLabel = (cams: any[]) => String.fromCharCode(65 + Math.min(25, cams.length)); // A, B, C…
type Cam = { label: string; color: string; onScreen: boolean };

/**
 * SYS-13 · D6 — Lining & Hot Cost. Log coverage + takes per scene (the digital tramline record),
 * wrap takes to stamp out-times, and watch the live Hot Cost monitor → push the day's accrual.
 */
export default function LiningPanel({ projectId, revision, onClose }: { projectId: string; revision: any; onClose: () => void }) {
  const scenes = revision?.scenes || [];
  const [sceneId, setSceneId] = useState(scenes[0]?.id || '');
  const [coverage, setCoverage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cov, setCov] = useState<any>({ slate: '', cameraSetup: 'A_CAM', description: '', isOffScreen: false, cameras: [{ label: 'A', color: CAM_COLORS[0], onScreen: true }] as Cam[], slateFormat: 'ALPHA' });
  const [slateFormat, setSlateFormat] = useState('ALPHA');
  const [autoBusy, setAutoBusy] = useState(false);

  // Hot Cost monitor
  const [hc, setHc] = useState<any>({ callTime: '06:00', targetWrap: '19:00', actualWrap: '', shootDate: '' });
  const [calc, setCalc] = useState<any>(null);
  const [accruals, setAccruals] = useState<any[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    productionApi.lining.list(revision.id).then((r) => setCoverage(Array.isArray(r.data) ? r.data : [])).finally(() => setLoading(false));
    productionApi.lining.accruals(projectId).then((r) => setAccruals(Array.isArray(r.data) ? r.data : []));
  }, [revision.id, projectId]);
  useEffect(() => { load(); }, [load]);

  const sceneCoverage = coverage.filter((c) => c.sceneId === sceneId);

  const addCoverage = async () => {
    if (!sceneId) return;
    await productionApi.lining.addCoverage(sceneId, { ...cov, slateFormat });
    setCov({ slate: '', cameraSetup: 'A_CAM', description: '', isOffScreen: false, cameras: [{ label: 'A', color: CAM_COLORS[0], onScreen: true }], slateFormat }); load();
  };
  const removeCoverage = async (id: string) => { await productionApi.lining.removeCoverage(id); load(); };

  // P4 — multi-camera slate edits on the draft + on saved coverage.
  const setDraftCams = (cams: Cam[]) => setCov({ ...cov, cameras: cams });
  const addDraftCam = () => { const cams = cov.cameras || []; setDraftCams([...cams, { label: nextCamLabel(cams), color: CAM_COLORS[cams.length % CAM_COLORS.length], onScreen: true }]); };
  const saveCams = async (c: any, cams: Cam[]) => { await productionApi.lining.updateCoverage(c.id, { cameras: cams }); load(); };

  const autoCoverage = async () => {
    setAutoBusy(true);
    try {
      const r = await productionApi.lining.autoCoverage(revision.id, { slateFormat });
      load();
      alert(`Auto-coverage: created ${r.data.created} master slate(s) across ${r.data.scenes} scene(s) (${r.data.skipped} already covered).`);
    } catch (e: any) { alert(e?.response?.data?.message || 'Auto-coverage failed.'); }
    finally { setAutoBusy(false); }
  };
  const addTake = async (coverageId: string) => { await productionApi.lining.addTake(coverageId, {}); load(); };
  const setTakeStatus = async (id: string, status: string) => { await productionApi.lining.updateTake(id, { status }); load(); };
  const wrapTake = async (id: string) => { await productionApi.lining.wrapTake(id); load(); };
  const removeTake = async (id: string) => { await productionApi.lining.removeTake(id); load(); };

  const compute = useCallback(async () => {
    const r = await productionApi.lining.hotCost(projectId, hc);
    setCalc(r.data);
  }, [projectId, hc]);
  useEffect(() => { compute(); }, [compute]);

  const push = async () => {
    await productionApi.lining.pushHotCost(projectId, { ...hc, force: true });
    productionApi.lining.accruals(projectId).then((r) => setAccruals(r.data || []));
    alert('Accrual pushed to Hot Cost.');
  };
  const removeAccrual = async (id: string) => { await productionApi.lining.removeAccrual(id); productionApi.lining.accruals(projectId).then((r) => setAccruals(r.data || [])); };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between sticky top-0 glass-bar">
          <h2 className="font-semibold text-sm inline-flex items-center gap-2"><Clapperboard size={16} /> Lining & Hot Cost — {revision?.revisionLabel}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* ── Lining (coverage + takes) ── */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <select className={`${inp} flex-1`} value={sceneId} onChange={(e) => setSceneId(e.target.value)}>
                {scenes.map((s: any) => <option key={s.id} value={s.id}>Sc {s.sceneNumber || '•'} — {s.slugline}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <label className="text-[10px] text-slate-400">Slate format</label>
              <select className={inp} value={slateFormat} onChange={(e) => setSlateFormat(e.target.value)}>
                <option value="ALPHA">Alpha (scene #)</option>
                <option value="NUMERIC">Numeric (1, 2, 3…)</option>
                <option value="DECIMAL">Decimal (1.1, 2.1…)</option>
              </select>
              <Btn variant="secondary" onClick={autoCoverage} className="ml-auto" disabled={autoBusy}>
                {autoBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />} Auto-coverage
              </Btn>
            </div>

            {/* add coverage */}
            <div className="rounded-xl border border-slate-200 p-2.5 mb-3 space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                <input className={inp} placeholder="Slate" value={cov.slate} onChange={(e) => setCov({ ...cov, slate: e.target.value })} />
                <input className={inp} placeholder="Camera (A_CAM)" value={cov.cameraSetup} onChange={(e) => setCov({ ...cov, cameraSetup: e.target.value })} />
                <input className={inp} placeholder="Desc (CU Jane)" value={cov.description} onChange={(e) => setCov({ ...cov, description: e.target.value })} />
              </div>
              {/* P4 — multi-camera slate */}
              <div className="flex items-center flex-wrap gap-1.5">
                <span className="text-[10px] text-slate-400 inline-flex items-center gap-1"><Camera size={11} /> Cameras</span>
                {(cov.cameras || []).map((cam: Cam, i: number) => (
                  <span key={i} className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] ${cam.onScreen ? 'border-slate-300' : 'border-dashed border-slate-300 opacity-60'}`} style={{ color: cam.color }}>
                    <input type="color" value={cam.color} onChange={(e) => { const cams = [...cov.cameras]; cams[i] = { ...cam, color: e.target.value }; setDraftCams(cams); }} className="w-3.5 h-3.5 rounded-full border-0 p-0 bg-transparent cursor-pointer" />
                    <button onClick={() => { const cams = [...cov.cameras]; cams[i] = { ...cam, onScreen: !cam.onScreen }; setDraftCams(cams); }} title={cam.onScreen ? 'On-screen' : 'Off-screen'} className="font-bold">{cam.label}</button>
                    <button onClick={() => setDraftCams(cov.cameras.filter((_: any, j: number) => j !== i))} className="text-slate-300 hover:text-rose-500"><X size={9} /></button>
                  </span>
                ))}
                {(cov.cameras || []).length < 26 && <button onClick={addDraftCam} className="text-slate-400 hover:text-slate-900"><Plus size={12} /></button>}
              </div>
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-slate-500 inline-flex items-center gap-1.5"><input type="checkbox" checked={cov.isOffScreen} onChange={(e) => setCov({ ...cov, isOffScreen: e.target.checked })} /> Off-screen (wavy tramline)</label>
                <Btn variant="secondary" onClick={addCoverage}><Plus size={12} /> Add coverage</Btn>
              </div>
            </div>

            {loading ? <Loader2 className="animate-spin text-slate-300 mx-auto my-6" /> : sceneCoverage.length === 0 ? (
              <p className="text-xs text-slate-400">No coverage logged for this scene yet.</p>
            ) : (
              <div className="space-y-2">
                {sceneCoverage.map((c) => (
                  <div key={c.id} className="rounded-xl border border-slate-200 p-2.5">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Chip tone="slate">Slate {c.slate || '—'}</Chip>
                      <span className="text-xs text-slate-500">{c.description}</span>
                      {Array.isArray(c.cameras) && c.cameras.length > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          {c.cameras.map((cam: Cam, i: number) => (
                            <button key={i} onClick={() => saveCams(c, c.cameras.map((x: Cam, j: number) => j === i ? { ...x, onScreen: !x.onScreen } : x))}
                              title={cam.onScreen ? 'On-screen — click for off-screen' : 'Off-screen'}
                              className={`text-[10px] font-bold w-4 h-4 rounded-full text-white inline-flex items-center justify-center ${cam.onScreen ? '' : 'opacity-40 ring-1 ring-dashed'}`} style={{ background: cam.color }}>{cam.label}</button>
                          ))}
                        </span>
                      ) : c.cameraSetup && <span className="text-[10px] text-slate-400">{c.cameraSetup}</span>}
                      {c.isOffScreen && <span className="text-[10px] text-slate-400">off-screen</span>}
                      <div className="ml-auto flex items-center gap-1.5">
                        <button onClick={() => addTake(c.id)} className="text-[11px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-0.5"><Plus size={11} /> take</button>
                        <button onClick={() => removeCoverage(c.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    {(c.takes || []).length > 0 && (
                      <div className="space-y-1">
                        {c.takes.map((t: any) => (
                          <div key={t.id} className="flex items-center gap-2 text-xs">
                            <span className="w-12 text-slate-500">Take {t.takeNumber}</span>
                            <button onClick={() => setTakeStatus(t.id, 'CIRCLE')} title="Circle (print)" className={t.status === 'CIRCLE' ? 'text-emerald-600' : 'text-slate-300 hover:text-emerald-600'}><CircleDot size={14} /></button>
                            <select className={inp} value={t.status} onChange={(e) => setTakeStatus(t.id, e.target.value)}>
                              <option value="OK">OK</option><option value="REJECT">Reject</option><option value="CIRCLE">Circle</option>
                            </select>
                            <span className="text-slate-400 flex-1">{t.inAt || '—'} → {t.outAt || (t.wrapTimestamp ? new Date(t.wrapTimestamp).toTimeString().slice(0, 5) : '…')}</span>
                            {!t.wrapTimestamp && <button onClick={() => wrapTake(t.id)} className="text-[11px] text-slate-500 hover:text-slate-900 inline-flex items-center gap-0.5"><Flag size={11} /> wrap</button>}
                            <button onClick={() => removeTake(t.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={12} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Hot Cost monitor ── */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2 inline-flex items-center gap-1"><Timer size={12} /> Hot Cost monitor</p>
            <div className="rounded-2xl border border-slate-200 p-3 space-y-2">
              <div className="grid grid-cols-3 gap-1.5">
                <div><label className="text-[10px] text-slate-400">Call</label><input className={`${inp} w-full`} value={hc.callTime} onChange={(e) => setHc({ ...hc, callTime: e.target.value })} placeholder="06:00" /></div>
                <div><label className="text-[10px] text-slate-400">Target wrap</label><input className={`${inp} w-full`} value={hc.targetWrap} onChange={(e) => setHc({ ...hc, targetWrap: e.target.value })} placeholder="19:00" /></div>
                <div><label className="text-[10px] text-slate-400">Actual wrap</label><input className={`${inp} w-full`} value={hc.actualWrap} onChange={(e) => setHc({ ...hc, actualWrap: e.target.value })} placeholder="19:42" /></div>
              </div>
              {calc && (
                <>
                  <div className="flex items-center gap-2 pt-1">
                    <Chip tone={calc.otMinutes > 0 ? 'risk' : 'money'}>{calc.otMinutes > 0 ? `+${calc.otMinutes} min OT` : 'On schedule'}</Chip>
                    <span className="text-[11px] text-slate-400">{calc.crewCount} crew · avg {money(calc.avgDayRate, calc.currency)}/day</span>
                  </div>
                  <div className="text-xs space-y-1 border-t border-slate-100 pt-2">
                    <div className="flex justify-between"><span className="text-slate-500">Base payroll</span><span className="font-medium">{money(calc.baseAmount, calc.currency)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Overtime (×1.5)</span><span className="font-medium text-amber-700">{money(calc.otAmount, calc.currency)}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Meal penalty ({calc.forcedCallCount} heads)</span><span className="font-medium text-amber-700">{money(calc.mealPenaltyAmount, calc.currency)}</span></div>
                    <div className="flex justify-between border-t border-slate-100 pt-1"><span className="font-semibold">Day total</span><span className="font-semibold">{money(calc.total, calc.currency)}</span></div>
                  </div>
                  <Btn variant="primary" onClick={push} className="w-full justify-center"><Coins size={13} /> Push accrual to Hot Cost</Btn>
                </>
              )}
            </div>

            {accruals.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Pushed accruals</p>
                <div className="space-y-1.5">
                  {accruals.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-xs rounded-lg border border-slate-200 px-2.5 py-1.5">
                      <Chip tone="money">{a.status}</Chip>
                      <span className="text-slate-500">{a.shootDate ? new Date(a.shootDate).toLocaleDateString('en-GB') : new Date(a.createdAt).toLocaleDateString('en-GB')}</span>
                      <span className="text-slate-400">+{a.otMinutes}m OT</span>
                      <span className="ml-auto font-medium">{money(Number(a.baseAmount) + Number(a.otAmount) + Number(a.mealPenaltyAmount), a.currency)}</span>
                      <button onClick={() => removeAccrual(a.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
