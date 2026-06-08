'use client';

import { useEffect, useState, useCallback } from 'react';
import { Plus, Trash2, Save, Printer, RefreshCw, ChevronUp, ChevronDown, Film } from 'lucide-react';
import { productionApi } from '@/lib/api';

type Line = { role: string; name: string };
type Block = { heading: string; lines: Line[] };

export default function EndCreditsPanel({ projectId }: { projectId: string }) {
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generated, setGenerated] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await productionApi.credits.get(projectId);
      setTitle(r.data.title || '');
      setBlocks((r.data.blocks as Block[]) || []);
      setGenerated(!!r.data._generated);
    } finally { setLoading(false); }
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try { await productionApi.credits.save(projectId, { title, blocks }); setGenerated(false); }
    finally { setSaving(false); }
  };

  const regenerate = async () => {
    if (!confirm('Rebuild the Crew block from current assignments? Your Cast and custom blocks are kept.')) return;
    const r = await productionApi.credits.regenerate(projectId);
    setTitle(r.data.title || ''); setBlocks((r.data.blocks as Block[]) || []); setGenerated(false);
  };

  const print = async () => { await save(); window.open(`/print/credits/${projectId}`, '_blank'); };

  // mutators
  const setBlock = (bi: number, patch: Partial<Block>) => setBlocks(bs => bs.map((b, i) => i === bi ? { ...b, ...patch } : b));
  const setLine = (bi: number, li: number, patch: Partial<Line>) =>
    setBlocks(bs => bs.map((b, i) => i === bi ? { ...b, lines: b.lines.map((l, j) => j === li ? { ...l, ...patch } : l) } : b));
  const addLine = (bi: number) => setBlocks(bs => bs.map((b, i) => i === bi ? { ...b, lines: [...b.lines, { role: '', name: '' }] } : b));
  const delLine = (bi: number, li: number) => setBlocks(bs => bs.map((b, i) => i === bi ? { ...b, lines: b.lines.filter((_, j) => j !== li) } : b));
  const addBlock = () => setBlocks(bs => [...bs, { heading: 'New Section', lines: [] }]);
  const delBlock = (bi: number) => setBlocks(bs => bs.filter((_, i) => i !== bi));
  const moveBlock = (bi: number, dir: -1 | 1) => setBlocks(bs => {
    const j = bi + dir; if (j < 0 || j >= bs.length) return bs;
    const copy = [...bs]; [copy[bi], copy[j]] = [copy[j], copy[bi]]; return copy;
  });

  if (loading) return <div className="card p-10 text-center text-gray-400 text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">End Credits</h3>
          <p className="text-xs text-gray-400">{generated ? 'Auto-generated from crew — edit then save.' : 'Edit roles, names and sections; export the credit roll.'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={regenerate} className="btn btn-secondary text-xs py-1.5 px-2"><RefreshCw size={12} className="mr-1" /> Regenerate crew</button>
          <button onClick={print} className="btn btn-secondary text-xs py-1.5 px-2"><Printer size={12} className="mr-1" /> Export roll</button>
          <button onClick={save} disabled={saving} className="btn btn-primary text-xs py-1.5 px-3"><Save size={12} className="mr-1" /> {saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>

      <div className="card">
        <label className="label text-xs">Title card</label>
        <input className="input w-full" value={title} onChange={e => setTitle(e.target.value)} placeholder="Film / project title" />
      </div>

      {blocks.map((b, bi) => (
        <div key={bi} className="card">
          <div className="flex items-center gap-2 mb-3">
            <input className="input text-sm font-semibold flex-1" value={b.heading} onChange={e => setBlock(bi, { heading: e.target.value })} placeholder="Section heading" />
            <button onClick={() => moveBlock(bi, -1)} className="text-gray-300 hover:text-gray-600"><ChevronUp size={15} /></button>
            <button onClick={() => moveBlock(bi, 1)} className="text-gray-300 hover:text-gray-600"><ChevronDown size={15} /></button>
            <button onClick={() => delBlock(bi)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
          </div>
          <div className="space-y-1.5">
            {b.lines.map((l, li) => (
              <div key={li} className="grid grid-cols-[1fr_1fr_28px] gap-2 items-center">
                <input className="input text-sm h-8" value={l.role} onChange={e => setLine(bi, li, { role: e.target.value })} placeholder="Role / title" />
                <input className="input text-sm h-8" value={l.name} onChange={e => setLine(bi, li, { name: e.target.value })} placeholder="Name" />
                <button onClick={() => delLine(bi, li)} className="text-gray-300 hover:text-red-500"><Trash2 size={12} /></button>
              </div>
            ))}
            {b.lines.length === 0 && <p className="text-xs text-gray-400 py-1">No entries.</p>}
          </div>
          <button onClick={() => addLine(bi)} className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1 mt-2"><Plus size={11} /> Add credit</button>
        </div>
      ))}

      <button onClick={addBlock} className="btn btn-secondary text-sm w-full"><Plus size={14} className="mr-1" /> Add section</button>
    </div>
  );
}
