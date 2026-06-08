import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency = 'AED'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-AE', {
    style: 'currency', currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: string | Date | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('en-AE', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date));
}

export function daysUntil(date: string | Date | null): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SENT: 'bg-blue-100 text-blue-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  CONVERTED: 'bg-purple-100 text-purple-700',
  CANCELLED: 'bg-red-100 text-red-600',
  PAID: 'bg-green-100 text-green-700',
  PARTIALLY_PAID: 'bg-amber-100 text-amber-700',
  OVERDUE: 'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  CLEARED: 'bg-green-100 text-green-700',
  BOUNCED: 'bg-red-100 text-red-700',
  // Booking statuses
  INQUIRY: 'bg-gray-100 text-gray-700',
  QUOTED: 'bg-blue-100 text-blue-700',
  AWAITING_PAYMENT: 'bg-amber-100 text-amber-700',
  CONTRACT_SENT: 'bg-indigo-100 text-indigo-700',
  CONTRACT_SIGNED: 'bg-indigo-100 text-indigo-700',
  SCHEDULED: 'bg-cyan-100 text-cyan-700',
  DISPATCHED: 'bg-cyan-100 text-cyan-700',
  DELIVERED: 'bg-teal-100 text-teal-700',
  ACTIVE: 'bg-green-100 text-green-700',
  ON_HIRE: 'bg-green-100 text-green-700',
  EXTENDED: 'bg-amber-100 text-amber-700',
  PICKUP_SCHEDULED: 'bg-cyan-100 text-cyan-700',
  RETURNED: 'bg-slate-100 text-slate-700',
  INSPECTED: 'bg-slate-100 text-slate-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-gray-100 text-gray-600',
};

// Human-readable labels for rental booking statuses.
export const STATUS_LABELS: Record<string, string> = {
  INQUIRY: 'Inquiry',
  QUOTED: 'Quoted',
  AWAITING_PAYMENT: 'Awaiting Payment',
  APPROVED: 'Approved',
  CONTRACT_SENT: 'Contract Sent',
  CONTRACT_SIGNED: 'Contract Signed',
  SCHEDULED: 'Scheduled',
  DISPATCHED: 'Dispatched',
  DELIVERED: 'Delivered',
  ACTIVE: 'Active',
  ON_HIRE: 'On Hire',
  EXTENDED: 'Extended',
  PICKUP_SCHEDULED: 'Pickup Scheduled',
  RETURNED: 'Returned',
  INSPECTED: 'Inspected',
  COMPLETED: 'Completed',
  CLOSED: 'Closed',
  CANCELLED: 'Cancelled',
};

// Alias kept for components that import BOOKING_STATUSES.
export const BOOKING_STATUSES = STATUS_LABELS;
