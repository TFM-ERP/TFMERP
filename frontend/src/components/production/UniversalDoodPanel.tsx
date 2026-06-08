'use client';

import { useEffect, useState, useCallback } from 'react';
import { CalendarRange, RefreshCw, UploadCloud, Info } from 'lucide-react';
import { productionApi } from '@/lib/api';
import { cn } from '@/lib/utils';

const CATEGORY_LABEL: Record<string, string> = {
  CAST: 'Cast', BACKGROUND: 'Background', STUNTS: 'Stunts', VEHICLES: 'Vehicles',
  ANIMALS: 'Animals', PROPS: 'Props', SET_DRESSING: 'Set Dressing', WARDROBE: 'Wardrobe',
  MAKEUP_HAIR: 'Makeup & Hair', SFX: 'Special Effects', VFX: 'Visual Effects',
  SPECIAL_EQUIPMENT: 'Special Equipment', SOUND_MUSIC: 'Sound & Music', ART: 'Art',
  GREENERY: 'Greenery', SECURITY: 'Security', OTHER: 'Other / Additional Labor',
};

const CODE_CLS: Record<string, string> = {
  SW: 'bg-green-100 text-green-800 font-bold',
  SWF: 'bg-green-100 text-green-800 font-bold',
  W: 'bg-gray-100 text-gray-700',
  WF: 'bg-blue-100 text-blue-800 font-bold',
  H: 'bg-amber-100 text-amber-700',
  D: 'bg-red-100 text-red-600',
};

/**
 * Universal Day-Out-of-Days — dynamic, every breakdown category.
 * Computed live from strips × breakdown elements: move a scene, refresh, the
 * matrix shifts. Modular — embed in scheduling, budgeting or report views.
 */
export default function UniversalDoodPanel({ projectId, defaultCategory = 'CAST' }:
  { projectId: string; defaultCategory?: string }) {
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState(defaultCategory);
  const [dropAfter, setDropAfter] = useState(4);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [staging, setStaging] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    productionApi.scheduling.doodCategories(projectId)
      .then(r => setCategories(r.data || [])).catch(() => setCategories(Object.keys(CATEGORY_LABEL)));
  }, [projectId]);

  const load = useCallback(() => {
    setLoading(true);
    productionApi.scheduling.doodMatrix(projectId, category, dropAfter)
      .then(r => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  }, [projectId, category, dropAfter]);
  useEffect(() => { load(); }, [load]);

  const updateGlobals = async () => {
    if (!confirm('Refresh Production Globals (staging) from the current schedule?\n\nRuns the DOOD for every category and stages the totals — nothing touches any budget version until you push staging explicitly.')) return;
    setStaging(true); setBanner(null);
    try {
      const r = await productionApi.scheduling.doodToGlobals(projectId, dropAfter);
      const cats = Object.entries(r.data?.categories || {}).map(([c, t]: any) => `${CATEGORY_LABEL[c] || c}: ${t.workDays}wd`).join(' · ');
      setBanner(`Staged — shoot days ${r.data?.shootDays}; ${cats}. Push staging to a working budget to apply.`);
    } catch (e: any) { setBanner(e.response?.data?.message || 'Staging refresh failed.'); }
    finally { setStaging(false); }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div className="flex items-start gap-2">
          <CalendarRange size={16} className="text-brand-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-gray-700">Day Out of Days — all categories</h4>
            <p className="text-[11px] text-gray-400">Computed live from the stripboard. Move a scene and refresh — every category shifts with it.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select className="input text-xs h-8 w-44" value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c] || c}</option>)}
          </select>
          <label className="text-[10px] text-gray-400 flex items-center gap-1" title="Idle days from which a gap becomes Drop instead of Hold">
            Drop after
            <input type="number" min={2} className="input text-xs h-8 w-14" value={dropAfter}
              onChange={e => setDropAfter(Math.max(2, Number(e.target.value) || 4))} />
            days
          </label>
          <button onClick={load} className="btn btn-secondary text-xs p-2"><RefreshCw size={13} className={cn(loading && 'animate-spin')} /></button>
          <button onClick={updateGlobals} disabled={staging} className="btn btn-primary text-xs">
            <UploadCloud size={13} className="mr-1" /> {staging ? 'Staging…' : 'Refresh Globals'}
          </button>
        </div>
      </div>

      {banner && <div className="text-xs text-gray-700 bg-sky-50 border border-sky-100 rounded-lg px-3 py-2 mb-3">{banner}</div>}

      {loading ? (
        <div className="p-8 text-center text-gray-400 text-sm">Computing…</div>
      ) : !data || !data.rows?.length ? (
        <div className="p-8 text-center text-gray-400 text-sm flex items-center justify-center gap-1.5">
          <Info size={14} /> No scheduled {CATEGORY_LABEL[category] || category} elements — schedule scenes on the stripboard and tag elements in the breakdown.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-xs border-collapse w-full">
            <thead>
              <tr>
                <th className="sticky left-0 bg-white text-left px-2 py-1.5 text-[10px] font-semibold text-gray-400 uppercase whitespace-nowrap border-b border-gray-100 z-10">{CATEGORY_LABEL[category] || category} ({data.rows.length})</th>
                {data.days.map((d: any) => (
                  <th key={d.day} className="px-1 py-1.5 text-center text-[10px] font-semibold text-gray-400 border-b border-gray-100 min-w-9" title={d.date ? new Date(d.date).toLocaleDateString('en-GB') : ''}>
                    D{d.day}
                    {d.date && <span className="block font-normal text-[8px] text-gray-300">{new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })}</span>}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400 uppercase border-b border-gray-100 whitespace-nowrap">Work</th>
                <th className="px-2 py-1.5 text-right text-[10px] font-semibold text-gray-400 uppercase border-b border-gray-100 whitespace-nowrap">Hold</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r: any) => (
                <tr key={r.name} className="border-b border-gray-50 hover:bg-gray-50/60">
                  <td className="sticky left-0 bg-white px-2 py-1 font-medium text-gray-800 whitespace-nowrap z-10">
                    {r.name}{r.quantity > 1 && <span className="ml-1 text-[9px] text-gray-400">×{r.quantity}</span>}
                  </td>
                  {data.days.map((d: any) => {
                    const code = r.cells[d.day] || '';
                    return (
                      <td key={d.day} className="px-0.5 py-1 text-center">
                        {code && <span className={cn('inline-block min-w-7 rounded px-1 py-0.5 text-[10px]', CODE_CLS[code] || 'text-gray-400')}>{code}</span>}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1 text-right font-semibold text-gray-800">{r.totalWorkDays}</td>
                  <td className={cn('px-2 py-1 text-right', r.totalHoldDays ? 'text-amber-600 font-semibold' : 'text-gray-300')}>{r.totalHoldDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-gray-400 mt-2">
            <b>SW</b> start · <b>W</b> work · <b>WF</b> finish · <b>SWF</b> single day · <b>H</b> hold (paid idle) · <b>D</b> drop (gap ≥ {data.dropAfter} days) · {data.totals.shootDays} shoot days
          </p>
        </div>
      )}
    </div>
  );
}
