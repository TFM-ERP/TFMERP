/* Crew Directory import — run from the backend folder:
 *   node prisma/import-crew.js
 *
 * Reads prisma/crew-import.json (172 people parsed & deduplicated from:
 * Crew List - Pickups.xlsx · Crew List 2019-012.xlsx · North of the 10 - Crew List.xlsx ·
 * The Misfits_Production Crew Information_13Nov2018.pdf · The Misfits_Crew List v9 .pages)
 *
 * Idempotent and non-destructive:
 * - matches existing CrewMember by email (case-insensitive), then by normalized name
 * - existing records: only EMPTY fields are filled — nothing is overwritten
 * - re-running never creates duplicates
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

const norm = (n) => String(n || '')
  .toLowerCase()
  .replace(/\b(mr|mrs|ms|dr|prince)\.?\s+/g, '')
  .replace(/[^a-z ]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

async function main() {
  const rows = JSON.parse(fs.readFileSync(path.join(__dirname, 'crew-import.json'), 'utf8'));
  console.log(`Importing ${rows.length} people into the Crew Directory…`);

  const existing = await prisma.crewMember.findMany({ select: { id: true, name: true, email: true, role: true, department: true, phone: true } });
  const byEmail = new Map(existing.filter((e) => e.email).map((e) => [e.email.toLowerCase(), e]));
  const byName = new Map(existing.map((e) => [norm(e.name), e]));

  let created = 0, updated = 0, untouched = 0;
  for (const p of rows) {
    const hit = (p.email && byEmail.get(p.email.toLowerCase())) || byName.get(norm(p.name));
    if (hit) {
      const patch = {};
      if (!hit.role && p.role) patch.role = p.role;
      if (!hit.department && p.department) patch.department = p.department;
      if (!hit.email && p.email) patch.email = p.email;
      if (!hit.phone && p.phone) patch.phone = p.phone;
      if (Object.keys(patch).length) {
        await prisma.crewMember.update({ where: { id: hit.id }, data: patch });
        updated++;
      } else untouched++;
      continue;
    }
    const rec = await prisma.crewMember.create({
      data: {
        name: p.name,
        role: p.role || null,
        department: p.department || null,
        email: p.email || null,
        phone: p.phone || null,
        notes: `Imported from: ${(p.sources || []).join(', ')}`,
      },
    });
    byName.set(norm(rec.name), rec);
    if (rec.email) byEmail.set(rec.email.toLowerCase(), rec);
    created++;
  }
  console.log(`Done. Created ${created}, enriched ${updated} existing, ${untouched} already complete.`);
  console.log('Total in Crew Directory:', await prisma.crewMember.count());
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
