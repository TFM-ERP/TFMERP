#!/usr/bin/env node
/**
 * preflight-invoice-import.js  (v2)
 *
 * READ-ONLY pre-flight check for the Gmail invoice import.
 * Performs NO writes of any kind. No migrations, no inserts, no updates.
 *
 *     cd C:\Projects\TFM-System\backend
 *     node tools/preflight-invoice-import.js
 *
 * v2 fixes: User has no `name` field (it is `fullName`), and adds tenancy,
 * client and multi-tenant checks that v1 missed.
 */

const { PrismaClient } = require('@prisma/client');

const TARGET_EMAILS = ['qais@thefilmmakers.com', 'admin@tfm.ae'];

const prisma = new PrismaClient();

function line(title) {
  console.log('\n' + '='.repeat(72));
  console.log(title);
  console.log('='.repeat(72));
}

function describeDatabaseUrl(raw) {
  if (!raw) return 'DATABASE_URL is NOT SET in this environment';
  try {
    const u = new URL(raw);
    const host = u.hostname || '(none)';
    let kind = 'REMOTE / HOSTED';
    if (['localhost', '127.0.0.1', '::1'].includes(host)) kind = 'LOCAL';
    else if (/railway|rlwy/i.test(host)) kind = 'RAILWAY (likely production)';
    else if (/supabase/i.test(host)) kind = 'SUPABASE';
    return [
      `  host     : ${host}`,
      `  port     : ${u.port || '(default)'}`,
      `  database : ${(u.pathname || '').replace(/^\//, '') || '(none)'}`,
      `  looks    : ${kind}`,
      '  (username and password deliberately not printed)',
    ].join('\n');
  } catch (err) {
    return `  Could not parse DATABASE_URL: ${err.message}`;
  }
}

