import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * The depreciation run.
 *
 * `expense-mapping.util.ts` records why capital items were being left in 6900
 * Other Expenses: "there is no depreciation method, useful life or
 * accumulated-depreciation mechanism in the schema, so capitalising it would
 * create an asset that could never be written down." That mechanism now exists,
 * and this is it.
 *
 * Two safety properties matter more than the arithmetic:
 *
 * 1. Only assets explicitly marked `isCompanyAsset` are depreciated. The rental
 *    fleet records in this system are demonstration data created in May and June
 *    2026 and would otherwise generate a charge against assets the company does
 *    not own.
 * 2. A run is unique per period. Charging depreciation twice for the same months
 *    is silent — the numbers simply come out wrong — so the period is the key.
 */

const STRAIGHT_LINE = 'STRAIGHT_LINE';
const REDUCING_BALANCE = 'REDUCING_BALANCE';

/** Default annual rate when an asset gives a useful life instead of a rate. */
function annualRate(usefulLifeYears?: number | null, rate?: number | null): number | null {
  if (rate && rate > 0) return rate / 100;
  if (usefulLifeYears && usefulLifeYears > 0) return 1 / usefulLifeYears;
  return null;
}

function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth()) + 1;
}

export interface AssetCharge {
  assetId: string;
  name: string;
  method: string;
  cost: number;
  openingNetBookValue: number;
  monthsCharged: number;
  charge: number;
  closingNetBookValue: number;
  note?: string;
}

@Injectable()
export class DepreciationService {
  constructor(private prisma: PrismaService) {}

  /**
   * What the charge would be for a period, without posting anything.
   *
   * Always run this first. A depreciation charge is an opinion about useful life
   * expressed as a number, and it should be read before it is booked.
   */
  async preview(args: { from: string; to: string }): Promise<{
    period: { from: string; to: string };
    charges: AssetCharge[];
    totalCharge: number;
    skipped: { name: string; reason: string }[];
  }> {
    const from = new Date(args.from);
    const to = new Date(args.to);

    const assets = await this.prisma.asset.findMany({
      where: { isCompanyAsset: true, isActive: true },
      select: {
        id: true,
        name: true,
        purchaseDate: true,
        purchaseValue: true,
        depreciation: true,
        depreciationMethod: true,
        usefulLifeYears: true,
        depreciationStartDate: true,
        accumulatedDepreciation: true,
      },
      orderBy: { name: 'asc' },
    });

    const charges: AssetCharge[] = [];
    const skipped: { name: string; reason: string }[] = [];

    for (const a of assets) {
      const cost = Number(a.purchaseValue ?? 0);
      if (cost <= 0) {
        skipped.push({ name: a.name, reason: 'No purchase value recorded' });
        continue;
      }

      const rate = annualRate(a.usefulLifeYears, a.depreciation ? Number(a.depreciation) : null);
      if (!rate) {
        skipped.push({ name: a.name, reason: 'No depreciation rate or useful life recorded' });
        continue;
      }

      const start = a.depreciationStartDate ?? a.purchaseDate;
      if (!start) {
        skipped.push({ name: a.name, reason: 'No purchase or depreciation start date recorded' });
        continue;
      }
      if (start > to) {
        skipped.push({ name: a.name, reason: 'Acquired after the end of the period' });
        continue;
      }

      const accumulated = Number(a.accumulatedDepreciation ?? 0);
      const openingNbv = r2(cost - accumulated);
      if (openingNbv <= 0) {
        skipped.push({ name: a.name, reason: 'Already fully depreciated' });
        continue;
      }

      // Charge only the months the asset was actually held within the period.
      const effectiveFrom = start > from ? start : from;
      const months = Math.max(0, Math.min(monthsBetween(effectiveFrom, to), monthsBetween(from, to)));
      if (months === 0) continue;

      const method = a.depreciationMethod ?? STRAIGHT_LINE;
      const annual = method === REDUCING_BALANCE ? openingNbv * rate : cost * rate;
      let charge = r2((annual * months) / 12);

      // Never write an asset below nil. The final period takes what is left.
      let note: string | undefined;
      if (charge > openingNbv) {
        charge = openingNbv;
        note = 'Charge limited to the remaining net book value';
      }

      charges.push({
        assetId: a.id,
        name: a.name,
        method,
        cost: r2(cost),
        openingNetBookValue: openingNbv,
        monthsCharged: months,
        charge,
        closingNetBookValue: r2(openingNbv - charge),
        note,
      });
    }

    return {
      period: { from: args.from, to: args.to },
      charges,
      totalCharge: r2(charges.reduce((s, c) => s + c.charge, 0)),
      skipped,
    };
  }

