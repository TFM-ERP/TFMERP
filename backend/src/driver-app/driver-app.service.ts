import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class DriverAppService {
  constructor(private prisma: PrismaService) {}

  /**
   * `client` lets a caller draw the next number inside an open transaction, so a
   * rolled-back approval does not consume an expense number.
   */
  private async seq(prefix: string, client: any = this.prisma) {
    const year = new Date().getFullYear();
    const s = await client.documentSequence.upsert({
      where: { prefix }, update: { lastNumber: { increment: 1 } }, create: { prefix, lastNumber: 1, year },
    });
    return `${prefix}-${year}-${String(s.lastNumber).padStart(4, '0')}`;
  }

  /** Resolve the Driver record for a logged-in user (via their employee link). */
  async myDriver(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return null;
    return this.prisma.driver.findUnique({ where: { employeeId: user.employeeId } });
  }

  async me(userId: string) {
    const driver = await this.myDriver(userId);
    return { isDriver: !!driver, driver };
  }

  async myJobs(userId: string) {
    const driver = await this.myDriver(userId);
    if (!driver) return [];
    return this.prisma.driverJob.findMany({
      where: { driverId: driver.id, status: { notIn: ['CANCELLED'] } },
      include: {
        asset: { select: { id: true, name: true, plateNumber: true } },
        booking: {
          select: {
            id: true, bookingNumber: true, deliveryAddress: true, deliveryLocationUrl: true,
            client: { select: { companyName: true, googleMapsUrl: true } },
            locations: { orderBy: { sequence: 'asc' } },
            items: { select: { id: true, towedById: true, asset: { select: { id: true, name: true, tracksMileage: true } } } },
          },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async createSubmission(userId: string, data: any) {
    const driver = await this.myDriver(userId);
    if (!driver) throw new Error('No driver profile linked to your account');
    return this.prisma.driverSubmission.create({
      data: {
        driverId: driver.id,
        driverJobId: data.driverJobId || null,
        bookingId: data.bookingId || null,
        assetId: data.assetId || null,
        type: data.type || 'FUEL',
        amount: Number(data.amount || 0),
        litres: data.litres != null && data.litres !== '' ? Number(data.litres) : null,
        odometer: data.odometer != null && data.odometer !== '' ? Number(data.odometer) : null,
        receiptUrl: data.receiptUrl || null,
        notes: data.notes || null,
        status: 'PENDING',
      },
    });
  }

  async mySubmissions(userId: string) {
    const driver = await this.myDriver(userId);
    if (!driver) return [];
    return this.prisma.driverSubmission.findMany({ where: { driverId: driver.id }, orderBy: { createdAt: 'desc' } });
  }

  // ── Manager side ──
  async pending() {
    const subs = await this.prisma.driverSubmission.findMany({ where: { status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
    const driverIds = [...new Set(subs.map(s => s.driverId))];
    const drivers = await this.prisma.driver.findMany({ where: { id: { in: driverIds } }, select: { id: true, fullName: true } });
    const map = Object.fromEntries(drivers.map(d => [d.id, d.fullName]));
    return subs.map(s => ({ ...s, driverName: map[s.driverId] }));
  }

  /**
   * A DRIVER CLAIM IS A REQUEST, NOT A POSTING.
   *
   * This route carries JwtAuthGuard only — no finance permission — so an approval here
   * must not create finance-approved cost. Every approved claim lands as an expense at
   * PENDING_APPROVAL, which is the state the expense workflow already gates to
   * FINANCE_MANAGER / SYSTEM_ADMIN / ACCOUNTANT (status/workflow.config.ts:159-175).
   * Finance confirms the receipt, the VAT and the supplier before it posts.
   *
   * FUEL REACHES THE BOOKS TOO. It previously went to fuelLog alone and never touched
   * the ledger. It now does both: the fuelLog still feeds fuel analytics, the odometer
   * and profitability-by-booking (reports.service.ts:374, which reads fuelLog and never
   * reads expenses, so there is no double count), and the expense carries the cost.
   *
   * NO SELF-REVIEW. A driver is tied to a user through the employee record
   * (user.employeeId === driver.employeeId), so the same employee cannot submit a claim
   * and approve it.
   */
  async review(id: string, status: 'APPROVED' | 'REJECTED', userId: string, notes?: string) {
    const sub = await this.prisma.driverSubmission.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Submission not found');

    const driver = await this.prisma.driver.findUnique({
      where: { id: sub.driverId },
      select: { fullName: true, employeeId: true },
    });
    const reviewer = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { employeeId: true },
    });
    if (driver?.employeeId && reviewer?.employeeId && driver.employeeId === reviewer.employeeId) {
      throw new ForbiddenException(
        'You cannot review your own submission — another reviewer must approve it',
      );
    }

    if (status !== 'APPROVED') {
      return this.prisma.driverSubmission.update({
        where: { id },
        data: { status, reviewedById: userId, reviewedAt: new Date(), reviewNotes: notes || null },
      });
    }

    const amount = Number(sub.amount);
    const litres = sub.litres != null ? Number(sub.litres) : 0;
    const isFuelLog = sub.type === 'FUEL' && !!sub.assetId && litres > 0;

    // One transaction: the submission is never left APPROVED with no expense behind it.
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.driverSubmission.update({
        where: { id },
        data: { status, reviewedById: userId, reviewedAt: new Date(), reviewNotes: notes || null },
      });

      if (isFuelLog) {
        await tx.fuelLog.create({
          data: {
            assetId: sub.assetId!, litres, costPerLitre: amount / litres, totalCost: amount,
            odometer: sub.odometer ?? undefined, receiptUrl: sub.receiptUrl ?? undefined,
            bookingRef: sub.bookingId ?? undefined, notes: `Driver ${driver?.fullName || ''} (approved)`,
          },
        });
      }

      await tx.expense.create({
        data: {
          expenseNumber: await this.seq('EXP', tx), activity: 'RENTAL',
          category: `Driver ${sub.type}`, description: `${sub.type} — ${driver?.fullName || 'driver'}`,
          amount, totalAmount: amount, vatAmount: 0, status: 'PENDING_APPROVAL' as any,
          vendorName: driver?.fullName, receiptUrl: sub.receiptUrl ?? undefined,
          projectRef: sub.bookingId ?? undefined, createdById: userId,
        },
      });

      return row;
    });

    // Odometer is a convenience reading, not part of the claim — a failure here must not
    // roll back the approval, so it sits outside the transaction.
    if (isFuelLog && sub.odometer) {
      await this.prisma.asset
        .update({ where: { id: sub.assetId! }, data: { currentOdometer: sub.odometer } })
        .catch(() => {});
    }

    return updated;
  }
}
