/**
 * add-employees-2026.ts
 *
 * Two people who work for the company but were never on an employee record.
 *
 *   Leo Youngmin Wong — the 15,000/month employee. The 2025 books already carry his pay:
 *   JE-2026-0418 "December 2025 salary - employee" 15,000 and JE-2026-0437 the end-of-service
 *   accrual of 875.00 "for the employee engaged from December 2025" (21 days basic a year =
 *   10,500, one month of it = 875). Joining date is set to 1 December 2025 to match.
 *
 *   Samir S S Almadi — works for the company; no pay for him appears anywhere in the 2025
 *   ledger, and his residence visa is sponsored by another employer, so basicSalary is left
 *   at 0 and employmentType blank until the GM says what the arrangement is.
 *
 * Both records carry the Emirates ID number and expiry, and the ID scans are copied into
 * backend/uploads and attached as employee documents.
 * Idempotent (skips a person whose emiratesId is already on a record). Pass --dry for the plan.
 */
import { PrismaClient } from '@prisma/client';
import { copyFileSync, existsSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry');
const HR = '/Users/qandil/Library/CloudStorage/OneDrive-Personal/Desktop/Commercials/TFM/2025/HR';
const UPLOADS = join(__dirname, '..', 'uploads');
const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

type Doc = { title: string; type: string; src: string; dest: string; issue: string; expiry: string };
type Person = {
  employeeNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  displayName: string;
  gender: string;
  dateOfBirth: string;
  nationality: string;
  emiratesId: string;
  emiratesIdExpiry: string;
  joiningDate?: string;
  contractStart?: string;
  payStructure?: string;
  basicSalary: number;
  employmentType?: string;
  notes: string;
  docs: Doc[];
};

const PEOPLE: Person[] = [
  {
    employeeNumber: '002',
    firstName: 'Leo',
    middleName: 'Youngmin',
    lastName: 'Wong',
    displayName: 'Leo Wong',
    gender: 'Male',
    dateOfBirth: '1974-09-03',
    nationality: 'United States of America',
    emiratesId: '784-1974-4297510-4',
    emiratesIdExpiry: '2027-10-26',
    joiningDate: '2025-12-01',
    contractStart: '2025-12-01',
    payStructure: 'Monthly',
    basicSalary: 15000,
    employmentType: 'FullTime',
    notes:
      'The 15,000/month employee named in JE-2026-0418 (December 2025 salary) and in the ' +
      'end-of-service accrual JE-2026-0437 of 875.00. Passport USA 683157376, issued ' +
      '14 Apr 2022, expires 13 Apr 2032, born California.',
    docs: [
      {
        title: 'Emirates ID — front (784-1974-4297510-4)',
        type: 'Emirates ID',
        src: 'Leo Wong/Leo-Wong-EmiratesID-front.jpg',
        dest: 'employee-002-leo-wong-emirates-id-front.jpg',
        issue: '2025-10-27',
        expiry: '2027-10-26',
      },
      {
        title: 'Passport — United States 683157376',
        type: 'Passport',
        src: 'Leo Wong/Leo-Wong-USpassport-683157376.jpg',
        dest: 'employee-002-leo-wong-us-passport-683157376.jpg',
        issue: '2022-04-14',
        expiry: '2032-04-13',
      },
    ],
  },
  {
    employeeNumber: '003',
    firstName: 'Samir',
    middleName: 'S S',
    lastName: 'Almadi',
    displayName: 'Samir Almadi',
    gender: 'Male',
    dateOfBirth: '1975-11-24',
    nationality: 'Palestine, State of',
    emiratesId: '784-1975-0416136-1',
    emiratesIdExpiry: '2026-12-09',
    basicSalary: 0,
    notes:
      'Works for the company (GM, 23 Sep 2026). No pay for him appears in the 2025 ledger, so ' +
      'basicSalary, joining date and employment type are left blank until the GM states the ' +
      'arrangement. His Emirates ID (card 141533280, issued 10 Dec 2024, expires 9 Dec 2026) ' +
      'shows occupation "Cashier" and employer "Alastura Home Health Care Services" — his ' +
      'residence visa is sponsored by another company, not by The Film Makers FZ LLC. ' +
      'Generator documents in his name: Senci repair form 2637 of 23 Jul 2025 (EXP-2025-0013) ' +
      'and Al-Futtaim Honda invoice 928947977 of 19 Sep 2026.',
    docs: [
      {
        title: 'Emirates ID — front (784-1975-0416136-1)',
        type: 'Emirates ID',
        src: 'Samir Almadi/Samir-Almadi-EmiratesID-front.jpg',
        dest: 'employee-003-samir-almadi-emirates-id-front.jpg',
        issue: '2024-12-10',
        expiry: '2026-12-09',
      },
      {
        title: 'Emirates ID — back (card 141533280)',
        type: 'Emirates ID',
        src: 'Samir Almadi/Samir-Almadi-EmiratesID-back.jpg',
        dest: 'employee-003-samir-almadi-emirates-id-back.jpg',
        issue: '2024-12-10',
        expiry: '2026-12-09',
      },
    ],
  },
];

async function main(): Promise<void> {
  for (const p of PEOPLE) {
    const already = await prisma.employee.findFirst({
      where: { OR: [{ emiratesId: p.emiratesId }, { employeeNumber: p.employeeNumber }] },
      select: { id: true, displayName: true },
    });
    if (already) {
      console.log(`${p.displayName}: already on record (${already.displayName}) — skipped.`);
      continue;
    }
    for (const d of p.docs) {
      if (!existsSync(join(HR, d.src))) throw new Error(`Missing scan: ${join(HR, d.src)}`);
    }
    console.log(`${p.employeeNumber} ${p.displayName} — ${p.nationality}, Emirates ID ${p.emiratesId}` +
      ` (expires ${p.emiratesIdExpiry}), basic ${p.basicSalary.toFixed(2)}` +
      `${p.joiningDate ? `, joined ${p.joiningDate}` : ', joining date not set'}` +
      `, ${p.docs.length} documents.`);
    if (DRY) continue;

    await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.create({
        data: {
          employeeNumber: p.employeeNumber,
          firstName: p.firstName,
          middleName: p.middleName ?? null,
          lastName: p.lastName,
          displayName: p.displayName,
          gender: p.gender,
          dateOfBirth: day(p.dateOfBirth),
          nationality: p.nationality,
          status: 'Active',
          emiratesId: p.emiratesId,
          emiratesIdExpiry: day(p.emiratesIdExpiry),
          passportNumber: p.employeeNumber === '002' ? '683157376' : null,
          passportExpiry: p.employeeNumber === '002' ? day('2032-04-13') : null,
          joiningDate: p.joiningDate ? day(p.joiningDate) : null,
          contractStart: p.contractStart ? day(p.contractStart) : null,
          payStructure: p.payStructure ?? null,
          basicSalary: p.basicSalary,
          employmentType: p.employmentType ?? null,
          employmentPermitInfo: p.notes,
        },
      });
      for (const d of p.docs) {
        copyFileSync(join(HR, d.src), join(UPLOADS, d.dest));
        await tx.employeeDocument.create({
          data: {
            employeeId: emp.id,
            type: d.type,
            title: d.title,
            fileUrl: `/uploads/${d.dest}`,
            issueDate: day(d.issue),
            expiryDate: day(d.expiry),
          },
        });
      }
    });
    console.log(`  written.`);
  }
  if (DRY) console.log('\n--dry: nothing written.');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
