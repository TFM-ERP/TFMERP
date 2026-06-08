'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Upload, Link2, Trash2, FileText, ExternalLink, RefreshCw, HardDrive, Cloud } from 'lucide-react';
import { productionApi, uploadFile, integrationsApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';

const API_ROOT = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
const fileSrc = (u: string) => (u?.startsWith('http') ? u : `${API_ROOT}${u}`);

const DBX_KEY = process.env.NEXT_PUBLIC_DROPBOX_APP_KEY;
const G_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const G_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

function loadScript(src: string, attrs: Record<string, string> = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (Array.from(document.scripts).some(s => s.src === src)) return resolve();
    const el = document.createElement('script');
    el.src = src; el.async = true;
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    el.onload = () => resolve(); el.onerror = () => reject(new Error('load failed'));
    document.body.appendChild(el);
  });
}
const CATEGORIES = ['Contract', 'Deal Memo', 'Receipt', 'Invoice', 'Agreement', 'Insurance', 'Permit', 'Script', 'Other'];
const PROVIDER_LABEL: Record<string, string> = { UPLOAD: 'File', GDRIVE: 'Google Drive', DROPBOX: 'Dropbox', LINK: 'Link' };
const fmtSize = (b?: number) => !b ? '' : b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`;

export default function DocumentsPanel({ projectId }: { projectId: string }) {
  const [docs, setDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('Other');
  const [uploading, setUploading] = useState(false);
  const [linkForm, setLinkForm] = useState({ name: '', url: '', category: 'Other' });
  const [showLink, setShowLink] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Connected-cloud (server token) import
  const [connected, setConnected] = useState<string[]>([]);
  const [cloud, setCloud] = useState<{ provider: string; files: any[]; q: string; loading: boolean } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    productionApi.documents.list(projectId).then(r => setDocs(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { integrationsApi.status().then(r => setConnected((r.data.connections || []).map((c: any) => c.provider))).catch(() => {}); }, []);

  const openCloud = async (provider: string) => {
    setCloud({ provider, files: [], q: '', loading: true });
    try { const r = await integrationsApi.files(provider); setCloud({ provider, files: r.data || [], q: '', loading: false }); }
    catch (e: any) { alert(e.response?.data?.message || 'Could not list files.'); setCloud(null); }
  };
  const searchCloud = async (q: string) => {
    if (!cloud) return; setCloud({ ...cloud, q, loading: true });
    try { const r = await integrationsApi.files(cloud.provider, q); setCloud(c => c && ({ ...c, files: r.data || [], loading: false })); }
    catch { setCloud(c => c && ({ ...c, loading: false })); }
  };
  const importCloud = async (f: any) => {
    if (!cloud) return;
    await integrationsApi.importFile(cloud.provider, { projectId, name: f.name, url: f.url, path: f.path, category: cat });
    load();
  };

  const onFile = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const up = await uploadFile(file);
      await productionApi.documents.create({
        projectId, name: up.originalName || file.name, kind: 'FILE', url: up.url,
        category: cat, mimeType: file.type, sizeBytes: file.size,
      });
      load();
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const addLink = async () => {
    if (!linkForm.url) return;
    await productionApi.documents.create({ projectId, kind: 'LINK', name: linkForm.name || linkForm.url, url: linkForm.url, category: linkForm.category });
    setShowLink(false); setLinkForm({ name: '', url: '', category: 'Other' });
    load();
  };
  const remove = async (id: string) => { if (confirm('Remove this document?')) { await productionApi.documents.remove(id); load(); } };

  // ── Native pickers ──
  const pickDropbox = async () => {
    if (!DBX_KEY) { alert('Dropbox isn’t configured. Set NEXT_PUBLIC_DROPBOX_APP_KEY (from your Dropbox app) and restart the frontend.'); return; }
    try {
      await loadScript('https://www.dropbox.com/static/api/2/dropins.js', { id: 'dropboxjs', 'data-app-key': DBX_KEY });
      (window as any).Dropbox.choose({
        linkType: 'preview', multiselect: true, extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.png', '.jpg', '.jpeg', 'documents', 'images'],
        success: async (files: any[]) => {
          for (const f of files) await productionApi.documents.create({ projectId, kind: 'LINK', name: f.name, url: f.link, category: cat });
          load();
        },
      });
    } catch { alert('Could not load the Dropbox chooser.'); }
  };

  const pickGoogle = async () => {
    if (!G_API_KEY || !G_CLIENT_ID) { alert('Google Drive isn’t configured. Set NEXT_PUBLIC_GOOGLE_API_KEY and NEXT_PUBLIC_GOOGLE_CLIENT_ID and restart the frontend.'); return; }
    try {
      await loadScript('https://apis.google.com/js/api.js');
      await loadScript('https://accounts.google.com/gsi/client');
      const gapi = (window as any).gapi; const google = (window as any).google;
      await new Promise<void>(r => gapi.load('picker', r));
      const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: G_CLIENT_ID, scope: 'https://www.googleapis.com/auth/drive.readonly',
        callback: (resp: any) => {
          if (!resp?.access_token) return;
          const view = new google.picker.DocsView().setIncludeFolders(true).setSelectFolderEnabled(false);
          const picker = new google.picker.PickerBuilder()
            .setOAuthToken(resp.access_token).setDeveloperKey(G_API_KEY).addView(view)
            .setCallback(async (data: any) => {
              if (data.action === google.picker.Action.PICKED) {
                for (const doc of data.docs || []) {
                  const url = doc.url || `https://drive.google.com/open?id=${doc.id}`;
                  await productionApi.documents.create({ projectId, kind: 'LINK', name: doc.name, url, category: cat });
                }
                load();
              }
            }).build();
          picker.setVisible(true);
        },
      });
      tokenClient.requestAccessToken();
    } catch { alert('Could not load the Google Drive picker.'); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Document Vault</h3>
          <p className="text-xs text-gray-400">Contracts, deal memos, receipts, permits — uploads or shared links (Google Drive / Dropbox).</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input text-xs h-8" value={cat} onChange={e => setCat(e.target.value)} title="Category for next upload">
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn btn-primary text-xs py-1.5 px-3"><Upload size={13} className="mr-1" /> {uploading ? 'Uploading…' : 'Upload file'}</button>
          <button onClick={pickGoogle} className="btn btn-secondary text-xs py-1.5 px-3"><Cloud size={13} className="mr-1 text-green-600" /> Drive</button>
          <button onClick={pickDropbox} className="btn btn-secondary text-xs py-1.5 px-3"><Cloud size={13} className="mr-1 text-blue-600" /> Dropbox</button>
          {connected.includes('GDRIVE') && <button onClick={() => openCloud('GDRIVE')} className="btn btn-secondary text-xs py-1.5 px-3"><Cloud size={13} className="mr-1 text-green-600" /> Drive library</button>}
          {connected.includes('DROPBOX') && <button onClick={() => openCloud('DROPBOX')} className="btn btn-secondary text-xs py-1.5 px-3"><Cloud size={13} className="mr-1 text-blue-600" /> Dropbox library</button>}
          <button onClick={() => setShowLink(s => !s)} className="btn btn-secondary text-xs py-1.5 px-3"><Link2 size={13} className="mr-1" /> Add link</button>
          <button onClick={load} className="btn btn-secondary p-1.5"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /></button>
        </div>
      </div>

      {showLink && (
        <div className="card bg-blue-50/40 border-blue-100">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2"><label className="label text-xs">Shared link (Google Drive / Dropbox / URL)</label><input className="input text-sm h-9 w-full" value={linkForm.url} onChange={e => setLinkForm(f => ({ ...f, url: e.target.value }))} placeholder="https://drive.google.com/…" /></div>
            <div><label className="label text-xs">Name</label><input className="input text-sm h-9 w-full" value={linkForm.name} onChange={e => setLinkForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Location agreement" /></div>
            <div><label className="label text-xs">Category</label><select className="input text-sm h-9 w-full" value={linkForm.category} onChange={e => setLinkForm(f => ({ ...f, category: e.target.value }))}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div className="flex gap-2 mt-3"><button onClick={addLink} className="btn btn-primary text-xs py-1.5">Add link</button><button onClick={() => setShowLink(false)} className="btn btn-secondary text-xs py-1.5">Cancel</button></div>
          <p className="text-[11px] text-gray-400 mt-2">Tip: in Google Drive / Dropbox, use "Share → copy link" and make sure your team has access.</p>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        {loading ? <div className="p-10 text-center text-gray-400 text-sm">Loading…</div> :
          docs.length === 0 ? <div className="p-10 text-center text-gray-400 text-sm"><FileText size={24} className="mx-auto mb-2 opacity-30" />No documents yet. Upload a file or add a shared link.</div> : (
            <table className="w-full text-sm">
              <thead><tr className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-2.5 text-left">Name</th><th className="px-3 py-2.5 text-left">Category</th>
                <th className="px-3 py-2.5 text-left">Source</th><th className="px-3 py-2.5 text-left">Added</th><th className="px-3 py-2.5 text-right">Actions</th>
              </tr></thead>
              <tbody>
                {docs.map(d => (
                  <tr key={d.id} className="border-b border-gray-50 hover:bg-gray-50/60">
                    <td className="px-4 py-2.5">
                      <a href={fileSrc(d.url)} target="_blank" rel="noreferrer" className="font-medium text-gray-800 hover:text-brand-600 inline-flex items-center gap-1.5">
                        {d.kind === 'LINK' ? <ExternalLink size={13} className="text-gray-400" /> : <FileText size={13} className="text-gray-400" />}{d.name}
                      </a>
                      {d.sizeBytes ? <span className="text-[11px] text-gray-400 ml-2">{fmtSize(d.sizeBytes)}</span> : null}
                    </td>
                    <td className="px-3 py-2.5"><span className="badge bg-gray-100 text-gray-600 text-xs">{d.category || '—'}</span></td>
                    <td className="px-3 py-2.5 text-xs text-gray-500">
                      <span className={cn('inline-flex items-center gap-1', d.provider === 'GDRIVE' && 'text-green-700', d.provider === 'DROPBOX' && 'text-blue-700')}>
                        <HardDrive size={11} /> {PROVIDER_LABEL[d.provider] || d.provider}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{formatDate(d.createdAt)}</td>
                    <td className="px-3 py-2.5 text-right">
                      <a href={fileSrc(d.url)} target="_blank" rel="noreferrer" className="text-brand-600 hover:text-brand-700 mr-3 text-xs">Open</a>
                      <button onClick={() => remove(d.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
      </div>

      {/* Cloud library (server token) */}
      {cloud && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCloud(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2"><Cloud size={16} className={cloud.provider === 'GDRIVE' ? 'text-green-600' : 'text-blue-600'} /> {cloud.provider === 'GDRIVE' ? 'Google Drive' : 'Dropbox'} library</h3>
              <button onClick={() => setCloud(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <input className="input text-sm h-9 w-full mb-3" placeholder="Search files…" value={cloud.q}
              onChange={e => setCloud(c => c && ({ ...c, q: e.target.value }))} onKeyDown={e => e.key === 'Enter' && searchCloud(cloud.q)} />
            <div className="overflow-y-auto flex-1 -mx-1">
              {cloud.loading ? <p className="text-sm text-gray-400 p-4 text-center">Loading…</p> :
                cloud.files.length === 0 ? <p className="text-sm text-gray-400 p-4 text-center">No files.</p> :
                  cloud.files.map((f: any) => (
                    <div key={f.id} className="flex items-center justify-between px-2 py-2 hover:bg-gray-50 rounded-lg text-sm">
                      <span className="text-gray-800 truncate flex items-center gap-2"><FileText size={13} className="text-gray-400 shrink-0" /> {f.name}</span>
                      <button onClick={() => importCloud(f)} className="btn btn-secondary text-xs py-1 px-2 shrink-0">Import</button>
                    </div>
                  ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">Files import as shared links into this project's vault, using the team's connected account.</p>
          </div>
        </div>
      )}
    </div>
  );
}
