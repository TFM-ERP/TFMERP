'use client';
import React from 'react';
import { videoEnginesApi, assetUrl } from '@/lib/api';

/**
 * Cohesive Episode — the continuity pipeline as one server-side job.
 *   1. Generate + APPROVE a character anchor (Seedream) → identity is locked before any video spend.
 *   2. Beats are derived from the shot list (≈3 shots → one ~14s clip).
 *   3. "Render episode" kicks off a backend job: each beat = reference-to-video (anchor identity +
 *      previous clip for continuity + native dialogue/music), then stitched into one 60–90s episode.
 *   4. The UI just polls the job — robust to reloads; the finished episode persists in the gallery.
 */
export default function CohesiveEpisodePanel({ projectId, stageVersionId, payload }: { projectId: string; stageVersionId?: string; payload: any }) {
  const shots: any[] = Array.isArray(payload?.shots) ? payload.shots
    : Array.isArray(payload?.videoPayload?.shots) ? payload.videoPayload.shots : [];

  // Beats: group the opening shots into ~5 clips of ~3 shots each (one ~14s Seedance render per beat).
  const beats = React.useMemo(() => {
    const src = shots.slice(0, 15);
    const groups: any[][] = [];
    for (let i = 0; i < src.length; i += 3) groups.push(src.slice(i, i + 3));
    return groups.slice(0, 6).map((g, i) => ({
      durationSec: 14, seed: 3000 + i,
      prompt: '@Image1 keeps the exact same character identity — same face, hair and wardrobe. '
        + (i > 0 ? 'Continue seamlessly from @Video1, identical look and colour grade. ' : '')
        + 'Vertical 9:16 cinematic. '
        + g.map((s) => String(s.prompt || s.action || '').trim()).filter(Boolean).join(' Then, ')
        + ' Native dialogue, ambience and score.',
    }));
  }, [shots]);

  const defaultAnchor = React.useMemo(() => {
    const subj = String(shots[0]?.subject || shots[0]?.characters || 'the lead character').trim();
    return `Cinematic character reference portrait — ${subj}. Photorealistic, sharp facial detail, neutral soft background, single character, clean identity reference, vertical 9:16.`;
  }, [shots]);

  const [anchorPrompt, setAnchorPrompt] = React.useState(defaultAnchor);
  React.useEffect(() => setAnchorPrompt(defaultAnchor), [defaultAnchor]);
  const [anchorUrl, setAnchorUrl] = React.useState('');
  const [anchorBusy, setAnchorBusy] = React.useState(false);
  const [job, setJob] = React.useState<any>(null);
  const [err, setErr] = React.useState('');
  const timer = React.useRef<any>(null);

  React.useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const genAnchor = async () => {
    setAnchorBusy(true); setErr('');
    try {
      const r = await videoEnginesApi.anchor({ projectId, prompt: anchorPrompt, width: 1080, height: 1920 });
      setAnchorUrl(String(r.data?.imageUrl || ''));
    } catch (e: any) { setErr(e?.response?.data?.message || e?.message || 'Anchor generation failed.'); }
    finally { setAnchorBusy(false); }
  };

  const poll = (id: string) => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(async () => {
      try {
        const r = await videoEnginesApi.episodeStatus(id);
        setJob(r.data);
        if (r.data?.status === 'COMPLETED' || r.data?.status === 'FAILED') clearInterval(timer.current);
      } catch { /* keep polling */ }
    }, 4000);
  };

  const renderEpisode = async () => {
    setErr('');
    try {
      const r = await videoEnginesApi.renderEpisode({ projectId, stageVersionId, anchorUrl, title: 'Episode 1', aspectRatio: '9:16', beats });
      const id = r.data?.episodeId;
      if (id) { setJob({ status: 'RENDERING', totalBeats: beats.length, doneBeats: 0, beats: [] }); poll(id); }
      else setErr('No episode id returned.');
    } catch (e: any) { setErr(e?.response?.data?.message || e?.message || 'Could not start the episode render.'); }
  };

  const st = job?.status;
  const running = st === 'RENDERING' || st === 'STITCHING';
  const done = st === 'COMPLETED';
  const estCost = (beats.length ? (14 * 0.3 + (beats.length - 1) * 14 * 0.18) : 0);
  const gold = 'linear-gradient(180deg,var(--gold2,#E6D2A2),var(--gold,#C6A463))';
  const btn: React.CSSProperties = { height: 38, padding: '0 16px', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13.5, cursor: 'pointer' };

  if (!shots.length) return null;

  return (
    <div style={{ marginTop: 14, border: '1px solid var(--gold,#C6A463)', borderRadius: 12, padding: 16, background: 'linear-gradient(180deg,rgba(198,164,99,.06),transparent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--gold2,#E6D2A2)' }}>✨ Cohesive episode</span>
        <span style={{ fontSize: 12, color: 'var(--mute,#9aa1ab)' }}>{beats.length} beats · ~{beats.length * 14}s · one consistent character, voiced &amp; scored</span>
      </div>

      {/* Step 1 — anchor */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--faint,#6b727d)', marginBottom: 6 }}>1 · Character anchor (approve the look first)</div>
        <textarea value={anchorPrompt} onChange={(e) => setAnchorPrompt(e.target.value)} rows={2}
          style={{ width: '100%', resize: 'vertical', background: 'var(--panel,#14161c)', color: 'var(--text,#e8e6e1)', border: '1px solid var(--hair,rgba(255,255,255,.12))', borderRadius: 8, padding: 8, fontSize: 12.5, fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 8 }}>
          <button onClick={genAnchor} disabled={anchorBusy || running}
            style={{ ...btn, background: anchorUrl ? 'transparent' : gold, color: anchorUrl ? 'var(--text,#e8e6e1)' : 'var(--goldink,#1a1509)', border: anchorUrl ? '1px solid var(--hair,rgba(255,255,255,.14))' : 'none', opacity: (anchorBusy || running) ? 0.6 : 1 }}>
            {anchorBusy ? 'Generating…' : anchorUrl ? '↻ Regenerate anchor' : '◐ Generate anchor'}
          </button>
          {anchorUrl && <img src={assetUrl(anchorUrl)} alt="anchor" style={{ width: 64, height: 110, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--gold,#C6A463)' }} />}
        </div>
      </div>

      {/* Step 2 — render */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--faint,#6b727d)', marginBottom: 6 }}>2 · Render the episode</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={renderEpisode} disabled={!anchorUrl || running}
            style={{ ...btn, background: gold, color: 'var(--goldink,#1a1509)', opacity: (!anchorUrl || running) ? 0.5 : 1 }}
            title={!anchorUrl ? 'Generate + approve the anchor first' : ''}>
            {running ? `Rendering… ${job?.doneBeats || 0}/${job?.totalBeats || beats.length}` : '▶ Render cohesive episode'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--mute,#9aa1ab)' }}>
            {anchorUrl ? `~$${estCost.toFixed(0)} · runs server-side, safe to leave` : 'Approve the anchor to enable'}
          </span>
        </div>
      </div>

      {err && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--red,#e5635f)' }}>{err}</div>}

      {/* Progress */}
      {job && (running || done || st === 'FAILED') && (
        <div style={{ marginTop: 12 }}>
          {running && (
            <div style={{ fontSize: 12, color: 'var(--amber,#e0a23b)' }}>
              {st === 'STITCHING' ? 'Stitching the episode…' : `Rendering beat ${(job.doneBeats || 0) + 1} of ${job.totalBeats || beats.length} (identity-locked, voiced)…`}
            </div>
          )}
          {st === 'FAILED' && <div style={{ fontSize: 12, color: 'var(--red,#e5635f)' }}>{job.error || 'Episode render failed.'}</div>}
          {done && job.episodeUrl && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.5px', textTransform: 'uppercase', color: 'var(--green,#57b368)', marginBottom: 8 }}>Episode ready · {job.durationSec}s · {job.totalBeats} beats</div>
              <video src={assetUrl(job.episodeUrl) + '#t=0.1'} controls preload="metadata" style={{ width: 260, aspectRatio: '9 / 16', objectFit: 'cover', borderRadius: 12, border: '1px solid var(--gold,#C6A463)', background: '#000', display: 'block' }} />
              <a href={assetUrl(job.episodeUrl)} download style={{ display: 'inline-block', marginTop: 8, fontSize: 12, color: 'var(--gold,#C6A463)' }}>Download episode ↓</a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
