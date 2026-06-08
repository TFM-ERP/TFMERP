import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  StatusModule,
  isTransitionAllowed,
  isRolePermitted,
  requiresNote,
  isLocked,
  getAllowedTransitions,
} from './workflow.config';

export interface LogStatusChangeDto {
  module: StatusModule;
  recordId: string;
  recordRef?: string;
  previousStatus: string | null;
  newStatus: string;
  changedById: string;
  notes?: string;
  isAutomatic?: boolean;
  metadata?: Record<string, any>;
}

export interface ValidateTransitionDto {
  module: StatusModule;
  fromStatus: string;
  toStatus: string;
  userRole: string;
  notes?: string;
}

/** Run a prisma call, returning a fallback if it throws. */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

@Injectable()
export class StatusService {
  constructor(private prisma: PrismaService) {}

  /**
   * Validate a status transition against the workflow rules.
   * Throws BadRequestException or ForbiddenException if invalid.
   */
  validate(dto: ValidateTransitionDto): void {
    const { module, fromStatus, toStatus, userRole, notes } = dto;

    // SYSTEM_ADMIN can override locked states
    const isAdmin = userRole === 'SYSTEM_ADMIN';

    // Check if current status is locked (terminal)
    if (!isAdmin && isLocked(module, fromStatus)) {
      throw new ForbiddenException(
        `Status "${fromStatus}" is locked. Contact a System Administrator to override.`,
      );
    }

    // Check transition is allowed
    if (!isTransitionAllowed(module, fromStatus, toStatus)) {
      const allowed = getAllowedTransitions(module, fromStatus);
      throw new BadRequestException(
        `Cannot transition from "${fromStatus}" to "${toStatus}". ` +
        (allowed.length ? `Allowed: ${allowed.join(', ')}` : 'No further transitions available.'),
      );
    }

    // Check role permission
    if (!isRolePermitted(module, toStatus, userRole)) {
      throw new ForbiddenException(
        `Your role (${userRole}) is not permitted to set status to "${toStatus}".`,
      );
    }

    // Check if note is required
    if (requiresNote(module, toStatus) && (!notes || notes.trim().length < 3)) {
      throw new BadRequestException(
        `A note/comment is required when setting status to "${toStatus}".`,
      );
    }
  }

  /**
   * Log a status change to the audit trail.
   * Call this AFTER the record has been updated successfully.
   */
  async log(dto: LogStatusChangeDto): Promise<void> {
    await (this.prisma.statusLog as any).create({
      data: {
        module:         dto.module,
        recordId:       dto.recordId,
        recordRef:      dto.recordRef,
        previousStatus: dto.previousStatus,
        newStatus:      dto.newStatus,
        changedById:    dto.changedById,
        notes:          dto.notes,
        isAutomatic:    dto.isAutomatic ?? false,
        metadata:       dto.metadata ?? undefined,
        changedAt:      new Date(),
      },
    });
  }

  /**
   * Get the full status history for a record.
   */
  async getHistory(module: StatusModule, recordId: string) {
    return (this.prisma.statusLog as any).findMany({
      where: { module, recordId },
      include: {
        changedBy: { select: { id: true, fullName: true, role: true, avatarUrl: true } },
      },
      orderBy: { changedAt: 'asc' },
    });
  }

  /**
   * Get recent status changes across all modules (for dashboard/notifications).
   */
  async getRecent(limit = 20) {
    return (this.prisma.statusLog as any).findMany({
      take: limit,
      include: {
        changedBy: { select: { id: true, fullName: true, role: true } },
      },
      orderBy: { changedAt: 'desc' },
    });
  }

