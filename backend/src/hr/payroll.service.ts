import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class PayrollService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.payrollRun.findMany({
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      include: { _count: { select: { payslips: true } } },
    });
  }

  async get(id: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id },
      include: { payslips: { orderBy: { employeeName: 'asc' } } },
    });
    if (!run) throw new NotFoundException(`Payroll run ${id} not found`);
    return run;
  }

  private allowances(e: any): number {
    return (
      (e.housingAllowance || 0) +
      (e.transportAllowance || 0) +
      (e.foodAllowance || 0) +
      (e.mobileAllowance || 0) +
      (e.fuelAllowance || 0) +
      (e.otherAllowance || 0)
    );
  }

  /**
   * Generate a payroll run for a month/year from active employees'
   * salary structures. Idempotent per period via unique constraint.
   */
  async generate(month: number, year: number, notes?: string) {
    if (!month || !year) throw new BadRequestException('month and year are required');
    const existing = await this.prisma.payrollRun.findUnique({
      where: { periodMonth_periodYear: { periodMonth: month, periodYear: year } },
    });
    if (existing) {
      throw new BadRequestException(
        `Payroll for ${month}/${year} already exists (${existing.reference}).`,
      );
    }

    const employees = await this.prisma.employee.findMany({
      where: { status: { in: ['Active', 'OnLeave'] } },
    });

    const reference = `PR-${year}-${String(month).padStart(2, '0')}`;
    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    const payslips = employees.map((e) => {
      const basic = e.basicSalary || 0;
      const allow = this.allowances(e);
      const gross = basic + allow;
      const net = gross; // deductions added per-slip later
      totalGross += gross;
      totalNet += net;
      return {
        employeeId: e.id,
        employeeName: e.displayName || `${e.firstName} ${e.lastName || ''}`.trim(),
        basicSalary: basic,
        allowances: allow,
        overtimePay: 0,
        grossPay: gross,
        deductions: 0,
        netPay: net,
        bankName: e.bankName,
        iban: e.iban,
      };
    });

    return this.prisma.payrollRun.create({
      data: {
        reference,
        periodMonth: month,
        periodYear: year,
        notes,
        status: 'Draft',
        totalGross,
        totalDeductions,
        totalNet,
        payslips: { create: payslips },
      },
      include: { payslips: true },
    });
  }

  /** Update a single payslip (overtime / deductions), then re-roll run totals. */
  async updatePayslip(payslipId: string, data: any) {
    const slip = await this.prisma.payslip.findUnique({ where: { id: payslipId } });
    if (!slip) throw new NotFoundException('Payslip not found');
    const overtimePay = data.overtimePay ?? slip.overtimePay;
    const deductions = data.deductions ?? slip.deductions;
    const grossPay = slip.basicSalary + slip.allowances + overtimePay;
    const netPay = grossPay - deductions;
    await this.prisma.payslip.update({
      where: { id: payslipId },
      data: {
        overtimePay,
        deductions,
        deductionNotes: data.deductionNotes ?? slip.deductionNotes,
        grossPay,
        netPay,
      },
    });
    return this.recalc(slip.payrollRunId);
  }

  private async recalc(runId: string) {
    const slips = await this.prisma.payslip.findMany({ where: { payrollRunId: runId } });
    const totalGross = slips.reduce((s, p) => s + p.grossPay, 0);
    const totalDeductions = slips.reduce((s, p) => s + p.deductions, 0);
    const totalNet = slips.reduce((s, p) => s + p.netPay, 0);
    return this.prisma.payrollRun.update({
      where: { id: runId },
      data: { totalGross, totalDeductions, totalNet },
      include: { payslips: { orderBy: { employeeName: 'asc' } } },
    });
  }

  setStatus(id: string, status: string) {
    return this.prisma.payrollRun.update({ where: { id }, data: { status } });
  }

  async remove(id: string) {
    await this.get(id);
    return this.prisma.payrollRun.delete({ where: { id } });
  }
}
