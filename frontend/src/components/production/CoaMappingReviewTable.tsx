'use client';

import { useEffect, useMemo, useState } from 'react';
import { Sparkles, CheckCircle, AlertTriangle, X, GitBranch, Loader2 } from 'lucide-react';
import { productionApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Btn } from './ui';

const CONFIDENCE_RED = 0.7; // below this the indicator turns red

type ParsedLine = {
  originalLineId: string;
  sectionCode: string; sectionTitle: string;
  externalCode: string | null; accountTitle: string | null;
  description: string;
  quantity: number; rate: number;
  fringePct: number; fringeAmount: number;
  subtotal: number; total: number;
  stages: any[] | null;
};
type Suggestion = {
  originalLineId: string;
  suggestedMasterCode: string;
  confidenceScore: number;
  reasoning: string;
  vatTreatment: string;
};
type Preview = {
  fileName: string | null;
  lines: ParsedLine[];
  ai: { suggestions: Suggestion[]; rejected: { originalLineId: string; problem: string }[]; mapped: number; requested: number };
  masterAccounts: { code: string; title: string | null }[];
};

const fmt = (n: number) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

/**
 * Review table for AI-suggested CoA mappings of a Movie Magic import.
 * Nothing is written until the user presses "Confirm and Push to Budget",
 * which clones the active (possibly LOCKED) version and injects the approved
 * lines into the new WORKING copy.
 */
