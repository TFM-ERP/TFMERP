'use client';

import { useEffect, useState } from 'react';
import { productionApi } from '@/lib/api';
import { FileText, Wand2, Film, Layers, Compass, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** TVC profile — a compact "creative spine" indicator: Brief → Treatment → Script → Deliverables → on-brief %. */
export default function CreativeFlowStrip({ projectId }: { projectId: string }) {
  const [brief, setBrief] = useState<any>(null); const [align, setAlign] = useState<any>(null); const [dels, setDels] = useState<any[]>([]);
  useEffect(() => {
    productionApi.brief.list(projectId).then((r: any) => { const list = Array.isArray(r.data) ? r.data : []; setBrief(list.find((b: any) => b.status !== 'RAW') || list[0] || null); }).catch(() => { });
    productionApi.brief.alignment(projectId).then((r: any) => setAlign(r.data)).catch(() => { });
    productionApi.deliverables.list(projectId).then((r: any) => setDels(Array.isArray(r.data) ? r.data : [])).catch(() => { });
  }, [projectId]);

  if (!brief && (!dels || dels.length === 0) && !align?.hasBrief) return null;
  const hasBrief = !!brief; const hasTreat = !!(brief?.treatmentDraft); const hasScript = !!(brief?.scriptDraft) || !!align?.hasScript;
  const delivered = dels.filter(d => d.pipelineStatus === 'DELIVERED').length;
  const pct = align?.hasBrief ? align.pct : null;
  const Step = ({ on, label, icon: Icon, sub }: { on: boolean; label: string; icon: any; sub?: string }) => (
    <div className="flex items-center gap-1.5">
      <span className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0', on ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400')}>{on ? <Check size={13} /> : <Icon size={12} />}</span>
      <div className="leading-tight"><div className={cn('text-[11px] font-semibold', on ? 'text-slate-700' : 'text-slate-400')}>{label}</div>{sub && <div className="text-[9px] text-slate-400">{sub}</div>}</div>
    </div>
  );
  return (
    <div className="son-card" style={{ padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Creative flow</span>
      <Step on={hasBrief} label="Brief" icon={FileText} sub={brief?.status ? String(brief.status).toLowerCase() : undefined} />
      <span className="text-slate-300">→</span>
      <Step on={hasTreat} label="Treatment" icon={Wand2} />
      <span className="text-slate-300">→</span>
      <Step on={hasScript} label="Script" icon={Film} />
      <span className="text-slate-300">→</span>
      <Step on={dels.length > 0} label="Deliverables" icon={Layers} sub={dels.length ? `${delivered}/${dels.length} delivered` : undefined} />
      <span className="flex-1" />
      {pct != null && <span className={cn('inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full', pct >= 80 ? 'bg-emerald-100 text-emerald-700' : pct >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700')}><Compass size={12} /> {pct}% on-brief</span>}
    </div>
  );
}
