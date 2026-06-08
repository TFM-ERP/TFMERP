import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DriverType, JobStatus } from '@prisma/client';

@Injectable()
export class DriversService {
  constructor(private prisma: PrismaService) {}

  // ── Payout / payroll helpers ──────────────────────────────────────────────
  private async seq(prefix: string) {
    const year = new Date().getFullYear();
    const s = await this.prisma.documentSequence.upsert({
      where: { prefix }, update: { lastNumber: { increment: 1 } }, create: { prefix, lastNumber: 1, year },
    });
    return `${prefix}-${year}-${String(s.lastNumber).padStart(4, '0')}`;
  }

  private jobExtras(j: any) {
    return Number(j.fuelExpense || 0) + Number(j.tollExpense || 0) + Number(j.parkingExpense || 0) +
      Number(j.foodAllowance || 0) + Number(j.otherExpense || 0) + Number(j.bonusAmount || 0);
  }

  /** Completed jobs for a driver that have not yet been included in a payout/payroll push. */
  async unbilledJobs(driverId: string) {
    const payouts = await this.prisma.driverPayout.findMany({ where: { driverId }, select: { jobIds: true } });
    const used = new Set(payouts.flatMap(p => p.jobIds));
    const jobs = await this.prisma.driverJob.findMany({
      where: { driverId, status: 'COMPLETED' },
      include: { booking: { select: { bookingNumber: true } }, asset: { select: { name: true } } },
      orderBy: { scheduledAt: 'desc' },
    });
    return jobs.filter(j => !used.has(j.id));
  }