export default function CoaMappingReviewTable({ projectId, initialFile, onClose, onPushed }: {
  projectId: string;
  initialFile?: File | null; // when provided (embedded mode), the picker is hidden and analysis starts immediately
  onClose?: () => void;
  onPushed?: (result: any) => void;
}) {
  const [file, setFile] = useState<File | null>(initialFile || null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [overrides, setOverrides] = useState<Record<string, string>>({}); // lineId → masterCode
  const [busy, setBusy] = useState<'analyze' | 'push' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byLine = useMemo(() => {
    const m = new Map<string, Suggestion>();
    for (const s of preview?.ai?.suggestions || []) m.set(s.originalLineId, s);
    return m;
  }, [preview]);
  const rejectedBy = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of preview?.ai?.rejected || []) m.set(r.originalLineId, r.problem);
    return m;
  }, [preview]);

  const codeFor = (id: string) => overrides[id] ?? byLine.get(id)?.suggestedMasterCode ?? '';
  const readyLines = useMemo(
    () => (preview?.lines || []).filter((l) => codeFor(l.originalLineId)),
    [preview, overrides, byLine], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const analyze = async (f?: File | null) => {
    const target = f || file;
    if (!target) return;
    setBusy('analyze'); setError(null);
    try {
      const r = await productionApi.movieMagic.aiPreview(projectId, target);
      setPreview(r.data); setOverrides({});
    } catch (e: any) { setError(e.response?.data?.message || 'AI preview failed.'); }
    finally { setBusy(null); }
  };

  // Embedded mode: a file handed in by the parent starts the analysis immediately.
  useEffect(() => {
    if (initialFile) { setFile(initialFile); analyze(initialFile); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  const push = async () => {
    if (!preview || !readyLines.length) return;
    const skipped = preview.lines.length - readyLines.length;
    if (!confirm(`Push ${readyLines.length} mapped line(s) to the budget?${skipped ? ` ${skipped} unmapped line(s) will be SKIPPED.` : ''}\n\nThis branches the active budget into a new WORKING version — the existing version is not modified.`)) return;
    setBusy('push'); setError(null);
    try {
      const r = await productionApi.movieMagic.aiConfirm(projectId, {
        versionName: `MM Import (AI-mapped) — ${preview.fileName || 'file'}`,
        lines: readyLines.map((l) => ({
          description: l.description, quantity: l.quantity, rate: l.rate,
          fringePct: l.fringePct, fringeAmount: l.fringeAmount, stages: l.stages,
          externalCode: l.externalCode,
          masterCode: codeFor(l.originalLineId),
          vatTreatment: byLine.get(l.originalLineId)?.vatTreatment || null,
        })),
      });
      alert(`Pushed to budget.\nNew working version: ${r.data.versionName}\nLines created: ${r.data.linesCreated} across ${r.data.accountsTouched} account(s).${r.data.unmatchedCodes?.length ? `\nUnmatched codes (in "IMPORT" section): ${r.data.unmatchedCodes.join(', ')}` : ''}`);
      onPushed?.(r.data);
      setPreview(null); setFile(null); setOverrides({});
    } catch (e: any) { setError(e.response?.data?.message || 'Push failed.'); }
    finally { setBusy(null); }
  };

  return (
    <div className={initialFile ? 'border-t border-slate-100 pt-3 mt-3' : 'rounded-2xl border border-slate-200 bg-white p-4'}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-600 uppercase flex items-center gap-1.5">
          <Sparkles size={13} className="text-violet-500" /> AI mapping review{initialFile ? ` — ${initialFile.name}` : ''}
        </h4>
        {onClose && <button onClick={onClose} className="text-gray-300 hover:text-gray-500"><X size={15} /></button>}
      </div>
      {!initialFile && (
        <p className="text-[11px] text-gray-400 mb-3">
          Upload an MMB export (.xml/.csv). The AI suggests a Master CoA account + VAT treatment per line, grounded in this
          project&apos;s jurisdiction rules. Nothing touches the budget until you confirm — pushing branches the active version
          into a new working copy.
        </p>
      )}

      {/* Step 1: choose + analyze (standalone mode only — embedded mode auto-analyzes) */}
      {!preview && !initialFile && (
        <div className="flex items-center gap-2">
          <input type="file" accept=".xml,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} className="text-xs" />
          <Btn variant="primary" onClick={() => analyze()} disabled={!file || !!busy}>
            {busy === 'analyze' ? <><Loader2 size={13} className="animate-spin" /> Analyzing…</> : <><Sparkles size={13} /> Analyze with AI</>}
          </Btn>
        </div>
      )}
      {!preview && initialFile && busy === 'analyze' && (
        <p className="text-xs text-gray-400 flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> Analyzing {initialFile.name} with AI…</p>
      )}

      {error && <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mt-2">{error}</div>}

      {/* Step 2: review table */}
      {preview && (
        <>
          <div className="text-[11px] text-gray-500 mb-2">
            <b>{preview.fileName}</b> · {preview.lines.length} lines parsed · {preview.ai.mapped} AI-mapped
            {preview.ai.rejected?.length ? <span className="text-amber-600"> · {preview.ai.rejected.length} need manual mapping</span> : null}
          </div>
          <div className="overflow-x-auto max-h-[28rem] overflow-y-auto border border-gray-100 rounded-lg">
            <table className="w-full text-xs">
              <thead className="sticky top-0">
                <tr className="bg-gray-50 text-slate-400 text-[11px] uppercase tracking-wide border-b border-slate-200">
                  <th className="text-left px-3 py-2">Movie Magic line</th>
                  <th className="text-left px-3 py-2">Master account / VAT</th>
                  <th className="text-left px-3 py-2 w-36">AI confidence</th>
                </tr>
              </thead>
              <tbody>
                {preview.lines.map((l) => {
                  const sug = byLine.get(l.originalLineId);
                  const problem = rejectedBy.get(l.originalLineId);
                  const code = codeFor(l.originalLineId);
                  const conf = sug?.confidenceScore ?? 0;
                  const isOverridden = overrides[l.originalLineId] != null && overrides[l.originalLineId] !== sug?.suggestedMasterCode;
                  return (
                    <tr key={l.originalLineId} className="border-t border-slate-100 align-top">
                      {/* Left: original import data */}
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-800">{l.description}</div>
                        <div className="text-[10px] text-gray-400">
                          MM {l.externalCode || '—'} · {l.sectionCode} {l.sectionTitle} · {fmt(l.total)}
                        </div>
                      </td>
                      {/* Middle: suggested code + manual override + VAT */}
                      <td className="px-3 py-2">
                        <select value={code} onChange={(e) => setOverrides((o) => ({ ...o, [l.originalLineId]: e.target.value }))}
                          className={cn('input text-xs py-1 w-full max-w-[16rem]', !code && 'border-amber-300 bg-amber-50')}>
                          <option value="">— select account —</option>
                          {preview.masterAccounts.map((a) => (
                            <option key={a.code} value={a.code}>{a.code} — {a.title || ''}</option>
                          ))}
                        </select>
                        <div className="text-[10px] mt-0.5 flex items-center gap-1.5 flex-wrap">
                          {sug && <span className="text-gray-400">{sug.vatTreatment}</span>}
                          {isOverridden && <span className="text-sky-600 font-semibold">manual override</span>}
                          {problem && <span className="text-amber-600">{problem}</span>}
                        </div>
                        {sug?.reasoning && <div className="text-[10px] text-gray-400 italic mt-0.5">{sug.reasoning}</div>}
                      </td>
                      {/* Right: confidence indicator (red below 70%) */}
                      <td className="px-3 py-2">
                        {sug ? (
                          <div>
                            <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                              <div className={cn('h-full rounded-full', conf < CONFIDENCE_RED ? 'bg-red-500' : 'bg-green-500')}
                                style={{ width: `${Math.round(conf * 100)}%` }} />
                            </div>
                            <div className={cn('text-[10px] mt-0.5 font-semibold flex items-center gap-1', conf < CONFIDENCE_RED ? 'text-red-600' : 'text-green-600')}>
                              {conf < CONFIDENCE_RED ? <AlertTriangle size={10} /> : <CheckCircle size={10} />} {Math.round(conf * 100)}%
                            </div>
                          </div>
                        ) : (
                          <span className="text-[10px] text-amber-600 flex items-center gap-1"><AlertTriangle size={10} /> no suggestion</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-3">
            <Btn variant="secondary" onClick={() => { setPreview(null); setOverrides({}); if (initialFile) onClose?.(); }}>{initialFile ? 'Cancel' : 'Start over'}</Btn>
            <Btn variant="primary" onClick={push} disabled={!readyLines.length || !!busy}>
              {busy === 'push'
                ? <><Loader2 size={13} className="animate-spin" /> Pushing…</>
                : <><GitBranch size={13} /> Confirm and Push to Budget ({readyLines.length})</>}
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}
