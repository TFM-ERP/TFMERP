import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { UserRole, Activity } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  private userSelect = {
    id: true, fullName: true, email: true, mobile: true,
    jobTitle: true, department: true, role: true, activity: true,
    isActive: true, twoFactorEnabled: true, lastLoginAt: true,
    approvalLimit: true, avatarUrl: true, createdAt: true,
    employeeId: true,
    employee: {
      select: {
        id: true, firstName: true, lastName: true, displayName: true,
        department: true, position: true, jobTitle: true, status: true,
        mobile: true, email: true, photoUrl: true,
      },
    },
  };

  async findAll(query: { search?: string; role?: UserRole; isActive?: boolean } = {}) {
    const { search, role, isActive } = query;
    const where: any = {};
    if (role) where.role = role;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.user.findMany({
      where,
      select: this.userSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: this.userSelect,
    });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  /**
   * Employees who do NOT yet have a system user account — the only candidates
   * for new user creation. Personnel data comes from HR; never entered here.
   */
  async availableEmployees(search?: string) {
    const where: any = {
      user: null,
      status: { notIn: ['Terminated', 'Resigned', 'Retired'] },
    };
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
        { employeeNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.employee.findMany({
      where,
      select: {
        id: true, employeeNumber: true, firstName: true, lastName: true,
        displayName: true, department: true, position: true, jobTitle: true,
        email: true, mobile: true, photoUrl: true,
      },
      orderBy: { firstName: 'asc' },
    });
  }

  /**
   * Create a system user account LINKED to an existing employee.
   * Personnel fields are copied from the employee (single source of truth).
   * The screen only supplies: employeeId, password, role, activity, login email.
   */
  async create(data: {
    employeeId: string;
    password: string;
    email?: string;
    role?: UserRole;
    activity?: Activity;
    approvalLimit?: number;
    isActive?: boolean;
  }) {
    if (!data.employeeId) {
      throw new BadRequestException('An employee must be selected. Users can only be created from existing employees.');
    }
    if (!data.password || data.password.length < 8) {
      throw new BadRequestException('A password of at least 8 characters is required.');
    }

    const employee = await this.prisma.employee.findUnique({
      where: { id: data.employeeId },
      include: { user: true },
    });
    if (!employee) throw new NotFoundException('Selected employee not found.');
    if (employee.user) throw new ConflictException('This employee already has a user account.');

    const loginEmail = (data.email || employee.email || '').toLowerCase().trim();
    if (!loginEmail) {
      throw new BadRequestException('A login email is required (the employee has no email on file).');
    }
    const emailTaken = await this.prisma.user.findUnique({ where: { email: loginEmail } });
    if (emailTaken) throw new ConflictException('That login email is already in use.');

    const fullName = employee.displayName || `${employee.firstName} ${employee.lastName || ''}`.trim();
    const passwordHash = await bcrypt.hash(data.password, 12);

    return this.prisma.user.create({
      data: {
        fullName,
        email: loginEmail,
        mobile: employee.mobile,
        jobTitle: employee.jobTitle || employee.position,
        department: employee.department,
        passwordHash,
        role: data.role || UserRole.ACCOUNTANT,
        activity: data.activity || Activity.BOTH,
        approvalLimit: data.approvalLimit ?? undefined,
        isActive: data.isActive ?? true,
        employee: { connect: { id: employee.id } },
      },
      select: this.userSelect,
    });
  }

  /**
   * Update account-only fields. Personnel data (name, department, etc.) is
   * managed in HR, not here — those keys are ignored if sent.
   */
  async update(id: string, data: any) {
    await this.findOne(id);
    const allowed: any = {};
    for (const k of ['role', 'activity', 'isActive', 'approvalLimit']) {
      if (data[k] !== undefined) allowed[k] = data[k];
    }
    if (data.email) allowed.email = String(data.email).toLowerCase().trim();
    if (data.password) {
      if (data.password.length < 8) throw new BadRequestException('Password must be at least 8 characters.');
      allowed.passwordHash = await bcrypt.hash(data.password, 12);
    }
    return this.prisma.user.update({
      where: { id },
      data: allowed,
      select: this.userSelect,
    });
  }

  async resetPassword(id: string, newPassword: string) {
    await this.findOne(id);
    if (!newPassword || newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters.');
    }
    const passwordHash = await bcrypt.hash(newPassword, 12);
    return this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }
}
