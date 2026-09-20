/**
 * READ-ONLY. Extracts text from the ADCB statement PDFs and reports every credit
 * line, so a named receipt can be traced. Uses pdf-parse, already a dependency.
 *
 *   node prisma/scan-bank-statements.js "<folder>" [grep-term]
 */
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const folder = process.argv[2];
const term = (process.argv[3] || '').toLowerCase();

function listPdfs(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listPdfs(full));
    else if (/\.pdf$/i.test(e.name)) out.push(full);
  }
  return out;
}

async function main() {
  const files = listPdfs(folder).sort();
  for (const f of files) {
    let text = '';
    let err = null;
    try {
      const data = await pdf(fs.readFileSync(f));
      text = data.text || '';
    } catch (e) {
      err = e.message ? e.message.slice(0, 80) : String(e);
    }

    const rel = path.relative(folder, f);
    if (err) {
      console.log(`--- ${rel}  [UNREADABLE: ${err}]`);
      continue;
    }
    if (text.trim().length < 40) {
      console.log(`--- ${rel}  [no extractable text - likely a scan or protected]`);
      continue;
    }

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

    // Statement period, if the header carries one.
    const period = lines.find((l) => /statement (period|of account)|from .* to /i.test(l)) || '';

    const hits = [];
    for (const l of lines) {
      const low = l.toLowerCase();
      if (term && low.includes(term)) hits.push(`TERM  ${l}`);
      // Any line carrying a round 10,000 or 20,000 figure.
      if (/\b(10,000\.00|20,000\.00|10,000|20,000)\b/.test(l)) hits.push(`ROUND ${l}`);
    }

    console.log(`--- ${rel}  (${lines.length} lines) ${period ? '| ' + period.slice(0, 70) : ''}`);
    for (const h of [...new Set(hits)].slice(0, 25)) console.log(`      ${h.slice(0, 180)}`);
    if (hits.length === 0) console.log('      (no 10,000 / 20,000 lines)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
