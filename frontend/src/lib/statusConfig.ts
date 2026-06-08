/**
 * TFM Status Management System — Frontend Config
 * Central source of truth for status colors, icons, labels, and workflow rules.
 */

export type StatusModule = 'Invoice' | 'Quotation' | 'Booking' | 'Asset' | 'Maintenance' | 'Expense';

export interface StatusDef {
  label:       string;
  color:       string;   // Tailwind bg class
  textColor:   string;   // Tailwind text class
  borderColor: string;   // Tailwind border class
  dot:         string;   // hex color for dot
  icon:        string;   // emoji icon
  description: string;
}

// ── QUOTATION ─────────────────────────────────────────────────────────────────
export const QUOTATION_STATUSES: Record<string, StatusDef> = {
  DRAFT:              { label:'Draft',               color:'bg-gray-100',   textColor:'text-gray-600',   borderColor:'border-gray-200',  dot:'#9ca3af', icon:'✏️',  description:'Being prepared internally' },
  PENDING_REVIEW:     { label:'Pending Review',      color:'bg-amber-100',  textColor:'text-amber-700',  borderColor:'border-amber-200', dot:'#f59e0b', icon:'🔍',  description:'Awaiting internal review before sending' },
  SENT:               { label:'Sent',                color:'bg-blue-100',   textColor:'text-blue-700',   borderColor:'border-blue-200',  dot:'#3b82f6', icon:'📤',  description:'Sent to client, awaiting response' },
  VIEWED:             { label:'Viewed',              color:'bg-cyan-100',   textColor:'text-cyan-700',   borderColor:'border-cyan-200',  dot:'#06b6d4', icon:'👁️',  description:'Client has opened the quotation' },
  REVISION_REQUESTED: { label:'Revision Requested',  color:'bg-orange-100', textColor:'text-orange-700', borderColor:'border-orange-200',dot:'#f97316', icon:'🔄',  description:'Client has requested changes' },
  APPROVED:           { label:'Approved',            color:'bg-green-100',  textColor:'text-green-700',  borderColor:'border-green-200', dot:'#10b981', icon:'✅',  description:'Client has approved the quotation' },
  REJECTED:           { label:'Rejected',            color:'bg-red-100',    textColor:'text-red-700',    borderColor:'border-red-200',   dot:'#ef4444', icon:'❌',  description:'Client has rejected the quotation' },
  EXPIRED:            { label:'Expired',             color:'bg-gray-100',   textColor:'text-gray-500',   borderColor:'border-gray-200',  dot:'#6b7280', icon:'⏰',  description:'Validity period has passed' },
  CONVERTED:          { label:'Converted',           color:'bg-purple-100', textColor:'text-purple-700', borderColor:'border-purple-200',dot:'#8b5cf6', icon:'🔀',  description:'Converted to invoice' },
  CANCELLED:          { label:'Cancelled',           color:'bg-red-50',     textColor:'text-red-400',    borderColor:'border-red-100',   dot:'#fca5a5', icon:'🚫',  description:'Quotation was cancelled' },
};

// ── INVOICE ───────────────────────────────────────────────────────────────────
export const INVOICE_STATUSES: Record<string, StatusDef> = {
  DRAFT:            { label:'Draft',            color:'bg-gray-100',   textColor:'text-gray-600',   borderColor:'border-gray-200',  dot:'#9ca3af', icon:'✏️',  description:'Invoice being prepared' },
  PENDING_APPROVAL: { label:'Pending Approval', color:'bg-amber-100',  textColor:'text-amber-700',  borderColor:'border-amber-200', dot:'#f59e0b', icon:'⏳',  description:'Awaiting management approval' },
  SENT:             { label:'Sent',             color:'bg-blue-100',   textColor:'text-blue-700',   borderColor:'border-blue-200',  dot:'#3b82f6', icon:'📤',  description:'Invoice sent to client' },
  PARTIALLY_PAID:   { label:'Partially Paid',   color:'bg-yellow-100', textColor:'text-yellow-700', borderColor:'border-yellow-200',dot:'#eab308', icon:'💰',  description:'Partial payment received' },
  PAID:             { label:'Paid',             color:'bg-green-100',  textColor:'text-green-700',  borderColor:'border-green-200', dot:'#10b981', icon:'✅',  description:'Payment received in full' },
  OVERDUE:          { label:'Overdue',          color:'bg-red-100',    textColor:'text-red-700',    borderColor:'border-red-200',   dot:'#ef4444', icon:'⚠️',  description:'Past due date, payment pending' },
  CANCELLED:        { label:'Cancelled',        color:'bg-gray-100',   textColor:'text-gray-500',   borderColor:'border-gray-200',  dot:'#9ca3af', icon:'🚫',  description:'Invoice cancelled' },
  VOIDED:           { label:'Voided',           color:'bg-gray-100',   textColor:'text-gray-400',   borderColor:'border-gray-100',  dot:'#d1d5db', icon:'🗑️',  description:'Invoice voided — not valid' },
  REFUNDED:         { label:'Refunded',         color:'bg-purple-100', textColor:'text-purple-700', borderColor:'border-purple-200',dot:'#8b5cf6', icon:'↩️',  description:'Payment has been refunded' },
  BAD_DEBT:         { label:'Bad Debt',         color:'bg-red-200',    textColor:'text-red-800',    borderColor:'border-red-300',   dot:'#b91c1c', icon:'💀',  description:'Deemed uncollectable' },
};

