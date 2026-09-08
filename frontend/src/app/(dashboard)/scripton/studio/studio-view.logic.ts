/**
 * WHICH SCREEN THE STUDIO IS SHOWING — derived from the URL and nothing else.
 *
 * Clicking Build on the rail while a build was open did nothing; he had to visit another screen and
 * come back. The push was never the problem: the rail pushes ?tab=builds while an open build sits at
 * ?build=X, so the URL genuinely changes and Next genuinely navigates. The READ was missing. `mode`
 * was useState and the open build was a ref set once at mount from window.location.search, so a
 * query-only navigation — which does not remount the page component — left both holding their old
 * values, and the render drew the same screen again.
 *
 * Pure, so the rule can be checked without a browser. The page calls this on every query change,
 * which is also what makes browser Back work and a refresh land where he was.
 */
export interface StudioView {
  mode: string;
  buildId: string | undefined;
}

export function resolveStudioView(search: string): StudioView {
  const q = new URLSearchParams(search || '');
  const tab = q.get('tab') || undefined;
  const build = q.get('build') || undefined;
  // TAB WINS, EXPLICITLY. ?tab=builds&build=X shows the board: the rail's intent is "show me the
  // board", and leaving the build set would land straight back on the develop branch — the bug.
  const buildId = tab === 'builds' ? undefined : build;
  return { mode: tab || (buildId ? 'develop' : 'builds'), buildId };
}
