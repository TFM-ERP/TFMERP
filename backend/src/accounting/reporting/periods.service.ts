import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * Opening and closing accounting periods, and recording a VAT return as filed.
 *
 * Both exist because the 2025 reconstruction had nowhere to put this information.
 * Whether a return had been filed was recorded by writing `[VAT2025:DECLARED]`
 * into `Invoice.internalNotes` — which was then destroyed when the invoices were
 * renamed to their real numbers, taking with it the only record of which invoices
 * were inside a filed return.
 */
@Injectable()
export class PeriodsService {
  constructor(private prisma: PrismaService) {}

  list(year?: number) {
    return this.prisma.fiscalPeriod.findMany({
      where: year ? { year } : undefined,
      orderBy: [{ year: 'desc' }, { startDate: 'asc' }],
    });
  }

  /** Create the twelve months and four quarters of a year, all OPEN. */
  async openYear(year: number) {
    const rows: any[] = [
      { year, periodType: 'YEAR', startDate: utc(year, 0, 1), endDate: utc(year, 11, 31) },
    ];
    for (let q = 0; q < 4; q++) {
      rows.push({
        year,
        periodType: 'QUARTER',
        startDate: utc(year, q * 3, 1),
        endDate: lastDay(year, q * 3 + 2),
      });
    }
    for (let m = 0; m < 12; m++) {
      rows.push({ year, periodType: 'MONTH', startDate: utc(year, m, 1), endDate: lastDay(year, m) });
    }
    await this.prisma.fiscalPeriod.createMany({ data: rows, skipDuplicates: true });
    return this.list(year);
  }

  async close(id: string, userId?: string) {
    const period = await this.prisma.fiscalPeriod.findUnique({ where: { id } });
    if (!period) throw new BadRequestException('No such period.');

    const drafts = await this.prisma.journalEntry.count({
      where: { status: 'DRAFT', date: { gte: period.startDate, lte: period.endDate } },
    });
    if (drafts > 0) {
      throw new BadRequestException(
        `${drafts} journal entr${drafts === 1 ? 'y is' : 'ies are'} still in draft inside this period. ` +
          'Post or void them first — closing now would leave them stranded outside the accounts.',
      );
    }

    return this.prisma.fiscalPeriod.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date(), closedById: userId ?? null },
    });
  }

  reopen(id: string) {
    return this.prisma.fiscalPeriod.update({
      where: { id },
      data: { status: 'OPEN', closedAt: null, closedById: null },
    });
  }
}

function utc(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day));
}

/** Day 0 of the next month is the last day of this one. */
function lastDay(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 0));
}
