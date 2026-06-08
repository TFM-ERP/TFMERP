/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * analyze-emails.js — review both mailboxes (.msg), extract & classify contacts,
 * compare against the LIVE database, and enrich/create at MASTER level only.
 *
 * Runs on YOUR machine (where the emails AND the database both live).
 *
 *   node tools/analyze-emails.js "C:\emails"            # DRY RUN (writes a report, changes nothing)
 *   node tools/analyze-emails.js "C:\emails" --apply    # commit master-level updates/creates
 *
 * Outputs (always written) to ../email-analysis/ :
 *   report.md       human report (new / updated / duplicates / classifications / insights)
 *   contacts.csv    every name-bearing contact + classification + DB match + action
 *   actions.json    machine plan of every create/enrich
 *   digest.json     threads, attachment names & signal keywords (for further analysis)
 *
 * RULES honoured:
 *  - A contact is created ONLY if it has a clearly identifiable full name (>=2 name tokens).
 *  - Companies/role-mailboxes/automated senders are NOT created as people.
 *  - Everything goes to master tables: Contact (people, typed), CrewMember (crew). No project scope.
 *  - Nothing is written unless --apply is passed; dry-run shows the full plan first.
 */
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const ROOT = process.argv[2] || 'C:\\emails';
const APPLY = process.argv.includes('--apply');
const OUT = path.join(__dirname, '..', '..', 'email-analysis');
const prisma = new PrismaClient();

