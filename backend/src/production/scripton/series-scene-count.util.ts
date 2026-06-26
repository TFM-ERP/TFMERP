/**
 * #45 — length/format-aware scene count for SERIES builds.
 *
 * Per-episode scene density derives from the episode RUNTIME (~1 scene per 2 minutes —
 * an hour drama ≈ 30 scenes), clamped to a sane band so absurd inputs can't explode or
 * collapse the generator. The season total is episodes × per-episode. Movies/shorts keep
 * the feature-band; vertical micro-drama has its own per-episode generation path.
 *
 * Pure + deterministic so it can be unit-tested and called from the generators.
 */
export const SCENES_PER_MIN = 0.5; // ~1 scene per 2 minutes
export const MIN_SCENES_PER_EP = 6;
export const MAX_SCENES_PER_EP = 60;

export type SeriesSceneCount = { scenesPerEp: number; episodes: number; seasonScenes: number };

export function seriesSceneCount(episodes: any, minutesPerEp: any): SeriesSceneCount {
  const eps = Math.max(1, Math.round(Number(episodes) || 1));
  const mins = Math.max(1, Number(minutesPerEp) || 0);
  const scenesPerEp = Math.min(MAX_SCENES_PER_EP, Math.max(MIN_SCENES_PER_EP, Math.round(mins * SCENES_PER_MIN)));
  return { scenesPerEp, episodes: eps, seasonScenes: scenesPerEp * eps };
}
