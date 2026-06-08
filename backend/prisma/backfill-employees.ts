/**
 * One-time backfill: ensure every User is linked to an Employee record.
 *
 * For each user that has no employeeId, this creates an Employee from the
 * user's data (splitting fullName into first/last) and links them 1:1.
 * Safe to re-run — it skips users that are already linked.
 *
 * Run:  npx ts-node prisma/backfill-employees.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = (full || '').trim().split(/\s+/);
  if (parts.length === 0 || parts[0] === '') return { firstName: 'Unknown', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

async function main() {
  const users = await prisma.user.findMany();
  let created = 0;
  let linkedExisting = 0;
  let alreadyLinked = 0;

  for (const u of users) {
    if ((u as any).employeeId) { alreadyLinked++; continue; }

    // If an employee already exists with this email, link to it instead of duplicating.
    let employee = u.email
      ? await prisma.employee.findFirst({ where: { email: u.email } })
      : null;

    if (employee) {
      // Don't hijack an employee that's already attached to another user.
      const taken = await prisma.user.findFirst({ where: { employeeId: employee.id } });
      if (taken) employee = null;
    }

    if (!employee) {
      const { firstName, lastName } = splitName(u.fullName);
      employee = await prisma.employee.create({
        data: {
          firstName,
          lastName,
          displayName: u.fullName,
          email: u.email,
          mobile: u.mobile || undefined,
          department: u.department || undefined,
          position: u.jobTitle || undefined,
          jobTitle: u.jobTitle || undefined,
          status: 'Active',
          employmentType: 'FullTime',
        },
      });
      created++;
    } else {
      linkedExisting++;
    }

    await prisma.user.update({
      where: { id: u.id },
      data: { employeeId: employee.id },
    });
  }

  console.log('── Backfill complete ──');
  console.log(`  Users processed:        ${users.length}`);
  console.log(`  Already linked:         ${alreadyLinked}`);
  console.log(`  New employees created:  ${created}`);
  console.log(`  Linked to existing emp: ${linkedExisting}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
