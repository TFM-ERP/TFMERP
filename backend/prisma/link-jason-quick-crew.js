/*
 * Connect project crew → budget cost lines (backfill for data created before the auto-link).
 *
 * Per the system design: a crew member added to a project is a Crew Directory person, so they
 * should always have a crewMemberId; assigning them connects them to the matching budget labour
 * line (BudgetLineItem.crewMemberId), which then flows to call sheets, etc.
 *
 * This script, for every project (or one named project):
 *   1. ensures each project HIRE (non-internal ProductionCrew) has a Crew Directory identity,
 *   2. links each unassigned labour budget line to its crew member — matched by NAME first
 *      (JQ lines read e.g. "Line Producer — Owen Brecht"), then by role, then round-robin.
 *
 * Safe + idempotent: only fills lines whose crewMemberId is null. Re-running is a no-op.
 *
 *   node prisma/link-jason-quick-crew.js                 # all projects
 *   node prisma/link-jason-quick-crew.js "Jason Quick"   # one project (title contains)
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const norm = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();
const personName = (subTitle) => { const m = String(subTitle || '').split(/[—–-]/); return m.length > 1 ? norm(m.slice(1).join(' ')) : ''; };

async function ensureDirectory(c) {
  if (c.crewMemberId || c.isInternal) return c.crewMemberId || null;
  const where = c.email ? { OR: [{ email: c.email }, { name: c.name }] } : { name: c.name };
  let m = await prisma.crewMember.findFirst({ where });
  if (!m) m = await prisma.crewMember.create({ data: { name: c.name, email: c.email || null, department: c.department || null, role: c.roleTitle || null } });
  await prisma.productionCrew.update({ where: { id: c.id }, data: { crewMemberId: m.id } });
  c.crewMemberId = m.id;
  return m.id;
}

async function linkProject(project) {
  const crew = await prisma.productionCrew.findMany({ where: { projectId: project.id } });
  if (!crew.length) { console.log(`  ${project.title}: no crew assigned — skipped.`); return 0; }
  let promoted = 0;
  for (const c of crew) { const before = c.crewMemberId; await ensureDirectory(c); if (!before && c.crewMemberId) promoted++; }
  const linkable = crew.filter((c) => c.crewMemberId);

  const versions = await prisma.budgetVersion.findMany({ where: { projectId: project.id }, select: { id: true } });
  const sections = await prisma.budgetSection.findMany({ where: { budgetVersionId: { in: versions.map((v) => v.id) } }, select: { id: true } });
  const accounts = await prisma.budgetAccount.findMany({ where: { sectionId: { in: sections.map((s) => s.id) } }, select: { id: true, code: true } });
  const acctCode = new Map(accounts.map((a) => [a.id, a.code]));
  const lines = await prisma.budgetLineItem.findMany({ where: { accountId: { in: accounts.map((a) => a.id) } } });
  const labour = lines.filter((l) =>
    l.crewMemberId == null && acctCode.get(l.accountId) !== '1400' && l.classificationCode !== 'PERFORMER' &&
    (l.stages != null || l.classificationCode != null || (l.subTitle && l.units && /day|week/i.test(l.units)))
  );

  console.log(`  ${project.title}: ${crew.length} crew (${promoted} promoted to directory), ${labour.length} unlinked labour line(s)`);
  if (!labour.length || !linkable.length) return 0;

  const byName = new Map(); const byRole = new Map();
  for (const c of linkable) {
    const n = norm(c.name); if (n && !byName.has(n)) byName.set(n, c);
    const r = norm(c.roleTitle || c.role); if (r && !byRole.has(r)) byRole.set(r, c);
  }
  let rr = 0; let linked = 0;
  for (const line of labour) {
    const nm = personName(line.subTitle);
    const rk = norm(line.subTitle || line.description);
    let c = (nm && byName.get(nm))
      || (nm && [...byName.entries()].find(([k]) => k && (k.includes(nm) || nm.includes(k)))?.[1])
      || byRole.get(rk)
      || [...byRole.entries()].find(([k]) => k && (rk.includes(k) || k.includes(rk)))?.[1];
    if (!c) { c = linkable[rr % linkable.length]; rr++; }
    await prisma.budgetLineItem.update({ where: { id: line.id }, data: { crewMemberId: c.crewMemberId } });
    if (c.dailyRate == null && line.rate != null) await prisma.productionCrew.update({ where: { id: c.id }, data: { dailyRate: line.rate } }).catch(() => {});
    linked++;
  }
  console.log(`    → linked ${linked} line(s).`);
  return linked;
}

async function main() {
  const arg = process.argv[2];
  const projects = await prisma.productionProject.findMany({
    where: arg ? { title: { contains: arg, mode: 'insensitive' } } : {},
    select: { id: true, title: true }, orderBy: { createdAt: 'desc' },
  });
  if (!projects.length) { console.error(arg ? `No project matching "${arg}".` : 'No projects found.'); process.exit(1); }
  console.log(`Connecting crew → budget lines for ${projects.length} project(s):`);
  let total = 0;
  for (const p of projects) total += await linkProject(p);
  console.log(`\n✅ Done. ${total} budget line(s) connected to their crew member.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