// ── BOOKING / RENTAL ──────────────────────────────────────────────────────────
export const BOOKING_STATUSES: Record<string, StatusDef> = {
  INQUIRY:          { label:'Inquiry',          color:'bg-gray-100',   textColor:'text-gray-600',   borderColor:'border-gray-200',  dot:'#9ca3af', icon:'📨',  description:'Initial enquiry received' },
  QUOTED:           { label:'Quoted',           color:'bg-blue-100',   textColor:'text-blue-600',   borderColor:'border-blue-200',  dot:'#60a5fa', icon:'📋',  description:'Quotation has been sent' },
  AWAITING_PAYMENT: { label:'Awaiting Payment', color:'bg-amber-100',  textColor:'text-amber-700',  borderColor:'border-amber-200', dot:'#f59e0b', icon:'💳',  description:'Waiting for advance payment' },
  APPROVED:         { label:'Approved',         color:'bg-teal-100',   textColor:'text-teal-700',   borderColor:'border-teal-200',  dot:'#14b8a6', icon:'✅',  description:'Booking approved and confirmed' },
  CONTRACT_SENT:    { label:'Contract Sent',    color:'bg-indigo-100', textColor:'text-indigo-700', borderColor:'border-indigo-200',dot:'#6366f1', icon:'📄',  description:'Contract sent for signature' },
  CONTRACT_SIGNED:  { label:'Contract Signed',  color:'bg-indigo-200', textColor:'text-indigo-800', borderColor:'border-indigo-300',dot:'#4f46e5', icon:'✍️',  description:'Contract signed by client' },
  SCHEDULED:        { label:'Scheduled',        color:'bg-cyan-100',   textColor:'text-cyan-700',   borderColor:'border-cyan-200',  dot:'#06b6d4', icon:'📅',  description:'Delivery date confirmed' },
  DISPATCHED:       { label:'Dispatched',       color:'bg-blue-200',   textColor:'text-blue-800',   borderColor:'border-blue-300',  dot:'#2563eb', icon:'🚚',  description:'Equipment en route to client' },
  DELIVERED:        { label:'Delivered',        color:'bg-green-100',  textColor:'text-green-700',  borderColor:'border-green-200', dot:'#16a34a', icon:'📦',  description:'Equipment delivered on site' },
  ACTIVE:           { label:'Active',           color:'bg-green-200',  textColor:'text-green-800',  borderColor:'border-green-300', dot:'#15803d', icon:'▶️',  description:'Hire is active and ongoing' },
  ON_HIRE:          { label:'On Hire',          color:'bg-emerald-100',textColor:'text-emerald-700',borderColor:'border-emerald-200',dot:'#10b981',icon:'🎬',  description:'Equipment currently on hire' },
  EXTENDED:         { label:'Extended',         color:'bg-orange-100', textColor:'text-orange-700', borderColor:'border-orange-200',dot:'#f97316', icon:'📆',  description:'Hire period has been extended' },
  PICKUP_SCHEDULED: { label:'Pickup Scheduled', color:'bg-purple-100', textColor:'text-purple-700', borderColor:'border-purple-200',dot:'#8b5cf6', icon:'🚛',  description:'Collection date arranged' },
  RETURNED:         { label:'Returned',         color:'bg-teal-100',   textColor:'text-teal-600',   borderColor:'border-teal-200',  dot:'#0d9488', icon:'↩️',  description:'Equipment returned by client' },
  INSPECTED:        { label:'Inspected',        color:'bg-sky-100',    textColor:'text-sky-700',    borderColor:'border-sky-200',   dot:'#0284c7', icon:'🔍',  description:'Return condition inspected' },
  COMPLETED:        { label:'Completed',        color:'bg-green-100',  textColor:'text-green-700',  borderColor:'border-green-200', dot:'#16a34a', icon:'🏁',  description:'Hire successfully completed' },
  CLOSED:           { label:'Closed',           color:'bg-gray-200',   textColor:'text-gray-600',   borderColor:'border-gray-300',  dot:'#6b7280', icon:'🔒',  description:'Booking closed and archived' },
  CANCELLED:        { label:'Cancelled',        color:'bg-red-100',    textColor:'text-red-600',    borderColor:'border-red-200',   dot:'#ef4444', icon:'🚫',  description:'Booking was cancelled' },
};

