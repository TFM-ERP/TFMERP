/**
 * Seeds the single House / Corporate project that owns all STANDALONE
 * (project-less) financial postings from the Travel, Contracts and Casting
 * modules. Standalone trips/contracts resolve this project and post with
 * ProjectTxnKind.CORPORATE_OVERHEAD through the normal Two-Ledger guards.
 *
 * Idempotent — keyed on isHouse. Safe to re-run.
 *
 * Run:  node prisma/seed-house-project.js
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.productionProject.findFirst({ where: { isHouse: true } });
  if (existing) {
    console.log(`House project already exists: ${existing.title} (${existing.id}).`);
    return;
  }
  const house = await prisma.productionProject.create({
    data: {
      projectNumber: 'HOUSE',
      title: 'The Film Makers — House / Corporate',
      projectType: 'CORPORATE',
      isHouse: true,
      description: 'Corporate/house entity. Owns standalone Travel, Contracts and Casting postings (CORPORATE_OVERHEAD). Do not delete.',
    },
  });
  console.log(`Created House project: ${house.title} (${house.id}).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
