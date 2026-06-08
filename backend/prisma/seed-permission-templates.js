/* V1.2 — standard per-project permission templates (doc system/05 §2).
 * Run from the backend folder:  node prisma/seed-permission-templates.js   (idempotent)
 *
 * These LAYER on top of the global role matrix — they say what a user can do on
 * ONE project. permissions levels: 'none' | 'view' | 'edit' | 'approve' | 'lock'.
 * fieldLevelAccess = field keys hidden from this template (server projects them out).
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const TEMPLATES = [
  { key: 'LINE_PRODUCER', name: 'Line Producer', description: 'Full production authority on the project.',
    permissions: { budget: 'edit', costReport: 'lock', po: 'approve', ledger: 'edit', transfers: 'approve', crew: 'manage', schedule: 'edit' },
    fieldLevelAccess: [] },
  { key: 'UPM', name: 'Unit Production Manager', description: 'Runs the floor: schedule, crew, POs.',
    permissions: { budget: 'view', costReport: 'view', po: 'approve', ledger: 'view', transfers: 'view', crew: 'manage', schedule: 'edit' },
    fieldLevelAccess: [] },
  { key: 'KEY_ACCOUNTANT', name: 'Key Accountant', description: 'Owns the ledger, cost report and reconciliation.',
    permissions: { budget: 'edit', costReport: 'lock', po: 'approve', ledger: 'edit', transfers: 'approve', crew: 'view', schedule: 'view' },
    fieldLevelAccess: [] },
  { key: 'COORDINATOR', name: 'Production Coordinator', description: 'Schedule + crew + call sheets; no money authority.',
    permissions: { budget: 'view', costReport: 'view', po: 'edit', ledger: 'none', transfers: 'none', crew: 'manage', schedule: 'edit' },
    fieldLevelAccess: ['dayRateAed', 'dayRateUsd', 'weeklyRateAed', 'weeklyRateUsd', 'iban', 'accountNumber'] },
  { key: 'DEPT_HEAD', name: 'Department Head', description: 'Sees own department; sensitive pay/PII hidden.',
    permissions: { budget: 'view', costReport: 'none', po: 'edit', ledger: 'none', transfers: 'none', crew: 'view', schedule: 'view' },
    fieldLevelAccess: ['dayRateAed', 'dayRateUsd', 'weeklyRateAed', 'weeklyRateUsd', 'prepWrapDayRateAed', 'prepWrapDayRateUsd', 'iban', 'accountNumber', 'swiftCode', 'passportNumber', 'emiratesId'] },
  { key: 'OBSERVER', name: 'Observer (read-only)', description: 'Financier / bond viewer — read-only, pay hidden.',
    permissions: { budget: 'view', costReport: 'view', po: 'view', ledger: 'view', transfers: 'view', crew: 'view', schedule: 'view' },
    fieldLevelAccess: ['iban', 'accountNumber', 'swiftCode', 'passportNumber', 'emiratesId'] },
];

async function main() {
  let created = 0, updated = 0;
  for (const t of TEMPLATES) {
    const existing = await prisma.permissionTemplate.findUnique({ where: { key: t.key } });
    const data = { name: t.name, description: t.description, permissions: t.permissions, fieldLevelAccess: t.fieldLevelAccess, isSystem: true };
    if (existing) { await prisma.permissionTemplate.update({ where: { key: t.key }, data }); updated++; }
    else { await prisma.permissionTemplate.create({ data: { key: t.key, ...data } }); created++; }
  }
  console.log(`Permission templates: ${created} created, ${updated} updated.`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
