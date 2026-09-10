/**
 * THE DRAFT IS WRITTEN IN PIECES.
 *
 * One call has one ceiling. On v2.2 the DRAFT's 25,000 tokens bought 38,257 characters — roughly
 * half the budget went to the model's reasoning — and it stopped around scene 20 of a 40-scene plan.
 * The alternative to pieces was one enormous call, and one enormous call can die twelve minutes in and
 * lose all of it. Pieces lose only the piece that failed. SCENES and STEP_OUTLINE already continue this
 * way (extendStageArray); this is the prose half.
 *
 * Each piece is asked to pick up exactly where the last one stopped: it is given the scenes already
 * written (so it does not write them again), the last lines verbatim, and the unfinished line to
 * finish. joinContinuation then stitches it on and refuses a piece that goes back to an earlier scene,
 * because appending that would put the same film in twice.
 *
 * Pure: the prompt for the next piece and the join. The model calls live in the service.
 */

/** Continuation calls after the first, at most — the same bound extendStageArray uses. */
export const DRAFT_CONTINUATION_PASSES = 4;
const TAIL_CHARS = 4000;

// "40  INT. FBI BOSTON FIELD OFFICE - CONFERENCE ROOM - DAY" — the numbered sluglines the DRAFT writes.
const HEADING = /^[ \t]*(\d{1,3})[ \t]+((?:INT\/EXT|EXT\/INT|I\/E|INT|EXT)\b[^\n]*)$/gm;

export interface SceneHeading { n: number; text: string; at: number }

export function sceneHeadings(text: string): SceneHeading[] {
  const out: SceneHeading[] = [];
  const re = new RegExp(HEADING.source, 'gm');
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(text || '')))) out.push({ n: Number(m[1]), text: m[0].trim(), at: m.index + (m[0].length - m[0].trimStart().length) });
  return out;
}

/** The line the last piece stopped in the middle of — empty when it stopped at a line break. */
function unfinishedLine(written: string): string {
  const w = String(written || '');
  return w.endsWith('\n') ? '' : w.slice(w.lastIndexOf('\n') + 1);
}

/** The stage prompt, plus what the next piece needs to carry on without repeating or restarting. */
export function continuationUser(user: string, written: string, piece: number): string {
  const w = String(written || '');
  const heads = sceneHeadings(w);
  const last = heads[heads.length - 1];
  let tail = w.length > TAIL_CHARS ? w.slice(w.length - TAIL_CHARS) : w;
  if (w.length > TAIL_CHARS && tail.indexOf('\n') >= 0) tail = tail.slice(tail.indexOf('\n') + 1);   // start on a whole line
  const partial = unfinishedLine(w).trim();
  return String(user || '')
    + '\n\nTHIS SCREENPLAY IS BEING WRITTEN IN PIECES — this is piece ' + (piece + 1) + '. Everything above still applies.'
    + ' The previous piece stopped at the length limit' + (last ? ', part-way through scene ' + last.n : '') + '.'
    + (heads.length ? '\nSCENES ALREADY WRITTEN — do not write any of them again:\n' + heads.map((h) => h.text).join('\n') : '')
    + '\nTHE LAST LINES WRITTEN, VERBATIM:\n<written>\n' + tail + '\n</written>'
    + '\nContinue the screenplay from exactly where it stops.'
    + (partial ? ' Begin by writing its unfinished last line again, in full: "' + partial.slice(0, 200) + '".' : '')
    + (last ? ' Finish scene ' + last.n + ', then keep the scene numbering going from ' + (last.n + 1) + '.' : '')
    + ' Carry on through the rest of the story to its ending and FADE OUT.'
    + ' Do not repeat anything already written, do not restart the screenplay, do not summarise what came before, and write no preamble. Plain text only.';
}

export type JoinHow = 'rewrote-line' | 'continued-line' | 'rewrote-scene' | 'appended';

export interface JoinResult {
  text: string;
  how: JoinHow;
  /** Leading lines of the piece dropped because they repeated what was already written. */
  dropped: number;
  /** Set when the piece went back to an earlier scene. The text is then UNCHANGED. */
  restarted: { at: number; after: number } | null;
  /** The piece's opening line, dropped because it was about the piece rather than in it. */
  preamble: string | null;
}

