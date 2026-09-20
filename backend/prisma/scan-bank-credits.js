/**
 * READ-ONLY. Lists every money-IN line in the readable ADCB statements, so a
 * remembered receipt can be traced to a date and a payer name.
 *
 *   node prisma/scan-bank-credits.js "<folder>"
 */
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const folder = process.argv[2];

function listPdfs(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listPdfs(full));
    else if (/\.pdf$/i.test(e.name) && /adcbstmt|statement/i.test(e.name)) out.push(full);
  }
  return out;
}

// A credit narrative on an ADCB business statement.
const CREDIT = /(B\/O|B\/O_|INW|INWARD|CDM|CASH DEP|CHQ DEP|CHEQUE DEP|I\/W|CREDIT|REFUND|REV )/i;

async function main() {
  const files = listPdfs(folder).sort();
  const unreadable = [];

  for (const f of files) {
    let text = '';
    try {
      text = (await pdf(fs.readFileSync(f))).text || '';
    } catch (e) {
      unreadable.push(path.relative(folder, f));
      continue;
    }
    if (text.trim().length < 40) {
      unreadable.push(path.relative(folder, f) + ' (no text)');
      continue;
    }

    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const periods = lines.filter((l) => /for the period from/i.test(l));
    const period = periods.length ? periods[0].replace(/.*for the period from/i, '').trim() : '?';

    const credits = lines.filter((l) => /^\d{2}\/\d{2}\/\d{4}/.test(l) && CREDIT.test(l));

    console.log(`\n=== ${path.relative(folder, f)}  |  ${period}`);
    if (credits.length === 0) {
      console.log('    (no credit lines matched)');
      continue;
    }
    for (const c of credits) console.log('    ' + c.slice(0, 165));
  }

  console.log('\n=== PASSWORD-PROTECTED / UNREADABLE ===');
  for (const u of unreadable) console.log('  ' + u);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
