/**
 * Where a stored file value points.
 *
 * Uploaded files are served by ONE route — GET /api/v1/uploads/<name> — behind a guard. There is
 * no public /uploads. A signed-in browser gets in with its file pass cookie (lib/file-pass.ts);
 * a public page is handed a link the server has already signed ("…?t=<token>").
 *
 * Pure: no window, no axios. api.ts puts the API host in front of an `api` path.
 */

export type UploadPath =
  | { kind: 'empty' }
  | { kind: 'external'; url: string }
  | { kind: 'api'; path: string };

const GUARDED = '/api/v1/uploads/';

/** "?dl=1" or "&dl=1" as the path needs, before any #fragment. Not added twice. */
function withDownload(path: string): string {
  const hashAt = path.indexOf('#');
  const main = hashAt < 0 ? path : path.slice(0, hashAt);
  const hash = hashAt < 0 ? '' : path.slice(hashAt);
  if (/[?&]dl=1(&|$)/.test(main)) return path;
  return `${main}${main.includes('?') ? '&' : '?'}dl=1${hash}`;
}

/** Encode a filename exactly once, whether or not it arrived already encoded. */
function encodeName(name: string): string {
  try {
    return encodeURIComponent(decodeURIComponent(name));
  } catch {
    return encodeURIComponent(name);
  }
}

export function uploadPath(u: string | null | undefined, opts?: { download?: boolean }): UploadPath {
  const s = typeof u === 'string' ? u.trim() : '';
  if (!s) return { kind: 'empty' };
  if (/^(https?:|data:|blob:)/i.test(s)) return { kind: 'external', url: s };

  // Already on the guarded route — possibly signed by the server. Hand it back byte for byte:
  // rebuilding it from the filename would drop its ?t= token.
  if (s.startsWith(GUARDED)) return { kind: 'api', path: opts?.download ? withDownload(s) : s };

  const rooted = s.startsWith('/') ? s : `/${s}`;
  const cut = rooted.search(/[?#]/);
  const pathOnly = cut < 0 ? rooted : rooted.slice(0, cut);
  const rest = cut < 0 ? '' : rooted.slice(cut);

  // "/uploads/<name>" or a bare "<name>": one level only, as the route serves.
  const m = /^\/uploads\/([^/]+)$/.exec(pathOnly) || (s.startsWith('/') ? null : /^\/([^/]+)$/.exec(pathOnly));
  if (!m) return { kind: 'api', path: rooted };

  const path = `${GUARDED}${encodeName(m[1])}${rest}`;
  return { kind: 'api', path: opts?.download ? withDownload(path) : path };
}