const norm = (s: string) => String(s || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-')
  .replace(/\s+/g, ' ').trim().toLowerCase();

const ABOUT_THE_WRITING = /\b(?:continuation|piece|previous|screenplay|draft|scene \d+|where i (?:left off|stopped))\b/i;

/**
 * A line the model wrote ABOUT the piece instead of IN it — "Continuing from where the last piece
 * stopped:", "Here is the continuation:", "[Continued from scene 40]". The prompt forbids a preamble;
 * this is the backstop, because such a line fails every test in joinContinuation and would otherwise
 * go into the screenplay as if it were action. Deliberately narrow: only a piece's first line is
 * tested, it must talk about continuing, and it must read as an announcement. "Continuing down the
 * hall, Jason stops." is action and stays; so do "(continuing)", "CONTINUED:", "CUT TO:" and the
 * line of dialogue "Here's where we left off."
 */
export function isPreamble(line: string): boolean {
  const l = String(line || '').trim().replace(/^[*_#>\s]+/, '').replace(/[*_\s]+$/, '');
  if (!/[a-z]/.test(l)) return false;                                        // all caps: a transition or a slugline
  if (!/\b(?:continu\w*|piece|picking up|resum\w*|left off)\b/i.test(l)) return false;
  if (/^[[(].*[\])]$/.test(l)) return ABOUT_THE_WRITING.test(l);             // "(continuing)" is a parenthetical
  if (/:$/.test(l) || /^piece\s+\d+\b/i.test(l)) return true;
  return /^(?:here(?:'s| is)|below is|sure|certainly|okay|ok)\b|^(?:continu\w*|picking up|resuming)\s+(?:from|where)\b/i.test(l)
    && ABOUT_THE_WRITING.test(l);
}

/** Stitch the next piece onto what was written. */
export function joinContinuation(written: string, next: string): JoinResult {
  let piece = String(next || '').replace(/^\s*```[a-z]*[ \t]*\n?/i, '').replace(/\n?```\s*$/, '');
  // The preamble goes before anything is judged: left in, it would also hide a rewritten scene's heading.
  const lead = piece.match(/^\s*([^\n]*)(?:\n|$)/);
  let preamble: string | null = null;
  if (lead && isPreamble(lead[1])) { preamble = lead[1].trim(); piece = piece.slice(lead[0].length); }
  return { ...joinPiece(String(written || ''), piece), preamble };
}

function joinPiece(w: string, piece: string): Omit<JoinResult, 'preamble'> {
  const lastW = sceneHeadings(w).slice(-1)[0];
  const firstP = sceneHeadings(piece)[0];

  // A PIECE THAT GOES BACK IS REFUSED, NOT APPENDED — it would put the same film in twice.
  if (lastW && ((firstP && firstP.n < lastW.n) || /^\s*FADE IN:/i.test(piece))) {
    return { text: w, how: 'appended', dropped: 0, restarted: { at: firstP ? firstP.n : 1, after: lastW.n } };
  }
  // IT REWROTE THE SCENE IT WAS CUT IN: the piece opens on that scene's heading. The whole rewritten
  // scene replaces the cut one, so the scene is complete once rather than half-and-then-whole.
  if (lastW && firstP && firstP.n === lastW.n && !piece.slice(0, firstP.at).trim()) {
    return { text: w.slice(0, lastW.at).replace(/\s*$/, '\n\n') + piece.slice(firstP.at), how: 'rewrote-scene', dropped: 0, restarted: null };
  }

  const cutAt = w.endsWith('\n') ? w.length : w.lastIndexOf('\n') + 1;
  const head = w.slice(0, cutAt);
  const partial = w.slice(cutAt);

  // Lines the piece repeats from the end of what is already written are dropped (up to twelve).
  const headLines = head.split('\n').filter((l) => l.trim());
  const pLines = piece.split('\n');
  const nz = pLines.map((l, i) => ({ l, i })).filter((x) => x.l.trim());
  let dropped = 0; let from = 0;
  for (let k = Math.min(12, headLines.length, nz.length); k >= 1; k--) {
    let same = true;
    for (let j = 0; j < k && same; j++) same = norm(headLines[headLines.length - k + j]) === norm(nz[j].l);
    if (same) { dropped = k; from = nz[k - 1].i + 1; break; }
  }
  const rest = pLines.slice(from).join('\n').replace(/^\s*\n/, '').replace(/^\n+/, '');
  if (!rest.trim()) return { text: w, how: 'appended', dropped, restarted: null };

  if (partial.trim()) {
    const first = rest.split('\n').find((l) => l.trim()) || '';
    const pn = norm(partial);
    // It wrote the unfinished line again, in full — as asked. The half line goes; the whole one stays.
    if (pn && norm(first).startsWith(pn.slice(0, Math.min(pn.length, 40)))) {
      return { text: head + rest.replace(/^\s+/, ''), how: 'rewrote-line', dropped, restarted: null };
    }
    // It carried straight on from the middle of the line.
    const r = rest.replace(/^[ \t]+/, '');
    if (/^[a-z,.;:!?'"’”)\]…-]/.test(r)) {
      const space = /^[,.;:!?'"’”)\]…]/.test(r) || /\s$/.test(partial) ? '' : ' ';
      return { text: w + space + r, how: 'continued-line', dropped, restarted: null };
    }
    // Neither: the half line is kept as written and the piece starts on the next line.
    return { text: w + '\n' + rest, how: 'appended', dropped, restarted: null };
  }
  return { text: head + (/\n\n$/.test(head) || !head ? '' : '\n') + rest, how: 'appended', dropped, restarted: null };
}
