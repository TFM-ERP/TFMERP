'use client';

/**
 * SYS-09 — Comms backbone (design → code).
 * Channels list (bulletins split from chatter) → message thread (append-only, optimistic
 * send, threaded replies, edit/delete, read receipts, @mention highlight) → PTT for walkie
 * channels. One-way broadcast channels are read-only for non-leads. Cross-channel message
 * search. Styled on the global Graphite & Gold tokens (light + dark).
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { commsApi, usersApi, productionApi, uploadFile, assetUrl } from '@/lib/api';
import { commsSocket } from '@/lib/socket';
import { toast } from 'sonner';
import {
  Send, Radio, Mic, Plus, Hash, Megaphone, MessageSquare, Search, Loader2,
  Pencil, Trash2, X, Users, Check, CheckCheck, ChevronLeft, ChevronDown, ChevronRight, Square, Reply, Lock, Receipt, FileSignature, PenLine, FileText, ExternalLink,
} from 'lucide-react';

const card: React.CSSProperties = { background: 'var(--surface-1)', border: '1px solid var(--border-1)', borderRadius: 16 };
const inputStyle: React.CSSProperties = { background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 10, padding: '10px 12px', color: 'var(--text-1)', fontSize: 14, outline: 'none' };

const scopeMeta: Record<string, { icon: any; label: string }> = {
  PROJECT: { icon: Hash, label: 'Project' }, UNIT: { icon: Hash, label: 'Unit' }, TEAM: { icon: Hash, label: 'Team' },
  DEPARTMENT: { icon: Hash, label: 'Dept' }, BUSINESS_UNIT: { icon: Hash, label: 'Business unit' }, COMPANY: { icon: Hash, label: 'Company' },
  JOB: { icon: Hash, label: 'Job' }, TRIP: { icon: Hash, label: 'Trip' }, DM: { icon: MessageSquare, label: 'Direct' },
  BROADCAST: { icon: Megaphone, label: 'Broadcast' }, PTT: { icon: Radio, label: 'Walkie' },
};
const scopeIcon = (ch: any) => (ch?.isPTT ? Radio : ch?.isBroadcast ? Megaphone : (scopeMeta[ch?.scopeType]?.icon || Hash));
const isLead = (role?: string) => role === 'OWNER' || role === 'ADMIN';

const fmtTime = (d?: string) => (d ? new Date(d).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '');
const fmtDay = (d?: string) => (d ? new Date(d).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : '');
const myId = (): string | undefined => {
  try { return JSON.parse(localStorage.getItem('tfm_user') || '{}')?.id; } catch { return undefined; }
};
// highlight @mentions inside a message body
function renderBody(body: string) {
  return String(body).split(/(@[A-Za-z0-9_]+)/g).map((p, i) =>
    /^@[A-Za-z0-9_]+$/.test(p)
      ? <span key={i} style={{ color: 'var(--gold)', fontWeight: 600 }}>{p}</span>
      : <span key={i}>{p}</span>);
}
// ENTITY_CARD messages carry JSON; parse the chat-to-ledger receipt card
function parseReceipt(body?: string | null): any {
  if (!body) return null;
  try { const o = JSON.parse(body); return o && o.kind === 'receipt' ? o : null; } catch { return null; }
}
function ReceiptCard({ rc, canApprove, onApprove, onReject, img }: { rc: any; canApprove: boolean; onApprove: () => void; onReject: () => void; img?: string }) {
  const ok = rc.status === 'APPROVED'; const done = ok || rc.status === 'REJECTED';
  return (
    <div style={{ maxWidth: 340, margin: '8px auto', border: `1px solid ${ok ? 'var(--ok)' : 'var(--border-2)'}`, borderRadius: 14, background: 'var(--surface-1)', overflow: 'hidden' }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-1)' }}>
        <Receipt size={15} style={{ color: 'var(--gold)' }} />
        <span className="text-sm font-semibold flex-1 truncate">Receipt — {rc.vendor || 'unverified vendor'}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ color: ok ? 'var(--ok)' : done ? 'var(--danger)' : 'var(--warn)' }}>
          {ok ? 'Approved' : rc.status === 'REJECTED' ? 'Rejected' : 'Pending'}
        </span>
      </div>
      <div className="flex gap-3 p-3">
        {img && <img src={assetUrl(img)} alt="receipt" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-1)' }} />}
        <div className="flex-1 text-sm" style={{ minWidth: 0 }}>
          <div className="flex justify-between gap-2"><span style={{ color: 'var(--text-3)' }}>Amount</span><span className="font-semibold">{rc.currency} {Number(rc.amount || 0).toFixed(2)}</span></div>
          <div className="flex justify-between gap-2"><span style={{ color: 'var(--text-3)' }}>VAT</span><span>{rc.currency} {Number(rc.vat || 0).toFixed(2)}</span></div>
          <div className="flex justify-between gap-2"><span style={{ color: 'var(--text-3)' }}>Code</span><span className="text-xs text-end" style={{ color: 'var(--text-2)' }}>{rc.accountCode || '—'} · {rc.accountTitle}</span></div>
        </div>
      </div>
      {!done && (canApprove ? (
        <div className="flex gap-2 px-3 pb-3">
          <button onClick={onReject} className="flex-1 text-sm py-2 rounded-lg" style={{ border: '1px solid var(--border-2)', color: 'var(--danger)' }}>Reject</button>
          <button onClick={onApprove} className="flex-1 text-sm py-2 rounded-lg font-semibold inline-flex items-center justify-center gap-1.5" style={{ background: 'var(--gold)', color: '#161C28' }}><Check size={15} /> Approve → ledger</button>
        </div>
      ) : (
        <div className="px-3 pb-3 text-xs" style={{ color: 'var(--text-3)' }}>Pending a producer's approval.</div>
      ))}
    </div>
  );
}

function parseSignoff(body?: string | null): any {
  if (!body) return null;
  try { const o = JSON.parse(body); return o && o.kind === 'signoff' ? o : null; } catch { return null; }
}
function SignoffCard({ sg, signed, onSign }: { sg: any; signed: boolean; onSign: () => void }) {
  return (
    <div style={{ maxWidth: 360, margin: '8px auto', border: `1px solid ${signed ? 'var(--ok)' : 'var(--gold)'}`, borderRadius: 14, background: 'var(--surface-1)', overflow: 'hidden' }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border-1)' }}>
        <FileSignature size={15} style={{ color: 'var(--gold)' }} />
        <span className="text-[11px] font-semibold flex-1 tracking-wide" style={{ color: 'var(--gold)' }}>READ &amp; SIGN</span>
        {signed && <span className="text-[10px] font-semibold inline-flex items-center gap-1" style={{ color: 'var(--ok)' }}><Check size={12} /> Signed</span>}
      </div>
      <div className="p-3">
        <div className="font-semibold">{sg.title}</div>
        {sg.body && <p className="text-sm mt-1" style={{ color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{sg.body}</p>}
        {!signed && (
          <button onClick={onSign} className="mt-3 w-full py-2.5 rounded-lg font-semibold inline-flex items-center justify-center gap-2" style={{ background: 'var(--gold)', color: '#161C28' }}>
            <PenLine size={15} /> Tap to sign
          </button>
        )}
      </div>
    </div>
  );
}

function parseDocument(body?: string | null): any {
  if (!body) return null;
  try { const o = JSON.parse(body); return o && o.kind === 'document' ? o : null; } catch { return null; }
}
function DocumentCard({ doc, onOpen }: { doc: any; onOpen: () => void }) {
  return (
    <div style={{ maxWidth: 320, margin: '8px auto', border: '1px solid var(--border-2)', borderRadius: 14, background: 'var(--surface-1)', overflow: 'hidden' }}>
      <div className="flex items-center gap-3 p-3">
        <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', flexShrink: 0 }}><FileText size={18} /></div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{doc.name}</div>
          <div className="text-[11px]" style={{ color: 'var(--text-3)' }}>Vault document · watermarked on open</div>
        </div>
      </div>
      <button onClick={onOpen} className="w-full py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2" style={{ background: 'var(--surface-2)', color: 'var(--gold)', borderTop: '1px solid var(--border-1)' }}>
        <ExternalLink size={14} /> Open (watermarked)
      </button>
    </div>
  );
}

// Debounced user search with a dropdown — reused by the DM picker and the search sender filter.
function UserSearch({ onPick, placeholder }: { onPick: (u: any) => void; placeholder: string }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<any[]>([]);
  useEffect(() => {
    if (!q.trim()) { setRes([]); return; }
    const t = setTimeout(() => { usersApi.list(q.trim()).then((r: any) => { const a = Array.isArray(r.data) ? r.data : (r.data?.items || r.data?.users || r.data?.data || []); setRes(a.slice(0, 8)); }).catch(() => setRes([])); }, 200);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="relative">
      <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, width: '100%' }} />
      {res.length > 0 && (
        <div className="absolute z-30 start-0 end-0 mt-1 rounded-lg overflow-hidden" style={{ background: 'var(--surface-1)', border: '1px solid var(--border-2)', maxHeight: 240, overflowY: 'auto' }}>
          {res.map((u) => (
            <button key={u.id} onClick={() => { onPick(u); setQ(''); setRes([]); }} className="w-full text-start px-3 py-2 text-sm flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-1)' }}>
              <span className="flex-1 truncate">{u.fullName || u.name || u.email}</span>
              <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{(u.role || '').replace(/_/g, ' ').toLowerCase()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommsPage() {
  const [channels, setChannels] = useState<any[]>([]);
  const [sel, setSel] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [presence, setPresence] = useState<any>(null);
  const [pendingSignoffs, setPendingSignoffs] = useState<any[]>([]);
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);
  const [creatingBlast, setCreatingBlast] = useState(false);
  const [blastForm, setBlastForm] = useState<any>({ title: '', body: '' });
  const [loadingCh, setLoadingCh] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<any>({ title: '', scopeType: 'TEAM' });
  const [ptt, setPtt] = useState<any>(null);
  const [recording, setRecording] = useState(false);
  const [rtcOn, setRtcOn] = useState(false);
  const [speaking, setSpeaking] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [searchSender, setSearchSender] = useState<any>(null);
  const [dmOpen, setDmOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [projectsMap, setProjectsMap] = useState<Record<string, string>>({});
  const me = useRef<string | undefined>(undefined);
  const recRef = useRef<{ mr: MediaRecorder; chunks: Blob[]; stream: MediaStream } | null>(null);
  const rtcRoomRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const receiptInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { me.current = myId(); }, []);

  const loadChannels = useCallback(async () => {
    try { setChannels(await commsApi.channels()); } catch { /* surfaced below */ } finally { setLoadingCh(false); }
  }, []);
  useEffect(() => { loadChannels(); const t = setInterval(loadChannels, 30000); return () => clearInterval(t); }, [loadChannels]);

  const loadSignoffs = useCallback(() => { commsApi.signoffsPending().then(setPendingSignoffs).catch(() => {}); }, []);
  useEffect(() => { loadSignoffs(); const t = setInterval(loadSignoffs, 60000); return () => clearInterval(t); }, [loadSignoffs]);

  const toggleCollapse = (pid: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(pid)) n.delete(pid); else n.add(pid); return n; });
  useEffect(() => { productionApi.projects.list().then((r: any) => { const d = r.data; const arr = Array.isArray(d) ? d : (d?.items || d?.projects || []); const m: Record<string, string> = {}; for (const p of arr) m[p.id] = p.title || p.projectNumber || p.id; setProjectsMap(m); }).catch(() => {}); }, []);

  const loadMessages = useCallback(async (channelId: string) => {
    const rows = await commsApi.messages(channelId, { limit: 100 });
    setMessages(rows);
    return rows;
  }, []);

  const open = useCallback(async (ch: any) => {
    setSel(ch); setMessages([]); setPending([]); setEditing(null); setReplyTo(null); setMembers([]); setPresence(null); setLoadingMsgs(true);
    try {
      await loadMessages(ch.id);
      commsApi.markRead(ch.id).then(() => setChannels((cs) => cs.map((c) => (c.id === ch.id ? { ...c, unread: 0 } : c))));
      commsApi.channel(ch.id).then((c) => setMembers(c?.members || [])).catch(() => {});
      if (ch.projectId) commsApi.presence(ch.projectId).then(setPresence).catch(() => {});
      if (ch.isPTT) setPtt(await commsApi.activePtt(ch.id)); else setPtt(null);
    } finally { setLoadingMsgs(false); }
  }, [loadMessages]);

  // Realtime: live channel list via inbox pushes + mention toasts + a slow safety poll.
  useEffect(() => {
    const s = commsSocket();
    const onInbox = () => loadChannels();
    const onMention = (p: any) => toast(`You were mentioned in a channel`, { description: p?.message?.body?.slice(0, 80) });
    s.on('inbox', onInbox); s.on('mention', onMention);
    const t = setInterval(loadChannels, 30000);
    return () => { s.off('inbox', onInbox); s.off('mention', onMention); clearInterval(t); };
  }, [loadChannels]);

  // Realtime: open thread — join room, apply live message + edit/delete pushes.
  useEffect(() => {
    if (!sel) return;
    const s = commsSocket();
    s.emit('channel:join', sel.id);
    const onMsg = (m: any) => { if (m.channelId !== sel.id) return; setMessages((ms) => (ms.some((x) => x.id === m.id) ? ms : [...ms, m])); };
    const onUpd = (m: any) => { if (m.channelId !== sel.id) return; setMessages((ms) => ms.map((x) => (x.id === m.id ? { ...x, ...m } : x))); };
    s.on('message', onMsg); s.on('message:update', onUpd);
    const t = setInterval(() => { loadMessages(sel.id).catch(() => {}); commsApi.channel(sel.id).then((c) => setMembers(c?.members || [])).catch(() => {}); if (sel.isPTT) commsApi.activePtt(sel.id).then(setPtt).catch(() => {}); }, 15000);
    return () => { s.emit('channel:leave', sel.id); s.off('message', onMsg); s.off('message:update', onUpd); clearInterval(t); };
  }, [sel, loadMessages]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages, pending, sel]);

  const sendText = async () => {
    const body = text.trim();
    if (!body || !sel) return;
    const clientId = (crypto as any).randomUUID?.() || `c${Date.now()}`;
    const replyToId = replyTo?.id;
    setText(''); setReplyTo(null);
    setPending((p) => [...p, { clientId, body, type: 'TEXT', authorId: me.current, createdAt: new Date().toISOString(), _pending: true }]);
    try {
      await commsApi.send(sel.id, { body, clientId, type: 'TEXT', replyToId });
      await loadMessages(sel.id);
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Message failed to send.'); }
    finally { setPending((p) => p.filter((x) => x.clientId !== clientId)); }
  };

  const saveEdit = async (m: any) => {
    const body = editText.trim();
    if (!body) return;
    setEditing(null);
    setMessages((ms) => ms.map((x) => (x.id === m.id ? { ...x, body, editedAt: new Date().toISOString() } : x)));
    try { await commsApi.editMessage(sel.id, m.id, body); } catch { toast.error('Edit failed'); loadMessages(sel.id); }
  };

  const removeMsg = async (m: any) => {
    if (!confirm('Delete this message? The original is retained in the audit vault.')) return;
    setMessages((ms) => ms.map((x) => (x.id === m.id ? { ...x, deleted: true, body: null } : x)));
    try { await commsApi.deleteMessage(sel.id, m.id); } catch { toast.error('Delete failed'); loadMessages(sel.id); }
  };

  const createChannel = async () => {
    if (!form.title.trim()) return;
    try {
      const ch = await commsApi.createChannel({ title: form.title.trim(), scopeType: form.scopeType, isPTT: form.scopeType === 'PTT', isBroadcast: form.scopeType === 'BROADCAST' });
      setCreating(false); setForm({ title: '', scopeType: 'TEAM' });
      await loadChannels(); open(ch);
    } catch { toast.error('Could not create channel'); }
  };

  // search across the user's channels (text + date range + sender)
  const runSearch = useCallback(async () => {
    const params: any = { q: searchQ.trim() || undefined, from: searchFrom || undefined, to: searchTo || undefined, authorId: searchSender?.id };
    if (!params.q && !params.from && !params.to && !params.authorId) { setSearchResults(null); return; }
    try { setSearchResults(await commsApi.search(params)); } catch { setSearchResults([]); }
  }, [searchQ, searchFrom, searchTo, searchSender]);
  useEffect(() => { if (!searchOpen) return; const t = setTimeout(() => runSearch(), 250); return () => clearTimeout(t); }, [searchOpen, runSearch]);

  // ── PTT (presence + optional live LiveKit radio) ──
  const joinRadio = async () => {
    try {
      const r = await commsApi.rtcToken(sel.id);
      if (!r?.configured) { setRtcOn(false); return; } // presence-only; voice-note PTT still works
      // @ts-ignore — livekit-client is an optional dependency (graceful fallback if absent)
      const lk: any = await import('livekit-client');
      const room = new lk.Room({ adaptiveStream: false, dynacast: false });
      room.on(lk.RoomEvent.TrackSubscribed, (track: any) => {
        if (track.kind === 'audio') { const el = track.attach(); el.style.display = 'none'; el.setAttribute('data-rtc', '1'); document.body.appendChild(el); }
      });
      room.on(lk.RoomEvent.ActiveSpeakersChanged, (sp: any[]) => setSpeaking(sp.map((s) => s.name || s.identity)));
      room.on(lk.RoomEvent.Disconnected, () => { setRtcOn(false); setSpeaking([]); });
      await room.connect(r.url, r.token);
      await room.localParticipant.setMicrophoneEnabled(false); // start muted — push-to-talk
      rtcRoomRef.current = room; setRtcOn(true);
    } catch { setRtcOn(false); }
  };
  const leaveRadio = async () => {
    const room = rtcRoomRef.current; rtcRoomRef.current = null;
    try { await room?.localParticipant?.setMicrophoneEnabled(false); room?.disconnect(); } catch {}
    document.querySelectorAll('audio[data-rtc]').forEach((el) => el.remove());
    setRtcOn(false); setSpeaking([]);
  };
  const toggleLive = async () => {
    if (!sel) return;
    try {
      if (ptt?.id || rtcOn) {
        await leaveRadio();
        if (ptt?.id) { await commsApi.endPtt(ptt.id); setPtt(null); }
      } else {
        setPtt(await commsApi.startPtt(sel.id));
        await joinRadio();
      }
    } catch { toast.error('PTT session error'); }
  };
  useEffect(() => () => { leaveRadio(); }, [sel?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const holdStart = async () => {
    if (!sel || recording) return;
    if (rtcOn && rtcRoomRef.current) { try { await rtcRoomRef.current.localParticipant.setMicrophoneEnabled(true); setRecording(true); } catch {} return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream); const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
        if (blob.size < 1200) return;
        try {
          const file = new File([blob], `ptt-${Date.now()}.webm`, { type: blob.type });
          const up = await uploadFile(file);
          await commsApi.send(sel.id, { type: 'VOICE', attachments: [{ kind: 'AUDIO', sharedPath: up.url, originalPath: up.url, sharedBytes: blob.size }] });
          await loadMessages(sel.id);
        } catch { toast.error('Voice note failed to send'); }
      };
      recRef.current = { mr, chunks, stream }; mr.start(); setRecording(true);
    } catch { toast.error('Microphone unavailable'); }
  };
  const holdEnd = () => {
    if (rtcOn && rtcRoomRef.current) { try { rtcRoomRef.current.localParticipant.setMicrophoneEnabled(false); } catch {} setRecording(false); return; }
    if (!recRef.current) return; try { recRef.current.mr.stop(); } catch {} recRef.current = null; setRecording(false);
  };

  // ── Chat-to-ledger receipt bot ──
  const attachReceipt = async (file: File) => {
    if (!sel?.projectId) { toast.error('Receipts attach to a project channel.'); return; }
    try {
      const up = await uploadFile(file);
      await commsApi.receiptIntake({ channelId: sel.id, projectId: sel.projectId, imagePath: up.url, mime: file.type });
    } catch (e: any) { toast.error(e?.response?.data?.message || 'Receipt upload failed'); }
  };
  const approveReceipt = async (txnId: string) => { try { await commsApi.receiptApprove(txnId); loadMessages(sel.id); } catch (e: any) { toast.error(e?.response?.data?.message || 'Approve failed'); } };
  const rejectReceipt = async (txnId: string) => { try { await commsApi.receiptReject(txnId); loadMessages(sel.id); } catch { toast.error('Reject failed'); } };

  // DOOD-driven: revoke wrapped hires' channel access
  const syncAccess = async () => {
    if (!sel?.projectId) return;
    try {
      const r = await commsApi.syncAccess(sel.projectId);
      toast.success(r.revoked ? `Revoked ${r.revoked} wrapped membership(s).` : 'No wrapped hires to revoke.');
      commsApi.presence(sel.projectId).then(setPresence).catch(() => {});
    } catch { toast.error('Access sync failed'); }
  };

  // Read-&-Sign blasts
  const signBlast = async (messageId: string) => { try { await commsApi.signoffAck(messageId); loadSignoffs(); if (sel) loadMessages(sel.id); } catch { toast.error('Sign failed'); } };
  const createBlast = async () => {
    if (!blastForm.title.trim() || !sel) return;
    try { await commsApi.signoffCreate(sel.id, { title: blastForm.title.trim(), body: blastForm.body.trim() }); setCreatingBlast(false); setBlastForm({ title: '', body: '' }); loadMessages(sel.id); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Could not post blast'); }
  };

  // Document vault share (per-user watermark on open)
  const openDocPicker = async () => {
    if (!sel?.projectId) { toast.error('Documents attach to a project channel.'); return; }
    setDocPickerOpen(true);
    try { const list = await commsApi.projectDocs(sel.projectId); setDocs((list || []).filter((d: any) => d.kind === 'FILE' && /\.pdf$/i.test(d.url || ''))); }
    catch { setDocs([]); }
  };
  const shareDoc = async (doc: any) => {
    if (!sel) return;
    setDocPickerOpen(false);
    try { await commsApi.send(sel.id, { type: 'ENTITY_CARD', body: JSON.stringify({ kind: 'document', docId: doc.id, name: doc.name }) }); loadMessages(sel.id); }
    catch { toast.error('Could not share document'); }
  };
  const openDoc = async (docId: string) => {
    try { const blob = await commsApi.docWatermarked(docId); const url = URL.createObjectURL(blob); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000); }
    catch { toast.error('Could not open document (uploaded PDFs only).'); }
  };
  const startDm = async (u: any) => {
    setDmOpen(false);
    try { const ch = await commsApi.createDm(u.id); await loadChannels(); open(ch); }
    catch (e: any) { toast.error(e?.response?.data?.message || 'Cannot message this person.'); }
  };

  // read receipts for my own messages: members (other than me) whose lastReadAt passed this message
  const seenBy = (m: any) => members.filter((mem) => mem.userId !== me.current && mem.lastReadAt && new Date(mem.lastReadAt) >= new Date(m.createdAt)).length;

  const shown = [...messages, ...pending.filter((p) => !messages.some((m) => m.clientId === p.clientId))];
  const filtered = channels.filter((c) => !q || (c.title || '').toLowerCase().includes(q.toLowerCase()));
  const canPost = !sel || !sel.isBroadcast || isLead(sel.myRole);

  const ChannelRow = (c: any) => {
    const Icon = scopeIcon(c); const on = sel?.id === c.id;
    return (
      <button key={c.id} onClick={() => open(c)} className="w-full text-start flex items-center gap-3 px-3 py-2.5 transition-colors"
        style={{ borderBottom: '1px solid var(--border-1)', background: on ? 'var(--surface-2)' : 'transparent', borderLeft: `2px solid ${on ? 'var(--gold)' : 'transparent'}` }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: c.isPTT ? 'var(--gold)' : c.isBroadcast ? 'var(--warn)' : 'var(--text-2)' }}>
          <Icon size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm truncate" style={{ flex: 1 }}>{c.title}</span>
            {c.lastMessage && <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{fmtTime(c.lastMessage.createdAt)}</span>}
          </div>
          <div className="text-xs truncate" style={{ color: 'var(--text-3)' }}>
            {c.lastMessage ? (c.lastMessage.deleted ? 'message deleted' : c.lastMessage.type === 'VOICE' ? '🎙 voice note' : c.lastMessage.type === 'ENTITY_CARD' ? '🧾 Receipt' : c.lastMessage.body) : (scopeMeta[c.scopeType]?.label || 'Channel')}
          </div>
        </div>
        {c.unread > 0 && <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ background: 'var(--gold)', color: '#161C28', minWidth: 18, textAlign: 'center' }}>{c.unread}</span>}
      </button>
    );
  };

  // ── Channel tree: Project → category → channels ──
  const catOf = (c: any) => (c.isBroadcast ? 'Bulletins' : c.isPTT ? 'Walkie' : c.scopeType === 'PROJECT' ? 'Channel' : c.scopeType === 'UNIT' ? 'Units' : c.scopeType === 'DEPARTMENT' ? 'Departments' : c.scopeType === 'TEAM' ? 'Teams' : c.scopeType === 'DM' ? 'Direct' : 'Channels');
  const CAT_ORDER = ['Channel', 'Bulletins', 'Units', 'Departments', 'Teams', 'Walkie', 'Direct', 'Channels'];
  const projName = (pid: string) => {
    if (!pid) return 'Direct & company';
    if (projectsMap[pid]) return projectsMap[pid];
    const all = channels.find((c) => c.projectId === pid && c.scopeType === 'PROJECT');
    return all ? (all.title || '').replace(/\s*·\s*all\s*$/i, '') : 'Project';
  };
  const groupsByProject = new Map<string, any[]>();
  for (const c of channels) { const k = c.projectId || ''; if (!groupsByProject.has(k)) groupsByProject.set(k, []); groupsByProject.get(k)!.push(c); }
  const projOrder = [...groupsByProject.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : projName(a).localeCompare(projName(b))));
  const channelTree = (
    <>
      {projOrder.map((pid) => {
        const chs = groupsByProject.get(pid)!;
        const isOpen = !collapsed.has(pid);
        const unread = chs.reduce((s, c) => s + (c.unread || 0), 0);
        const byCat = new Map<string, any[]>();
        for (const c of chs) { const k = catOf(c); if (!byCat.has(k)) byCat.set(k, []); byCat.get(k)!.push(c); }
        return (
          <div key={pid || 'none'}>
            <button onClick={() => toggleCollapse(pid)} className="w-full flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--surface-2)' }}>
              {isOpen ? <ChevronDown size={14} style={{ color: 'var(--text-3)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />}
              <span className="text-xs font-semibold uppercase tracking-wide flex-1 text-start truncate" style={{ color: 'var(--text-2)' }}>{projName(pid)}</span>
              {unread > 0 && <span className="text-[10px] font-bold rounded-full px-1.5 py-0.5" style={{ background: 'var(--gold)', color: '#161C28' }}>{unread}</span>}
            </button>
            {isOpen && CAT_ORDER.filter((cat) => byCat.has(cat)).map((cat) => (
              <div key={cat}>
                {cat !== 'Channel' && <div className="pt-2 pb-1 text-[10px] uppercase tracking-wide" style={{ color: cat === 'Bulletins' ? 'var(--warn)' : 'var(--text-3)', paddingInlineStart: 26 }}>{cat}</div>}
                {byCat.get(cat)!.map(ChannelRow)}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );

  return (
    <div className="p-6" style={{ color: 'var(--text-1)' }}>
      <div className="max-w-[1200px] mx-auto">
        {pendingSignoffs.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
            <div style={{ ...card, maxWidth: 440, width: '100%', padding: 0, overflow: 'hidden' }}>
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-1)' }}>
                <FileSignature size={18} style={{ color: 'var(--gold)' }} />
                <div className="font-semibold flex-1">Read &amp; sign required</div>
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>{pendingSignoffs.length} pending</span>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {pendingSignoffs.map((s) => (
                  <div key={s.id} className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-1)' }}>
                    <div className="text-[11px] uppercase tracking-wide mb-1" style={{ color: 'var(--text-3)' }}>{s.channelTitle}</div>
                    <div className="font-semibold">{s.title}</div>
                    {s.body && <p className="text-sm mt-1" style={{ color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{s.body}</p>}
                    <button onClick={() => signBlast(s.id)} className="mt-3 w-full py-2.5 rounded-lg font-semibold inline-flex items-center justify-center gap-2" style={{ background: 'var(--gold)', color: '#161C28' }}>
                      <PenLine size={15} /> Tap to sign
                    </button>
                  </div>
                ))}
              </div>
              <div className="px-5 py-3 text-xs" style={{ color: 'var(--text-3)', borderTop: '1px solid var(--border-1)' }}>You must sign these before continuing. Each signature is logged.</div>
            </div>
          </div>
        )}
        {docPickerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setDocPickerOpen(false)}>
            <div style={{ ...card, maxWidth: 420, width: '100%', padding: 0, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-1)' }}>
                <FileText size={17} style={{ color: 'var(--gold)' }} /><div className="font-semibold flex-1">Share a vault document</div>
                <button onClick={() => setDocPickerOpen(false)} style={{ color: 'var(--text-3)' }}><X size={16} /></button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {docs.length === 0 ? <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--text-3)' }}>No PDF documents in this project's vault.</div>
                  : docs.map((d) => (
                    <button key={d.id} onClick={() => shareDoc(d)} className="w-full text-start flex items-center gap-3 px-5 py-3" style={{ borderBottom: '1px solid var(--border-1)' }}>
                      <FileText size={16} style={{ color: 'var(--text-3)' }} />
                      <span className="flex-1 truncate text-sm">{d.name}</span>
                      {d.category && <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{d.category}</span>}
                    </button>
                  ))}
              </div>
              <div className="px-5 py-3 text-xs" style={{ color: 'var(--text-3)', borderTop: '1px solid var(--border-1)' }}>Each recipient opens a copy stamped with their name — leaks are traceable.</div>
            </div>
          </div>
        )}
        {dmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={() => setDmOpen(false)}>
            <div style={{ ...card, maxWidth: 420, width: '100%', padding: 0, overflow: 'visible' }} onClick={(e) => e.stopPropagation()}>
              <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-1)' }}>
                <MessageSquare size={17} style={{ color: 'var(--gold)' }} /><div className="font-semibold flex-1">New direct message</div>
                <button onClick={() => setDmOpen(false)} style={{ color: 'var(--text-3)' }}><X size={16} /></button>
              </div>
              <div className="p-4">
                <UserSearch placeholder="Search people to message…" onPick={startDm} />
                <p className="text-xs mt-3" style={{ color: 'var(--text-3)' }}>Crew can message their department lead; leads can message anyone.</p>
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">Comms</h1>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-3)' }}>Project channels, broadcast and walkie — one append-only, auditable log.</p>
          </div>
          <button onClick={() => { setSearchOpen((v) => !v); setSearchQ(''); setSearchResults(null); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid var(--border-2)', borderRadius: 10, padding: '8px 14px', fontSize: 13, color: 'var(--text-2)' }}>
            <Search size={15} /> Search messages
          </button>
        </div>

        {/* Cross-channel message search */}
        {searchOpen && (
          <div style={{ ...card, padding: 14 }} className="mb-4">
            <div className="flex items-center gap-2 px-2.5 rounded-lg mb-2" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
              <Search size={15} style={{ color: 'var(--text-3)' }} />
              <input autoFocus value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Search across all your channels…" className="flex-1 bg-transparent py-2.5 text-sm outline-none" style={{ color: 'var(--text-1)' }} />
              {searchQ && <button onClick={() => { setSearchQ(''); setSearchResults(null); }} style={{ color: 'var(--text-3)' }}><X size={15} /></button>}
            </div>
            <div className="flex flex-wrap items-center gap-2 mb-2 text-xs" style={{ color: 'var(--text-3)' }}>
              <label className="inline-flex items-center gap-1">From <input type="date" value={searchFrom} onChange={(e) => setSearchFrom(e.target.value)} style={{ ...inputStyle, padding: '5px 8px' }} /></label>
              <label className="inline-flex items-center gap-1">To <input type="date" value={searchTo} onChange={(e) => setSearchTo(e.target.value)} style={{ ...inputStyle, padding: '5px 8px' }} /></label>
              <div style={{ width: 190, position: 'relative' }}>
                {searchSender
                  ? <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>{searchSender.fullName || searchSender.email}<button onClick={() => setSearchSender(null)}><X size={12} /></button></span>
                  : <UserSearch placeholder="From sender…" onPick={setSearchSender} />}
              </div>
              {(searchFrom || searchTo || searchSender) && <button onClick={() => { setSearchFrom(''); setSearchTo(''); setSearchSender(null); }} style={{ color: 'var(--gold)' }}>Clear filters</button>}
            </div>
            {searchResults && (
              <div className="max-h-72 overflow-y-auto">
                {searchResults.length === 0 ? <div className="text-sm text-center py-6" style={{ color: 'var(--text-3)' }}>No matches.</div>
                  : searchResults.map((m) => (
                    <button key={m.id} onClick={() => { const c = channels.find((x) => x.id === m.channelId); if (c) { open(c); setSearchOpen(false); } }}
                      className="w-full text-start px-3 py-2 rounded-lg" style={{ borderBottom: '1px solid var(--border-1)' }}>
                      <div className="flex items-center gap-2 text-xs mb-0.5" style={{ color: 'var(--text-3)' }}>
                        <Hash size={11} /> {m.channel?.title || 'channel'} · {fmtDay(m.createdAt)} {fmtTime(m.createdAt)}
                      </div>
                      <div className="text-sm" style={{ color: 'var(--text-1)' }}>{m.type === 'VOICE' ? '🎙 voice note' : m.type === 'ENTITY_CARD' ? '🧾 Receipt' : renderBody(m.body || '')}</div>
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0,320px) 1fr', height: 'calc(100vh - 210px)' }}>
          {/* ── Channel list (bulletins split from chatter) ── */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className={sel ? 'hidden md:flex' : 'flex'}>
            <div className="p-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border-1)' }}>
              <div className="flex items-center gap-2 flex-1 px-2.5 rounded-lg" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)' }}>
                <Search size={14} style={{ color: 'var(--text-3)' }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter channels" className="flex-1 bg-transparent py-2 text-sm outline-none" style={{ color: 'var(--text-1)' }} />
              </div>
              <button onClick={() => setDmOpen(true)} title="New direct message"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'var(--surface-2)', color: 'var(--text-2)', border: '1px solid var(--border-2)', borderRadius: 10, flexShrink: 0 }}>
                <MessageSquare size={16} />
              </button>
              <button onClick={() => setCreating((v) => !v)} title="New channel"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'var(--gold)', color: '#161C28', borderRadius: 10, flexShrink: 0 }}>
                <Plus size={18} />
              </button>
            </div>

            {creating && (
              <div className="p-3 flex flex-col gap-2" style={{ borderBottom: '1px solid var(--border-1)' }}>
                <input placeholder="Channel name" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
                <div className="flex gap-2">
                  <select value={form.scopeType} onChange={(e) => setForm({ ...form, scopeType: e.target.value })} style={{ ...inputStyle, flex: 1 }}>
                    {['TEAM', 'UNIT', 'DEPARTMENT', 'PROJECT', 'BROADCAST', 'PTT', 'DM'].map((s) => <option key={s} value={s}>{scopeMeta[s]?.label || s}</option>)}
                  </select>
                  <button onClick={createChannel} style={{ background: 'var(--gold)', color: '#161C28', borderRadius: 10, padding: '0 16px', fontWeight: 600 }}>Create</button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {loadingCh ? (
                <div className="text-center py-10"><Loader2 className="animate-spin mx-auto" style={{ color: 'var(--text-3)' }} /></div>
              ) : filtered.length === 0 ? (
                <div className="text-center px-6 py-12" style={{ color: 'var(--text-3)' }}>
                  <MessageSquare size={26} className="mx-auto mb-2" />
                  <div className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>No channels yet</div>
                  <p className="text-xs mt-1">Create one, or generate the standard project groups from a project.</p>
                </div>
              ) : q ? (
                <>{filtered.map(ChannelRow)}</>
              ) : (
                channelTree
              )}
            </div>
          </div>

          {/* ── Thread ── */}
          <div style={{ ...card, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} className={sel ? 'flex' : 'hidden md:flex'}>
            {!sel ? (
              <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--text-3)' }}>Select a channel to open its thread.</div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border-1)' }}>
                  <button onClick={() => setSel(null)} className="md:hidden" style={{ color: 'var(--text-3)' }}><ChevronLeft size={20} /></button>
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: sel.isPTT ? 'var(--gold)' : sel.isBroadcast ? 'var(--warn)' : 'var(--text-2)' }}>
                    {(() => { const I = scopeIcon(sel); return <I size={16} />; })()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate flex items-center gap-2">{sel.title}{sel.isBroadcast && <Megaphone size={13} style={{ color: 'var(--warn)' }} />}</div>
                    <div className="text-xs flex items-center gap-2" style={{ color: 'var(--text-3)' }}>
                      <span>{scopeMeta[sel.scopeType]?.label || sel.scopeType}</span>
                      {members.length > 0 && <span className="inline-flex items-center gap-1"><Users size={11} /> {members.length}</span>}
                      {presence && <span className="inline-flex items-center gap-1" style={{ color: 'var(--ok)' }}><span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--ok)' }} /> {presence.counts?.ON_SET || 0} on set{presence.counts?.WRAPPED ? ` · ${presence.counts.WRAPPED} wrapped` : ''}</span>}
                      {sel.isBroadcast && <span style={{ color: 'var(--warn)' }}>· announce-only</span>}
                    </div>
                  </div>
                  {sel.isBroadcast && isLead(sel.myRole) && (
                    <button onClick={() => setCreatingBlast((v) => !v)} title="Post a read-&-sign blast"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 600, background: 'var(--gold)', color: '#161C28' }}>
                      <FileSignature size={13} /> Blast
                    </button>
                  )}
                  {presence && isLead(sel.myRole) && presence.counts?.WRAPPED > 0 && (
                    <button onClick={syncAccess} title="Revoke wrapped hires' channel access"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 600, background: 'var(--surface-2)', color: 'var(--warn)', border: '1px solid var(--border-2)' }}>
                      Sync access
                    </button>
                  )}
                  {sel.isPTT && (() => { const live = !!ptt || rtcOn; return (
                    <button onClick={toggleLive}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 7, borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 600,
                        background: live ? 'var(--danger-soft, rgba(220,80,80,.15))' : 'var(--surface-2)', color: live ? 'var(--danger)' : 'var(--text-2)', border: '1px solid var(--border-2)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: live ? 'var(--danger)' : 'var(--text-3)' }} />
                      {rtcOn ? (speaking.length ? `On air · ${speaking[0]} speaking` : 'On air · radio') : ptt ? `On air · ${ptt.participants?.length || 1}` : 'Go live'}
                    </button>
                  ); })()}
                </div>

                {creatingBlast && (
                  <div className="px-4 py-3 flex flex-col gap-2" style={{ borderBottom: '1px solid var(--border-1)' }}>
                    <input placeholder="Blast title (e.g. Safety addendum — heat protocol)" value={blastForm.title} onChange={(e) => setBlastForm({ ...blastForm, title: e.target.value })} style={inputStyle} />
                    <textarea placeholder="Details…" value={blastForm.body} onChange={(e) => setBlastForm({ ...blastForm, body: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setCreatingBlast(false)} className="text-sm px-3 py-1.5 rounded-lg" style={{ color: 'var(--text-2)' }}>Cancel</button>
                      <button onClick={createBlast} className="text-sm px-4 py-1.5 rounded-lg font-semibold" style={{ background: 'var(--gold)', color: '#161C28' }}>Post blast</button>
                    </div>
                  </div>
                )}
                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3" style={{ background: 'var(--surface-0)' }}>
                  {loadingMsgs ? (
                    <div className="text-center py-10"><Loader2 className="animate-spin mx-auto" style={{ color: 'var(--text-3)' }} /></div>
                  ) : shown.length === 0 ? (
                    <div className="text-center py-12 text-sm" style={{ color: 'var(--text-3)' }}>No messages yet — say hello.</div>
                  ) : shown.map((m, i) => {
                    const mine = !!m.authorId && m.authorId === me.current;
                    const prev = shown[i - 1];
                    const newDay = !prev || fmtDay(prev.createdAt) !== fmtDay(m.createdAt);
                    const seen = mine && !m._pending && !m.deleted ? seenBy(m) : 0;
                    if (m.type === 'SYSTEM' && !m.deleted) return (
                      <div key={m.id || m.clientId} className="text-center my-2">
                        <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>{m.body}</span>
                      </div>
                    );
                    const sg = m.type === 'ENTITY_CARD' ? parseSignoff(m.body) : null;
                    if (sg) return (
                      <div key={m.id || m.clientId}>
                        {newDay && <div className="text-center my-3"><span className="text-[10px] px-2 py-1 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>{fmtDay(m.createdAt)}</span></div>}
                        <SignoffCard sg={sg} signed={!pendingSignoffs.some((p) => p.id === m.id)} onSign={() => signBlast(m.id)} />
                      </div>
                    );
                    const dc = m.type === 'ENTITY_CARD' ? parseDocument(m.body) : null;
                    if (dc) return (
                      <div key={m.id || m.clientId}>
                        {newDay && <div className="text-center my-3"><span className="text-[10px] px-2 py-1 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>{fmtDay(m.createdAt)}</span></div>}
                        <DocumentCard doc={dc} onOpen={() => openDoc(dc.docId)} />
                      </div>
                    );
                    const rc = m.type === 'ENTITY_CARD' ? parseReceipt(m.body) : null;
                    if (rc) return (
                      <div key={m.id || m.clientId}>
                        {newDay && <div className="text-center my-3"><span className="text-[10px] px-2 py-1 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>{fmtDay(m.createdAt)}</span></div>}
                        <ReceiptCard rc={rc} canApprove={isLead(sel.myRole)} onApprove={() => approveReceipt(rc.txnId)} onReject={() => rejectReceipt(rc.txnId)} img={m.attachments?.[0]?.sharedPath} />
                      </div>
                    );
                    return (
                      <div key={m.id || m.clientId}>
                        {newDay && <div className="text-center my-3"><span className="text-[10px] px-2 py-1 rounded-full" style={{ background: 'var(--surface-2)', color: 'var(--text-3)' }}>{fmtDay(m.createdAt)}</span></div>}
                        <div className="flex mb-2.5" style={{ justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                          <div style={{ maxWidth: '72%' }}>
                            <div className="group relative" style={{
                              background: mine ? 'var(--accent-soft, rgba(176,141,79,.16))' : 'var(--surface-1)',
                              border: `1px solid ${mine ? 'var(--gold)' : 'var(--border-1)'}`,
                              borderRadius: 14, padding: '8px 11px', opacity: m._pending ? 0.6 : 1,
                            }}>
                              {/* reply preview */}
                              {m.replyTo && !m.deleted && (
                                <div className="mb-1.5 ps-2 text-xs" style={{ borderLeft: '2px solid var(--gold)', color: 'var(--text-3)' }}>
                                  {m.replyTo.deleted ? 'deleted message' : (m.replyTo.type === 'VOICE' ? '🎙 voice note' : (m.replyTo.body || '').slice(0, 80))}
                                </div>
                              )}
                              {editing === m.id ? (
                                <div className="flex items-center gap-2">
                                  <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(m); if (e.key === 'Escape') setEditing(null); }} style={{ ...inputStyle, padding: '4px 8px' }} />
                                  <button onClick={() => saveEdit(m)} style={{ color: 'var(--ok)' }}><Check size={16} /></button>
                                  <button onClick={() => setEditing(null)} style={{ color: 'var(--text-3)' }}><X size={16} /></button>
                                </div>
                              ) : m.deleted ? (
                                <span className="text-sm italic" style={{ color: 'var(--text-3)' }}>message deleted</span>
                              ) : (
                                <>
                                  {m.type === 'VOICE' && m.attachments?.[0]
                                    ? <audio controls src={assetUrl(m.attachments[0].sharedPath)} style={{ height: 34, maxWidth: 240 }} />
                                    : <span className="text-sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderBody(m.body || '')}</span>}
                                  {/* hover actions */}
                                  {!m._pending && (
                                    <div className="absolute -top-3 end-1 hidden group-hover:flex items-center gap-1 rounded-md px-1 py-0.5" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-1)' }}>
                                      <button onClick={() => setReplyTo(m)} title="Reply" style={{ color: 'var(--text-3)' }}><Reply size={12} /></button>
                                      {mine && m.type !== 'VOICE' && <button onClick={() => { setEditing(m.id); setEditText(m.body || ''); }} title="Edit" style={{ color: 'var(--text-3)' }}><Pencil size={12} /></button>}
                                      {mine && <button onClick={() => removeMsg(m)} title="Delete" style={{ color: 'var(--danger)' }}><Trash2 size={12} /></button>}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="text-[10px] mt-0.5 px-1 flex items-center gap-1" style={{ color: 'var(--text-3)', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                              <span>{m._pending ? 'sending…' : fmtTime(m.createdAt)}{m.editedAt && !m.deleted ? ' · edited' : ''}</span>
                              {mine && !m._pending && !m.deleted && (seen > 0
                                ? <span className="inline-flex items-center gap-0.5" style={{ color: 'var(--ok)' }}><CheckCheck size={12} /> {seen}</span>
                                : <Check size={12} />)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Composer */}
                {!canPost ? (
                  <div className="px-4 py-4 flex items-center justify-center gap-2 text-sm" style={{ borderTop: '1px solid var(--border-1)', color: 'var(--text-3)' }}>
                    <Lock size={14} /> Announcements channel — read-only. Only leads can post here.
                  </div>
                ) : (
                  <div style={{ borderTop: '1px solid var(--border-1)' }}>
                    {replyTo && (
                      <div className="px-3 pt-2 flex items-center gap-2 text-xs" style={{ color: 'var(--text-3)' }}>
                        <Reply size={12} /> <span className="flex-1 truncate">Replying to: {replyTo.type === 'VOICE' ? 'voice note' : (replyTo.body || '').slice(0, 60)}</span>
                        <button onClick={() => setReplyTo(null)} style={{ color: 'var(--text-3)' }}><X size={13} /></button>
                      </div>
                    )}
                    <div className="px-3 py-3 flex items-center gap-2">
                      {sel.isPTT ? (
                        <button onMouseDown={holdStart} onMouseUp={holdEnd} onMouseLeave={() => recording && holdEnd()}
                          onTouchStart={(e) => { e.preventDefault(); holdStart(); }} onTouchEnd={(e) => { e.preventDefault(); holdEnd(); }}
                          className="flex-1 flex items-center justify-center gap-2 select-none"
                          style={{ borderRadius: 12, padding: '12px 16px', fontWeight: 600, fontSize: 14, background: recording ? 'var(--danger)' : 'var(--gold)', color: recording ? '#fff' : '#161C28' }}>
                          {recording ? <><Square size={16} /> {rtcOn ? 'Transmitting…' : 'Release to send'}</> : <><Mic size={18} /> Hold to talk</>}
                        </button>
                      ) : (
                        <>
                          {sel.projectId && (
                            <>
                              <input ref={receiptInputRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) attachReceipt(f); if (e.currentTarget) e.currentTarget.value = ''; }} />
                              <button onClick={() => receiptInputRef.current?.click()} title="Attach a receipt for ledger approval"
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 11, border: '1px solid var(--border-2)', color: 'var(--text-2)', flexShrink: 0 }}>
                                <Receipt size={18} />
                              </button>
                              <button onClick={openDocPicker} title="Share a vault document (watermarked)"
                                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 11, border: '1px solid var(--border-2)', color: 'var(--text-2)', flexShrink: 0 }}>
                                <FileText size={18} />
                              </button>
                            </>
                          )}
                          <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendText(); } }}
                            placeholder={sel.isBroadcast ? 'Post an announcement…  (@all to ping everyone)' : 'Message…  (@all to ping everyone)'} style={{ ...inputStyle, flex: 1 }} />
                          <button onClick={sendText} disabled={!text.trim()}
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, borderRadius: 11, background: 'var(--gold)', color: '#161C28', opacity: text.trim() ? 1 : 0.5, flexShrink: 0 }}>
                            <Send size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
