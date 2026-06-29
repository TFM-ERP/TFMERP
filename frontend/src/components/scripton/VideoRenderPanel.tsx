'use client';
import React from 'react';
import { videoEnginesApi, assetUrl } from '@/lib/api';

/**
 * VIDEO_PROMPT render bay — turns the shot list into actual clips.
 *   • Render scene 1 only … cheap single-scene proof.
 *   • Render all N scenes … governed batch (Seedance / ComfyUI / Runway via VideoRoutingPolicy), limited
 *     concurrency, live per-scene progress; every clip persists as a VideoRun so reopening the build shows them.
 *   • Stitch into one video … ffmpeg-concatenates the finished clips, in scene order, into one continuous MP4.
 * Uses the .sx gold tokens (with fallbacks) so it sits cleanly inside the Develop canvas.
 */

const PER_SEC_USD = 0.3; // Seedance ≈ $0.30/s — estimate shown before any spend.
const CONCURRENCY = 3;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Sc = { status: 'idle' | 'rendering' | 'done' | 'failed'; runId?: string; videoUrl?: string; error?: string };

export default function VideoRenderPanel({ projectId, stageVersionId, payload }: { projectId: string; stageVersionId?: string; payload: any }) {
  const shots: any[] = Array.isArray(payload?.shots) ? payload.shots
    : Array.isArray(payload?.videoPayload?.shots) ? payload.videoPayload.shots
    : Array.isArray(payload) ? payload : [];
  const aspectRatio: string = payload?.aspectRatio || payload?.videoPayload?.aspectRatio || '9:16';
  const N = shots.length;
  const estCost = shots.reduce((t, s) => t + (Number(s?.durationSec) || 5) * PER_SEC_USD, 0);

  const [sc, setSc] = React.useState<Record<number, Sc>>({});
  const [batch, setBatch] = React.useState(false);
  const [armed, setArmed] = React.useState(false);
  const [prior, setPrior] = React.useState<any[]>([]);      // completed clips from earlier sessions
  const [stitchBusy, setStitchBusy] = React.useState(false);
  const [stitchUrl, setStitchUrl] = React.useState('');
  const [stitchErr, setStitchErr] = React.useState('');
  const cancelled = React.useRef(false);

  const setScene = (i: number, patch: Partial<Sc>) => setSc((p) => ({ ...p, [i]: { ...(p[i] || { status: 'idle' }), ...patch } }));

  // Load already-rendered clips so reopening the build shows the videos (not just this session's).
  const loadPrior = React.useCallback(async () => {
    if (!projectId) return;
    try {
      const r = await videoEnginesApi.videoRuns(projectId);
      const list: any[] = Array.isArray(r.data) ? r.data : (r.data?.runs || []);
      setPrior(list.filter((x: any) => x.status === 'COMPLETED' && x.videoUrl).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
    } catch { /* none yet */ }
  }, [projectId]);

  React.useEffect(() => { void loadPrior(); }, [loadPrior]);
  React.useEffect(() => { setSc({}); setArmed(false); setStitchUrl(''); setStitchErr(''); }, [stageVersionId]);
  React.useEffect(() => () => { cancelled.current = true; }, []);

  const fullPromptFor = (shot: any) => {
    const base = String(shot?.prompt || shot?.action || '').trim();
    const cam = String(shot?.camera_movement || '').trim();
    return cam && !base.toLowerCase().includes(cam.toLowerCase()) ? `${base} Camera: ${cam}.` : base;
  };

  const pollToDone = async (id: string): Promise<string> => {
    for (let k = 0; k < 240 && !cancelled.current; k++) {
      await sleep(3000);
      try {
        const r = await videoEnginesApi.runStatus(id);
        const s = r.data?.status;
        if (s === 'COMPLETED') return String(r.data?.videoUrl || '');
        if (s === 'FAILED') return '';
      } catch { /* transient — keep polling */ }
    }
    return '';
  };

  const renderScene = async (idx: number) => {
    const shot = shots[idx]; if (!shot) return;
    setScene(idx, { status: 'rendering', error: '' });
    try {
      const r = await videoEnginesApi.generate({ projectId, stageVersionId, prompt: fullPromptFor(shot), negativePrompt: shot.negativePrompt || '', durationSec: shot.durationSec || 5, aspectRatio, seed: shot.seed });
      const id = r.data?.runId;
      if (!id) { setScene(idx, { status: 'failed', error: 'No run id returned.' }); return; }
      setScene(idx, { runId: id });
      const url = await pollToDone(id);
      if (url) setScene(idx, { status: 'done', videoUrl: url }); else setScene(idx, { status: 'failed', error: 'Render failed.' });
    } catch (e: any) {
      setScene(idx, { status: 'failed', error: e?.response?.data?.message || e?.message || 'Render failed to start — enable a video engine in AI Governance.' });
    }
  };

  const renderOne = async (idx: number) => { setBatch(true); cancelled.current = false; await renderScene(idx); setBatch(false); void loadPrior(); };

  const renderAll = async () => {
    setArmed(false); setBatch(true); cancelled.current = false;
    let next = 0;
    const worker = async () => { while (!cancelled.current) { const i = next++; if (i >= N) break; await renderScene(i); } };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, N) }, worker));
    setBatch(false); void loadPrior();
  };

  const stitch = async () => {
    setStitchBusy(true); setStitchErr(''); setStitchUrl('');
    try {
      const runIds = shots.map((_, i) => sc[i]).filter((x) => x && x.status === 'done' && x.runId).map((x) => x!.runId as string);
      const r = await videoEnginesApi.stitch({ projectId, stageVersionId, runIds: runIds.length ? runIds : undefined });
      setStitchUrl(String(r.data?.url || ''));
    } catch (e: any) {
      setStitchErr(e?.response?.data?.message || e?.message || 'Could not stitch the clips.');
    } finally { setStitchBusy(false); }
  };

  const states = shots.map((_, i) => sc[i]?.status || 'idle');
  const doneCount = states.filter((s) => s === 'done').length;
  const failCount = states.filter((s) => s === 'failed').length;
  const liveDoneUrls = new Set(shots.map((_, i) => sc[i]?.videoUrl).filter(Boolean) as string[]);
  // Earlier-session clips that aren't part of this session's scene tiles.
  const extraPrior = prior.filter((p) => !liveDoneUrls.has(p.videoUrl));
  const canStitch = doneCount + extraPrior.length >= 2;

  const gold = 'linear-gradient(180deg,var(--gold2,#E6D2A2),var(--gold,#C6A463))';
  const btnBase: React.CSSProperties = { height: 38, padding: '0 16px', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' };

  return (
    <div style={{ marginTop: 12, border: '1px solid var(--hair,rgba(255,255,255,.08))', borderRadius: 12, padding: 14, background: 'var(--panel,#14161c)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {!armed ? (
          <button onClick={() => N && setArmed(true)} disabled={batch || !N}
            style={{ ...btnBase, background: gold, color: 'var(--goldink,#1a1509)', opacity: (batch || !N) ? 0.6 : 1 }}>
            {batch ? `Rendering… ${doneCount}/${N}` : `▶ Render all ${N} scene${N === 1 ? '' : 's'}`}
          </button>
        ) : (
          <>
            <button onClick={renderAll} style={{ ...btnBase, background: gold, color: 'var(--goldink,#1a1509)' }}>
              Confirm — render {N} scenes (~${estCost.toFixed(0)})
            </button>
            <button onClick={() => setArmed(false)} style={{ ...btnBase, background: 'transparent', color: 'var(--mute,#9aa1ab)', border: '1px solid var(--hair,rgba(255,255,255,.12))' }}>Cancel</button>
          </>
        )}
        {!armed && (
          <button onClick={() => renderOne(0)} disabled={batch || !N}
            style={{ ...btnBase, background: 'transparent', color: 'var(--text,#e8e6e1)', border: '1px solid var(--hair,rgba(255,255,255,.14))', opacity: (batch || !N) ? 0.6 : 1 }}>
            Render scene 1 only
          </button>
        )}
        {batch && <button onClick={() => { cancelled.current = true; }} style={{ ...btnBase, background: 'transparent', color: 'var(--red,#e5635f)', border: '1px solid var(--red,#e5635f)' }}>Stop</button>}
        <span style={{ fontSize: 12, color: 'var(--mute,#9aa1ab)' }}>
          {N ? `${N} shot${N === 1 ? '' : 's'} · ${aspectRatio} · ~$${estCost.toFixed(0)} total est.` : 'No shots in the prompt yet'}
        </span>
        {(doneCount > 0 || failCount > 0) && (
          <span style={{ marginInlineStart: 'auto', fontSize: 12, fontWeight: 600, color: 'var(--mute,#9aa1ab)' }}>
            {doneCount}/{N} done{failCount ? ` · ${failCount} failed` : ''}
          </span>
        )}
      </div>

      {armed && <div style={{ marginTop: 8, fontSize: 12, color: 'var(--amber,#e0a23b)' }}>This sends every scene to the paid render engine (~${estCost.toFixed(0)}). Clips persist as you go — you can Stop anytime.</div>}

      {/* Scene tiles — live progress doubling as the ordered gallery */}
      {N > 0 && (
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(116px, 1fr))', gap: 10 }}>
          {shots.map((shot, i) => {
            const st = sc[i]?.status || 'idle';
            const url = sc[i]?.videoUrl;
            const ring = st === 'done' ? 'var(--green,#57b368)' : st === 'rendering' ? 'var(--amber,#e0a23b)' : st === 'failed' ? 'var(--red,#e5635f)' : 'var(--hair,rgba(255,255,255,.10))';
            return (
              <div key={i} title={fullPromptFor(shot).slice(0, 180)}
                style={{ position: 'relative', aspectRatio: '9 / 16', borderRadius: 10, border: `1px solid ${ring}`, background: '#000', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {st === 'done' && url
                  ? <video src={assetUrl(url) + '#t=0.1'} controls preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ textAlign: 'center', padding: 6 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text,#e8e6e1)' }}>Scene {i + 1}</div>
                      <div style={{ fontSize: 10, marginTop: 4, color: ring }}>
                        {st === 'rendering' ? 'Rendering…' : st === 'failed' ? 'Failed' : 'Not rendered'}
                      </div>
                      {st === 'failed' && !batch && <button onClick={() => renderOne(i)} style={{ marginTop: 6, fontSize: 10, padding: '2px 8px', borderRadius: 6, border: '1px solid var(--hair,rgba(255,255,255,.14))', background: 'transparent', color: 'var(--text,#e8e6e1)', cursor: 'pointer' }}>Retry</button>}
                    </div>}
                <span style={{ position: 'absolute', top: 4, insetInlineStart: 4, fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 5, background: 'rgba(0,0,0,.55)', color: '#fff' }}>{i + 1}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Earlier-session clips (persisted), if any aren't already shown above */}
      {extraPrior.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--faint,#6b727d)', marginBottom: 8 }}>{extraPrior.length} earlier clip{extraPrior.length > 1 ? 's' : ''}</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {extraPrior.map((c: any, i: number) => (
              <video key={c.id || i} src={assetUrl(c.videoUrl) + '#t=0.1'} controls preload="metadata"
                style={{ width: 116, aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 10, border: '1px solid var(--hair,rgba(255,255,255,.08))', background: '#000' }} />
            ))}
          </div>
        </div>
      )}

      {/* Stitch into one continuous video */}
      {canStitch && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--hair,rgba(255,255,255,.08))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button onClick={stitch} disabled={stitchBusy}
              style={{ ...btnBase, background: 'transparent', color: 'var(--text,#e8e6e1)', border: '1px solid var(--gold,#C6A463)', opacity: stitchBusy ? 0.6 : 1 }}>
              {stitchBusy ? 'Stitching…' : '⬇ Stitch into one video'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--mute,#9aa1ab)' }}>Joins the finished scenes, in order, into one continuous {aspectRatio} clip (free — no AI cost).</span>
          </div>
          {stitchErr && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--red,#e5635f)' }}>{stitchErr}</div>}
          {stitchUrl && (
            <div style={{ marginTop: 12 }}>
              <video src={assetUrl(stitchUrl) + '#t=0.1'} controls preload="metadata" style={{ width: 240, aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 12, border: '1px solid var(--gold,#C6A463)', background: '#000', display: 'block' }} />
              <a href={assetUrl(stitchUrl)} download style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: 'var(--gold,#C6A463)' }}>Download full episode ↓</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