// ───────────────────────── CFBF / .msg parser (no deps) ─────────────────────
const ENDOFCHAIN = 0xfffffffe, FREESECT = 0xffffffff;
function parseMsg(buf) {
  if (buf.length < 512 || buf.readUInt32LE(0) !== 0xe011cfd0) throw new Error('not a .msg');
  const secSize = 1 << buf.readUInt16LE(30);
  const miniSize = 1 << buf.readUInt16LE(32);
  const numFat = buf.readUInt32LE(44), dirStart = buf.readUInt32LE(48);
  const miniCutoff = buf.readUInt32LE(56), miniFatStart = buf.readUInt32LE(60), numMiniFat = buf.readUInt32LE(64);
  const difatStart = buf.readUInt32LE(68), numDifat = buf.readUInt32LE(72);
  const secOff = (s) => (s + 1) * secSize;
  const fatSectors = [];
  for (let i = 0; i < 109 && fatSectors.length < numFat; i++) { const v = buf.readUInt32LE(76 + i * 4); if (v !== FREESECT && v !== ENDOFCHAIN) fatSectors.push(v); }
  let ds = difatStart, g = 0;
  while (numDifat > 0 && ds !== ENDOFCHAIN && ds !== FREESECT && g++ < 100000) {
    const base = secOff(ds);
    for (let i = 0; i < secSize / 4 - 1; i++) { const v = buf.readUInt32LE(base + i * 4); if (v !== FREESECT && v !== ENDOFCHAIN) fatSectors.push(v); }
    ds = buf.readUInt32LE(base + secSize - 4);
  }
  const fat = [];
  for (const fsec of fatSectors) { const base = secOff(fsec); for (let i = 0; i < secSize / 4; i++) fat.push(buf.readUInt32LE(base + i * 4)); }
  const readChain = (start) => { const p = []; let s = start, n = 0; while (s !== ENDOFCHAIN && s !== FREESECT && s < fat.length && n++ < 1e6) { const o = secOff(s); p.push(buf.subarray(o, o + secSize)); s = fat[s]; } return Buffer.concat(p); };
  const dirBuf = readChain(dirStart);
  const entries = [];
  for (let off = 0; off + 128 <= dirBuf.length; off += 128) {
    const nameLen = dirBuf.readUInt16LE(off + 64), type = dirBuf.readUInt8(off + 66);
    if (type === 0) continue;
    entries.push({ name: dirBuf.toString('utf16le', off, off + Math.max(0, nameLen - 2)), type,
      left: dirBuf.readUInt32LE(off + 68), right: dirBuf.readUInt32LE(off + 72), child: dirBuf.readUInt32LE(off + 76),
      start: dirBuf.readUInt32LE(off + 116), size: dirBuf.readUInt32LE(off + 120) });
  }
  if (!entries.length) return { attachments: [], recipients: [] };
  const root = entries[0];
  const miniStream = readChain(root.start);
  const miniFat = [];
  if (numMiniFat > 0) { const mf = readChain(miniFatStart); for (let i = 0; i < mf.length / 4; i++) miniFat.push(mf.readUInt32LE(i * 4)); }
  const readMini = (start, size) => { const p = []; let s = start, n = 0; while (s !== ENDOFCHAIN && s !== FREESECT && s < miniFat.length && n++ < 1e6) { const o = s * miniSize; p.push(miniStream.subarray(o, o + miniSize)); s = miniFat[s]; } return Buffer.concat(p).subarray(0, size); };
  const data = (e) => (e.size < miniCutoff ? readMini(e.start, e.size) : readChain(e.start).subarray(0, e.size));
  const children = (idx) => { const out = []; const visit = (i) => { if (i === FREESECT || i < 0 || i >= entries.length) return; out.push(entries[i]); visit(entries[i].left); visit(entries[i].right); }; visit(entries[idx].child); return out; };
  const idxOf = (e) => entries.indexOf(e);
  const propText = (mem, tag) => { const u = mem.find((m) => m.name.toLowerCase() === `__substg1.0_${tag}001f`); if (u) return data(u).toString('utf16le').trim(); const a = mem.find((m) => m.name.toLowerCase() === `__substg1.0_${tag}001e`); if (a) return data(a).toString('latin1').trim(); return undefined; };
  const top = children(0);
  const headers = propText(top, '007d'); // PR_TRANSPORT_MESSAGE_HEADERS (raw RFC822)
  const out = {
    subject: propText(top, '0037'), fromName: propText(top, '0c1a'),
    fromEmail: propText(top, '0c1f') || propText(top, '5d01'),
    body: (propText(top, '1000') || '').slice(0, 6000), headers: headers || '',
    recipients: [], attachments: [],
  };
  for (const e of top) {
    if (e.type === 1 && /^__recip_version1\.0_/i.test(e.name)) {
      const m = children(idxOf(e));
      const name = propText(m, '3001'); const email = propText(m, '39fe') || propText(m, '3003') || propText(m, '5ff6');
      const rtype = (() => { const t = m.find((x) => /__substg1\.0_0c150003$/i.test(x.name)); return t ? data(t).readUInt32LE(0) : 0; })();
      if (name || email) out.recipients.push({ name, email, kind: rtype === 2 ? 'cc' : 'to' });
    }
    if (e.type === 1 && /^__attach_version1\.0_/i.test(e.name)) {
      const m = children(idxOf(e));
      out.attachments.push(propText(m, '3707') || propText(m, '3704') || 'attachment');
    }
  }
  return out;
}

