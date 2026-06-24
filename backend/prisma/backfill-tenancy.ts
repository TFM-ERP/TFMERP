/**
 * One-off, idempotent tenancy backfill. Ensures a default Tenant exists and stamps every
 * existing root row (User/ProductionProject/Supplier/Asset/MasterScript/Contact) that has no tenant yet.
 * Safe to re-run (upsert + WHERE tenantId IS NULL). Run from backend/:
 *   npx ts-node --transpile-only prisma/backfill-tenancy.ts
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tenant = await (prisma as any).tenant.upsert({
    where: { slug: 'studio-one' },
    update: {},
    create: { name: 'Studio One', slug: 'studio-one' },
  });
  console.log(`Default tenant: ${tenant.name} (${tenant.id})`);
  const roots = ['user', 'productionProject', 'supplier', 'asset', 'masterScript', 'contact'];
  for (const m of roots) {
    const res = await (prisma as any)[m].updateMany({ where: { tenantId: null }, data: { tenantId: tenant.id } });
    console.log(`  ${m}: stamped ${res.count} row(s)`);
  }
  console.log('Backfill complete — all root rows now belong to a tenant.');
}
main().catch((e) => { console.error('Backfill failed:', e); process.exit(1); }).finally(() => prisma.$disconnect());
