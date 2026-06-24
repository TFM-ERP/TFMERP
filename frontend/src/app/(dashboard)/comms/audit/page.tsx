'use client';

/**
 * SYS-09 — Comms audit vault (admin-only).
 * Deleted/edited messages are never really gone — the original body, edit-version trail,
 * and attachments are retained. This page lists them and shows the full record; opening a
 * record is itself logged (AuditAccessLog), so there's a trail of who looked at what.
 * Backend gates this to production-level-3 admins; non-admins get a 403 → lock screen.
 */
import { useEffect, useState, useCallback } from 'react';
import { commsApi, assetUrl } from '@/lib/api';
import {
  ShieldCheck, Lock, Trash2, Clock, Hash, History, Loader2, FileAudio, FileText, Eye,
} from 'lucide-react';

const card: React.CSSProperties = { background: 'var(--surface-1)', border: '1px solid var(--border-1)', borderRadius: 16 };
const fmt = (d?: string) => (d ? new Date(d).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const short = (s?: string) => (s ? s.slice(0, 8) : '—');

export default function AuditVaultPage() {
  const [list, setList] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [accessLog, setAccessLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setList(await commsApi.vaultDeleted()); }
    catch (e: any) { if (e?.response?.status === 403) setDenied(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const open = async (m: any) => {
    setSel({ ...m, _loading: true });
    try {
      const full = await commsApi.vaultView(m.id);     // logs the access server-side
      setSel(full);
      commsApi.vaultLog(m.id).then(setAccessLog).catch(() => setAccessLog([]));
    } catch { setSel({ ...m, _error: true }); }
  };

  if (denied) {
    return (
      <div className="p-6" style={{ color: 'var(--text-1)' }}>
        <div className="max-w-md mx-auto text-center" style={{ ...card, padding: 40, marginTop: 60 }}>
          <Lock size={28} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
          <h1 className="text-lg font-semibold">Audit vault is restricted</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-3)' }}>This area is limited to production administrators. Your access attempt is logged.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6" style={{ color: 'var(--text-1)' }}>
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)' }}>
            <ShieldCheck size={20} />
          </div>
          <div className="flex-1">
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.18em', color: 'var(--gold)', textTransform: 'uppercase' }}>Comms · Admin</div>
            <h1 className="text-2xl font-semibold leading-tight">Audit vault</h1>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>Deleted and edited messages, retained in full. Every record you open is logged.</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16"><Loader2 className="animate-spin mx-auto" style={{ color: 'var(--text-3)' }} /></div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0,380px) 1fr' }}>
            {/* Deleted list */}
            <div style={{ ...card, overflow: 'hidden' }}>
              <div className="px-4 py-3 text-sm font-semibold flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-1)' }}>
                <Trash2 size={14} style={{ color: 'var(--danger)' }} /> Deleted messages ({list.length})
              </div>
              <div className="max-h-[70vh] overflow-y-auto">
                {list.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-3)' }}>Nothing deleted — the vault is empty.</div>
                ) : list.map((m) => (
                  <button key={m.id} onClick={() => open(m)}
                    className="w-full text-start px-4 py-3"
                    style={{ borderBottom: '1px solid var(--border-1)', background: sel?.id === m.id ? 'var(--surface-2)' : 'transparent', borderLeft: `2px solid ${sel?.id === m.id ? 'var(--gold)' : 'transparent'}` }}>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium truncate flex-1" style={{ color: 'var(--text-2)' }}>{m.channel?.title || 'channel'}</span>
                      <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{fmt(m.deletedAt)}</span>
                    </div>
                    <div className="text-sm truncate" style={{ color: 'var(--text-1)' }}>
                      {m.type === 'VOICE' ? '🎙 voice note' : (m.body || <span style={{ color: 'var(--text-3)' }}>(no text)</span>)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail */}
            <div>
              {!sel ? (
                <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>Select a deleted message to inspect its full retained record.</div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div style={{ ...card, padding: 18 }}>
                    <div className="flex items-center gap-2 mb-2">
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', background: 'var(--surface-2)', borderRadius: 999, padding: '2px 10px' }}>{sel.type || 'TEXT'}</span>
                      <span className="text-xs" style={{ color: 'var(--text-3)' }}>in {sel.channel?.title || 'channel'}</span>
                    </div>
                    <div className="text-[15px]" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {sel._loading ? <Loader2 className="animate-spin" size={16} style={{ color: 'var(--text-3)' }} />
                        : sel.type === 'VOICE' && sel.attachments?.[0] ? <audio controls src={assetUrl(sel.attachments[0].sharedPath)} style={{ height: 36 }} />
                        : (sel.body || <span style={{ color: 'var(--text-3)' }}>(no text content)</span>)}
                    </div>
                    <div className="grid gap-2 mt-4 text-xs" style={{ gridTemplateColumns: '1fr 1fr', color: 'var(--text-3)' }}>
                      <div><span style={{ color: 'var(--text-2)' }}>Author</span><br />{short(sel.authorId)}</div>
                      <div><span style={{ color: 'var(--text-2)' }}>Deleted by</span><br />{short(sel.deletedById) || '—'}</div>
                      <div className="inline-flex items-start gap-1"><Clock size={12} className="mt-0.5" /><span>created {fmt(sel.createdAt)}</span></div>
                      <div className="inline-flex items-start gap-1"><Trash2 size={12} className="mt-0.5" /><span>deleted {fmt(sel.deletedAt)}</span></div>
                    </div>
                    {sel.contentHash && (
                      <div className="mt-3 text-[11px] inline-flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
                        <Hash size={12} /> <span style={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{sel.contentHash}</span>
                      </div>
                    )}
                  </div>

                  {/* Edit version trail */}
                  {sel.versions?.length > 0 && (
                    <div style={{ ...card, padding: 18 }}>
                      <div className="font-semibold mb-2 flex items-center gap-2"><History size={15} style={{ color: 'var(--gold)' }} /> Edit history ({sel.versions.length})</div>
                      {sel.versions.map((v: any) => (
                        <div key={v.id} className="flex gap-3 text-sm" style={{ padding: '8px 0', borderTop: '1px solid var(--border-1)' }}>
                          <span style={{ width: 24, color: 'var(--text-3)', fontWeight: 600 }}>v{v.version}</span>
                          <span className="flex-1" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v.body || <span style={{ color: 'var(--text-3)' }}>(empty)</span>}</span>
                          <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{fmt(v.editedAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Attachments */}
                  {sel.attachments?.length > 0 && (
                    <div style={{ ...card, padding: 18 }}>
                      <div className="font-semibold mb-2">Attachments ({sel.attachments.length})</div>
                      {sel.attachments.map((a: any) => (
                        <div key={a.id} className="flex items-center gap-2 text-sm" style={{ padding: '6px 0' }}>
                          {a.kind === 'AUDIO' ? <FileAudio size={15} style={{ color: 'var(--text-3)' }} /> : <FileText size={15} style={{ color: 'var(--text-3)' }} />}
                          <a href={assetUrl(a.originalPath || a.sharedPath)} target="_blank" rel="noreferrer" style={{ color: 'var(--accent, var(--gold))' }}>{a.kind.toLowerCase()} · {short(a.contentHash) || 'file'}</a>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Who has viewed this record */}
                  {accessLog.length > 0 && (
                    <div style={{ ...card, padding: 18 }}>
                      <div className="font-semibold mb-2 flex items-center gap-2"><Eye size={15} style={{ color: 'var(--text-3)' }} /> Access log</div>
                      {accessLog.map((l: any) => (
                        <div key={l.id} className="flex items-center gap-2 text-xs" style={{ padding: '5px 0', color: 'var(--text-3)' }}>
                          <span style={{ color: 'var(--text-2)' }}>{short(l.adminId)}</span> {l.action.toLowerCase()} · {fmt(l.at)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
