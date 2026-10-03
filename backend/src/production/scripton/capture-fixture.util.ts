import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * TEST-ONLY FIXTURE LOADER FOR REAL CAPTURED DRAFTS.
 *
 * Nothing in production imports this. It exists so that the cross-story and language assertions
 * required by the two standing rules can be made against REAL scripts, without those scripts
 * entering the repository.
 *
 * WHY THE SCRIPTS STAY OUT. The captures are whole screenplays — 89,056 and 224,107 characters of
 * someone's work. They are reference material for a test, not source, and a repository is the wrong
 * place for them: they would be cloned by everyone forever, they would dominate every diff that
 * touched them, and the Arabic one is 400 KB of JSON. So they live in the captures folder beside
 * the other run evidence, and a test that needs one SKIPS BY NAME when it is absent.
 *
 * AND WHY SKIPPING BY NAME MATTERS. A fixture-backed test that silently vanishes when its fixture is
 * missing is this project's own defect in test form: an absent result reading as a pass. `node:test`
 * skipping prints the test's name and its reason, so a run on a machine without the captures says
 * which assertions did not happen and why, rather than reporting a smaller green total.
 *
 * THE DEFAULT IS RESOLVED FROM THIS FILE, NOT HARD-CODED TO ONE MACHINE. It was an absolute path
 * under one home directory, which would have skipped every fixture test for everyone else while
 * reporting a smaller green total — the exact failure the skip-by-name design exists to avoid. The
 * captures live in the sibling checkout, so the default walks up to this repo's root and across.
 *
 * The depth is the same under ts-node and under dist: `backend/src/production/scripton` and
 * `backend/dist/production/scripton` are both four levels below the repo root.
 *
 * SCRIPTON_CAPTURES overrides it for anyone whose layout differs.
 */

const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

export const CAPTURES_DIR = process.env.SCRIPTON_CAPTURES
  || join(REPO_ROOT, '..', 'TFM-System', 'Claude outputs', 'captures');

/** One captured revision: the shape written by the read-only capture (plan 01 task 0). */
export interface CapturedScript {
  story: string;
  revisionId: string;
  pageCount: number;
  chars: number;
  script: { letters: number; arabic: number; latin: number; arabicShare: number; latinShare: number };
  cueCast: Array<{ name: string; count: number }>;
  sceneRows: Array<{ sceneNumber: string | null; slugline: string | null; pages: string | null }>;
  pageText: Array<{ page: number; text: string }>;
}

/** The parsed capture, or null when it is not on this machine. Never throws. */
export function loadCapture(file: string): CapturedScript | null {
  try {
    const p = join(CAPTURES_DIR, file);
    if (!existsSync(p)) return null;
    const j = JSON.parse(readFileSync(p, 'utf8'));
    // A file that exists but carries none of the shape is as absent as a missing one, and saying so
    // is better than a test failing deep inside on `undefined.map`.
    if (!j || !Array.isArray(j.pageText) || !Array.isArray(j.cueCast)) return null;
    return j as CapturedScript;
  } catch {
    return null;
  }
}

/** The reason string for a skipped fixture test: it names the file and where it was looked for. */
export function missingCapture(file: string): string {
  return 'capture not on this machine: ' + join(CAPTURES_DIR, file)
    + ' (the screenplays are deliberately not in the repo; set SCRIPTON_CAPTURES to point at them)';
}

/** Every page's text joined — what the sweeps and the fingerprints see. */
export function captureText(c: CapturedScript): string {
  return c.pageText.map((p) => String((p && p.text) || '')).join('\n');
}