  listPayouts(driverId?: string) {
    return this.prisma.driverPayout.findMany({
      where: driverId ? { driverId } : {},
      include: { driver: { select: { id: true, fullName: true, driverType: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPayout(driverId: string, jobIds: string[]) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');
    if (driver.driverType !== 'FREELANCE') throw new BadRequestException('Payouts are for freelance drivers. Use "push to payroll" for direct hires.');
    const jobs = await this.prisma.driverJob.findMany({
      where: { id: { in: jobIds }, driverId, status: 'COMPLETED' },
      include: { booking: { select: { bookingNumber: true } }, asset: { select: { name: true } } },
    });
    if (jobs.length === 0) throw new BadRequestException('No completed jobs selected');
    const rate = Number(driver.dailyRate || 0);
    const lineItems = jobs.map(j => {
      const extras = this.jobExtras(j);
      return { jobId: j.id, bookingRef: j.booking?.bookingNumber, asset: j.asset?.name, jobType: j.jobType, rate, extras, lineTotal: rate + extras };
    });
    const subtotal = lineItems.reduce((s, l) => s + l.lineTotal, 0);
    const payoutNumber = await this.seq('DPO');
    return this.prisma.driverPayout.create({
      data: { payoutNumber, driverId, status: 'DRAFT', jobIds, lineItems, subtotal, total: subtotal },
    });
  }

  async approvePayout(id: string) {
    return this.prisma.driverPayout.update({ where: { id }, data: { status: 'APPROVED' } });
  }

  async payPayout(id: string, data: any, userId: string) {
    const payout = await this.prisma.driverPayout.findUnique({ where: { id }, include: { driver: true } });
    if (!payout) throw new NotFoundException('Payout not found');
    const updated = await this.prisma.driverPayout.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date(), bankAccountId: data.bankAccountId || null, paymentRef: data.paymentRef || null },
    });
    // Record in finance as an expense (payable settled)
    await this.prisma.expense.create({
      data: {
        expenseNumber: await this.seq('EXP'),
        activity: 'RENTAL', category: 'Driver Payout',
        description: `Freelance driver payout ${payout.payoutNumber} — ${payout.driver.fullName}`,
        amount: payout.total, totalAmount: payout.total, vatAmount: 0,
        status: 'PAID', paidAt: new Date(), vendorName: payout.driver.fullName,
        notes: data.paymentRef ? `Ref: ${data.paymentRef}` : undefined,
        createdById: userId,
      },
    });
    return updated;
  }

  async pushToPayroll(driverId: string, jobIds: string[], month: number, year: number) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Driver not found');
    if (driver.driverType !== 'EMPLOYEE' || !driver.employeeId) throw new BadRequestException('Push to payroll is for direct-hire drivers linked to an employee.');
    const run = await this.prisma.payrollRun.findUnique({ where: { periodMonth_periodYear: { periodMonth: month, periodYear: year } } });
    if (!run) throw new BadRequestException(`No payroll run for ${month}/${year}. Generate that month's payroll first.`);
    const slip = await this.prisma.payslip.findFirst({ where: { payrollRunId: run.id, employeeId: driver.employeeId } });
    if (!slip) throw new BadRequestException('This driver has no payslip in that payroll run.');

    const jobs = await this.prisma.driverJob.findMany({ where: { id: { in: jobIds }, driverId, status: 'COMPLETED' }, include: { booking: { select: { bookingNumber: true } } } });
    if (jobs.length === 0) throw new BadRequestException('No completed jobs selected');
    const extras = jobs.reduce((s, j) => s + this.jobExtras(j), 0);

    const overtimePay = (slip.overtimePay || 0) + extras;
    const grossPay = slip.basicSalary + slip.allowances + overtimePay;
    await this.prisma.payslip.update({
      where: { id: slip.id },
      data: { overtimePay, grossPay, netPay: grossPay - slip.deductions },
    });
    const totalsSlips = await this.prisma.payslip.findMany({ where: { payrollRunId: run.id } });
    await this.prisma.payrollRun.update({
      where: { id: run.id },
      data: { totalGross: totalsSlips.reduce((s, p) => s + p.grossPay, 0), totalNet: totalsSlips.reduce((s, p) => s + p.netPay, 0) },
    });
    // Record so these jobs aren't pushed/paid twice
    return this.prisma.driverPayout.create({
      data: {
        payoutNumber: await this.seq('DPO'), driverId, status: 'PAID', jobIds,
        lineItems: jobs.map(j => ({ jobId: j.id, bookingRef: j.booking?.bookingNumber, extras: this.jobExtras(j) })),
        subtotal: extras, total: extras, paidAt: new Date(), paymentRef: run.reference,
        notes: `Pushed to payroll ${run.reference}`,
      },
    });
  }

  async findAll(query: {
    driverType?: DriverType;
    isActive?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const { driverType, isActive, search, page = 1, limit = 25 } = query;
    const where: any = {};
    if (driverType) where.driverType = driverType;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
        { licenseNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.driver.findMany({
        where,
        include: { _count: { select: { jobs: true, incidents: true } } },
        orderBy: { fullName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.driver.count({ where }),
    ]);

    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id },
      include: {
        jobs: {
          include: {
            booking: { select: { id: true, bookingNumber: true, startDate: true, endDate: true, deliveryAddress: true } },
            asset: { select: { id: true, name: true, assetType: true, plateNumber: true } },
          },
          orderBy: { scheduledAt: 'desc' },
          take: 30,
        },
        incidents: {
          orderBy: { occurredAt: 'desc' },
          take: 10,
          include: {
            asset: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!driver) throw new NotFoundException(`Driver ${id} not found`);
    return driver;
  }

  async create(data: any) {
    return this.prisma.driver.create({
      data: {
        fullName: data.fullName,
        mobile: data.mobile,
        email: data.email,
        driverType: data.driverType || 'EMPLOYEE',
        employeeId: data.employeeId || undefined,
        emiratesId: data.emiratesId,
        emiratesIdExpiry: data.emiratesIdExpiry ? new Date(data.emiratesIdExpiry) : undefined,
        passportNumber: data.passportNumber,
        passportExpiry: data.passportExpiry ? new Date(data.passportExpiry) : undefined,
        licenseNumber: data.licenseNumber,
        licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry) : undefined,
        licenseClass: data.licenseClass,
        visaExpiry: data.visaExpiry ? new Date(data.visaExpiry) : undefined,
        bankName: data.bankName,
        bankAccount: data.bankAccount,
        iban: data.iban,
        dailyRate: data.dailyRate ? Number(data.dailyRate) : undefined,
        weeklyRate: data.weeklyRate ? Number(data.weeklyRate) : undefined,
        photoUrl: data.photoUrl,
        emiratesIdDocUrl: data.emiratesIdDocUrl,
        passportDocUrl: data.passportDocUrl,
        licenseDocUrl: data.licenseDocUrl,
        notes: data.notes,
      },
    });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    return this.prisma.driver.update({
      where: { id },
      data: {
        fullName: data.fullName,
        mobile: data.mobile,
        email: data.email,
        driverType: data.driverType,
        ...(data.employeeId !== undefined && { employeeId: data.employeeId || null }),
        emiratesId: data.emiratesId,
        emiratesIdExpiry: data.emiratesIdExpiry ? new Date(data.emiratesIdExpiry) : undefined,
        passportNumber: data.passportNumber,
        passportExpiry: data.passportExpiry ? new Date(data.passportExpiry) : undefined,
        licenseNumber: data.licenseNumber,
        licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry) : undefined,
        licenseClass: data.licenseClass,
        visaExpiry: data.visaExpiry ? new Date(data.visaExpiry) : undefined,
        bankName: data.bankName,
        bankAccount: data.bankAccount,
        iban: data.iban,
        dailyRate: data.dailyRate ? Number(data.dailyRate) : undefined,
        weeklyRate: data.weeklyRate ? Number(data.weeklyRate) : undefined,
        photoUrl: data.photoUrl,
        emiratesIdDocUrl: data.emiratesIdDocUrl,
        passportDocUrl: data.passportDocUrl,
        licenseDocUrl: data.licenseDocUrl,
        isActive: data.isActive,
        notes: data.notes,
      },
    });
  }

  async createJob(data: any) {
    const booking = await this.prisma.rentalBooking.findUnique({ where: { id: data.bookingId } });
    if (!booking) throw new NotFoundException(`Booking ${data.bookingId} not found`);

    return this.prisma.driverJob.create({
      data: {
        bookingId: data.bookingId,
        driverId: data.driverId,
        assetId: data.assetId || undefined,
        jobType: data.jobType,
        scheduledAt: new Date(data.scheduledAt || data.scheduledDate),
        pickupLocation: data.pickupLocation || data.fromLocation,
        dropoffLocation: data.dropoffLocation || data.toLocation,
        driverNotes: data.notes,
        equipmentChecklist: data.equipmentChecklist || undefined,
      },
      include: {
        driver: { select: { id: true, fullName: true, mobile: true } },
        asset: { select: { id: true, name: true, assetType: true } },
        booking: { select: { id: true, bookingNumber: true } },
      },
    });
  }

  async updateJobStatus(jobId: string, status: JobStatus, completedAt?: string) {
    const job = await this.prisma.driverJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    return this.prisma.driverJob.update({
      where: { id: jobId },
      data: {
        status,
        startedAt: status === 'EN_ROUTE' && !job.startedAt ? new Date() : undefined,
        arrivedAt: status === 'ARRIVED' && !job.arrivedAt ? new Date() : undefined,
        completedAt: completedAt ? new Date(completedAt) : (status === 'COMPLETED' ? new Date() : undefined),
      },
    });
  }

  async updateJob(jobId: string, data: any) {
    const job = await this.prisma.driverJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);

    return this.prisma.driverJob.update({
      where: { id: jobId },
      data: {
        status: data.status,
        driverNotes: data.driverNotes || data.notes,
        deliveryPhotos: data.deliveryPhotos,
        pickupPhotos: data.pickupPhotos,
        signatureUrl: data.signatureUrl,
        receiptPhotoUrls: data.receiptPhotoUrls,
        equipmentChecklist: data.equipmentChecklist,
        gpsOnArrival: data.gpsOnArrival,
        fuelExpense: data.fuelExpense ? Number(data.fuelExpense) : undefined,
        tollExpense: data.tollExpense ? Number(data.tollExpense) : undefined,
        parkingExpense: data.parkingExpense ? Number(data.parkingExpense) : undefined,
        foodAllowance: data.foodAllowance ? Number(data.foodAllowance) : undefined,
        otherExpense: data.otherExpense ? Number(data.otherExpense) : undefined,
        bonusAmount: data.bonusAmount ? Number(data.bonusAmount) : undefined,
        bonusNotes: data.bonusNotes,
      },
    });
  }

  async getJobsByBooking(bookingId: string) {
    return this.prisma.driverJob.findMany({
      where: { bookingId },
      include: {
        driver: { select: { id: true, fullName: true, mobile: true } },
        asset: { select: { id: true, name: true, assetType: true } },
      },
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async getExpiryAlerts() {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 86400000);

    return this.prisma.driver.findMany({
      where: {
        isActive: true,
        OR: [
          { licenseExpiry: { lte: in30Days } },
          { passportExpiry: { lte: in30Days } },
          { visaExpiry: { lte: in30Days } },
          { emiratesIdExpiry: { lte: in30Days } },
        ],
      },
      select: {
        id: true, fullName: true, mobile: true, driverType: true,
        licenseExpiry: true, passportExpiry: true, visaExpiry: true, emiratesIdExpiry: true,
      },
      orderBy: { licenseExpiry: 'asc' },
    });
  }

  async getPerformance(driverId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { id: true, fullName: true, driverType: true, dailyRate: true, weeklyRate: true },
    });
    if (!driver) throw new NotFoundException(`Driver ${driverId} not found`);

    const jobs = await this.prisma.driverJob.findMany({
      where: { driverId },
      select: {
        id: true, status: true, scheduledAt: true, startedAt: true,
        completedAt: true, fuelExpense: true, tollExpense: true,
        parkingExpense: true, foodAllowance: true, otherExpense: true, bonusAmount: true,
      },
    });

    const completed = jobs.filter(j => j.status === 'COMPLETED');
    const cancelled = jobs.filter(j => j.status === 'CANCELLED');

    // Delay = started more than 30 min after scheduled
    const delayed = completed.filter(j => {
      if (!j.startedAt) return false;
      return j.startedAt.getTime() - j.scheduledAt.getTime() > 30 * 60 * 1000;
    });

    // Average job duration
    const durations = completed
      .filter(j => j.startedAt && j.completedAt)
      .map(j => (j.completedAt!.getTime() - j.startedAt!.getTime()) / 3600000);
    const avgDurationHrs = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

    // Expenses
    const totalExpenses = jobs.reduce((sum, j) => {
      return sum +
        Number(j.fuelExpense || 0) + Number(j.tollExpense || 0) +
        Number(j.parkingExpense || 0) + Number(j.foodAllowance || 0) +
        Number(j.otherExpense || 0);
    }, 0);

    const totalBonus = jobs.reduce((sum, j) => sum + Number(j.bonusAmount || 0), 0);

    // Incident count
    const incidentCount = await this.prisma.incidentReport.count({ where: { driverId } });

    // Reliability score: 100 - (delay% * 0.5) - (incident% * 0.3) - (cancellation% * 0.2)
    const totalJobs = jobs.length || 1;
    const delayPct = (delayed.length / totalJobs) * 100;
    const incidentPct = (incidentCount / totalJobs) * 100;
    const cancellationPct = (cancelled.length / totalJobs) * 100;
    const reliabilityScore = Math.max(0, Math.round(100 - delayPct * 0.5 - incidentPct * 0.3 - cancellationPct * 0.2));

    return {
      driver,
      totalJobs: jobs.length,
      completedJobs: completed.length,
      cancelledJobs: cancelled.length,
      delayedJobs: delayed.length,
      delayRate: Math.round(delayPct),
      incidentCount,
      avgJobDurationHrs: Math.round(avgDurationHrs * 10) / 10,
      totalExpenses,
      totalBonus,
      reliabilityScore,
    };
  }

  async generateFreelancerInvoice(driverId: string, jobIds: string[]) {
    const driver = await this.prisma.driver.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException(`Driver ${driverId} not found`);
    if (driver.driverType !== 'FREELANCE') {
      throw new Error('Invoice generation is only for FREELANCE drivers');
    }

    const jobs = await this.prisma.driverJob.findMany({
      where: {
        id: { in: jobIds },
        driverId,
        status: 'COMPLETED',
      },
      include: {
        booking: { select: { id: true, bookingNumber: true, deliveryAddress: true } },
        asset: { select: { id: true, name: true, plateNumber: true } },
      },
    });

    const lineItems = jobs.map(j => ({
      jobId: j.id,
      bookingRef: j.booking?.bookingNumber,
      jobType: j.jobType,
      scheduledAt: j.scheduledAt,
      asset: j.asset?.name,
      dailyRate: driver.dailyRate ? Number(driver.dailyRate) : 0,
      fuelExpense: Number(j.fuelExpense || 0),
      tollExpense: Number(j.tollExpense || 0),
      parkingExpense: Number(j.parkingExpense || 0),
      foodAllowance: Number(j.foodAllowance || 0),
      otherExpense: Number(j.otherExpense || 0),
      bonusAmount: Number(j.bonusAmount || 0),
      lineTotal: (driver.dailyRate ? Number(driver.dailyRate) : 0) +
        Number(j.fuelExpense || 0) + Number(j.tollExpense || 0) +
        Number(j.parkingExpense || 0) + Number(j.foodAllowance || 0) +
        Number(j.otherExpense || 0) + Number(j.bonusAmount || 0),
    }));

    const subtotal = lineItems.reduce((s, l) => s + l.lineTotal, 0);

    return {
      driver: { id: driver.id, fullName: driver.fullName, mobile: driver.mobile, iban: driver.iban, bankName: driver.bankName },
      generatedAt: new Date(),
      lineItems,
      subtotal,
      vatAmount: 0, // Freelance individuals typically not VAT registered
      total: subtotal,
      jobCount: jobs.length,
    };
  }
}