// ── ASSET ─────────────────────────────────────────────────────────────────────
export const ASSET_STATUSES: Record<string, StatusDef> = {
  AVAILABLE:      { label:'Available',      color:'bg-green-100',  textColor:'text-green-700',  borderColor:'border-green-200', dot:'#10b981', icon:'✅',  description:'Ready for hire' },
  RESERVED:       { label:'Reserved',       color:'bg-cyan-100',   textColor:'text-cyan-700',   borderColor:'border-cyan-200',  dot:'#06b6d4', icon:'🔒',  description:'Reserved for upcoming booking' },
  ON_HIRE:        { label:'On Hire',        color:'bg-blue-100',   textColor:'text-blue-700',   borderColor:'border-blue-200',  dot:'#3b82f6', icon:'🎬',  description:'Currently out on hire' },
  IN_MAINTENANCE: { label:'In Maintenance', color:'bg-amber-100',  textColor:'text-amber-700',  borderColor:'border-amber-200', dot:'#f59e0b', icon:'🔧',  description:'Undergoing maintenance or repair' },
  OUT_OF_SERVICE: { label:'Out of Service', color:'bg-red-100',    textColor:'text-red-700',    borderColor:'border-red-200',   dot:'#ef4444', icon:'⛔',  description:'Temporarily out of service' },
  DAMAGED:        { label:'Damaged',        color:'bg-red-200',    textColor:'text-red-800',    borderColor:'border-red-300',   dot:'#dc2626', icon:'💥',  description:'Has reported damage' },
  IN_TRANSIT:     { label:'In Transit',     color:'bg-indigo-100', textColor:'text-indigo-700', borderColor:'border-indigo-200',dot:'#6366f1', icon:'🚚',  description:'Being transported between locations' },
  RETIRED:        { label:'Retired',        color:'bg-gray-200',   textColor:'text-gray-600',   borderColor:'border-gray-300',  dot:'#9ca3af', icon:'📦',  description:'Taken out of active fleet' },
  SOLD:           { label:'Sold',           color:'bg-gray-300',   textColor:'text-gray-700',   borderColor:'border-gray-400',  dot:'#6b7280', icon:'💸',  description:'Sold — no longer in fleet' },
};

