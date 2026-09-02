/**
 * provider-health.util — telling a failure that WILL pass from one that never will.
 *
 * WHY THIS EXISTS. On 1 Sep a 139-scene feature ran cleanly to scene 116 and then hit this, in the
 * space of one second:
 *
 *   GEMINI (out of credit/quota — gemini-2.5-flash: … "code": 429 … exceeded your current quota …)
 *   ANTHROPIC (out of credit/quota — claude-opus-5: … "Your credit balance is too low" …)
 *
 * `writeScene` treated that exactly as it treats a timeout: three attempts, then file the stub
 * "(The scene continues.)" and move to the next scene. Twenty-one scenes — 118 and 121 through 139,
 * the whole third act — were manufactured as stubs in ninety seconds, sixty-three doomed requests
 * deep, and the run then filed itself DONE because the stub ratio (15%) sat under the wholesale-
 * failure threshold of 50%. The operator was handed a script whose climax and ending were one
 * repeated sentence, and told it was complete.
 *
 * A retry is a bet that the next call differs from the last one. Against a timeout or a rate limit
 * that bet is good. Against an empty wallet it is not a bet at all, and the cost of taking it is
 * paid in destroyed drafts rather than in wasted seconds.
 *
 * COUPLING, DELIBERATE AND NARROW. The classification lives in ai.service.ts, which already sorts
 * every provider error into CREDIT / AUTH / RATE / TIMEOUT / NETWORK / SERVER / MODEL and renders
 * each as a fixed English phrase inside one composed message. That message is the only thing that
 * survives the throw — `run()` raises a plain BadRequestException carrying a string, with no
 * structured cause — so the phrases are what we match. They are matched EXACTLY, against the
 * router's own vocabulary rather than any vendor's wording, so a provider rephrasing its billing
 * copy cannot move this. If ai.service.ts ever attaches a machine-readable cause, delete the
 * parsing and read the cause; until then this is the seam.
 */

/** Reasons no retry can fix inside this run: the money is gone, or the key is wrong. */
export const TERMINAL_REASONS: readonly string[] = ['out of credit/quota', 'bad or missing key'];

/** Reasons a later attempt may well survive. Listed so the matcher can tell a mixed chain apart. */
export const RETRYABLE_REASONS: readonly string[] = [
  'rate-limited', 'model not available on this provider', 'timed out', 'unreachable', 'provider error', 'failed',
];

// `plan.key + ' (' + reason + ' — ' + model + detail + ')'`, joined with '; '. The reason is
// anchored between an opening parenthesis and a spaced em dash, which is why this does not split on
// '; ': a provider's raw error body is quoted verbatim in `detail` and can contain semicolons,
// parentheses and braces of its own.
const REASON_RE = new RegExp('\\((' + TERMINAL_REASONS.concat(RETRYABLE_REASONS as string[]).join('|').replace(/\//g, '\\/') + ')\\s+—\\s', 'g');

const ROUTER_RE = /No AI provider could complete the request/i;
/** Thrown before any provider is contacted — there is nothing to retry against. */
const NOT_CONFIGURED_RE = /AI is not configured\./i;
/** The sweep was cut short by the wall-clock budget, so providers remain untried. Never terminal. */
const TIME_BUDGET_RE = /overall time budget reached/i;

function messageOf(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  const m = (err as any).message;
  if (typeof m === 'string' && m) return m;
  // Nest wraps some throws as { response: { message } }.
  const r = (err as any).response;
  if (r && typeof r.message === 'string') return r.message;
  return '';
}

/**
 * True when EVERY provider the router actually tried refused for a terminal reason.
 *
 * Deliberately strict, because a false positive kills a forty-minute run that would have recovered:
 *   * one retryable reason anywhere in the chain → false (that provider may answer next time);
 *   * a sweep stopped by the time budget → false (untried providers remain);
 *   * anything that is not a routing failure at all → false.
 */
export function isProviderExhausted(err: unknown): boolean {
  const msg = messageOf(err);
  if (!msg) return false;
  if (NOT_CONFIGURED_RE.test(msg)) return true;
  if (!ROUTER_RE.test(msg)) return false;
  if (TIME_BUDGET_RE.test(msg)) return false;
  REASON_RE.lastIndex = 0;
  const reasons: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = REASON_RE.exec(msg)) !== null) reasons.push(m[1]);
  if (!reasons.length) return false;
  return reasons.every((r) => TERMINAL_REASONS.indexOf(r) >= 0);
}

/**
 * How many scenes may come back empty BACK TO BACK before the run is abandoned.
 *
 * Five, from the shape of the real logs rather than from taste. In a healthy run an empty return is
 * common and local: scenes 5, 7, 29, 48, 53, 90 and 108 all came back empty on 1 Sep and every one
 * of them recovered on its own second or third attempt — the longest streak of scenes that ended AS
 * stubs, across 116 healthy scenes, was one. A streak of five means fifteen consecutive failed
 * requests, which no longer looks like this scene being difficult; it looks like the writer being
 * gone. Whole-run ratios cannot see this: twenty-one consecutive dead scenes at the end of a
 * 139-scene draft is 15%, and 15% passes.
 */
export const STUB_STREAK_ABORT = 5;

/** True once consecutive empty scenes stop being bad luck. */
export function isStubRunaway(streak: number): boolean {
  return streak >= STUB_STREAK_ABORT;
}

export type HaltKind = 'PROVIDER_EXHAUSTED' | 'STUB_STREAK';

/**
 * Raised to unwind out of the scene loop when continuing would only manufacture damage.
 *
 * Duck-typed via `halted` rather than checked with `instanceof`, which is unreliable for Error
 * subclasses once TypeScript downlevels them. The generation loops catch it BY NAME and land the
 * run through `failPartialRun`, which keeps every page already written — unlike the generic
 * catch-all, which replaces pageText with a one-page apology and would throw the good scenes away.
 */
export class ScriptGenerationHalted extends Error {
  readonly halted = true;
  readonly kind: HaltKind;
  constructor(kind: HaltKind, message: string) {
    super(message);
    this.name = 'ScriptGenerationHalted';
    this.kind = kind;
  }
}

export function isHalt(e: unknown): e is ScriptGenerationHalted {
  return !!e && (e as any).halted === true;
}
