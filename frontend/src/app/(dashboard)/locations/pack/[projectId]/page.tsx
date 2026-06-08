'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { assessmentApi, assetUrl } from '@/lib/api';
import { Printer, MapPin, ShieldAlert, FileText, Star } from 'lucide-react';

const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString() : '—');
const riskCls = (s: number) => (s >= 15 ? 'bg-red-100 text-red-700' : s >= 8 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700');
const REC_CLS: Record<string, string> = { RECOMMENDED: 'bg-green-100 text-green-700', ACCEPTABLE: 'bg-amber-100 text-amber-700', NOT_RECOMMENDED: 'bg-red-100 text-red-700' };

export default function LocationPackPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    assessmentApi?.pack
      ? assessmentApi.pack(projectId).then((r) => setData(r.data)).catch((e) => setErr(e?.response?.data?.message || e?.message || 'Failed to load pack'))
      : setErr('Module not loaded — restart the dev server (clear the .next cache).');
  }, [projectId]);

  if (err) return <div className="p-6 text-sm text-red-600">Couldn&apos;t load the location pack: {err}</div>;
  if (!data) return <div className="p-6 text-sm text-gray-400">Loading location pack…</div>;
  const { project, locations, generatedAt } = data;

  return (
    <div className="max-w-3xl mx-auto p-6 print:p-0">
      <style>{`@media print { .no-print { display:none } @page { margin: 14mm } } `}</style>

      <div className="flex items-center justify-between mb-6 no-print">
        <h1 className="text-xl font-semibold">Location Pack</h1>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 bg-[#0f172a] text-white px-4 py-2 rounded-lg text-sm"><Printer size={15} /> Print / Save PDF</button>
      </div>

      <div className="border-b pb-4 mb-6">
        <h2 className="text-2xl font-bold">{project?.title || 'Project'}</h2>
        <p className="text-sm text-gray-500">Location pack · {locations.length} location{locations.length !== 1 ? 's' : ''} · generated {fmtDate(generatedAt)}</p>
      </div>

      {locations.length === 0 && <p className="text-gray-400">No locations in this project yet.</p>}

      {locations.map((l: any, i: number) => {
        const m = l.masterLocation;
        const media = m?.media || [];
        const ev = l.evaluations?.[0];
        return (
          <section key={l.id} className="mb-8 break-inside-avoid">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2"><span className="text-gray-400">{i + 1}.</span> {l.name}</h3>
                <p className="text-sm text-gray-500">{[l.area, l.emirate, l.country].filter(Boolean).join(', ')} · {l.type} · {l.status}</p>
              </div>
              {ev && <span className={`text-xs px-2 py-1 rounded ${REC_CLS[ev.recommendation]}`}>{ev.recommendation.replace('_', ' ')} · {Number(ev.weightedScore).toFixed(1)}/5</span>}
            </div>

            {media.length > 0 && (
              <div className="flex gap-2 mt-3 overflow-x-auto">
                {media.slice(0, 4).map((md: any) => <img key={md.id} src={assetUrl(md.url)} alt="" onError={(e) => { const t = e.currentTarget as any; if (!t.dataset.fb) { t.dataset.fb = '1'; t.src = `https://picsum.photos/seed/${encodeURIComponent(md.id)}/400/280`; } }} className="h-28 rounded object-cover" />)}
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 text-sm">
              {l.fullAddress && <Field label="Address" value={l.fullAddress} span />}
              {l.scenes && <Field label="Scenes" value={l.scenes} />}
              {(l.shootStart || l.shootEnd) && <Field label="Shoot" value={`${fmtDate(l.shootStart)} – ${fmtDate(l.shootEnd)}`} />}
              {l.googleMapsUrl && <Field label="Map" value={l.googleMapsUrl} />}
              {l.ownerContactName && <Field label="Owner" value={`${l.ownerContactName}${l.ownerPhone ? ` · ${l.ownerPhone}` : ''}`} />}
              {l.locationFeePerDay && <Field label="Fee/day" value={`${l.currency} ${Number(l.locationFeePerDay).toLocaleString()}`} />}
              {l.parkingNotes && <Field label="Parking" value={l.parkingNotes} span />}
              {l.accessNotes && <Field label="Access" value={l.accessNotes} span />}
              {l.nearestHospitalName && <Field label="Nearest hospital" value={`${l.nearestHospitalName}${l.nearestHospitalPhone ? ` · ${l.nearestHospitalPhone}` : ''}`} span />}
            </div>

            {l.permits?.length > 0 && (
              <div className="mt-3">
                <h4 className="text-xs font-semibold uppercase text-gray-400 mb-1 flex items-center gap-1"><FileText size={12} /> Permits</h4>
                <table className="w-full text-sm border-t">
                  <tbody>
                    {l.permits.map((p: any) => (
                      <tr key={p.id} className="border-b">
                        <td className="py-1 font-medium">{p.type}</td>
                        <td>{p.authority || '—'}</td>
                        <td>{p.status.replace('_', ' ')}</td>
                        <td className="text-right">{p.expiryDate ? `exp ${fmtDate(p.expiryDate)}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {l.risks?.length > 0 && (
              <div className="mt-3">
                <h4 className="text-xs font-semibold uppercase text-gray-400 mb-1 flex items-center gap-1"><ShieldAlert size={12} /> Risk register</h4>
                <div className="space-y-1">
                  {l.risks.map((r: any) => (
                    <div key={r.id} className="text-sm flex items-start gap-2">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded shrink-0 ${riskCls(r.riskScore)}`}>{r.riskScore}</span>
                      <span><b>{r.category}:</b> {r.hazard}{r.mitigation ? ` — ${r.mitigation}` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Field({ label, value, span }: { label: string; value: any; span?: boolean }) {
  return <div className={span ? 'col-span-2' : ''}><span className="text-gray-400">{label}: </span><span className="text-gray-800">{value}</span></div>;
}