// ───────────────────────── helpers ─────────────────────────────────────────
const AUTOMATED = /(no-?reply|do-?not-?reply|notification|newsletter|mailer|bounce|postmaster|@.*mailjet|bnc3|community|digest|microsoft|outlook\.com$|googleplay|account-security|severtson|support@|info@|marketing@|team@|hello@|sales@|admin@|billing@)/i;
// Own/internal addresses — these are YOU/your staff, not external contacts.
const OWN_DOMAIN = /@(thefilmmakers\.com|filmmakers\.ae|fhefilmmakers\.com)$/i;
// Brand / system display names that slip past the full-name test.
const BADNAME = /\b(microsoft|outlook|google|apple|linkedin|facebook|instagram|netflix|amazon|adobe|paypal|dropbox|zoom|canva|notion|mailchimp|docusign|wix|godaddy|noreply|mailer|notifications?|team|account|security|newsletter|support|no reply)\b/i;
const ROLEWORD = /^(the|team|info|sales|admin|support|accounts?|hr|careers?|noreply|no reply|customer|service|help ?desk|enquir|booking|reception|community|newsletter|notifications?)\b/i;
const NAME_OK = /^[\p{L}][\p{L}.''-]+(?:\s+[\p{L}][\p{L}.''-]+){1,4}$/u; // 2-5 name tokens, letters
const EMAIL = /[A-Za-z0-9._%+-]{2,}@[A-Za-z0-9.-]+\.[A-Za-z]{2,12}/g;
const PHONE = /(?:(?:\+|00)?971[\s\-\.]?|0)5[0245678][\s\-\.]?\d{3}[\s\-\.]?\d{4}|\+\d{1,3}[\s\-]?\d[\d\s\-]{6,14}\d/g;
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const normName = (s) => (s || '').toLowerCase().replace(/\b(mr|mrs|ms|dr|eng|mr\.|dr\.)\b/g, '').replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim();
function cleanName(n) {
  if (!n) return '';
  n = n.replace(/["']/g, '').replace(/\s+/g, ' ').replace(/\(.*?\)/g, '').trim();
  n = n.replace(/\s*[-|,].*$/, '').trim(); // drop "Name - Company" / "Name, Title"
  if (n.includes('@')) return '';
  return n;
}
function isFullName(n) { return !!n && NAME_OK.test(n) && !ROLEWORD.test(n) && !BADNAME.test(n) && n.length <= 60; }
function normPhone(p) { let d = p.replace(/[^\d+]/g, ''); if (d.startsWith('00')) d = '+' + d.slice(2); if (/^0?5[0245678]\d{7}$/.test(d.replace('+', ''))) d = '+971' + d.replace(/^\+?0?/, ''); if (!d.startsWith('+') && d.length >= 11) d = '+' + d; return d; }

// classification signals
const SIG = {
  CREW: ['crew', 'day rate', 'availability', 'reel', 'showreel', 'dop', 'director of photography', 'gaffer', 'grip', 'camera operator', 'focus puller', 'vfx', 'sfx', 'editor', 'colourist', 'colorist', 'sound recordist', 'production manager', 'line producer', '1st ad', 'assistant director', 'call sheet', 'wardrobe', 'make-up', 'makeup', 'stunt', 'art director', 'location manager', 'freelance'],
  CLIENT: ['brief', 'our production', 'purchase order', 'campaign', 'deliverables', 'statement of work', 'rfp', 'kindly find', 'scope of work', 'awarded', 'your proposal', 'client'],
  VENDOR: ['quotation', 'quote', 'rental', 'hire', 'equipment', 'price list', 'rate card', 'proforma', 'supply', 'goods', 'lighting', 'grip truck', 'camera package'],
  SUPPLIER: ['invoice', 'statement of account', 'catering', 'transport', 'fuel', 'stationery', 'uniform', 'consumables'],
  SERVICE_PROVIDER: ['charter', 'fixer', 'insurance', 'legal', 'visa', 'logistics', 'post production', 'translation', 'accommodation', 'travel', 'shipping', 'customs', 'security'],
  AUTHORITY: ['permit', 'noc', 'no objection', 'approval', 'municipality', 'police', 'rta', 'twofour54', 'film commission', 'ministry', 'authority', 'pass cancel', 'tasreeh'],
  PARTNER: ['co-production', 'co production', 'partnership', 'mou', 'collaboration', 'joint venture'],
};
// Verified company classifications (online-checked) — override the keyword heuristic.
const DOMAIN_CLASS = {
  'imagenation.ae': 'PARTNER', 'breakoutfilms.com': 'PARTNER', 'electricfilms.ae': 'PARTNER',
  'pinzutufilms.com': 'PARTNER', 'ffprods.com': 'PARTNER',
  'thenudgetheory.com': 'CLIENT', 'thecheek.ae': 'CLIENT', 'seemeproduction.com': 'CLIENT', 'thecompanyfilms.com': 'CLIENT',
  'needafixer.com': 'SERVICE_PROVIDER', 'iyfilmlocations.com': 'VENDOR', 'vfxdudes.com': 'VENDOR',
  'dctabudhabi.ae': 'AUTHORITY',
};
const DOMAIN_HINT = (d) => {
  if (/\.gov\.ae$|police|rta|cma\.gov|film\.gov|twofour54|szgmc|adpolice/i.test(d)) return 'AUTHORITY';
  if (/rental|equipment|lighting|grip|camera/i.test(d)) return 'VENDOR';
  if (/charter|logistics|insurance|legal|travel|shipping|hotel|rotana|anantara/i.test(d)) return 'SERVICE_PROVIDER';
  // production/studio/agency domains → their staff are partner/client contacts, not freelance crew
  if (/films?|production|productions|studio|studios|media|pictures|entertainment|creative/i.test(d)) return 'PARTNER';
  return null;
};
function classify(c) {
  if (DOMAIN_CLASS[c.domain]) return { klass: DOMAIN_CLASS[c.domain], confidence: 0.9, reasons: ['verified-domain'] };
  const text = (c.subjects.join(' ') + ' ' + (c.bodySample || '')).toLowerCase();
  const scores = {};
  for (const [k, words] of Object.entries(SIG)) scores[k] = words.reduce((a, w) => a + (text.includes(w) ? 1 : 0), 0);
  const dh = DOMAIN_HINT(c.domain); if (dh) scores[dh] = (scores[dh] || 0) + 2;
  let best = 'OTHER', bestScore = 0;
  for (const [k, v] of Object.entries(scores)) if (v > bestScore) { best = k; bestScore = v; }
  const conf = bestScore === 0 ? 0.2 : Math.min(0.95, 0.4 + bestScore * 0.15);
  const reasons = Object.entries(scores).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`);
  return { klass: bestScore === 0 ? 'OTHER' : best, confidence: Number(conf.toFixed(2)), reasons };
}
const CONTACT_TYPE = { CREW: 'CREW_MEMBER', CLIENT: 'CLIENT_EMPLOYEE', VENDOR: 'VENDOR_EMPLOYEE', SUPPLIER: 'SUPPLIER_EMPLOYEE', SERVICE_PROVIDER: 'VENDOR_EMPLOYEE', PARTNER: 'OTHER', AUTHORITY: 'OTHER', OTHER: 'OTHER' };

// ───────────────────────── walk & parse ────────────────────────────────────
function walk(dir, acc) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, acc); else if (/\.msg$/i.test(e.name)) acc.push(p); } return acc; }

function ownerOf(fp) { const l = fp.toLowerCase(); return l.includes('qais') ? 'Qais' : l.includes('islam') ? 'Islam' : 'Other'; }
function folderOf(fp) { const l = fp.toLowerCase(); return /(sent|outbox)/.test(l) ? 'out' : 'in'; }

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  if (!fs.existsSync(ROOT)) { console.error(`Path not found: ${ROOT}`); process.exit(1); }
  const files = walk(ROOT, []);
  console.log(`Found ${files.length} .msg files under ${ROOT}`);

  const byEmail = new Map();      // email -> contact aggregate
  const threads = [];             // operational thread digest
  const attachAll = {};           // filename -> count
  const subjectKw = {};           // keyword -> count (for insights)
  const INSIGHT_KW = ['permit', 'noc', 'callsheet', 'call sheet', 'invoice', 'quotation', 'rebate', 'visa', 'insurance', 'risk assessment', 'method statement', 'budget', 'schedule', 'location', 'crew', 'shipping', 'charter', 'security', 'accommodation', 'travel', 'casting', 'contract'];

  let parsed = 0, failed = 0;
  for (const fp of files) {
    let m; try { m = parseMsg(fs.readFileSync(fp)); parsed++; } catch { failed++; continue; }
    const owner = ownerOf(fp), folder = folderOf(fp);
    const subject = (m.subject || path.basename(fp, '.msg')).replace(/\s+/g, ' ').trim();
    const bodyLc = (m.body || '').toLowerCase();
    // insight signals
    for (const k of INSIGHT_KW) if (subject.toLowerCase().includes(k) || bodyLc.includes(k)) subjectKw[k] = (subjectKw[k] || 0) + 1;
    for (const a of m.attachments || []) if (a && !/^image\d|\.png$|\.gif$/i.test(a)) attachAll[a] = (attachAll[a] || 0) + 1;
    if (!/digest|newsletter|microsoft|severtson|community|no-?reply/i.test(subject) && (m.attachments || []).length)
      threads.push({ owner, folder, subject, from: m.fromName || m.fromEmail, attachments: (m.attachments || []).slice(0, 6) });

    // candidate people: From + each recipient (name+email)
    const people = [];
    if (m.fromEmail) people.push({ name: m.fromName, email: m.fromEmail, role: folder === 'in' ? 'sender' : 'self' });
    for (const r of m.recipients || []) people.push({ name: r.name, email: r.email, role: 'recipient' });
    // phones found in this message -> attribute to the sender
    const phones = [...new Set([...(m.body || '').matchAll(PHONE)].map((x) => normPhone(x[0])).filter((p) => p.replace(/\D/g, '').length >= 9))];

    for (const p of people) {
      if (!p.email || AUTOMATED.test(p.email) || OWN_DOMAIN.test(p.email)) continue;
      const email = p.email.toLowerCase().trim();
      if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) continue;
      const nm = cleanName(p.name);
      let c = byEmail.get(email);
      if (!c) { c = { email, name: '', domain: email.split('@')[1], phones: new Set(), company: '', subjects: [], bodySample: '', in: 0, out: 0, owners: new Set() }; byEmail.set(email, c); }
      if (isFullName(nm) && nm.length > c.name.length) c.name = nm;
      c.owners.add(owner);
      if (folder === 'in') c.in++; else c.out++;
      if (c.subjects.length < 8 && subject) c.subjects.push(subject);
      if (!c.bodySample && p.role === 'sender') c.bodySample = (m.body || '').slice(0, 600);
      if (p.role === 'sender') phones.forEach((ph) => c.phones.add(ph));
    }
  }
  console.log(`Parsed ${parsed}, failed ${failed}. Unique email-bearing parties: ${byEmail.size}`);

  // keep ONLY contacts with a clear full name (rule #3)
  const named = [...byEmail.values()].filter((c) => isFullName(c.name));
  console.log(`Named contacts (full name present): ${named.length}`);

  // ── load existing master records for dedup ──
  const [contacts, crew, clients, suppliers] = await Promise.all([
    prisma.contact.findMany({ select: { id: true, name: true, email: true, mobile: true, company: true, contactType: true } }),
    prisma.crewMember.findMany({ select: { id: true, name: true, email: true, phone: true } }),
    prisma.client.findMany({ select: { id: true, companyName: true, contactName: true, email: true } }),
    prisma.supplier.findMany({ select: { id: true, name: true, email: true } }),
  ]);
  const emailIndex = new Map();
  const nameIndex = new Map();
  const addIdx = (table, rec, email, name) => {
    if (email) emailIndex.set(email.toLowerCase().trim(), { table, ...rec });
    const nn = normName(name); if (nn && nn.includes(' ')) nameIndex.set(nn, { table, ...rec });
  };
  contacts.forEach((r) => addIdx('Contact', { id: r.id, hasMobile: !!r.mobile, hasCompany: !!c0(r.company), type: r.contactType }, r.email, r.name));
  crew.forEach((r) => addIdx('CrewMember', { id: r.id, hasPhone: !!r.phone }, r.email, r.name));
  clients.forEach((r) => addIdx('Client', { id: r.id }, r.email, r.contactName || r.companyName));
  suppliers.forEach((r) => addIdx('Supplier', { id: r.id }, r.email, r.name));
  function c0(v) { return v; }

  // ── decide actions ──
  const actions = [];
  for (const c of named) {
    const klass = classify(c);
    const em = emailIndex.get(c.email);                          // exact email match = safe
    const nm = !em ? nameIndex.get(normName(c.name)) : null;     // name-only = needs review
    const phone = [...c.phones][0] || '';
    const base = { name: c.name, email: c.email, phone, company: companyFromDomain(c.domain), domain: c.domain,
      class: klass.klass, contactType: CONTACT_TYPE[klass.klass], confidence: klass.confidence, reasons: klass.reasons.join(' '),
      seenIn: c.in, seenOut: c.out, owners: [...c.owners].join('+'), sampleSubjects: c.subjects.slice(0, 3).join(' | ') };
    if (em) actions.push({ ...base, action: 'ENRICH', matchTable: em.table, matchId: em.id, matchBy: 'email' });
    else if (nm) actions.push({ ...base, action: 'REVIEW', matchTable: nm.table, matchId: nm.id, matchBy: 'name' });
    else actions.push({ ...base, action: 'CREATE', target: klass.klass === 'CREW' ? 'CrewMember' : 'Contact' });
  }
  const news = actions.filter((a) => a.action === 'CREATE');
  const updates = actions.filter((a) => a.action === 'ENRICH');
  const reviews = actions.filter((a) => a.action === 'REVIEW');

  // ── write outputs ──
  writeCsv(actions);
  fs.writeFileSync(path.join(OUT, 'actions.json'), JSON.stringify(actions, null, 2));
  fs.writeFileSync(path.join(OUT, 'digest.json'), JSON.stringify({
    files: files.length, parsed, failed, namedContacts: named.length,
    insightKeywords: Object.entries(subjectKw).sort((a, b) => b[1] - a[1]),
    topAttachments: Object.entries(attachAll).sort((a, b) => b[1] - a[1]).slice(0, 80),
    sampleThreads: threads.slice(0, 120),
  }, null, 2));
  writeReport({ files: files.length, parsed, failed, named: named.length, news, updates, reviews, subjectKw, attachAll, threads });

  // ── apply ──
  if (APPLY) {
    let created = 0, enriched = 0;
    for (const a of actions) {
      try {
        if (a.action === 'CREATE') {
          if (a.target === 'CrewMember') await prisma.crewMember.create({ data: { name: a.name, email: a.email || null, phone: a.phone || null, notes: `Imported from email analysis. Domain ${a.domain}.` } });
          else await prisma.contact.create({ data: { name: a.name, email: a.email || null, mobile: a.phone || null, company: a.company || null, contactType: a.contactType, notes: `Imported from email analysis (${a.class}, conf ${a.confidence}).` } });
          created++;
        } else if (a.action === 'ENRICH') {
          if (a.matchTable === 'Contact') await prisma.contact.update({ where: { id: a.matchId }, data: { mobile: a.phone || undefined, email: a.email || undefined, company: a.company || undefined } });
          else if (a.matchTable === 'CrewMember') await prisma.crewMember.update({ where: { id: a.matchId }, data: { phone: a.phone || undefined, email: a.email || undefined } });
          // Client/Supplier matches: leave company records untouched (only fill if you choose)
          enriched++;
        }
      } catch (e) { console.error('skip', a.email, e.message); }
    }
    console.log(`APPLIED: ${created} created, ${enriched} enriched.`);
  } else {
    console.log(`DRY RUN complete. CREATE ${news.length} · ENRICH(email) ${updates.length} · REVIEW(name dup) ${reviews.length}. See email-analysis/report.md`);
  }
  await prisma.$disconnect();
}

function companyFromDomain(d) {
  const free = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com', 'live.com', 'icloud.com', 'me.com'];
  if (!d || free.includes(d)) return '';
  return d.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase());
}
function csvCell(v) { v = (v == null ? '' : String(v)).replace(/"/g, '""'); return `"${v}"`; }
function writeCsv(actions) {
  const head = ['Name', 'Email', 'Phone', 'Company', 'Class', 'ContactType', 'Confidence', 'Reasons', 'Action', 'MatchTable', 'Owners', 'SeenIn', 'SeenOut', 'SampleSubjects'];
  const rows = actions.map((a) => [a.name, a.email, a.phone, a.company, a.class, a.contactType, a.confidence, a.reasons, a.action + (a.matchTable ? `→${a.matchTable}` : `→${a.target}`), a.matchTable || '', a.owners, a.seenIn, a.seenOut, a.sampleSubjects].map(csvCell).join(','));
  fs.writeFileSync(path.join(OUT, 'contacts.csv'), [head.map(csvCell).join(','), ...rows].join('\n'));
}
function writeReport(d) {
  const byClass = {}; for (const a of [...d.news, ...d.updates, ...d.reviews]) byClass[a.class] = (byClass[a.class] || 0) + 1;
  const L = [];
  L.push(`# Email Analysis Report — TFM-System`, ``, `Generated ${new Date().toISOString()}${APPLY ? ' (APPLIED)' : ' (DRY RUN — no changes made)'}`, ``);
  L.push(`## Coverage`, `- .msg files scanned: **${d.files}** (parsed ${d.parsed}, failed ${d.failed})`, `- Contacts with a clear full name: **${d.named}**`, `- New (create): **${d.news.length}** · Email‑matched (safe enrich): **${d.updates.length}** · Name‑only matches (review): **${d.reviews.length}**`, ``);
  L.push(`## Suggested classifications`, ...Object.entries(byClass).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`), ``);
  L.push(`## New contacts identified (${d.news.length})`, `| Name | Class | Company | Email | Phone | Conf |`, `|---|---|---|---|---|---|`,
    ...d.news.sort((a, b) => (a.class).localeCompare(b.class)).slice(0, 400).map((a) => `| ${a.name} | ${a.class} | ${a.company} | ${a.email} | ${a.phone} | ${a.confidence} |`), ``);
  L.push(`## Existing contacts to update / enrich (${d.updates.length})`, `| Name | Matched in | Add phone | Email | Class |`, `|---|---|---|---|---|`,
    ...d.updates.slice(0, 400).map((a) => `| ${a.name} | ${a.matchTable} | ${a.phone || '—'} | ${a.email} | ${a.class} |`), ``);
  L.push(`## Possible duplicates to review — name matched but email differs (${d.reviews.length})`, `_Not auto-merged. Confirm before applying._`, `| Name | Matched in | New email | Class |`, `|---|---|---|---|`,
    ...d.reviews.slice(0, 300).map((a) => `| ${a.name} | ${a.matchTable} | ${a.email} | ${a.class} |`), ``);
  L.push(`## Operational insights (signal keyword frequency across subjects/bodies)`, ...Object.entries(d.subjectKw).sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`), ``);
  L.push(`## Most-exchanged document attachments`, ...Object.entries(d.attachAll).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `- ${v}× ${k}`), ``);
  L.push(`## Notes`, `- Companies/role mailboxes/automated senders were excluded (rule: people with full names only).`, `- People classified CREW are created in CrewMember; all others in the master Contact directory with a contactType.`, `- Company records (Client/Supplier/Vendor) are matched for context but not auto-modified.`, `- Re-run with \`--apply\` to commit. Review contacts.csv first.`);
  fs.writeFileSync(path.join(OUT, 'report.md'), L.join('\n'));
}

main().catch((e) => { console.error(e); process.exit(1); });
