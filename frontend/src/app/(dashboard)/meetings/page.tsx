'use client';

/**
 * SYS-08 — Meetings page (design → code).
 * Lists meetings and shows a detail with attendees, time-boxed agenda, minutes and
 * action items, hitting the new /meetings API. Styled on the global Graphite & Gold
 * tokens (var(--surface-*) / --text-* / --gold) so it matches the Figma design in
 * both light and dark.
 */
import { useEffect, useState, useCallback } from 'react';
import { meetingsApi } from '@/lib/api';
import { Plus, Calendar, Clock, MapPin, Users, CheckCircle2, Circle, Loader2, Repeat } from 'lucide-react';

const TYPE_LABEL: Record<string, string> = {
  PRE_PRODUCTION: 'Pre-production', PRODUCTION: 'Production', DEPARTMENT: 'Department',
  TONE: 'Tone', CONCEPT: 'Concept', SAFETY: 'Safety', TECH_RECCE: 'Tech recce', WRAP: 'Wrap', OTHER: 'Other',
};
const KIND_TONE: Record<string, string> = { INFO: 'var(--text-3)', ACTION: 'var(--gold)', DISCUSSION: 'var(--text-2)' };

const card: React.CSSProperties = {
  background: 'var(--surface-1)', border: '1px solid var(--border-1)', borderRadius: 18,
};
const fmt = (d?: string) => (d ? new Date(d).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--text-2)', background: 'var(--surface-2)', borderRadius: 999, padding: '3px 10px' }}>
      {color && <span style={{ width: 7, height: 7, borderRadius: 999, background: color }} />}
      {children}
    </span>
  );
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<any>({ title: '', type: 'PRODUCTION', startsAt: '', room: '' });
  const [newAction, setNewAction] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { setMeetings(await meetingsApi.list()); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = async (id: string) => setSel(await meetingsApi.get(id));

  const create = async () => {
    if (!form.title || !form.startsAt) return;
    const m = await meetingsApi.create(form);
    setCreating(false); setForm({ title: '', type: 'PRODUCTION', startsAt: '', room: '' });
    await load(); open(m.id);
  };

  const toggleAction = async (a: any) => {
    const status = a.status === 'DONE' ? 'OPEN' : 'DONE';
    await meetingsApi.updateAction(a.id, { status });
    open(sel.id);
  };

  const addAction = async () => {
    if (!newAction.trim()) return;
    await meetingsApi.addAction(sel.id, { title: newAction.trim(), projectId: sel.projectId });
    setNewAction(''); open(sel.id);
  };

  return (
    <div className="p-6" style={{ color: 'var(--text-1)' }}>
      <div className="max-w-[1100px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">Meetings</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>Schedule, agenda, minutes and action items.</p>
          </div>
          <button onClick={() => setCreating((v) => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--gold)', color: '#161C28', borderRadius: 12, padding: '10px 16px', fontSize: 14, fontWeight: 600 }}>
            <Plus size={16} /> New meeting
          </button>
        </div>

        {/* Create form */}
        {creating && (
          <div style={{ ...card, padding: 16 }} className="mb-5">
            <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 180px 200px auto' }}>
              <input placeholder="Meeting title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text-1)', fontSize: 14 }} />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text-1)', fontSize: 14 }}>
                {Object.keys(TYPE_LABEL).map((k) => <option key={k} value={k}>{TYPE_LABEL[k]}</option>)}
              </select>
              <input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text-1)', fontSize: 14 }} />
              <div className="flex gap-2">
                <input placeholder="Room" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })}
                  style={{ width: 110, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text-1)', fontSize: 14 }} />
                <button onClick={create} style={{ background: 'var(--gold)', color: '#161C28', borderRadius: 10, padding: '0 16px', fontWeight: 600 }}>Add</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16"><Loader2 className="animate-spin mx-auto" style={{ color: 'var(--text-3)' }} /></div>
        ) : (
          <div className="grid gap-5" style={{ gridTemplateColumns: 'minmax(0,360px) 1fr' }}>
            {/* List */}
            <div className="flex flex-col gap-3">
              {meetings.length === 0 && (
                <div style={{ ...card, padding: 28, textAlign: 'center' }}>
                  <Calendar size={26} style={{ color: 'var(--text-3)', margin: '0 auto 10px' }} />
                  <div className="font-medium">No meetings yet</div>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>Create one with “New meeting”.</p>
                </div>
              )}
              {meetings.map((m) => (
                <button key={m.id} onClick={() => open(m.id)}
                  style={{ ...card, padding: 14, textAlign: 'start', borderColor: sel?.id === m.id ? 'var(--gold)' : 'var(--border-1)' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold" style={{ flex: 1 }}>{m.title}</span>
                    <Chip color="var(--gold)">{TYPE_LABEL[m.type] || m.type}</Chip>
                  </div>
                  <div className="text-sm flex items-center gap-3 flex-wrap" style={{ color: 'var(--text-3)' }}>
                    <span className="inline-flex items-center gap-1"><Clock size={13} /> {fmt(m.startsAt)}</span>
                    {m.room && <span className="inline-flex items-center gap-1"><MapPin size={13} /> {m.room}</span>}
                    <span className="inline-flex items-center gap-1"><Users size={13} /> {m._count?.attendees ?? 0}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Detail */}
            <div>
              {!sel ? (
                <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Select a meeting to see its agenda and actions.</div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Detail header */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', color: 'var(--gold)', textTransform: 'uppercase' }}>{TYPE_LABEL[sel.type] || sel.type}</div>
                    <h2 className="text-xl font-semibold mt-0.5">{sel.title}</h2>
                    <div className="text-sm flex items-center gap-3 flex-wrap mt-1" style={{ color: 'var(--text-2)' }}>
                      <span className="inline-flex items-center gap-1"><Clock size={14} /> {fmt(sel.startsAt)}</span>
                      {sel.room && <span className="inline-flex items-center gap-1"><MapPin size={14} /> {sel.room}</span>}
                      {sel.recurrenceRule && <span className="inline-flex items-center gap-1"><Repeat size={14} /> recurring</span>}
                    </div>
                  </div>

                  {/* Attendees */}
                  {sel.attendees?.length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {sel.attendees.map((a: any) => <Chip key={a.id}>{a.name || a.role || a.userId}</Chip>)}
                    </div>
                  )}

                  {/* Agenda */}
                  <div style={{ ...card, padding: 16 }}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-semibold">Agenda</div>
                      <div className="text-sm" style={{ color: 'var(--text-3)' }}>{(sel.agenda || []).reduce((s: number, it: any) => s + (it.minutes || 0), 0)} min</div>
                    </div>
                    {(sel.agenda || []).length === 0 && <p className="text-sm" style={{ color: 'var(--text-3)' }}>No agenda items.</p>}
                    {(sel.agenda || []).map((it: any) => (
                      <div key={it.id} className="flex items-center gap-3" style={{ padding: '9px 0', borderTop: '1px solid var(--border-1)' }}>
                        {it.minutes != null && <span style={{ width: 36, fontSize: 12, fontWeight: 600, color: KIND_TONE[it.kind] || 'var(--gold)' }}>{it.minutes}m</span>}
                        <span className="flex-1 text-sm">{it.title}</span>
                        {it.presenter && <span className="text-xs" style={{ color: 'var(--text-3)' }}>{it.presenter}</span>}
                      </div>
                    ))}
                  </div>

                  {/* Action items */}
                  <div style={{ ...card, padding: 16 }}>
                    <div className="font-semibold mb-1">Action items</div>
                    {(sel.actionItems || []).map((a: any) => (
                      <div key={a.id} className="flex items-start gap-3" style={{ padding: '9px 0', borderTop: '1px solid var(--border-1)' }}>
                        <button onClick={() => toggleAction(a)} style={{ marginTop: 1, color: a.status === 'DONE' ? 'var(--ok)' : 'var(--text-3)' }}>
                          {a.status === 'DONE' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                        </button>
                        <div className="flex-1">
                          <div className="text-sm" style={{ color: a.status === 'DONE' ? 'var(--text-3)' : 'var(--text-1)' }}>{a.title}</div>
                          <div className="text-xs" style={{ color: 'var(--text-3)' }}>{[a.ownerName, a.dueAt ? `due ${new Date(a.dueAt).toLocaleDateString()}` : null].filter(Boolean).join(' · ')}</div>
                        </div>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-3">
                      <input placeholder="Assign an action item…" value={newAction} onChange={(e) => setNewAction(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addAction()}
                        style={{ flex: 1, background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text-1)', fontSize: 14 }} />
                      <button onClick={addAction} style={{ background: 'var(--gold)', color: '#161C28', borderRadius: 10, padding: '0 16px', fontWeight: 600 }}>Add</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
