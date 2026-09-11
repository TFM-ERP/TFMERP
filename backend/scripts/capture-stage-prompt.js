/**
 * CAPTURE THE PROMPT A STAGE WOULD SEND — and count the source's register in it.
 *
 *   node -r ts-node/register scripts/capture-stage-prompt.js <buildId> <target> [--phrase "…"]… [--out <file.json>]
 *
 *   --phrase  repeatable. Each is counted in the captured payload — in the register block and outside
 *             it — after normalising curly quotes and whitespace, with the exact count beside it.
 *             Checked only on a capture: with NOT CAPTURED no phrase is reported at all.
 *
 *   exit  0 captured (and every --phrase found) · 1 captured, and at least one --phrase ABSENT
 *         3 NOT CAPTURED (never 1: "no prompt" and "a prompt without the phrase" stay apart)
 *         2 usage / unknown build · 4 the instrument itself failed
 *
 *   target  a ladder kind (SCENES, STEP_OUTLINE, DRAFT, SYNOPSIS, COVERAGE, …)
 *             → generateStage({ projectId, kind, buildId }), the exact options the studio sends
 *               (studio/page.tsx genStage → generate-async → startStage → generateStage).
 *           DRAFT_CONT
 *             → a LATER DRAFT PIECE: generateStage({ …, kind: DRAFT }), with piece 1 ANSWERED by the stub
 *               with a synthetic screenplay cut off at its ceiling (stopReason max_tokens, output tokens =
 *               the call's maxTokens) — a declared deviation — so the real extendDraft asks for piece 2.
 *               Captures scripton.develop.draft.cont, and also reports whether piece 2's prompt begins
 *               with piece 1's prompt byte for byte (both are captured from the same run).
 *           FEATURE_SCENE
 *             → the feature writer's first per-scene call, entered at generateScriptAsync with the
 *               arguments regenerateFeature assembles (:4670-4679). The build must be linked to a script.
 *           FEATURE_ENTRY
 *             → regenerateFeature(docId, 'rewrite'), the public entry. It creates a revision before any
 *               model call, so a read-only capture through it MUST fail — and says so.
 *
 * CAPTURE, NOT RECONSTRUCTION. The service's own code runs and builds its own prompt. The model is
 * replaced by a stub that records the first call to the TARGET task verbatim (every field it was
 * handed) and then refuses it. Nothing here assembles a prompt; the only thing computed locally is
 * the REFERENCE — the register lines the prompt is checked for — and that is read from the stored
 * source_canons row when one exists (written at extraction time, not by this run).
 *
 * READ-ONLY. Every Prisma write is blocked and recorded, with whether it happened before or after the
 * capture. No model is called: every non-target call is refused and recorded, except that in
 * FEATURE_SCENE the planner is answered with a fixed one-scene plan (the writer throws without a plan);
 * the build's own SCENES cards replace that plan when they are longer, as they would in a real run.
 *
 * A COUNT IS ONLY REPORTED FOR A CAPTURE. If the target call is never reached — a blocked write, a
 * refusal, an exception, a timeout — the status is NOT CAPTURED with the reason, and NO count is
 * printed. A reference of zero lines is NO REFERENCE, also without a count. "0 of 81" therefore always
 * means: the prompt was captured, and the register is not in it.
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { PrismaService } = require('../src/common/prisma/prisma.service.ts');
const { CanonService } = require('../src/production/scripton/canon/canon.service.ts');
const { ScripOnService } = require('../src/production/scripton/scripton.service.ts');
const { transcribeRegister } = require('../src/production/scripton/canon/canon-register.util.ts');
const { asSourceText } = require('../src/production/scripton/source-excerpt.util.ts');

const args = process.argv.slice(2);
const buildId = args[0];
const target = String(args[1] || '').toUpperCase();
const opt = (k, d) => { const i = args.indexOf(k); return i > 0 && args[i + 1] ? args[i + 1] : d; };
const OUT = opt('--out', null);
const PHRASES = [];
for (let i = 2; i < args.length; i++) if (args[i] === '--phrase' && args[i + 1]) PHRASES.push(args[++i]);
if (!buildId || !target || target.startsWith('--')) { console.error('usage: node -r ts-node/register scripts/capture-stage-prompt.js <buildId> <KIND|DRAFT_CONT|FEATURE_SCENE|FEATURE_ENTRY> [--phrase "…"]… [--out file.json]'); process.exit(2); }

// The header registerDirective() opens the block with (canon-inject.util.ts). Read, not rebuilt: the
// block is located by finding this line in the captured text.
const REGISTER_HEADER = "THE SOURCE'S OWN RULES — transcribed VERBATIM from the source material";
const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const CAPTURED = new Error('CAPTURED (instrument): the target call was recorded and refused');

const events = [];            // every write attempt and model call, in order
let captured = null;          // the target call, verbatim
const stamp = () => (captured ? 'after' : 'before');

const WRITE = /^(create|createMany|update|updateMany|upsert|delete|deleteMany)$/;
const readOnly = (real) => new Proxy(real, { get(t, k) {
  if (['$executeRaw', '$executeRawUnsafe', '$transaction'].includes(String(k))) {
    return () => { events.push({ type: 'write-blocked', what: String(k), when: stamp() }); return Promise.reject(new Error('WRITE BLOCKED (instrument): ' + String(k))); };
  }
  const v = t[k];
  if (v && typeof v === 'object' && typeof v.findMany === 'function') {
    return new Proxy(v, { get(d, m) {
      const f = d[m];
      if (typeof f !== 'function') return f;
      if (!WRITE.test(String(m))) return f.bind(d);
      return () => { events.push({ type: 'write-blocked', what: String(k) + '.' + String(m), when: stamp() }); return Promise.reject(new Error('WRITE BLOCKED (instrument): ' + String(k) + '.' + String(m))); };
    } });
  }
  return typeof v === 'function' ? v.bind(t) : v;
} });

const PLAN = { scenes: [{ intExt: 'INT', location: 'CAPTURE PLACEHOLDER', dayNight: 'DAY', brief: 'Placeholder scene supplied by the capture instrument.', characters: ['JASON QUICK'], pageWeight: 1 }] };
// DRAFT_CONT: piece 1, as a draft that ran into its ceiling mid-line. Synthetic — its only job is to
// make the real extendDraft ask for piece 2; its text reaches piece 2's prompt as "the last lines written".
const CUT_PIECE = 'FADE IN:\n\n1  EXT. HARBOUR - NIGHT\n\nCAPTURE PLACEHOLDER. Rain on the moorings.\n\n'
  + '2  INT. BOATHOUSE - NIGHT\n\nCAPTURE PLACEHOLDER. A lamp swings over the workbench and';
let answered = null;          // DRAFT_CONT: the piece-1 call, verbatim, as the code sent it
const makeAi = (targetTask, answerPlanner, cutFirstDraft) => {
  let planned = 0;
  const call = (method) => async (o) => {
    const task = String((o && o.task) || '?');
    // Several calls share a task (extractPlanState is also scripton.feature.plan), so each event also
    // carries the head of its system prompt — the task alone cannot say which code made the call.
    const who = ' — "' + String((o && o.system) || '').replace(/\s+/g, ' ').slice(0, 60) + '…"';
    if (!captured && task === targetTask) {
      captured = { method, task, fields: {} };
      for (const [key, val] of Object.entries(o || {})) {
        if (typeof val === 'string') captured.fields[key] = val;
        else if (key === 'messages' && Array.isArray(val)) captured.fields.messages = val.map((m) => String((m && m.role) || '') + ': ' + (typeof m.content === 'string' ? m.content : JSON.stringify(m.content))).join('\n\n');
      }
      events.push({ type: 'model-call-CAPTURED', what: method + ' ' + task, when: 'capture' });
      throw CAPTURED;
    }
    if (!captured && cutFirstDraft && !answered && task === 'scripton.develop.draft') {
      answered = { method, task, user: String((o && o.user) || ''), system: String((o && o.system) || ''), maxTokens: o && o.maxTokens };
      events.push({ type: 'model-call-answered', what: method + ' ' + task + ' (answered: synthetic piece 1, ' + CUT_PIECE.length + ' chars, stopReason max_tokens, output_tokens ' + (o && o.maxTokens) + ')' + who, when: stamp() });
      return { text: CUT_PIECE, stopReason: 'max_tokens', usage: { output_tokens: Number(o && o.maxTokens) || 0 } };
    }
    if (!captured && answerPlanner && task === 'scripton.feature.plan') {
      planned++;
      events.push({ type: 'model-call-answered', what: method + ' ' + task + (planned === 1 ? ' (answered: fixed one-scene plan)' : ' (answered: {"scenes":[]})') + who, when: stamp() });
      return planned === 1 ? { json: PLAN, text: JSON.stringify(PLAN) } : { json: { scenes: [] }, text: '{"scenes":[]}' };
    }
    events.push({ type: 'model-call-refused', what: method + ' ' + task + who, when: stamp() });
    throw new Error('MODEL CALL REFUSED (instrument): ' + task);
  };
  return new Proxy({}, { get(_t, k) { return typeof k === 'string' ? call(k) : undefined; } });
};

(async () => {
  const real = new PrismaService();
  const b = await real.developmentBuild.findUnique({ where: { id: buildId }, select: { id: true, name: true, projectId: true, brief: true, linkedScriptId: true } });
  if (!b) { console.error('no build ' + buildId); process.exit(2); }

  const feature = target === 'FEATURE_SCENE' || target === 'FEATURE_ENTRY';
  const cont = target === 'DRAFT_CONT';
  const kind = cont ? 'DRAFT' : target;
  const targetTask = feature ? 'scripton.feature.scene' : cont ? 'scripton.develop.draft.cont' : 'scripton.develop.' + kind.toLowerCase();
  const ai = makeAi(targetTask, feature, cont);
  const ro = readOnly(real);
  const svc = new ScripOnService(ro, ai, new CanonService(ro, ai));

  // ── the reference: the build's register, from the stored canon row when there is one ──────────
  const src = (asSourceText(b.brief && b.brief.sourceText) || '').trim();
  const nowReg = transcribeRegister(src).facts;
  let reference = null, referenceFrom = '';
  if (src) {
    const { digest } = svc.canonKeyOf(src);
    const row = await svc.readStoredCanon(digest).catch(() => null);
    const stored = row && row.register && Array.isArray(row.register.facts) ? row.register.facts : null;
    if (stored && stored.length) { reference = stored; referenceFrom = 'stored source_canons ' + row.id + ' (register v' + row.register.version + ', digest ' + String(digest).slice(0, 16) + ')'; }
    else { reference = nowReg; referenceFrom = 'transcribed now from brief.sourceText (no stored canon row for digest ' + String(digest).slice(0, 16) + ')'; }
  }
  const refLines = (reference || []).map((f) => norm(f.statement)).filter(Boolean);
  const sameAsNow = reference && refLines.length === nowReg.length && refLines.every((s, i) => s === norm(nowReg[i].statement));

  // ── run the real code ──────────────────────────────────────────────────────────────────────────
  let thrown = null, how = '';
  const run = async () => {
    if (!feature) {
      how = 'generateStage({ projectId: ' + b.projectId + ', kind: ' + kind + ', buildId: ' + b.id + ' })';
      return svc.generateStage({ projectId: b.projectId, kind, buildId: b.id });
    }
    if (!b.linkedScriptId) throw new Error('build ' + b.id + ' is not linked to a script (linkedScriptId is null) — the feature writer finds its build only through that link, so there is no feature-writer prompt to capture for it');
    if (target === 'FEATURE_ENTRY') { how = 'regenerateFeature(' + b.linkedScriptId + ', rewrite)'; return svc.regenerateFeature(b.linkedScriptId, undefined, 'rewrite'); }
    // FEATURE_SCENE: regenerateFeature's own argument assembly (:4670-4679), minus the revision it
    // creates at :4684 — the one write that stands before the model; revId is the doc's current one,
    // used only for saves that come after the capture.
    const doc = await ro.scriptDocument.findUnique({ where: { id: b.linkedScriptId } });
    const build = await ro.developmentBuild.findFirst({ where: { linkedScriptId: doc.id } });
    const stages = await svc.pipeline(doc.projectId, build ? build.id : null);
    const existing = svc.sceneCards(stages);
    how = 'generateScriptAsync(' + doc.id + ', ' + doc.activeRevisionId + ', ' + doc.projectId + ', pipeline(…), sceneCards → ' + existing.length + ' card(s))';
    return svc.generateScriptAsync(doc.id, doc.activeRevisionId, doc.projectId, stages, existing);
  };
  try {
    await Promise.race([run(), new Promise((_, rej) => setTimeout(() => rej(new Error('TIMEOUT after 180s (instrument)')), 180000))]);
  } catch (e) { thrown = e; }

  // ── verdict ────────────────────────────────────────────────────────────────────────────────────
  const before = events.filter((e) => e.when === 'before');
  const deviations = before.filter((e) => e.type !== 'model-call-CAPTURED');
  const report = { build: b.id, name: b.name, target, targetTask, how, referenceFrom, referenceLines: refLines.length, referenceSameAsTranscribedNow: !!sameAsNow, events };
  let status;
  if (!captured) {
    status = 'NOT CAPTURED';
    report.reason = thrown && thrown !== CAPTURED ? String(thrown.message || thrown).slice(0, 600) : 'the run ended without calling ' + targetTask;
  } else {
    status = !refLines.length ? 'CAPTURED — NO REFERENCE (the build has no register to look for; no register count)'
      : deviations.length ? 'CAPTURED, WITH PATH DEVIATIONS BEFORE THE CAPTURE' : 'CAPTURED CLEAN';
    const fields = Object.entries(captured.fields);
    const whole = norm(fields.map(([, v]) => v).join('\n'));
    let block = '', blockField = null;
    for (const [key, val] of fields) {
      const at = val.indexOf(REGISTER_HEADER);
      if (at < 0) continue;
      const lines = val.slice(at).split('\n');
      let end = 2;   // the two header lines
      while (end < lines.length && (lines[end] === '' || /^\[.*\]$/.test(lines[end]) || lines[end].startsWith('- '))) end++;
      block = lines.slice(0, end).join('\n'); blockField = key; break;
    }
    const nb = norm(block);
    report.capture = {
      method: captured.method, task: captured.task,
      fields: Object.fromEntries(fields.map(([k, v]) => [k, v.length + ' chars'])),
      registerBlock: block ? ('present in `' + blockField + '`, ' + block.length + ' chars') : 'ABSENT',
    };
    if (refLines.length) Object.assign(report.capture, {
      inRegisterBlock: refLines.filter((s) => nb.includes(s)).length, anywhereInPayload: refLines.filter((s) => whole.includes(s)).length, of: refLines.length,
      missingFromBlock: refLines.map((s, i) => (nb.includes(s) ? null : '#' + (i + 1) + ' ' + s.slice(0, 90))).filter(Boolean),
    });
    // --phrase, folded in from the retired verify-stage-prompt.js. Checked ONLY here, on a capture:
    // a phrase count exists only when there is a prompt to count it in. Matched after normalising
    // curly quotes (the bible writes "don’t") and whitespace (registerDirective joins wrapped lines);
    // the exact, un-normalised count is reported beside it so a normalised hit is visible as one.
    if (PHRASES.length) {
      const q = (t) => norm(String(t).replace(/[‘’]/g, "'").replace(/[“”]/g, '"'));
      const count = (hay, needle) => (needle ? hay.split(needle).length - 1 : 0);
      const W = q(fields.map(([, v]) => v).join('\n')), B = q(block);
      const rawWhole = fields.map(([, v]) => v).join('\n');
      report.capture.phrases = PHRASES.map((ph) => {
        const total = count(W, q(ph)), inside = count(B, q(ph));
        return { phrase: ph, found: total > 0, total, inRegisterBlock: inside, outsideRegisterBlock: total - inside, exact: count(rawWhole, ph) };
      });
    }
    if (answered) {
      // Two captures from one run, compared — nothing rebuilt. Does the later piece carry the first
      // piece's prompt whole, and the same system prompt?
      const u2 = String(captured.fields.user || '');
      report.capture.continuation = {
        piece1UserChars: answered.user.length, piece2UserChars: u2.length,
        piece2BeginsWithPiece1: u2.startsWith(answered.user),
        suffixChars: u2.startsWith(answered.user) ? u2.length - answered.user.length : null,
        sameSystem: String(captured.fields.system || '') === answered.system,
        suffixHead: u2.startsWith(answered.user) ? u2.slice(answered.user.length, answered.user.length + 160) : null,
      };
    }
    report.payload = captured.fields;
  }
  report.status = status;

  console.log('BUILD   ' + b.id + ' ' + JSON.stringify(b.name) + '   TARGET ' + target + ' (task ' + targetTask + ')');
  console.log('RAN     ' + (how || '(did not start)'));
  console.log('REF     ' + (refLines.length ? refLines.length + ' register line(s) — ' + referenceFrom + (sameAsNow ? '; identical to a transcription made now' : '; DIFFERS from a transcription made now (' + nowReg.length + ')') : 'none'));
  console.log('STATUS  ' + status);
  if (report.reason) console.log('REASON  ' + report.reason);
  for (const e of events) console.log('  ' + e.when.padEnd(7) + ' ' + e.type.padEnd(21) + ' ' + e.what);
  if (report.capture) {
    const c = report.capture;
    console.log('CAPTURE ' + c.method + ' ' + c.task + ' · fields ' + JSON.stringify(c.fields));
    console.log('REGISTER BLOCK ' + c.registerBlock);
    if (c.of) console.log('COUNT   ' + c.inRegisterBlock + ' of ' + c.of + ' register lines in the register block · ' + c.anywhereInPayload + ' of ' + c.of + ' anywhere in the payload');
    if (c.missingFromBlock && c.missingFromBlock.length && c.missingFromBlock.length <= 10) c.missingFromBlock.forEach((m) => console.log('  missing ' + m));
    for (const p of c.phrases || []) {
      console.log('PHRASE  ' + (p.found ? 'FOUND ' : 'ABSENT') + ' ' + JSON.stringify(p.phrase) + ' ×' + p.total + ' (in the register block ' + p.inRegisterBlock
        + ', outside it ' + p.outsideRegisterBlock + '; exact, un-normalised ' + p.exact + ')');
    }
    if (c.continuation) {
      const k = c.continuation;
      console.log('PIECES  piece 1 user ' + k.piece1UserChars + ' chars · piece 2 user ' + k.piece2UserChars + ' chars · piece 2 begins with piece 1 byte for byte: '
        + (k.piece2BeginsWithPiece1 ? 'YES (+' + k.suffixChars + ' chars of suffix)' : 'NO') + ' · same system prompt: ' + (k.sameSystem ? 'YES' : 'NO'));
      if (k.suffixHead) console.log('SUFFIX  ' + JSON.stringify(k.suffixHead) + '…');
    }
  }
  if (!captured && PHRASES.length) console.log('PHRASES not checked — nothing was captured, so there is no prompt to find them in (' + PHRASES.length + ' requested)');
  if (OUT) { fs.writeFileSync(OUT, JSON.stringify(report, null, 2)); console.log('WROTE   ' + OUT); }
  await real.$disconnect();
  // Exit codes keep the two zeros apart: 3 is "no prompt", 1 is "a prompt, and a phrase not in it".
  const absent = (report.capture && report.capture.phrases || []).filter((p) => !p.found).length;
  process.exit(!captured ? 3 : absent ? 1 : 0);
})().catch((e) => { console.error('INSTRUMENT ERROR (no count):', e); process.exit(4); });
