/**
 * POOLED BUFFERS BREAK PDF PARSING. Turn the pool off, once, for the process.
 *
 * Node allocates every Buffer under `Buffer.poolSize >>> 1` out of one shared slab. pdf-parse vendors
 * a ~2016 copy of pdf.js that re-buffers its input, and on a pooled allocation that engine reads the
 * wrong bytes: the file comes back "Invalid PDF structure" or simply empty.
 *
 * MEASURED ON THIS REPO'S OWN uploads/ — 134 real PDFs through extractText:
 *
 *     poolSize  8192  (Node 22's default)  cutoff  4096  →  129 extracted,  5 failed
 *     poolSize 65536  (Node 24's default)  cutoff 32768  →  122 extracted, 12 failed
 *     poolSize     0  (this file)          cutoff     0  →  129 extracted,  5 failed
 *
 * The 5 constant failures are genuine scans with no text layer. The other 7 are ordinary files that
 * Node 24 alone loses — five sides-*.pdf (6,281–16,821 bytes) and two of the Jason Quick script
 * exports (8,937 and 8,987) — and they fail SILENTLY: zero characters, and the build continues with
 * no source text. That is how a 105,179-character bible becomes an empty brief.
 *
 * WHY 0 AND NOT 8192. The cutoff is not a threshold you can sit under: jasonquick-pink (8,982 bytes)
 * passes while blue (8,937) and white (8,987) fail, and a synthetic sweep at 8192 gives
 * 662 ✗, 862 ✗, 1062 ✓, 1363 ✗, 1663 ✗, 2063 ✓. Non-monotonic, so any pool leaves some sizes broken;
 * 8192 would merely move the broken band under ~2 KB. Only 0 removes the class.
 *
 * WHY HERE AND NOT AT EACH CALL SITE. There are five, and a sixth is one import away:
 *     production/scripton/source-ingest.util.ts:172
 *     production/breakdown/script-import.service.ts:113
 *     production/script/script.service.ts:376
 *     production/brief/creative-brief.service.ts:142 and :154
 * A knob that must be re-applied at every call site is a knob that will be missed at the next one.
 *
 * WHAT IT COSTS, measured rather than assumed: the unit suite runs 2,025–2,041 ms pooled and
 * 1,932–1,968 ms unpooled, and the 134-PDF ingest sweep takes 3,290 ms pooled and 3,293 ms unpooled.
 * No measurable cost either way at this scale.
 *
 * Its proper home is `main.ts`, beside the other process-wide settings. It is here because that file
 * currently carries uncommitted work of its own; importing this module from `AppModule` runs it at
 * the same moment — before the app is created, and long before any request can parse a PDF.
 */
Buffer.poolSize = 0;

/** Exported so a caller can assert the setting took, and so the import is never mistaken for dead. */
export const BUFFER_POOL_DISABLED = true;
