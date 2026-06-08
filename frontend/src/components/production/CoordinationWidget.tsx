'use client';

import Link from 'next/link';
import { FileSignature, ClipboardList, MapPin, Users, Calendar, ArrowRight } from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';

const DEAL_CLS: Record<string, string> = { NOT_SENT: 'bg-gray-100 text-gray-500', SENT: 'bg-amber-100 text-amber-700', SIGNED: 'bg-green-100 text-green-700' };
const NDA_CLS: Record<string, string> = { NOT_REQUIRED: 'bg-gray-100 text-gray-400', SENT: 'bg-amber-100 text-amber-700', SIGNED: 'bg-green-100 text-green-700' };

/**
 * 2nd AD / Production Coordinator widget: outstanding paperwork (unsigned deal memos / NDAs)
 * and the latest call sheet's distribution status. Data from getDashboard(role) → coordination.
 */
export default function CoordinationWidget({ coordination }: { coordination: any }) {
  if (!coordination) return null;
  const counts = coordination.counts || { dealMemoNotSent: 0, dealMemoSent: 0, ndaUnsigned: 0 };
  const unsigned: any[] = coordination.unsigned || [];
  const cs = coordination.callSheet;

  return (
    <div className="space-y-4 mb-6">
      {/* Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card"><p className="text-xs text-gray-400">Deal memos not sent</p><p className="text-lg font-bold text-gray-700">{counts.dealMemoNotSent}</p></div>
        <div className="card"><p className="text-xs text-gray-400">Deal memos awaiting signature</p><p className="text-lg font-bold text-amber-600">{counts.dealMemoSent}</p></div>
        <div className="card"><p className="text-xs text-gray-400">NDAs awaiting signature</p><p className="text-lg font-bold text-amber-600">{counts.ndaUnsigned}</p></div>
        <div className="card"><p className="text-xs text-gray-400">People outstanding</p><p className="text-lg font-bold text-gray-900">{coordination.unsignedCount}</p></div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Outstanding paperwork */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-1.5"><FileSignature size={13} className="text-gray-400" /><h3 className="text-sm font-semibold text-gray-700">Outstanding deal memos & NDAs</h3></div>
          {unsigned.length === 0 ? <div className="p-8 text-center text-gray-400 text-sm">All paperwork is signed. 🎉</div> : (
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white"><tr className="text-[10px] font-semibold text-gray-400 uppercase border-b border-gray-100"><th className="px-4 py-2 text-left">Crew</th><th className="px-3 py-2 text-left">Deal memo</th><th className="px-3 py-2 text-left">NDA</th></tr></thead>
                <tbody>
                  {unsigned.map(c => (
                    <tr key={c.id} className="border-b border-gray-50">
                      <td className="px-4 py-2"><Link href={`/production/projects/${c.project?.id}?tab=crew`} className="text-gray-800 hover:text-brand-600 font-medium">{c.name}</Link><div className="text-[10px] text-gray-400">{[c.roleTitle || c.department, c.project?.projectNumber].filter(Boolean).join(' · ')}</div></td>
                      <td className="px-3 py-2"><span className={cn('badge text-[10px]', DEAL_CLS[c.dealMemoStatus] || 'bg-gray-100')}>{(c.dealMemoStatus || '').replace(/_/g, ' ')}</span></td>
                      <td className="px-3 py-2">{c.ndaStatus === 'SENT' ? <span className={cn('badge text-[10px]', NDA_CLS.SENT)}>sent</span> : <span className="text-gray-300 text-xs">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Latest call sheet status */}
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-1.5"><ClipboardList size={13} className="text-gray-400" /><h3 className="text-sm font-semibold text-gray-700">Latest call sheet</h3></div>
          {!cs ? <div className="p-8 text-center text-gray-400 text-sm">No call sheets yet.</div> : (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-800">Day {cs.dayNumber}{cs.totalDays ? ` of ${cs.totalDays}` : ''} · {cs.project?.title}</div>
                  <div className="text-[11px] text-gray-400 flex items-center gap-2">{cs.shootDate && <span className="inline-flex items-center gap-1"><Calendar size={11} />{formatDate(cs.shootDate)}</span>}{cs.location && <span className="inline-flex items-center gap-1"><MapPin size={11} />{cs.location}</span>}</div>
                </div>
                <span className={cn('badge text-[11px]', cs.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>{cs.published ? 'Published' : 'Draft'}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-center"><div className="text-base font-bold text-gray-800">{cs.crewCount}</div><div className="text-[10px] text-gray-400 flex items-center justify-center gap-1"><Users size={10} /> crew calls</div></div>
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-center"><div className="text-base font-bold text-gray-800">{cs.castCount}</div><div className="text-[10px] text-gray-400">cast calls</div></div>
                <div className="rounded-lg bg-gray-50 px-3 py-2 text-center"><div className="text-base font-bold text-gray-800">{cs.backgroundCount}</div><div className="text-[10px] text-gray-400">background</div></div>
              </div>
              <Link href={`/print/callsheet/${cs.id}`} target="_blank" className="text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 text-xs">Open call sheet <ArrowRight size={12} /></Link>
              {!cs.published && <p className="text-[11px] text-amber-600">This call sheet is still a draft — publish it to distribute to crew.</p>}
            </div>
          )}
        </div>
      </div>
      <p className="text-[11px] text-gray-400">Read-receipt tracking requires email delivery logging (not yet enabled); distribution status reflects publish state and call counts.</p>
    </div>
  );
}
