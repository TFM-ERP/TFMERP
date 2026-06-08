import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * HR & Workforce Management — central personnel system.
 * Manages employees plus their documents, leave, driver profile,
 * asset assignments and certifications. Compliance fields support
 * both Mainland (MOHRE) and Free Zone jurisdictions.
 */

// Employee DateTime columns — must be Date objects or omitted (not "" / date-only strings).
const EMPLOYEE_DATE_FIELDS = new Set([
  'dateOfBirth',
  'joiningDate',
  'probationStart',
  'probationEnd',
  'contractStart',
  'contractEnd',
  'resignationDate',
  'terminationDate',
  'workPermitIssueDate',
  'workPermitExpiryDate',
  'employmentCardIssueDate',
  'employmentCardExpiryDate',
  'emiratesIdExpiry',
  'passportExpiry',
  'visaExpiry',
]);
const EMPLOYEE_NUMBER_FIELDS = new Set([
  'basicSalary',
  'housingAllowance',
  'transportAllowance',
  'foodAllowance',
  'mobileAllowance',
  'fuelAllowance',
  'otherAllowance',
  'dailyRate',
  'hourlyRate',
]);

function sanitizeEmployee(input: any): any {
  const out: any = {};
  for (const [k, v] of Object.entries(input || {})) {
    if (v === '' || v === undefined) continue;
    if (v === null) { out[k] = null; continue; }
    if (EMPLOYEE_DATE_FIELDS.has(k)) {
      const d = new Date(v as string);
      out[k] = isNaN(d.getTime()) ? undefined : d;
    } else if (EMPLOYEE_NUMBER_FIELDS.has(k)) {
      const n = Number(v);
      out[k] = isNaN(n) ? undefined : n;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function sanitizeDates(input: any, fields: string[]): any {
  const out: any = { ...input };
  for (const f of fields) {
    if (out[f] === '' || out[f] === undefined || out[f] === null) {
      delete out[f];
    } else {
      const d = new Date(out[f]);
      if (isNaN(d.getTime())) delete out[f];
      else out[f] = d;
    }
  }
  return out;
}

@Injectable()
export class HrService {
  constructor(private prisma: PrismaService) {}

  private fullInclude = {
    documents: true,
    leaveRequests: { orderBy: { startDate: 'desc' as const } },
    assets: { orderBy: { assignmentDate: 'desc' as const } },
    certifications: true,
    driverProfile: true,
    manager: { select: { id: true, firstName: true, lastName: true, displayName: true } },
  };

  // ── Employees ───────────────────────────────────────────────────────────
  async findAll(query: any = {}) {
    const { search, status, department, employmentType, isDriver } = query;
    const where: any = {};
    if (status) where.status = status;
    if (department) where.department = department;
    if (employmentType) where.employmentType = employmentType;
    if (isDriver !== undefined) where.isDriver = isDriver === true || isDriver === 'true';
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { employeeNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.employee.findMany({
      where,
      include: { driverProfile: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const emp = await this.prisma.employee.findUnique({
      where: { id },
      include: this.fullInclude,
    });
    if (!emp) throw new NotFoundException(`Employee ${id} not found`);
    return emp;
  }

  private split(data: any) {
    const {
      documents,
      certifications,
      driverProfile,
      leaveRequests,
      assets,
      manager,
      id,
      createdAt,
      updatedAt,
      ...employee
    } = data || {};
    return { employee: sanitizeEmployee(employee), documents, certifications, driverProfile };
  }

  async create(data: any) {
    const { employee, documents, certifications, driverProfile } = this.split(data);
    if (!employee.displayName) {
      employee.displayName = [employee.firstName, employee.lastName]
        .filter(Boolean)
        .join(' ');
    }
    const cleanDocs = (documents || []).map((d: any) =>
      sanitizeDates(d, ['issueDate', 'expiryDate']),
    );
    const cleanCerts = (certifications || []).map((c: any) =>
      sanitizeDates(c, ['issueDate', 'expiryDate']),
    );
    const cleanDriver = driverProfile
      ? sanitizeDates(driverProfile, ['licenseIssueDate', 'licenseExpiryDate'])
      : null;
    return this.prisma.employee.create({
      data: {
        ...employee,
        documents: cleanDocs.length ? { create: cleanDocs } : undefined,
        certifications: cleanCerts.length ? { create: cleanCerts } : undefined,
        driverProfile:
          employee.isDriver && cleanDriver ? { create: cleanDriver } : undefined,
      },
      include: this.fullInclude,
    });
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    const { employee, driverProfile } = this.split(data);
    if (driverProfile && employee.isDriver) {
      const cleanDriver = sanitizeDates(driverProfile, ['licenseIssueDate', 'licenseExpiryDate']);
      await this.prisma.driverProfile.upsert({
        where: { employeeId: id },
        update: cleanDriver,
        create: { ...cleanDriver, employeeId: id },
      });
    }
    return this.prisma.employee.update({
      where: { id },
      data: employee,
      include: this.fullInclude,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.employee.delete({ where: { id } });
  }

  // ── Documents ───────────────────────────────────────────────────────────
  addDocument(employeeId: string, data: any) {
    return this.prisma.employeeDocument.create({
      data: { ...sanitizeDates(data, ['issueDate', 'expiryDate']), employeeId },
    });
  }
  removeDocument(docId: string) {
    return this.prisma.employeeDocument.delete({ where: { id: docId } });
  }

  // ── Leave ───────────────────────────────────────────────────────────────
  listLeave(query: any = {}) {
    const where: any = {};
    if (query.employeeId) where.employeeId = query.employeeId;
    if (query.status) where.status = query.status;
    return this.prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, displayName: true, firstName: true, lastName: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }
  createLeave(data: any) {
    const clean = sanitizeDates(data, ['startDate', 'endDate']);
    const start = new Date(clean.startDate);
    const end = new Date(clean.endDate);
    const days =
      clean.days ??
      Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    return this.prisma.leaveRequest.create({ data: { ...clean, days } });
  }
  setLeaveStatus(id: string, status: string) {
    return this.prisma.leaveRequest.update({ where: { id }, data: { status } });
  }

  // ── Assets assigned to employees ────────────────────────────────────────
  assignAsset(employeeId: string, data: any) {
    return this.prisma.assetAssignment.create({
      data: { ...sanitizeDates(data, ['assignmentDate', 'returnDate']), employeeId },
    });
  }
  returnAsset(id: string) {
    return this.prisma.assetAssignment.update({
      where: { id },
      data: { status: 'Returned', returnDate: new Date() },
    });
  }

  // ── Certifications ──────────────────────────────────────────────────────
  addCertification(employeeId: string, data: any) {
    return this.prisma.certification.create({
      data: { ...sanitizeDates(data, ['issueDate', 'expiryDate']), employeeId },
    });
  }
  removeCertification(id: string) {
    return this.prisma.certification.delete({ where: { id } });
  }

  // ── Reports ─────────────────────────────────────────────────────────────
  async stats() {
    const [total, active, onLeave, drivers] = await Promise.all([
      this.prisma.employee.count(),
      this.prisma.employee.count({ where: { status: 'Active' } }),
      this.prisma.employee.count({ where: { status: 'OnLeave' } }),
      this.prisma.employee.count({ where: { isDriver: true } }),
    ]);
    return { total, active, onLeave, drivers };
  }

  /** Upcoming expiries across visa / Emirates ID / labour & employment cards / contracts. */
  async expiryAlerts(days = 60) {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + days);
    const employees = await this.prisma.employee.findMany({
      where: { status: { notIn: ['Terminated', 'Resigned', 'Retired'] } },
    });
    const alerts: any[] = [];
    const push = (e: any, type: string, date?: Date | null) => {
      if (date && new Date(date) <= horizon) {
        alerts.push({
          employeeId: e.id,
          employee: e.displayName || `${e.firstName} ${e.lastName || ''}`.trim(),
          type,
          expiryDate: date,
        });
      }
    };
    for (const e of employees) {
      push(e, 'Visa', e.visaExpiry);
      push(e, 'Emirates ID', e.emiratesIdExpiry);
      push(e, 'Passport', e.passportExpiry);
      push(e, 'Work Permit', e.workPermitExpiryDate);
      push(e, 'Employment Card', e.employmentCardExpiryDate);
      push(e, 'Contract', e.contractEnd);
    }
    return alerts.sort(
      (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime(),
    );
  }
}
