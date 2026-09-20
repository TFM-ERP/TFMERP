# ScripON — the MINUTEMEN source restore, and three findings the investigation left behind

14 September 2026. Read this before anyone clicks **Regenerate** on the MINUTEMEN build.

---

## 1. What was restored

`development_builds.cmtke96j000085ad8tax70kcq` — build name `"MINUTEMWN"` (the typo is in the row),
`status=DRAFT`, created 2 Sep 2026 17:52:44Z.

Its two uploaded sources carried **no extracted text at all** — not an empty string, but no `text`,
`chars` or `note` key on either entry — and `brief.sourceText` was `""`. Both files were, and are,
intact on disk. They were re-read and the two fields written back:

| | before | after |
|---|---|---|
| `brief` sha256(16), key-order independent | `03bd5f4e8baf374f` | `e1d2e94f991af556` |
| `brief.sourceText` | 0 chars | **47,441 chars** |
| `sources[0]` `e73d3ba5-…docx` (14,175,762 B) | `text`/`chars`/`note` ABSENT | `text` + `chars` **42,373**, no note |
| `sources[1]` `e87c9c32-…pdf` (1,608,533 B) | `text`/`chars`/`note` ABSENT | `text` + `chars` **5,066**, no note |
| the other 46 `brief` keys | — | **none changed** (per-key deep compare) |

42,373 + 5,066 + 2 (the `\n\n` join) = 47,441. Nothing folded, nothing doubled. The write itself ran
once, `UPDATE affected rows: 1`, pinned to that id.

**How well each column above is attested, since they are not attested equally.** The input lengths
were reproduced at a second desk before the write was authorised. The resulting row state was read
once, by the process that wrote it.

**Method, so it can be repeated or distrusted on its own terms.** The one-off imported `extractText`
and `assembleCorpus` from `source-ingest.util` — the same functions `materialiseSources` calls — and
computed `chars` the way that method computes it (`String(text||'').length`, untrimmed). It required
`common/buffer-pool` first, so it ran at the server's `Buffer.poolSize`. The write was a single
two-key jsonb merge in the shape of the `storyYear` write at `scripton.service.ts:3179`, guarded on
`n > 0`. No route was added, no brief was rewritten, no other row was touched.

**Why it was empty has nothing to do with buffer pooling.** `materialiseSources` arrived 3 Sep in
6838a1d; this build is 2 Sep. The keys did not exist yet. The `sourceText`-erasure bug fixed in
a3e9048 needs `materialiseSources` to run and writes a different table, so it cannot reach this row
either. The chronology closes by data flow: no path ever runs `materialiseSources` over
`development_builds.brief.sources` — the only three writes to a build's brief are `createBuild`
(`:5670`, verbatim from the request body), the version-switch restore (`:826`) and the `storyYear`
merge (`:3179`).

---

## 2. Before anyone clicks Regenerate: **the first click is an error by design**

`scripton.service.ts:1249` — when `canonState` is null and the source is ≥ 400 characters, the stage
call throws *"This build predates the canon step… Try this stage again in a minute"* and fires
`extractCanonForBuild` in the background. `canonState` on this build **is** null, because `hasSource`
gates on `sourceText` at `createBuild` only and restoring the text does not retroactively run canon.

So: **the first Regenerate returns an error. The second proceeds.** That is the designed behaviour
of a build whose source arrived after its creation — not a symptom of the restore.

The 47,441 characters do reach generation: `:1215` reads
`asSourceText(buildRow.brief.sourceText) || intakeRow.sourceText || seed`, so the build's own field
wins over the frozen workspace row.

**What exists on the build today** — 8 stages, one with any content:

| stage | version |
|---|---|
| LOGLINE | v1 DRAFT, 229 chars, 2 Sep 17:54 |
| SYNOPSIS · TREATMENT · BEATS · SCENES · STEP_OUTLINE · DRAFT · COVERAGE | no version row, no `currentVersionId` |

The only artifact written against the empty source is a 229-character logline from two minutes after
the build was created. Nothing was built on top of it. Regenerating costs one logline.

---

## 3. Finding — `script-import.service.ts:113` records its successes and not its failures

The breakdown importer throws `Could not read script text from the file` when extraction yields
under 50 characters. It persists **no per-file row**: a lost PDF leaves an error on screen and
nothing in the database.

Its successes are visible — 122 strips tagged `Imported:`, from 2 distinct PDFs. Its failures are
structurally invisible to any query, at any date, by any method. This is why the cross-table sweep
below can report "the signature is absent" and that sentence is weaker than it sounds.

---

## 4. Finding — the pooling bug is real on the files and absent from the data

Every text/json column in the database — **2,863 of them** — was swept for `.pdf`. Four tables
persist a per-file extraction result: `script_revisions`, `master_script_revisions`,
`creative_briefs`, `development_builds.brief` (and `intake_profiles.sources` by the same extractor).

**Rows where a PDF yielded 0 characters: 3. Rows where a PDF *under 32 KB* yielded 0 characters: 0.**

The five PDF references inside those three rows are 1,608,533 · 1,608,533 · 189,489 · 4,027,553 ·
71,447 bytes. The smallest is 2.2× the widest pooling window this repo has ever run. 32 KB is
Node 24's `poolSize 65536 >>> 1`, so the bound is date-independent and needs no upgrade window.

The fix in 4722466 stands on its own measurement (134 real PDFs: 122 extracted under Node 24's
default, 129 with the pool off). What is *not* claimed is that it recovered any recorded loss —
no row in this database shows the bug having fired, and §3 above says why absence of a row is not
absence of a loss.

---

## 5. Disclosure — the raw merge bypasses `@updatedAt`

After the restore, `development_builds.updatedAt` on this row still reads **8 Sep 19:46:26Z**. A
`$executeRaw` merge does not touch Prisma's `@updatedAt`. **Every `storyYear` write at `:3179`
shares this**, and has since it landed.

§38 records the converse — *a timestamp that any write bumps cannot date a specific write*. This is
the inverse: a timestamp that some writes do not bump cannot rule a write out either. That matters
here more than usual, because `updatedAt` on this exact row is the field this investigation reasoned
from when asking whether the a3e9048 bug was in scope. It happened to be the wrong question — the
data-flow argument in §1 settles it without the timestamp — but the reasoning was one coincidence
away from being wrong for a reason the field could not disclose.

Not worth a fix tonight. Worth knowing before the next investigation reads that column as evidence.

---

## Not done, deliberately

- **Canon was not run.** `canonState` stays null; §2 says what happens on the first click.
- **No stage was touched.** The 229-character logline was written against no source and restoring
  does not change it.
- **No other build, and not the intake row `cmqod2tnh`** — which carries the same two files with the
  same missing keys, from 22 Jun, and is out of scope by the same chronology.
