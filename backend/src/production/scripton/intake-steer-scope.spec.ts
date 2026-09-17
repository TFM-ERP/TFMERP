/**
 * F3 — the last shared read in the CREATIVE BRIEF path.
 *
 * Every brief field in `intakeSteer` became build-scoped in 3a. The direction did not: a build with
 * no `build_directions` row fell through to `intake.treatment`, the one-row-per-project workspace
 * value, which on 17 Sep held a ~5,000-word FAITHFUL direction belonging to a different build.
 *
 * The defect was visible in captured prompts before it was fixed here: the "no direction" build's
 * TREATMENT prompt carried "Compression by function" and "You don't get to disappear" — text from
 * another build's direction. That is what these tests prevent returning.
 *
 * Driven through a stub Prisma so the assertion is on the steer text the model would actually
 * receive, not on a re-implementation of the resolution.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { ScripOnService } from './scripton.service';

const WORKSPACE_DIRECTION = 'FAITHFUL - change: Compression by function, not by headcount.';

/** `intakeSteer` is private and the whole point is what it emits, so it is called by name. */
const steer = (svc: any, buildId?: string | null) => (svc as any).intakeSteer('proj-1', buildId);

const svcWith = (opts: { dirRow?: any; brief?: any }) => {
  const prisma: any = {
    intakeProfile: { findUnique: async () => ({ treatment: WORKSPACE_DIRECTION, genres: ['Romance'], tone: 'Workspace tone' }) },
    developmentBuild: { findUnique: async () => ({ brief: opts.brief || { genres: ['Thriller'], tone: 'Build tone' } }) },
    buildDirection: { findFirst: async () => opts.dirRow || null },
  };
  const svc: any = new ScripOnService(prisma, {} as any, {} as any);
  svc.log = { log: () => {}, warn: () => {}, error: () => {}, debug: () => {}, verbose: () => {} };
  // buildDirectionRow's own shape is not under test here; the fallback it feeds is.
  svc.buildDirectionRow = async () => opts.dirRow || null;
  return svc;
};

test('a build with NO direction row of its own gets no direction at all', async () => {
  const out = await steer(svcWith({}), 'build-1');
  assert.ok(!out.includes('Compression by function'), 'the workspace direction is still reaching a build that never set one');
  assert.ok(!out.includes('Narrative treatment/style'), 'a direction line was emitted with nothing to put in it');
});

test('a build WITH a direction row still gets its own', async () => {
  // The row shape directionSteerText actually reads: label / change / tone / keep / note.
  const dirRow = { label: 'FAITHFUL', change: 'Its own direction, not the workspace one.', keep: 'The bracelet clasp.' };
  const out = await steer(svcWith({ dirRow }), 'build-1');
  assert.ok(out.includes('Narrative treatment/style'), 'a build with a direction row emitted no direction line');
  assert.ok(out.includes('Its own direction'), 'the build direction did not reach the prompt');
  assert.ok(!out.includes('Compression by function'), 'the workspace direction leaked in alongside the build one');
});

test('the LEGACY path — no buildId — keeps the workspace row, which is the only source it has', async () => {
  const out = await steer(svcWith({}), null);
  assert.ok(out.includes('Compression by function'), 'the legacy project path lost its only direction source');
});

test('the brief fields were already scoped, and stay scoped', async () => {
  // Guards the 3a behaviour this change sits beside: with a buildId the build answers for itself.
  const withBuild = await steer(svcWith({}), 'build-1');
  assert.ok(withBuild.includes('Thriller'), 'the build brief no longer reaches the prompt');
  assert.ok(!withBuild.includes('Romance'), 'the workspace genres are back in a build prompt');
  const legacy = await steer(svcWith({}), null);
  assert.ok(legacy.includes('Romance'), 'the legacy path lost the workspace brief');
});
