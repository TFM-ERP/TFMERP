'use client';

import { useEffect, useRef, useState } from 'react';
import { productionApi, assetUrl } from '@/lib/api';
import { X, Mic, Square, Trash2, Loader2, Volume2 } from 'lucide-react';

/**
 * SYS-13b · P6 — Audio notes (browser-native, $0).
 * Record voice memos with MediaRecorder, attach to a revision (optionally a page), play back.
 * Nothing leaves the machine except the uploaded clip to the app's own /uploads.
 */
export default function AudioNotesPanel({ revision, onClose }: { revision: any; onClose: () => void }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [label, setLabel] = useState('');
  const [page, setPage] = useState('');
  const [err, setErr] = useState('');
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const startedRef = useRef<number>(0);

  const load = () => productionApi.script.audioList(revision.id).then((r) => setNotes(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [revision.id]);

  const start = async () => {
    setErr('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        await upload(blob, Math.round((Date.now() - startedRef.current) / 1000));
      };
      rec.start();
      recRef.current = rec;
      startedRef.current = Date.now();
      setRecording(true); setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      setErr('Microphone access was blocked. Allow it in your browser to record.');
    }
  };
  const stop = () => {
    clearInterval(timerRef.current);
    setRecording(false);
    recRef.current?.stop();
  };
  const upload = async (blob: Blob, durationSec: number) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', blob, `note-${Date.now()}.webm`);
      if (label.trim()) fd.append('label', label.trim());
      if (page) fd.append('page', page);
      fd.append('durationSec', String(durationSec));
      await productionApi.script.addAudio(revision.id, fd);
      setLabel(''); setPage(''); load();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Upload failed.'); }
    finally { setUploading(false); }
  };
  const remove = async (id: string) => { if (confirm('Delete this audio note?')) { await productionApi.script.removeAudio(id); load(); } };

  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-100 px-5 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-sm inline-flex items-center gap-2"><Mic size={16} /> Audio notes — {revision.revisionLabel}</h2>
          <button onClick={onClose}><X size={18} /></button>
        </div>

        <div className="p-4 border-b border-slate-100 space-y-2">
          <div className="flex items-center gap-2">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label (optional)" className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
            <input value={page} onChange={(e) => setPage(e.target.value.replace(/\D/g, ''))} placeholder="Page" className="w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
          </div>
          {!recording ? (
            <button onClick={start} disabled={uploading} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 text-white text-sm py-2 disabled:opacity-50">
              {uploading ? <Loader2 size={15} className="animate-spin" /> : <Mic size={15} />} {uploading ? 'Saving…' : 'Record'}
            </button>
          ) : (
            <button onClick={stop} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 text-white text-sm py-2">
              <Square size={14} /> Stop · {mmss(elapsed)}
            </button>
          )}
          {err && <p className="text-[11px] text-rose-600">{err}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {notes.length === 0 ? <p className="text-sm text-slate-400 text-center py-6">No audio notes yet.</p> : notes.map((n) => (
            <div key={n.id} className="rounded-xl border border-slate-200 p-2.5">
              <div className="flex items-center gap-2 mb-1.5 text-xs">
                <Volume2 size={13} className="text-slate-400" />
                <span className="font-medium text-slate-700">{n.label || 'Voice memo'}</span>
                {n.page != null && <span className="text-slate-400">p.{n.page}</span>}
                {n.durationSec != null && <span className="text-slate-400">{mmss(n.durationSec)}</span>}
                <span className="ml-auto text-slate-300">{new Date(n.createdAt).toLocaleDateString('en-GB')}</span>
                <button onClick={() => remove(n.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={13} /></button>
              </div>
              <audio controls src={assetUrl(n.audioUrl)} className="w-full h-8" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
