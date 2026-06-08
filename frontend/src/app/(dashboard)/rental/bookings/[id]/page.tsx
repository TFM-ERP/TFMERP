'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { rentalApi } from '@/lib/api';
import { formatDate, formatCurrency, cn } from '@/lib/utils';
import { ArrowLeft, FileText, Truck, AlertTriangle, CheckCircle2, Receipt, ChevronDown, History, X } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';
import StatusTimeline from '@/components/StatusTimeline';
import StatusChangeModal from '@/components/StatusChangeModal';
import ConditionReports from '@/components/rental/ConditionReports';
import BookingDrivers from '@/components/rental/BookingDrivers';
import BookingLocations from '@/components/rental/BookingLocations';

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [booking, setBooking]           = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showHistory, setShowHistory]   = useState(false);

  const load = () => {
    rentalApi.bookings.get(id)
      .then(r => setBooking(r.data))
      .catch(() => router.push('/rental/bookings'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const handleStatusChange = async (status: string, notes: string) => {
    await rentalApi.bookings.updateStatus(id, status, notes);
    setBooking((b: any) => ({ ...b, status }));
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-6 h-6 border-2 border-brand-600 border-t-transparent rounded-full" /></div>;
  if (!booking) return null;

  return (
    <>
      {showStatusModal && (
        <StatusChangeModal
          module="Booking"
          currentStatus={booking.status}
          recordRef={booking.bookingNumber}
          onConfirm={handleStatusChange}
          onClose={() => setShowStatusModal(false)}
        />
      )}
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/rental/bookings" className="btn btn-secondary p-1.5"><ArrowLeft size={16} /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{booking.bookingNumber}</h1>
          <p className="text-sm text-gray-500">{booking.client?.companyName}</p>
        </div>
        <StatusBadge module="Booking" status={booking.status} size="lg" />
        <button onClick={() => setShowStatusModal(true)} className="btn btn-secondary text-sm">
          <ChevronDown size={13} /> Change Status
        </button>
        <button onClick={() => setShowHistory(h => !h)} className={cn('btn btn-secondary text-sm', showHistory && 'bg-gray-100')}>
          <History size={13} /> History
        </button>
      </div>

      {showHistory && (
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2"><History size={15} /> Status History</h3>
            <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600"><X size={14} /></button>
          </div>
          <StatusTimeline module="Booking" recordId={id} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left */}
        <div className="lg:col-span-2 space-y-6">
          {/* Rental Items */}
          <div className="card overflow-hidden p-0">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700">Rental Items</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Asset / Description</th>
                  <th className="table-th text-right">Days</th>
                  <th className="table-th text-right">Rate/Day</th>
                  <th className="table-th text-right">Line Total</th>
                </tr>
              </thead>
              <tbody>
                {(booking.items || []).map((item: any) => (
                  <tr key={item.id} className="table-row">
                    <td className="table-td">
                      <div className="font-medium text-gray-800">{item.asset?.name || item.description}</div>
                      {item.asset && item.description !== item.asset.name && (
                        <div className="text-xs text-gray-400">{item.description}</div>
                      )}
                      {item.asset?.plateNumber && <div className="text-xs text-gray-400">{item.asset.plateNumber}</div>}
                    </td>
                    <td className="table-td text-right text-sm text-gray-700">{item.days}</td>
                    <td className="table-td text-right text-sm text-gray-700">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="table-td text-right text-sm font-medium text-gray-800">
                      {formatCurrency(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-100">
                  <td colSpan={3} className="px-4 py-2 text-right text-sm text-gray-500">Subtotal</td>
                  <td className="px-4 py-2 text-right text-sm font-medium">{formatCurrency(booking.subtotal)}</td>
                </tr>
                {booking.discountAmount > 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-1 text-right text-sm text-gray-500">Discount</td>
                    <td className="px-4 py-1 text-right text-sm text-red-600">-{formatCurrency(booking.discountAmount)}</td>
                  </tr>
                )}
                {booking.vatAmount > 0 && (
                  <tr>
                    <td colSpan={3} className="px-4 py-1 text-right text-sm text-gray-500">VAT</td>
                    <td className="px-4 py-1 text-right text-sm">{formatCurrency(booking.vatAmount)}</td>
                  </tr>
                )}
                <tr className="border-t border-gray-200 bg-gray-50">
                  <td colSpan={3} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900">{formatCurrency(booking.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Driver Jobs */}
          {booking.driverJobs?.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Truck size={14} /> Driver Jobs
              </h3>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th">Driver</th>
                    <th className="table-th">Job Type</th>
                    <th className="table-th">Scheduled</th>
                    <th className="table-th">Asset</th>
                    <th className="table-th">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {booking.driverJobs.map((job: any) => (
                    <tr key={job.id} className="table-row">
                      <td className="table-td text-sm">{job.driver?.fullName}</td>
                      <td className="table-td text-sm text-gray-600">{job.jobType.replace(/_/g, ' ')}</td>
                      <td className="table-td text-sm text-gray-600">{formatDate(job.scheduledDate)}</td>
                      <td className="table-td text-sm text-gray-600">{job.asset?.name || '—'}</td>
                      <td className="table-td">
                        <span className={cn('badge', job.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                          {job.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Invoices */}
          {booking.invoices?.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Receipt size={14} /> Invoices
              </h3>
              <div className="space-y-2">
                {booking.invoices.map((inv: any) => (
                  <Link key={inv.id} href={`/finance/invoices/${inv.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-brand-200 hover:bg-brand-50 transition-all">
                    <div>
                      <span className="text-sm font-medium text-gray-800">{inv.invoiceNumber}</span>
                      <span className={cn('ml-2 badge text-xs', inv.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700')}>
                        {inv.status}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-700">{formatCurrency(inv.total)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Damage reports */}
          {booking.damageReports?.length > 0 && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500" /> Damage Reports
              </h3>
              <div className="space-y-2">
                {booking.damageReports.map((dr: any) => (
                  <Link key={dr.id} href={`/rental/damage/${dr.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-amber-200 hover:bg-amber-50 transition-all">
                    <div>
                      <span className="text-sm font-medium text-gray-800">{dr.reportNumber}</span>
                      <span className={cn('ml-2 badge text-xs',
                        dr.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                        dr.severity === 'MAJOR' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'
                      )}>{dr.severity}</span>
                    </div>
                    <span className="text-xs text-gray-400">{formatDate(dr.reportedAt)}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Location schedule (multi-site hire) */}
          <BookingLocations bookingId={id} />

          {/* Drivers & logistics */}
          <BookingDrivers
            bookingId={id}
            assets={(booking.items || []).map((it: any) => ({ id: it.asset?.id, name: it.asset?.name })).filter((a: any) => a.id)}
          />

          {/* Condition reports (delivery / return inspections) */}
          <ConditionReports
            bookingId={id}
            assets={(booking.items || []).map((it: any) => ({ id: it.asset?.id, name: it.asset?.name })).filter((a: any) => a.id)}
          />
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Client info */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Client</h3>
            <p className="text-sm font-medium text-gray-800">{booking.client?.companyName}</p>
            {booking.client?.contacts?.slice(0, 1).map((c: any) => (
              <div key={c.id} className="mt-2 text-xs text-gray-500 space-y-0.5">
                {c.name && <p>{c.name} {c.isPrimary ? '(Primary)' : ''}</p>}
                {c.email && <p>{c.email}</p>}
                {c.mobile && <p>{c.mobile}</p>}
              </div>
            ))}
          </div>

          {/* Dates */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Dates</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Rental Start', value: booking.startDate },
                { label: 'Rental End', value: booking.endDate },
                { label: 'Delivery', value: booking.deliveryDate },
                { label: 'Pickup', value: booking.pickupDate },
              ].filter(d => d.value).map(d => (
                <div key={d.label} className="flex justify-between">
                  <span className="text-gray-500">{d.label}</span>
                  <span className="text-gray-800 font-medium">{formatDate(d.value)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Info */}
          {(booking.deliveryAddress || booking.deliveryCity) && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Delivery Location</h3>
              <p className="text-sm text-gray-700">{booking.deliveryAddress}</p>
              {booking.deliveryCity && <p className="text-sm text-gray-500">{booking.deliveryCity}</p>}
              {booking.deliveryNotes && <p className="text-xs text-gray-400 mt-1">{booking.deliveryNotes}</p>}
            </div>
          )}

          {/* PO / Contract */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">References</h3>
            <div className="space-y-2 text-sm">
              {booking.poNumber && (
                <div className="flex justify-between">
                  <span className="text-gray-500">PO Number</span>
                  <span className="text-gray-800 font-medium">{booking.poNumber}</span>
                </div>
              )}
              {booking.depositAmount && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Deposit</span>
                  <span className="text-gray-800 font-medium">{formatCurrency(booking.depositAmount)}</span>
                </div>
              )}
              {booking.contract && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <Link href={`/rental/contracts/${booking.contract.id}`}
                    className="flex items-center gap-1.5 text-brand-600 hover:underline text-xs">
                    <FileText size={12} /> View Contract
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {(booking.notes || booking.internalNotes) && (
            <div className="card">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
              {booking.notes && <p className="text-sm text-gray-700 mb-2">{booking.notes}</p>}
              {booking.internalNotes && (
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">Internal</p>
                  <p className="text-sm text-gray-600">{booking.internalNotes}</p>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="card">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Actions</h3>
            <div className="space-y-2">
              <Link href={`/rental/contracts/new?bookingId=${id}`} className="btn btn-secondary w-full text-sm justify-center">
                <FileText size={13} className="mr-1.5" /> Create Contract
              </Link>
              <Link href={`/rental/damage/new?bookingId=${id}`} className="btn btn-secondary w-full text-sm justify-center text-amber-600 hover:bg-amber-50">
                <AlertTriangle size={13} className="mr-1.5" /> Report Damage
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
