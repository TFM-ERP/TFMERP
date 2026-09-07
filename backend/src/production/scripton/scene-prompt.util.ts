/**
 * The scene writer's prompt, split by WHAT VARIES — which is a caching constraint, not tidiness.
 *
 * Anthropic's cache prefix runs tools -> system -> messages, and a change at any level invalidates
 * that level and every one after it. The system prompt used to have the per-scene length rule
 * concatenated into it, so `system` differed on every call: the story-context breakpoint below it
 * could never hit, every scene WROTE a fresh cache entry at 1.25x and READ nothing, and caching cost
 * more than not caching while being slower. Nothing reported it, because a write-every-call looks
 * exactly like a cache that is working if you only ask "did anything get cached".
 *
 * So the split is load-bearing:
 *
 *   SCENE_SYSTEM_PROMPT   the ROLE. Byte-identical on every call, forever. Nothing per-scene may be
 *                         concatenated into it — that is what broke, and the spec test hashes it
 *                         across budgets rather than trusting a reading of the code.
 *   sceneLengthRule()     everything that varies per scene: the length budget and the pacing rule,
 *                         which depends on whether the scene has cast in it. It travels in the user
 *                         payload BELOW the cache breakpoint, where a per-scene instruction belongs.
 */
import type { LineBudget } from './feature-length.util';

export const SCENE_SYSTEM_PROMPT = 'You are a professional screenwriter writing ONE scene of a feature film in industry-standard FINAL DRAFT format. Present-tense action; dialogue = a centred UPPERCASE CHARACTER cue on its own line, an optional (parenthetical), then the line; use (V.O.)/(O.S.)/(CONT\'D) where apt. Land real emotion, subtext, conflict and one turn.'
  + ' Write in fragments and single-line action beats (only what the camera sees); keep dialogue clipped and oblique — no speeches, no exposition dumps, no small talk. Enter on the last possible moment and cut on the turn. No novelistic prose, no unfilmable inner thoughts, no restating the heading. Do NOT write the scene heading/slug line (it is already provided) and do NOT add a scene number. Output ONLY the scene text.';

/** The per-scene half: length budget + pacing. Varies by design — keep it out of the system prompt. */
export function sceneLengthRule(b: LineBudget, characters?: string): string {
  const pageWord = b.pages === 1 ? 'ONE full page' : (b.pages < 1 ? ('about ' + b.pages + ' of a page') : ('about ' + b.pages + ' pages'));
  return 'LENGTH IS STRICT AND MEASURED: this scene must run ' + pageWord + ' of a screenplay — '
    + 'approximately ' + b.wordsAsk + ' WORDS, and it must NOT exceed ' + b.wordsMax + ' words. '
    + '(For reference that is roughly ' + b.target + ' lines including blank ones.) Count as you write and stop when you reach the target. '
    + (b.pages <= 0.5
        ? 'This is a SHORT beat: one image or one exchange, in and out. Do not develop it.'
        : 'Fill the space with real dramatic content — action beats, behaviour, dialogue that turns. Do NOT pad with description.')
    + ' Running OVER ' + b.wordsMax + ' words is a failure — it makes the finished screenplay too long to be a feature. '
    + 'Coming in far under is also a failure. If the material wants more room than this, cut it to fit instead.'
    // Density, not style. The 31 Aug draft opened with FOURTEEN consecutive description paragraphs
    // before a human did anything — every line of it good, the stack of them unreadable. The fix is
    // NOT to ban atmosphere (a script is READ before it is shot, and mood on the page is the point);
    // it is to stop atmosphere from queueing up. Scoped to scenes that actually have people in them,
    // so an establishing sequence with no cast is left alone.
    + (characters
        ? ' PACING: characters are present in this scene, so at most THREE description paragraphs may'
          + ' pass before one of them acts, moves or speaks. Atmosphere is welcome — stacked atmosphere'
          + ' is not. Let an image land on its own line, then cut to a person.'
        : ' PACING: no characters are listed for this scene, so it is an establishing beat — keep it to'
          + ' a handful of images and get out.')
    // The model was hard-wrapping mid-sentence, which the renderer then read as a paragraph break.
    // The renderer now rejoins those, but a paragraph that arrives as one line is simply correct.
    + ' FORMATTING: write each action paragraph and each character\'s speech as ONE continuous line —'
    + ' do NOT insert line breaks inside a paragraph to wrap it. Separate paragraphs and beats with a'
    + ' single blank line. The page layout does its own wrapping.';
}