  /**
   * Post the charge for a period: Dr 6600 Depreciation Expense, Cr 1510
   * Accumulated Depreciation, and advance each asset's accumulated figure.
   *
   * Refuses to run twice for the same period. The whole operation is one
   * transaction, so a failure partway cannot leave assets written down against a
   * journal that was never posted.
   */
  async run(args: { from: string; to: string }) {
    const preview = await this.preview(args);
    if (preview.charges.length === 0) {
      throw new BadRequestException(
        'Nothing to depreciate for this period. Mark the company\'s own assets with isCompanyAsset and give each a purchase value and either a rate or a useful life.',
      );
    }

    const from = new Date(args.from);
    const to = new Date(args.to);

    const existing = await this.prisma.depreciationRun.findUnique({
      where: { periodStart_periodEnd: { periodStart: from, periodEnd: to } },
    });
    if (existing) {
      throw new BadRequestException(
        `Depreciation has already been run for ${args.from} to ${args.to} (${existing.totalCharge}). Charging it twice would silently overstate the expense.`,
      );
    }

    const [expenseAccount, accumulatedAccount] = await Promise.all([
      this.prisma.glAccount.findUnique({ where: { code: '6600' } }),
      this.prisma.glAccount.findUnique({ where: { code: '1510' } }),
    ]);
    if (!expenseAccount || !accumulatedAccount) {
      throw new BadRequestException('Seed the chart of accounts first — 6600 and 1510 are required.');
    }

    return this.prisma.$transaction(async tx => {
      const year = to.getUTCFullYear();
      const count = await tx.journalEntry.count({ where: { entryNumber: { startsWith: `JE-${year}-` } } });
      const entryNumber = `JE-${year}-${String(count + 1).padStart(4, '0')}`;

      const entry = await tx.journalEntry.create({
        data: {
          entryNumber,
          date: to,
          memo: `Depreciation for ${args.from} to ${args.to}. ${preview.charges.length} asset(s), computed from each asset's recorded cost and rate.`,
          reference: `DEPRECIATION ${args.from}..${args.to}`,
          source: 'SYSTEM',
          status: 'POSTED',
          postedAt: new Date(),
          lines: {
            create: [
              { accountId: expenseAccount.id, description: 'Depreciation for the period', debit: preview.totalCharge, credit: 0, sortOrder: 1 },
              { accountId: accumulatedAccount.id, description: 'Accumulated depreciation', debit: 0, credit: preview.totalCharge, sortOrder: 2 },
            ],
          },
        },
      });

      for (const c of preview.charges) {
        await tx.asset.update({
          where: { id: c.assetId },
          data: { accumulatedDepreciation: r2(c.cost - c.closingNetBookValue), currentValue: c.closingNetBookValue },
        });
      }

      const run = await tx.depreciationRun.create({
        data: {
          periodStart: from,
          periodEnd: to,
          assetCount: preview.charges.length,
          totalCharge: preview.totalCharge,
          journalEntryId: entry.id,
        },
      });

      return { run, entryNumber, totalCharge: preview.totalCharge, charges: preview.charges, skipped: preview.skipped };
    });
  }
}
