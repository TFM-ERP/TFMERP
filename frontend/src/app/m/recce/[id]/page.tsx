'use client';

/** SYS-mobile — Tech Recce capture. Photo-capture for one location → its Document Vault.
 *  Capture (camera) → optional caption → upload (category PHOTO) → gallery → tap to enlarge. */
import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { productionApi, assetUrl } from '@/lib/api';
import { Loader2, ChevronLeft, Camera, MapPin, X } from 'lucide-react';

const photoUrl = (d: any) => d?.url || d?.fileUrl || '';
const isImage = (d: any) => /\.(png|jpe?g|webp|gif|heic)$/i.test(photoUrl(d)) || String(d?.mimeType || '').startsWith('image');

export default function MobileRecceCapture() {
  const params = useParams();
  const id = String((params as any)?.id || '');
  const [loc, setLoc] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [caption, setCaption] = useState('');
  const [viewer, setViewer] = useState<any>(null); // enlarged photo
  const [err, setErr] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    productionApi.locations.documents(id).then((r: any) => { const d = r.data; setDocs(Array.isArray(d) ? d : (d?.items || [])); }).catch(() => setDocs([]));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    productionApi.locations.get(id).then((r: any) => setLoc(r.data)).catch(() => {});
    load();
    setLoading(false);
  }, [id, load]);

  const capture = async (e: any) => {
    const file = e.target.files?.[0]; if (!file) return;
    setBusy(true); setErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', 'PHOTO');
      if (caption.trim()) fd.append('title', caption.trim());
      await productionApi.locations.uploadDoc(id, fd);
      setCaption('');
      load();
    } catch {
      setErr('Upload failed — check your connection and try again.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const photos = docs.filter(isImage);

  return (
    <div className="px-4 pt-4 pb-4">
      <Link href="/m/recce" className="inline-flex items-center gap-1 text-sm mb-3" style={{ color: 'var(--text-3)' }}><ChevronLeft size={16} /> Locations</Link>
      {loading ? <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--text-3)' }} /></div> : (
        <>
          <h1 className="text-xl font-bold">{loc?.name || loc?.title || 'Location'}</h1>
          {(loc?.address || loc?.city) && <div className="text-sm mb-3 flex items-center gap-1" style={{ color: 'var(--text-3)' }}><MapPin size={13} /> {loc.address || loc.city}</div>}

          {err && <div className="mb-3 p-2.5 rounded-lg text-sm" style={{ background: 'rgba(226,75,74,0.1)', color: '#e24b4a' }}>{err}</div>}

          {/* Optional caption, then capture */}
          <input
            value={caption} onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (optional) — e.g. North wall, power point"
            className="w-full rounded-xl px-3 py-2.5 mb-2 text-sm"
            style={{ background: 'var(--surface-1)', border: '1px solid var(--border-1)', color: 'var(--text-1)' }}
          />
          <button onClick={() => input.current?.click()} disabled={busy} className="w-full flex items-center justify-center gap-2 rounded-xl py-3 mb-5 font-semibold text-sm disabled:opacity-60" style={{ background: 'var(--gold)', color: '#161C28' }}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} {busy ? 'Uploading…' : 'Capture photo'}
          </button>

          <div className="text-xs uppercase tracking-wide mb-2" style={{ color: 'var(--text-3)' }}>Recce photos · {photos.length}</div>
          {photos.length === 0 ? (
            <div className="text-center py-10 text-sm rounded-xl" style={{ border: '1px dashed var(--border-2)', color: 'var(--text-3)' }}>No photos yet — tap Capture.</div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {photos.map((p) => (
                <button key={p.id} onClick={() => setViewer(p)} className="text-start">
                  <img src={assetUrl(photoUrl(p))} alt={p.title || ''} className="w-full rounded-xl" style={{ aspectRatio: '1 / 1', objectFit: 'cover', border: '1px solid var(--border-1)' }} />
                  {p.title && p.title !== p.originalName && <div className="text-[11px] mt-1 truncate" style={{ color: 'var(--text-3)' }}>{p.title}</div>}
                </button>
              ))}
            </div>
          )}
          <input ref={input} type="file" accept="image/*" capture="environment" onChange={capture} className="hidden" />

          {/* Full-screen viewer */}
          {viewer && (
            <div onClick={() => setViewer(null)} className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.92)' }}>
              <button onClick={() => setViewer(null)} className="absolute top-4 right-4" style={{ color: '#fff' }}><X size={26} /></button>
              <img src={assetUrl(photoUrl(viewer))} alt={viewer.title || ''} className="max-w-full rounded-lg" style={{ maxHeight: '80vh', objectFit: 'contain' }} />
              {viewer.title && <div className="mt-3 text-sm text-center" style={{ color: '#ddd' }}>{viewer.title}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
