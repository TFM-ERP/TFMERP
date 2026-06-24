'use client';

/** SYS-mobile — Production switcher bottom-sheet (matches the Figma design).
 *  Trigger is a chevron next to the title; opens a sheet listing the user's productions
 *  with the active one gold-checked. Renders nothing when there's only one production. */
import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function ProductionSwitcher({ projects, value, onChange }: { projects: any[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  if (!projects || projects.length <= 1) return null;

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Switch production" className="mt-1 p-1 rounded-lg" style={{ color: 'var(--text-3)', border: '1px solid var(--border-2)' }}>
        <ChevronDown size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setOpen(false)}>
          <div className="w-full" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ background: 'var(--surface-1)', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 24, maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ width: 40, height: 4, borderRadius: 99, background: 'var(--border-2)', margin: '10px auto' }} />
              <div className="pt-2 pb-2" style={{ paddingInlineStart: 18, paddingInlineEnd: 18 }}>
                <div className="text-lg font-semibold" style={{ color: 'var(--text-1)' }}>Switch production</div>
                <div className="text-xs" style={{ color: 'var(--text-3)' }}>Productions you’re crewed on</div>
              </div>
              {projects.map((p, i) => {
                const active = p.id === value;
                return (
                  <button key={p.id} onClick={() => { onChange(p.id); setOpen(false); }}
                    className="w-full flex items-center gap-3 text-start"
                    style={{ paddingInlineStart: 18, paddingInlineEnd: 18, paddingTop: 15, paddingBottom: 15, borderTop: i ? '1px solid var(--border-1)' : 'none', background: active ? 'var(--surface-2)' : 'transparent' }}>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-medium truncate" style={{ color: 'var(--text-1)' }}>{p.title || p.projectNumber || p.id}</div>
                      <div className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{[p.projectNumber, p.status].filter(Boolean).join(' · ') || '—'}</div>
                    </div>
                    {active && <Check size={18} style={{ color: 'var(--gold)' }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
