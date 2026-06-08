/**
 * Central workflow configuration for the TFM Status Management System.
 * Defines valid transitions, role guards, locked terminal states,
 * and transitions that require mandatory notes.
 */

export type StatusModule =
  | 'Invoice'
  | 'Quotation'
  | 'Booking'
  | 'Asset'
  | 'Maintenance'
  | 'Expense';

export interface WorkflowConfig {
  /** Map of fromStatus → allowed toStatuses */
  transitions: Record<string, string[]>;
  /** Roles that may perform each transition (empty = any role) */
  requiredRoles?: Record<string, string[]>;
  /** Statuses that require a note/comment before transitioning away from */
  requiresNotes?: string[];
  /** Terminal statuses — once reached, no further transition is allowed without SYSTEM_ADMIN override */
  locked?: string[];
  /** Statuses that require approval from a second user */
  requiresApproval?: string[];
}

export const WORKFLOW: Record<StatusModule, WorkflowConfig> = {

  // ─── QUOTATION ────────────────────────────────────────────────────────────
  Quotation: {
    transitions: {
      DRAFT:              ['PENDING_REVIEW', 'SENT', 'CANCELLED'],
      PENDING_REVIEW:     ['SENT', 'REVISION_REQUESTED', 'CANCELLED'],
      SENT:               ['VIEWED', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'EXPIRED', 'CANCELLED'],
      VIEWED:             ['APPROVED', 'REJECTED', 'REVISION_REQUESTED', 'EXPIRED'],
      REVISION_REQUESTED: ['DRAFT', 'CANCELLED'],
      APPROVED:           ['CONVERTED', 'CANCELLED'],
      REJECTED:           [],
      EXPIRED:            ['DRAFT'],
      CONVERTED:          [],
      CANCELLED:          [],
    },
    requiredRoles: {
      APPROVED:  ['SALES', 'RENTAL_MANAGER', 'FINANCE_MANAGER', 'SYSTEM_ADMIN'],
      CONVERTED: ['SALES', 'RENTAL_MANAGER', 'FINANCE_MANAGER', 'SYSTEM_ADMIN'],
    },
    requiresNotes: ['REVISION_REQUESTED', 'REJECTED', 'CANCELLED'],
    locked: ['CONVERTED', 'REJECTED'],
  },

  // ─── INVOICE ──────────────────────────────────────────────────────────────
  Invoice: {
    transitions: {
      DRAFT:           ['PENDING_APPROVAL', 'SENT', 'CANCELLED'],
      PENDING_APPROVAL:['SENT', 'DRAFT', 'CANCELLED'],
      SENT:            ['PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'VOIDED'],
      PARTIALLY_PAID:  ['PAID', 'OVERDUE', 'BAD_DEBT'],
      PAID:            ['REFUNDED'],
      OVERDUE:         ['PAID', 'PARTIALLY_PAID', 'BAD_DEBT', 'CANCELLED'],
      CANCELLED:       [],
      VOIDED:          [],
      REFUNDED:        [],
      BAD_DEBT:        [],
    },
    requiredRoles: {
      PAID:            ['FINANCE_MANAGER', 'SYSTEM_ADMIN'],
      REFUNDED:        ['FINANCE_MANAGER', 'SYSTEM_ADMIN'],
      BAD_DEBT:        ['FINANCE_MANAGER', 'SYSTEM_ADMIN'],
      VOIDED:          ['FINANCE_MANAGER', 'SYSTEM_ADMIN'],
      PENDING_APPROVAL:['FINANCE_MANAGER', 'SYSTEM_ADMIN', 'ACCOUNTANT'],
    },
    requiresNotes: ['CANCELLED', 'VOIDED', 'BAD_DEBT', 'REFUNDED'],
    locked: ['PAID', 'VOIDED', 'REFUNDED', 'BAD_DEBT'],
    requiresApproval: ['PENDING_APPROVAL'],
  },

  // ─── BOOKING / RENTAL ─────────────────────────────────────────────────────
  Booking: {
    transitions: {
      INQUIRY:          ['QUOTED', 'CANCELLED'],
      QUOTED:           ['AWAITING_PAYMENT', 'APPROVED', 'CANCELLED'],
      AWAITING_PAYMENT: ['APPROVED', 'CANCELLED'],
      APPROVED:         ['CONTRACT_SENT', 'SCHEDULED', 'CANCELLED'],
      CONTRACT_SENT:    ['CONTRACT_SIGNED', 'CANCELLED'],
      CONTRACT_SIGNED:  ['SCHEDULED', 'CANCELLED'],
      SCHEDULED:        ['DISPATCHED', 'CANCELLED'],
      DISPATCHED:       ['DELIVERED', 'CANCELLED'],
      DELIVERED:        ['ACTIVE', 'ON_HIRE'],
      ACTIVE:           ['ON_HIRE', 'EXTENDED', 'PICKUP_SCHEDULED'],
      ON_HIRE:          ['EXTENDED', 'PICKUP_SCHEDULED'],
      EXTENDED:         ['PICKUP_SCHEDULED', 'ON_HIRE'],
      PICKUP_SCHEDULED: ['RETURNED'],
      RETURNED:         ['INSPECTED', 'COMPLETED'],
      INSPECTED:        ['COMPLETED', 'CLOSED'],
      COMPLETED:        ['CLOSED'],
      CLOSED:           [],
      CANCELLED:        [],
    },
    requiredRoles: {
      DISPATCHED:    ['RENTAL_MANAGER', 'SYSTEM_ADMIN'],
      CLOSED:        ['RENTAL_MANAGER', 'FINANCE_MANAGER', 'SYSTEM_ADMIN'],
      COMPLETED:     ['RENTAL_MANAGER', 'SYSTEM_ADMIN'],
    },
    requiresNotes: ['CANCELLED', 'EXTENDED'],
    locked: ['CLOSED', 'CANCELLED'],
  },

  // ─── ASSET ────────────────────────────────────────────────────────────────
  Asset: {
    transitions: {
      AVAILABLE:      ['RESERVED', 'ON_HIRE', 'IN_MAINTENANCE', 'IN_TRANSIT', 'OUT_OF_SERVICE', 'DAMAGED', 'RETIRED', 'SOLD'],
      RESERVED:       ['AVAILABLE', 'ON_HIRE', 'CANCELLED'],
      ON_HIRE:        ['AVAILABLE', 'RETURNED', 'IN_MAINTENANCE', 'DAMAGED'],
      IN_MAINTENANCE: ['AVAILABLE', 'OUT_OF_SERVICE', 'DAMAGED', 'RETIRED'],
      OUT_OF_SERVICE: ['IN_MAINTENANCE', 'AVAILABLE', 'RETIRED', 'SOLD'],
      DAMAGED:        ['IN_MAINTENANCE', 'OUT_OF_SERVICE', 'RETIRED', 'SOLD'],
      IN_TRANSIT:     ['AVAILABLE', 'ON_HIRE'],
      RETIRED:        ['SOLD'],
      SOLD:           [],
    },
    requiredRoles: {
      RETIRED: ['RENTAL_MANAGER', 'SYSTEM_ADMIN'],
      SOLD:    ['RENTAL_MANAGER', 'SYSTEM_ADMIN'],
    },
    requiresNotes: ['DAMAGED', 'OUT_OF_SERVICE', 'RETIRED', 'SOLD'],
    locked: ['SOLD'],
  },

  // ─── MAINTENANCE ──────────────────────────────────────────────────────────
  Maintenance: {
    transitions: {
      REPORTED:         ['PENDING_APPROVAL', 'CANCELLED'],
      PENDING_APPROVAL: ['APPROVED', 'CANCELLED'],
      APPROVED:         ['ASSIGNED', 'CANCELLED'],
      ASSIGNED:         ['WAITING_FOR_PARTS', 'IN_PROGRESS', 'CANCELLED'],
      WAITING_FOR_PARTS:['IN_PROGRESS', 'CANCELLED'],
      IN_PROGRESS:      ['TESTING', 'COMPLETED', 'WARRANTY_CLAIM'],
      TESTING:          ['COMPLETED', 'IN_PROGRESS'],
      COMPLETED:        ['CLOSED'],
      CLOSED:           [],
      WARRANTY_CLAIM:   ['IN_PROGRESS', 'CLOSED'],
      CANCELLED:        [],
    },
    requiredRoles: {
      APPROVED:  ['MAINTENANCE', 'RENTAL_MANAGER', 'SYSTEM_ADMIN'],
      CLOSED:    ['MAINTENANCE', 'RENTAL_MANAGER', 'SYSTEM_ADMIN'],
      COMPLETED: ['MAINTENANCE', 'SYSTEM_ADMIN'],
    },
    requiresNotes: ['CANCELLED', 'WARRANTY_CLAIM', 'WAITING_FOR_PARTS'],
    locked: ['CLOSED', 'CANCELLED'],
    requiresApproval: ['PENDING_APPROVAL'],
  },

  // ─── EXPENSE ──────────────────────────────────────────────────────────────
  Expense: {
    transitions: {
      DRAFT:             ['SUBMITTED', 'ARCHIVED'],
      SUBMITTED:         ['PENDING_APPROVAL', 'DRAFT'],
      PENDING_APPROVAL:  ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'],
      APPROVED:          ['PAID', 'ARCHIVED'],
      PARTIALLY_APPROVED:['PAID', 'REJECTED'],
      REJECTED:          ['DRAFT'],
      PAID:              ['ARCHIVED'],
      ARCHIVED:          [],
    },
    requiredRoles: {
      APPROVED:          ['FINANCE_MANAGER', 'SYSTEM_ADMIN'],
      PARTIALLY_APPROVED:['FINANCE_MANAGER', 'SYSTEM_ADMIN'],
      REJECTED:          ['FINANCE_MANAGER', 'SYSTEM_ADMIN'],
      PAID:              ['FINANCE_MANAGER', 'SYSTEM_ADMIN'],
    },
    requiresNotes: ['REJECTED', 'PARTIALLY_APPROVED'],
    locked: ['PAID', 'ARCHIVED'],
    requiresApproval: ['PENDING_APPROVAL'],
  },
};

/** Check if a transition is allowed for a given module */
export function isTransitionAllowed(
  module: StatusModule,
  fromStatus: string,
  toStatus: string,
): boolean {
  const allowed = WORKFLOW[module]?.transitions[fromStatus] ?? [];
  return allowed.includes(toStatus);
}

/** Get allowed next statuses from the current state */
export function getAllowedTransitions(module: StatusModule, fromStatus: string): string[] {
  return WORKFLOW[module]?.transitions[fromStatus] ?? [];
}

/** Check if a role is permitted to make a specific transition */
export function isRolePermitted(module: StatusModule, toStatus: string, userRole: string): boolean {
  const requiredRoles = WORKFLOW[module]?.requiredRoles?.[toStatus];
  if (!requiredRoles || requiredRoles.length === 0) return true; // no restriction
  return requiredRoles.includes(userRole);
}

/** Check if this transition requires a note */
export function requiresNote(module: StatusModule, toStatus: string): boolean {
  return WORKFLOW[module]?.requiresNotes?.includes(toStatus) ?? false;
}

/** Check if a status is locked (terminal) */
export function isLocked(module: StatusModule, status: string): boolean {
  return WORKFLOW[module]?.locked?.includes(status) ?? false;
}