  /**
   * Kanban board data: all records for a module grouped by status.
   */
  async getKanbanData(module: StatusModule) {
    const now = new Date();
    const dayMs = 86_400_000;

    const addDaysInStatus = (records: any[]) =>
      records.map(r => ({
        ...r,
        daysInStatus: Math.floor((now.getTime() - new Date(r.updatedAt ?? r.createdAt).getTime()) / dayMs),
      }));

    switch (module) {
      case 'Invoice':
        return addDaysInStatus(await this.prisma.invoice.findMany({
          select: { id: true, invoiceNumber: true, status: true, total: true, amountDue: true,
            dueDate: true, updatedAt: true, createdAt: true,
            client: { select: { companyName: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 200,
        }));
      case 'Quotation':
        return addDaysInStatus(await this.prisma.quotation.findMany({
          select: { id: true, quotationNumber: true, status: true, total: true,
            validUntil: true, updatedAt: true, createdAt: true,
            client: { select: { companyName: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 200,
        }));
      case 'Booking':
        return addDaysInStatus(await this.prisma.rentalBooking.findMany({
          select: { id: true, bookingNumber: true, status: true, total: true,
            startDate: true, endDate: true, updatedAt: true, createdAt: true,
            client: { select: { companyName: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 200,
        }));
      case 'Asset':
        return addDaysInStatus(await this.prisma.asset.findMany({
          select: { id: true, name: true, assetType: true, status: true,
            updatedAt: true, createdAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 200,
        }));
      case 'Maintenance':
        return addDaysInStatus(await this.prisma.maintenanceLog.findMany({
          select: { id: true, status: true, maintenanceType: true, scheduledDate: true,
            updatedAt: true, createdAt: true,
            asset: { select: { id: true, name: true } } },
          orderBy: { updatedAt: 'desc' },
          take: 200,
        }));
      default:
        return [];
    }
  }

  /**
   * Records pending approval across modules.
   */
  async getPendingApprovals() {
    const [invoices, expenses, quotations] = await Promise.all([
      safe(() => this.prisma.invoice.findMany({
        where: { status: 'PENDING_APPROVAL' as any },
        select: { id: true, invoiceNumber: true, total: true, createdAt: true,
          client: { select: { companyName: true } } },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }), [] as any[]),
      safe(() => this.prisma.expense.findMany({
        where: { status: 'PENDING_APPROVAL' as any },
        select: { id: true, expenseNumber: true, totalAmount: true, category: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }), [] as any[]),
      safe(() => this.prisma.quotation.findMany({
        where: { status: 'PENDING_REVIEW' as any },
        select: { id: true, quotationNumber: true, total: true, createdAt: true,
          client: { select: { companyName: true } } },
        orderBy: { createdAt: 'asc' },
        take: 100,
      }), [] as any[]),
    ]);
    return { invoices, expenses, quotations };
  }

  /**
   * Workflow KPI metrics for the dashboard.
   */
  async getKpiData() {
    const now = new Date();
    const [
      overdueInvoices,
      pendingApprovalInvoices,
      pendingApprovalExpenses,
      activeHires,
      scheduledBookings,
      openMaintenance,
      waitingParts,
      availableAssets,
      damagedAssets,
      recentStatusChanges,
      totalOutstanding,
      totalPaid30d,
    ] = await Promise.all([
      safe(() => this.prisma.invoice.count({ where: { status: 'OVERDUE' as any } }), 0),
      safe(() => this.prisma.invoice.count({ where: { status: 'PENDING_APPROVAL' as any } }), 0),
      safe(() => this.prisma.expense.count({ where: { status: 'PENDING_APPROVAL' as any } }), 0),
      safe(() => this.prisma.rentalBooking.count({
        where: { status: { in: ['ACTIVE', 'ON_HIRE', 'DELIVERED'] as any[] } },
      }), 0),
      safe(() => this.prisma.rentalBooking.count({ where: { status: 'SCHEDULED' as any } }), 0),
      safe(() => this.prisma.maintenanceLog.count({
        where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] as any[] } },
      }), 0),
      safe(() => this.prisma.maintenanceLog.count({ where: { status: 'WAITING_FOR_PARTS' as any } }), 0),
      safe(() => this.prisma.asset.count({ where: { status: 'AVAILABLE' as any } }), 0),
      safe(() => this.prisma.asset.count({ where: { status: { in: ['DAMAGED', 'OUT_OF_SERVICE'] as any[] } } }), 0),
      safe(() => (this.prisma.statusLog as any).count({
        where: { changedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
      }), 0),
      safe(() => this.prisma.invoice.aggregate({
        where: { status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] as any[] } },
        _sum: { amountDue: true },
      }), { _sum: { amountDue: 0 } } as any),
      safe(() => this.prisma.invoice.aggregate({
        where: { status: 'PAID' as any, updatedAt: { gte: new Date(now.getTime() - 30 * 86_400_000) } },
        _sum: { total: true },
      }), { _sum: { total: 0 } } as any),
    ]);

    return {
      finance: {
        overdueInvoices,
        pendingApprovalInvoices,
        pendingApprovalExpenses,
        totalOutstandingAED: Number((totalOutstanding as any)._sum?.amountDue ?? 0),
        paidLast30dAED:      Number((totalPaid30d as any)._sum?.total ?? 0),
      },
      rental: {
        activeHires,
        scheduledBookings,
      },
      maintenance: {
        openMaintenance,
        waitingParts,
      },
      assets: {
        availableAssets,
        damagedAssets,
      },
      activity: {
        statusChangesLast7d: recentStatusChanges,
      },
    };
  }

  /**
   * Status analytics for a module: counts grouped by status.
   */
  async getStatusDurationAnalytics(module: StatusModule) {
    const groupByStatus = async (rows: { status: string }[]) => {
      const counts: Record<string, number> = {};
      for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
      return Object.entries(counts).map(([status, count]) => ({ status, count }));
    };

    switch (module) {
      case 'Invoice':
        return groupByStatus(await safe(() => this.prisma.invoice.findMany({ select: { status: true } }), [] as any[]));
      case 'Quotation':
        return groupByStatus(await safe(() => this.prisma.quotation.findMany({ select: { status: true } }), [] as any[]));
      case 'Booking':
        return groupByStatus(await safe(() => this.prisma.rentalBooking.findMany({ select: { status: true } }), [] as any[]));
      case 'Asset':
        return groupByStatus(await safe(() => this.prisma.asset.findMany({ select: { status: true } }), [] as any[]));
      case 'Maintenance':
        return groupByStatus(await safe(() => this.prisma.maintenanceLog.findMany({ select: { status: true } }), [] as any[]));
      default:
        return [];
    }
  }
}
