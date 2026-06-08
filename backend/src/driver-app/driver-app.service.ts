import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class DriverAppService {
  constructor(private prisma: PrismaService) {}

  private async seq(prefix: string) {
    const year = new Date().getFullYear();
    const s = await this.prisma.documentSequence.upsert({
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

  async review(id: string, status: 'APPROVED' | 'REJECTED', userId: string, notes?: string) {
    const sub = await this.prisma.driverSubmission.findUnique({ where: { id } });
    if (!sub) throw new NotFoundException('Submission not found');
    const updated = await this.prisma.driverSubmission.update({
      where: { id },
      data: { status, reviewedById: userId, reviewedAt: new Date(), reviewNotes: notes || null },
    });
    if (status !== 'APPROVED') return updated;

    const driver = await this.prisma.driver.findUnique({ where: { id: sub.driverId }, select: { fullName: true } });
    const amount = Number(sub.amount);
    // Fuel with an asset + litres → a Fuel Log (feeds fuel analytics + odometer)
    if (sub.type === 'FUEL' && sub.assetId && sub.litres && Number(sub.litres) > 0) {
      const litres = Number(sub.litres);
      await this.prisma.fuelLog.create({
        data: {
          assetId: sub.assetId, litres, costPerLitre: amount / litres, totalCost: amount,
          odometer: sub.odometer ?? undefined, receiptUrl: sub.receiptUrl ?? undefined,
          bookingRef: sub.bookingId ?? undefined, notes: `Driver ${driver?.fullName || ''} (approved)`,
        },
      });
      if (sub.odometer) await this.prisma.asset.update({ where: { id: sub.assetId }, data: { currentOdometer: sub.odometer } }).catch(() => {});
    } else {
      // Everything else → a finance Expense
      await this.prisma.expense.create({
        data: {
          expenseNumber: await this.seq('EXP'), activity: 'RENTAL',
          category: `Driver ${sub.type}`, description: `${sub.type} — ${driver?.fullName || 'driver'}`,
          amount, totalAmount: amount, vatAmount: 0, status: 'APPROVED' as any,
          vendorName: driver?.fullName, receiptUrl: sub.receiptUrl ?? undefined,
          projectRef: sub.bookingId ?? undefined, createdById: userId,
        },
      });
    }
    return updated;
  }
}
