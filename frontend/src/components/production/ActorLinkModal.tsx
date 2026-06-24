'use client';

/** Actor access link generator — mints a login-free link/QR for an actor to see ONLY their
 *  own call (per production). QR is rendered locally (qrcode.react) — the token never leaves
 *  the browser to a third party. */
import { useEffect, useState } from 'react';
import { castingApi, productionApi } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { X, Copy, Check, Loader2, QrCode, Share2 } from 'lucide-react';

export default function ActorLinkModal({ talent, onClose }: { talent: any; onClose: () => void }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState('');
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    productionApi.projects.list().then((r: any) => {
      const d = r.data; const list = Array.isArray(d) ? d : (d?.items || d?.projects || []);
      setProjects(list); setProjectId(list[0]?.id || '');
    }).catch(() => {});
  }, []);

  const gen = async () => {
    if (!projectId) return;
    setBusy(true); setLink('');
    try {
      const r = await castingApi.actorAccessLink(talent.id, projectId);
      const path = r.data?.path || `/a/${r.data?.token}`;
      setLink(`${window.location.origin}${path}`);
    } catch (e: any) { alert(e?.response?.data?.message || 'Could not generate link'); }
    finally { setBusy(false); }
  };
  const copy = () => { navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  const share = () => { if ((navigator as any).share) (navigator as any).share({ title: 'Your call sheet access', url: link }).catch(() => {}); else copy(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 flex items-center gap-2"><QrCode size={17} /> Actor access link</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="p-5">
          <p className="text-sm text-slate-500 mb-3">A private, login-free link for <span className="font-medium text-slate-800">{talent.stageName || talent.fullName}</span> to see only their own call time, location &amp; safety info.</p>
          <label className="text-xs font-medium text-slate-500">Production</label>
          <select value={projectId} onChange={(e) => { setProjectId(e.target.value); setLink(''); }} className="w-full mt-1 mb-3 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#0f172a]">
            {projects.length === 0 && <option value="">No productions</option>}
            {projects.map((p) => <option key={p.id} value={p.id}>{p.title || p.projectNumber || p.id}</option>)}
          </select>
          {!link ? (
            <button onClick={gen} disabled={busy || !projectId} className="w-full rounded-xl bg-slate-900 text-white py-2.5 text-sm font-medium disabled:opacity-40 inline-flex items-center justify-center gap-2">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <QrCode size={15} />} Generate link
            </button>
          ) : (
            <>
              <div className="flex justify-center py-3"><div className="p-3 bg-white rounded-xl border border-slate-200"><QRCodeSVG value={link} size={168} level="M" /></div></div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
                <span className="text-xs text-slate-600 truncate flex-1">{link}</span>
                <button onClick={copy} className="text-xs inline-flex items-center gap-1 text-[#0f172a] font-medium shrink-0">{copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}</button>
              </div>
              <button onClick={share} className="w-full mt-2 rounded-xl py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2" style={{ background: '#C9A24B', color: '#161C28' }}><Share2 size={15} /> Share link</button>
              <p className="text-[11px] text-slate-400 mt-2 text-center">Share by message, or print the QR on the call sheet. No login required.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