// ── MAINTENANCE ───────────────────────────────────────────────────────────────
export const MAINTENANCE_STATUSES: Record<string, StatusDef> = {
  REPORTED:         { label:'Reported',          color:'bg-orange-100', textColor:'text-orange-700', borderColor:'border-orange-200',dot:'#f97316', icon:'🚨',  description:'Issue has been reported' },
  PENDING_APPROVAL: { label:'Pending Approval',  color:'bg-amber-100',  textColor:'text-amber-700',  borderColor:'border-amber-200', dot:'#f59e0b', icon:'⏳',  description:'Awaiting manager approval to proceed' },
  APPROVED:         { label:'Approved',          color:'bg-teal-100',   textColor:'text-teal-700',   borderColor:'border-teal-200',  dot:'#14b8a6', icon:'✅',  description:'Approved — ready to assign' },
  ASSIGNED:         { label:'Assigned',          color:'bg-blue-100',   textColor:'text-blue-700',   borderColor:'border-blue-200',  dot:'#3b82f6', icon:'👷',  description:'Assigned to workshop or technician' },
  WAITING_FOR_PARTS:{ label:'Waiting for Parts', color:'bg-yellow-100', textColor:'text-yellow-700', borderColor:'border-yellow-200',dot:'#eab308', icon:'📦',  description:'On hold pending spare parts arrival' },
  IN_PROGRESS:      { label:'In Progress',       color:'bg-indigo-100', textColor:'text-indigo-700', borderColor:'border-indigo-200',dot:'#6366f1', icon:'⚙️',  description:'Work is actively underway' },
  TESTING:          { label:'Testing',           color:'bg-purple-100', textColor:'text-purple-700', borderColor:'border-purple-200',dot:'#8b5cf6', icon:'🔬',  description:'Repair complete — being tested' },
  COMPLETED:        { label:'Completed',         color:'bg-green-100',  textColor:'text-green-700',  borderColor:'border-green-200', dot:'#10b981', icon:'🏁',  description:'Work completed successfully' },
  CLOSED:           { label:'Closed',            color:'bg-gray-200',   textColor:'text-gray-600',   borderColor:'border-gray-300',  dot:'#9ca3af', icon:'🔒',  description:'Job closed and signed off' },
  WARRANTY_CLAIM:   { label:'Warranty Claim',    color:'bg-pink-100',   textColor:'text-pink-700',   borderColor:'border-pink-200',  dot:'#ec4899', icon:'🛡️',  description:'Covered under warranty — claim in progress' },
  CANCELLED:        { label:'Cancelled',         color:'bg-red-100',    textColor:'text-red-600',    borderColor:'border-red-200',   dot:'#ef4444', icon:'🚫',  description:'Job was cancelled' },
};

// ── EXPENSE ───────────────────────────────────────────────────────────────────
export const EXPENSE_STATUSES: Record<string, StatusDef> = {
  DRAFT:             { label:'Draft',             color:'bg-gray-100',   textColor:'text-gray-600',   borderColor:'border-gray-200',  dot:'#9ca3af', icon:'✏️',  description:'Being prepared' },
  SUBMITTED:         { label:'Submitted',         color:'bg-blue-100',   textColor:'text-blue-700',   borderColor:'border-blue-200',  dot:'#3b82f6', icon:'📤',  description:'Submitted for approval' },
  PENDING_APPROVAL:  { label:'Pending Approval',  color:'bg-amber-100',  textColor:'text-amber-700',  borderColor:'border-amber-200', dot:'#f59e0b', icon:'⏳',  description:'Awaiting manager approval' },
  APPROVED:          { label:'Approved',          color:'bg-green-100',  textColor:'text-green-700',  borderColor:'border-green-200', dot:'#10b981', icon:'✅',  description:'Expense approved for payment' },
  REJECTED:          { label:'Rejected',          color:'bg-red-100',    textColor:'text-red-700',    borderColor:'border-red-200',   dot:'#ef4444', icon:'❌',  description:'Expense rejected' },
  PARTIALLY_APPROVED:{ label:'Partially Approved',color:'bg-yellow-100', textColor:'text-yellow-700', borderColor:'border-yellow-200',dot:'#eab308', icon:'⚖️',  description:'Partially approved — reduced amount' },
  PAID:              { label:'Paid',              color:'bg-green-200',  textColor:'text-green-800',  borderColor:'border-green-300', dot:'#16a34a', icon:'💸',  description:'Payment has been made' },
  ARCHIVED:          { label:'Archived',          color:'bg-gray-200',   textColor:'text-gray-500',   borderColor:'border-gray-300',  dot:'#9ca3af', icon:'📁',  description:'Archived — closed' },
};

// ── Master map ─────────────────────────────────────────────────────────────────
export const STATUS_CONFIGS: Record<StatusModule, Record<string, StatusDef>> = {
  Quotation:   QUOTATION_STATUSES,
  Invoice:     INVOICE_STATUSES,
  Booking:     BOOKING_STATUSES,
  Asset:       ASSET_STATUSES,
  Maintenance: MAINTENANCE_STATUSES,
  Expense:     EXPENSE_STATUSES,
};

/** Get status definition for a specific module + status value */
export function getStatusDef(module: StatusModule, status: string): StatusDef {
  return STATUS_CONFIGS[module]?.[status] ?? {
    label: status.replace(/_/g, ' '),
    color: 'bg-gray-100', textColor: 'text-gray-600', borderColor: 'border-gray-200',
    dot: '#9ca3af', icon: '●', description: '',
  };
}

