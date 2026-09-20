/**
 * READ-ONLY. Sweeps every document in the connected Commercials/TFM/2025 folder
 * (docx and pdf) and pulls out the document kind, number, date and grand total,
 * so the folder can be reconciled against the ledger.
 *
 *   node prisma/scan-commercials-2025.js "<folder>"
 */
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const AdmZip = null; // not needed; docx handled with a tiny inflate via zlib
const zlib = require('zlib');

const folder = process.argv[2];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(docx|pdf)$/i.test(e.name) && !e.name.startsWith('~')) out.push(full);
  }
  return out;
}

/** Minimal zip reader: pull one entry out of a .docx by central-directory scan. */
function readZipEntry(buf, wanted) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return null;
  let off = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.slice(off + 46, off + 46 + nameLen).toString('utf8');
    if (name === wanted) {
      const lnLen = buf.readUInt16LE(localOff + 26);
      const leLen = buf.readUInt16LE(localOff + 28);
      const start = localOff + 30 + lnLen + leLen;
      const raw = buf.slice(start, start + compSize);
      try {
        return method === 0 ? raw : zlib.inflateRawSync(raw);
      } catch {
        return null;
      }
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}

function strip(xml) {
  return xml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/w:tc>/g, ' | ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&');
}

async function textOf(file) {
  if (/\.pdf$/i.test(file)) {
    try {
      return (await pdf(fs.readFileSync(file))).text || '';
    } catch {
      return '';
    }
  }
  const buf = fs.readFileSync(file);
  let out = '';
  for (let i = 1; i <= 4; i++) {
    const h = readZipEntry(buf, `word/header${i}.xml`);
    if (h) out += strip(h.toString('utf8')) + '\n';
  }
  const d = readZipEntry(buf, 'word/document.xml');
  if (d) out += strip(d.toString('utf8'));
  return out;
}

const NUMRE =
  /(Inv\.?\s*No\.?|Invoice\.?\s*No\.?|Invoice\s*No\.?|I\.\s*No\.?|P\.?I\.?\s*No\.?|Quot\.?\s*No\.?|QTN\.?\s*No\.?)\s*:?\s*([A-Za-z0-9./-]{3,14})/i;
const DATERE = /Date\.?\s*:?\s*([A-Za-z]{3,9}\.?\s*\d{1,2}(?:st|nd|rd|th)?\s*,?\s*20\d{2}|\d{1,2}[\/ ][A-Za-z]{3,9},?\s*20\d{2}|\d{2}\/\d{2}\/20\d{2})/i;
const TOTRE = /Grand\s*Total\s*(?:Due)?\s*\|?\s*(?:AED)?\s*([\d,]+\.?\d{0,2})/i;
const TOT2 = /(?:^|\|)\s*Total\s*\|?\s*(?:AED)?\s*([\d,]+\.?\d{0,2})/i;

function kind(t) {
  if (/tax invoice/i.test(t)) return 'TAX INVOICE';
  if (/proforma/i.test(t)) return 'PROFORMA';
  if (/^\s*quotation|quotation\s*$|Quot\.?\s*No/im.test(t) && !/invoice/i.test(t)) return 'QUOTATION';
  if (/invoice/i.test(t)) return 'INVOICE';
  if (/quotation/i.test(t)) return 'QUOTATION';
  return '?';
}

async function main() {
  const files = walk(folder).sort();
  console.log(`# ${files.length} documents under ${path.basename(folder)}\n`);
  for (const f of files) {
    const t = await textOf(f);
    const flat = t.replace(/\s+/g, ' ');
    if (!flat.trim()) {
      console.log(`${path.relative(folder, f)}\n    [no extractable text]`);
      continue;
    }
    const n = flat.match(NUMRE);
    const d = flat.match(DATERE);
    const g = flat.match(TOTRE) || flat.match(TOT2);
    console.log(path.relative(folder, f));
    console.log(
      `    kind=${kind(flat)}  no=${n ? n[2] : '?'}  date=${d ? d[1].trim() : '?'}  total=${
        g ? g[1] : '?'
      }`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
