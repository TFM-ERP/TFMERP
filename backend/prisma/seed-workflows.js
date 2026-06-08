/* Standard approval workflows (universal engine — doc system/06 §E).
 * Run from the backend folder:  node prisma/seed-workflows.js   (idempotent)
 *
 * Nodes name an approver by project PermissionTemplate key and/or global role —
 * either match lets a user act. Order = sequential routing. Migrates the old flat
 * amount-chain concept into the engine as named definitions.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFS = [
  { key: 'PO_STANDARD', name: 'Purchase Order — standard', entityType: 'PURCHASE_ORDER',
    description: 'Coordinator raises → UPM → Key Accountant.',
    nodes: [
      { order: 1, name: 'UPM review', approverTemplateKey: 'UPM', approverRole: 'PRODUCTION_MANAGER' },
      { order: 2, name: 'Key Accountant', approverTemplateKey: 'KEY_ACCOUNTANT', approverRole: 'FINANCE_MANAGER' },
    ] },
  { key: 'PETTY_CASH_STANDARD', name: 'Petty Cash — standard', entityType: 'PETTY_CASH',
    description: 'Dept Head → Key Accountant.',
    nodes: [
      { order: 1, name: 'Department Head', approverTemplateKey: 'DEPT_HEAD' },
      { order: 2, name: 'Key Accountant', approverTemplateKey: 'KEY_ACCOUNTANT', approverRole: 'FINANCE_MANAGER' },
    ] },
  { key: 'TIMECARD_STANDARD', name: 'Timecard — standard', entityType: 'TIMECARD',
    description: 'Dept Head → UPM → Key Accountant.',
    nodes: [
      { order: 1, name: 'Department Head', approverTemplateKey: 'DEPT_HEAD' },
      { order: 2, name: 'UPM', approverTemplateKey: 'UPM', approverRole: 'PRODUCTION_MANAGER' },
      { order: 3, name: 'Key Accountant', approverTemplateKey: 'KEY_ACCOUNTANT', approverRole: 'FINANCE_MANAGER' },
    ] },
  { key: 'BUDGET_TRANSFER_STANDARD', name: 'Budget Transfer — standard', entityType: 'BUDGET_TRANSFER',
    description: 'Line Producer approves money movement.',
    nodes: [
      { order: 1, name: 'Line Producer', approverTemplateKey: 'LINE_PRODUCER', approverRole: 'PRODUCTION_MANAGER' },
    ] },
  { key: 'OVERAGE_STANDARD', name: 'Overage — standard', entityType: 'OVERAGE',
    description: 'UPM → Line Producer → Finance.',
    nodes: [
      { order: 1, name: 'UPM', approverTemplateKey: 'UPM', approverRole: 'PRODUCTION_MANAGER' },
      { order: 2, name: 'Line Producer', approverTemplateKey: 'LINE_PRODUCER' },
      { order: 3, name: 'Finance', approverTemplateKey: 'KEY_ACCOUNTANT', approverRole: 'FINANCE_MANAGER' },
    ] },
  { key: 'INVOICE_STANDARD', name: 'Invoice / AP — standard', entityType: 'INVOICE',
    description: 'Key Accountant → Finance Manager.',
    nodes: [
      { order: 1, name: 'Key Accountant', approverTemplateKey: 'KEY_ACCOUNTANT', approverRole: 'ACCOUNTANT' },
      { order: 2, name: 'Finance Manager', approverRole: 'FINANCE_MANAGER' },
    ] },
  { key: 'LOCATION_PERMIT_STANDARD', name: 'Location Permit — standard', entityType: 'LOCATION',
    description: 'Location Manager → UPM → Producer.',
    nodes: [
      { order: 1, name: 'Location Manager', approverTemplateKey: 'LOCATION_MANAGER', approverRole: 'PRODUCTION_MANAGER' },
      { order: 2, name: 'UPM', approverTemplateKey: 'UPM', approverRole: 'PRODUCTION_MANAGER' },
      { order: 3, name: 'Producer', approverTemplateKey: 'LINE_PRODUCER', approverRole: 'PRODUCTION_MANAGER' },
    ] },
];

async function main() {
  let created = 0, updated = 0;
  for (const d of DEFS) {
    const existing = await prisma.workflowDefinition.findUnique({ where: { key: d.key } });
    const def = await prisma.workflowDefinition.upsert({
      where: { key: d.key },
      update: { name: d.name, entityType: d.entityType, description: d.description, isActive: true, isSystem: true },
      create: { key: d.key, name: d.name, entityType: d.entityType, description: d.description, isActive: true, isSystem: true },
    });
    await prisma.workflowNode.deleteMany({ where: { definitionId: def.id } });
    await prisma.workflowNode.createMany({ data: d.nodes.map((n) => ({ definitionId: def.id, ...n })) });
    existing ? updated++ : created++;
  }
  console.log(`Workflow definitions: ${created} created, ${updated} updated.`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