// ── Workflow transition rules (client-side mirror of backend config) ──────────
export const WORKFLOW_TRANSITIONS: Record<StatusModule, Record<string, string[]>> = {
  Quotation: {
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
  Invoice: {
    DRAFT:            ['PENDING_APPROVAL', 'SENT', 'CANCELLED'],
    PENDING_APPROVAL: ['SENT', 'DRAFT', 'CANCELLED'],
    SENT:             ['PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', 'VOIDED'],
    PARTIALLY_PAID:   ['PAID', 'OVERDUE', 'BAD_DEBT'],
    PAID:             ['REFUNDED'],
    OVERDUE:          ['PAID', 'PARTIALLY_PAID', 'BAD_DEBT', 'CANCELLED'],
    CANCELLED:        [],
    VOIDED:           [],
    REFUNDED:         [],
    BAD_DEBT:         [],
  },
  Booking: {
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
  Asset: {
    AVAILABLE:      ['RESERVED', 'ON_HIRE', 'IN_MAINTENANCE', 'IN_TRANSIT', 'OUT_OF_SERVICE', 'DAMAGED', 'RETIRED', 'SOLD'],
    RESERVED:       ['AVAILABLE', 'ON_HIRE'],
    ON_HIRE:        ['AVAILABLE', 'IN_MAINTENANCE', 'DAMAGED'],
    IN_MAINTENANCE: ['AVAILABLE', 'OUT_OF_SERVICE', 'DAMAGED', 'RETIRED'],
    OUT_OF_SERVICE: ['IN_MAINTENANCE', 'AVAILABLE', 'RETIRED', 'SOLD'],
    DAMAGED:        ['IN_MAINTENANCE', 'OUT_OF_SERVICE', 'RETIRED', 'SOLD'],
    IN_TRANSIT:     ['AVAILABLE', 'ON_HIRE'],
    RETIRED:        ['SOLD'],
    SOLD:           [],
  },
  Maintenance: {
    REPORTED:          ['PENDING_APPROVAL', 'CANCELLED'],
    PENDING_APPROVAL:  ['APPROVED', 'CANCELLED'],
    APPROVED:          ['ASSIGNED', 'CANCELLED'],
    ASSIGNED:          ['WAITING_FOR_PARTS', 'IN_PROGRESS', 'CANCELLED'],
    WAITING_FOR_PARTS: ['IN_PROGRESS', 'CANCELLED'],
    IN_PROGRESS:       ['TESTING', 'COMPLETED', 'WARRANTY_CLAIM'],
    TESTING:           ['COMPLETED', 'IN_PROGRESS'],
    COMPLETED:         ['CLOSED'],
    CLOSED:            [],
    WARRANTY_CLAIM:    ['IN_PROGRESS', 'CLOSED'],
    CANCELLED:         [],
  },
  Expense: {
    DRAFT:             ['SUBMITTED', 'ARCHIVED'],
    SUBMITTED:         ['PENDING_APPROVAL', 'DRAFT'],
    PENDING_APPROVAL:  ['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'],
    APPROVED:          ['PAID', 'ARCHIVED'],
    PARTIALLY_APPROVED:['PAID', 'REJECTED'],
    REJECTED:          ['DRAFT'],
    PAID:              ['ARCHIVED'],
    ARCHIVED:          [],
  },
};

/** Transitions that require a mandatory note */
export const REQUIRES_NOTES: Record<StatusModule, string[]> = {
  Quotation:   ['REVISION_REQUESTED', 'REJECTED', 'CANCELLED'],
  Invoice:     ['CANCELLED', 'VOIDED', 'BAD_DEBT', 'REFUNDED'],
  Booking:     ['CANCELLED', 'EXTENDED'],
  Asset:       ['DAMAGED', 'OUT_OF_SERVICE', 'RETIRED', 'SOLD'],
  Maintenance: ['CANCELLED', 'WARRANTY_CLAIM', 'WAITING_FOR_PARTS'],
  Expense:     ['REJECTED', 'PARTIALLY_APPROVED'],
};

export function getAllowedTransitions(module: StatusModule, fromStatus: string): string[] {
  return WORKFLOW_TRANSITIONS[module]?.[fromStatus] ?? [];
}

export function noteRequired(module: StatusModule, toStatus: string): boolean {
  return REQUIRES_NOTES[module]?.includes(toStatus) ?? false;
}