/** Which columns actually exist on a table, straight from information_schema. */
async function columnsOf(table) {
  try {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position`,
      table
    );
    return rows.map((r) => r.column_name);
  } catch (err) {
    console.log(`  Could not inspect ${table}: ${err.message}`);
    return [];
  }
}

async function resolveUsers() {
  line('1. USER IDS FOR THE IMPORT (Expense.createdById is a required FK)');

  const SELECT = {
    id: true,
    email: true,
    fullName: true,
    role: true,
    isActive: true,
    tenantId: true,
    jobTitle: true,
    approvalLimit: true,
  };

  const found = [];
  for (const email of TARGET_EMAILS) {
    try {
      const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
        select: SELECT,
      });
      if (user) {
        found.push(user);
        console.log(`  FOUND  ${email}`);
        console.log(`         id            = ${user.id}`);
        console.log(`         fullName      = ${user.fullName ?? '(none)'}`);
        console.log(`         role          = ${user.role ?? '(none)'}`);
        console.log(`         jobTitle      = ${user.jobTitle ?? '(none)'}`);
        console.log(`         approvalLimit = ${user.approvalLimit ?? '(none)'}`);
        console.log(`         tenantId      = ${user.tenantId ?? '(null)'}`);
        console.log(`         isActive      = ${user.isActive}`);
      } else {
        console.log(`  MISSING  ${email}  — no User row with this email`);
      }
      console.log('');
    } catch (err) {
      console.log(`  ERROR looking up ${email}: ${err.message.split('\n')[0]}`);
    }
  }

  if (found.length < TARGET_EMAILS.length) {
    console.log('  One or both were not found. Every user in the database:');
    try {
      const all = await prisma.user.findMany({
        select: { id: true, email: true, fullName: true, role: true, isActive: true },
        orderBy: { email: 'asc' },
      });
      for (const u of all) {
        const flag = u.isActive ? ' ' : '!';
        console.log(
          `   ${flag} ${String(u.email).padEnd(34)} ${String(u.role ?? '-').padEnd(14)} ${u.id}`
        );
      }
      console.log(`\n  (${all.length} users total; "!" marks inactive)`);
    } catch (err) {
      console.log(`  Could not list users: ${err.message.split('\n')[0]}`);
    }
  }
}

async function checkTenancy() {
  line('2. MULTI-TENANCY — does the import need a tenantId?');
  for (const table of ['expenses', 'suppliers', 'invoices', 'users', 'clients']) {
    const cols = await columnsOf(table);
    if (!cols.length) {
      console.log(`  ${table.padEnd(12)} : table not found`);
      continue;
    }
    console.log(`  ${table.padEnd(12)} : tenantId column ${cols.includes('tenantId') ? 'PRESENT' : 'absent'}`);
  }
  try {
    const t = await prisma.$queryRawUnsafe(
      `SELECT "tenantId", COUNT(*)::int AS n FROM users GROUP BY "tenantId" ORDER BY n DESC`
    );
    console.log('\n  Distinct tenantId values on users:');
    for (const r of t) console.log(`    ${String(r.tenantId ?? '(null)').padEnd(30)} ${r.n}`);
  } catch (err) {
    console.log(`\n  Could not group users by tenantId: ${err.message.split('\n')[0]}`);
  }
}

async function checkExpenseShape() {
  line('3. EXPENSE TABLE — columns that exist TODAY');
  const cols = await columnsOf('expenses');
  console.log('  ' + cols.join(', '));
  const planned = [
    'invoiceNumber',
    'invoiceDate',
    'dueDate',
    'sourceUrl',
    'sourceRef',
    'importSource',
    'importBatchId',
    'importedAt',
    'reviewedById',
    'reviewedAt',
    'rejectionReason',
  ];
  const already = planned.filter((p) => cols.includes(p));
  console.log('\n  Planned new columns already present: ' + (already.length ? already.join(', ') : 'none'));
  console.log('  => ' + (planned.length - already.length) + ' column(s) to add.');
}

async function checkClients() {
  line('4. CLIENTS — needed for the issued-invoice (revenue) import');
  try {
    const clients = await prisma.client.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    console.log(`  ${clients.length} client(s) on file:`);
    for (const c of clients) console.log(`    ${String(c.name).padEnd(42)} ${c.id}`);
    console.log('\n  Folder names in Desktop\\Commercials\\TFM\\2026 to match against:');
    for (const n of [
      'Al Falah Academy',
      'Khalifa Award for Education',
      'Sama Dubai',
      'Cinegate FZC',
      'PULSTRY L.L.C-FZ',
      'MACQUIP COMMERCIAL EQUIPMENT',
      'News GroupInternational FZE',
      'Prestige motorcycle Rentals LLC',
      'TWOFOUR54 FZ LLC',
    ]) {
      const hit = clients.find(
        (c) => String(c.name).toLowerCase().slice(0, 8) === n.toLowerCase().slice(0, 8)
      );
      console.log(`    ${n.padEnd(34)} ${hit ? 'matches "' + hit.name + '"' : 'NO MATCH — would be created'}`);
    }
  } catch (err) {
    console.log(`  Could not read clients: ${err.message.split('\n')[0]}`);
  }
}

async function checkVolumes() {
  line('5. CURRENT DATA VOLUMES');
  try {
    console.log(`  expenses   : ${await prisma.expense.count()}`);
    console.log(`  suppliers  : ${await prisma.supplier.count()}`);
    console.log(`  invoices   : ${await prisma.invoice.count()}`);
    console.log(`  quotations : ${await prisma.quotation.count()}`);
    console.log(`  journal entries : ${await prisma.journalEntry.count()}`);
  } catch (err) {
    console.log(`  Could not count: ${err.message.split('\n')[0]}`);
  }
}

async function main() {
  console.log('PRE-FLIGHT CHECK v2 — Gmail invoice import into TFM-System');
  console.log('READ-ONLY. This script performs no writes.');
  console.log(`Run at: ${new Date().toISOString()}`);

  line('0. DATABASE TARGET');
  console.log(describeDatabaseUrl(process.env.DATABASE_URL));

  await resolveUsers();
  await checkTenancy();
  await checkExpenseShape();
  await checkClients();
  await checkVolumes();

  line('DONE — nothing was written.');
}

main()
  .catch((err) => {
    console.error('\nPRE-FLIGHT FAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
