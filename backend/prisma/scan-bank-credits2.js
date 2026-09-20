/**
 * READ-ONLY. Rebuilds wrapped ADCB statement rows (pdf-parse splits a wrapped
 * narrative across several lines) and lists every money-IN line.
 *
 * A row is money-in when the running balance goes UP compared with the previous
 * row, which avoids having to guess the debit/credit column from glued text.
 *
 *   node prisma/scan-bank-credits2.js "<folder>"
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
    else if (/\.pdf$/i.test(e.name) && /adcbstmt|e-statement|statement of account/i.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

const DATE = /^(\d{2}\/\d{2}\/\d{4})/;
const NUM = /(\d{1,3}(?:,\d{3})*\.\d{2})/g;

function num(s) {
  return Number(s.replace(/,/g, ''));
}

/** Join wrapped rows: a new row starts at a date, everything else appends. */
function rebuild(lines) {
  const rows = [];
  for (const l of lines) {
    if (DATE.test(l)) rows.push(l);
    else if (rows.length) rows[rows.length - 1] += ' ' + l;
  }
  return rows;
}

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
    const periodLine = lines.find((l) => /for the period from/i.test(l)) || '';
    const period = periodLine.replace(/.*for the period from/i, '').trim().slice(0, 30);

    const rows = rebuild(lines).filter((r) => !/^\d{2}\/\d{2}\/\d{4}\s*$/.test(r));

    let prevBal = null;
    const credits = [];
    for (const r of rows) {
      const nums = r.match(NUM);
      if (!nums || nums.length === 0) continue;
      const bal = num(nums[nums.length - 1]);
      if (prevBal !== null) {
        const delta = Math.round((bal - prevBal) * 100) / 100;
        if (delta > 0.009) {
          credits.push({ delta, row: r });
        }
      }
      prevBal = bal;
    }

    console.log(`\n=== ${path.relative(folder, f)}  |  ${period}`);
    if (credits.length === 0) {
      console.log('    (no money-in rows detected)');
    }
    for (const c of credits) {
      const narrative = c.row.replace(NUM, '').replace(/\s+/g, ' ').slice(0, 110);
      console.log(`    +${c.delta.toFixed(2).padStart(12)}  ${narrative}`);
    }
    const total = credits.reduce((a, c) => a + c.delta, 0);
    if (credits.length) console.log(`    -- total in: ${total.toFixed(2)}`);
  }

  console.log('\n=== PASSWORD-PROTECTED / UNREADABLE (not opened) ===');
  for (const u of unreadable) console.log('  ' + u);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
