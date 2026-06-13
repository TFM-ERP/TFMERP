'use client';

/**
 * Business Partners — Unified Supplier & Vendor Directory
 *
 * Displays all Suppliers (the master record under Option D).
 * When a Supplier has a linked MaintenanceVendor (vendorId set), a Workshop badge appears
 * and a direct link to the vendor profile is shown.
 *
 * Filters: search, category, status, "Workshop only" toggle.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { financeApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import {
  Search, RefreshCw, Plus, Building2, Wrench, MapPin,
  ChevronRight, ExternalLink, Filter, Users, FileText, ShoppingCart,
} from 'lucide-react';
import { SUPPLIER_CATEGORIES } from '@/components/SupplierSelect';
import { CinematicHeader } from '@/components/CinematicHeader';

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:      'bg-green-100 text-green-700',
  INACTIVE:    'bg-gray-100 text-gray-500',
  BLACKLISTED: 'bg-red-100 text-red-700',
};

const WORKSHOP_CATS = ['Maintenance Workshop', 'Spare Parts Supplier', 'Tire Supplier'];

// ── Category Badge Strip ───────────────────────────────────────────────────────

function CatBadges({ categories, fallback }: { categories?: string[]; fallback?: string | null }) {
  const cats = categories?.length ? categories : fallback ? [fallback] : [];
  if (!cats.length) return <span className="text-gray-300 text-xs">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {cats.slice(0, 3).map(cat => (
        <span key={cat} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
          WORKSHOP_CATS.includes(cat) ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'
        }`}>{cat}</span>
      ))}
      {cats.length > 3 && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-500">+{cats.length - 3}</span>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BusinessPartnersPage() {
  const [items,       setItems]       = useState<any[]>([]);
  const [total,       setTotal]       = useState(0);
  const [pages,       setPages]       = useState(1);
  const [page,        setPage]        = useState(1);
  const [search,      setSearch]      = useState('');
  const [catFilter,   setCatFilter]   = useState('');
  const [statFilter,  setStatFilter]  = useState('');
  const [workshopOnly, setWorkshopOnly] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [stats,       setStats]       = useState({ total: 0, active: 0, workshops: 0, blacklisted: 0 });

  const load = useCallback(() => {
    setLoading(true);
    financeApi.suppliers.list({
      search:   search   || undefined,
      category: catFilter  || undefined,
      status:   statFilter || undefined,
      page,
      limit: 30,
    })
      .then(r => {
        const allItems: any[] = r.data.items || [];

        // Apply workshop-only filter client-side (vendor link info is available)
        const filtered = workshopOnly
          ? allItems.filter((s: any) => !!s.vendor || s.categories?.some((c: string) => WORKSHOP_CATS.includes(c)))
          : allItems;

        setItems(filtered);
        setTotal(r.data.total || 0);
        setPages(r.data.pages || 1);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, catFilter, statFilter, workshopOnly, page]);

  useEffect(() => { load(); }, [load]);

  // Compute summary stats from loaded items
  useEffect(() => {
    financeApi.suppliers.list({ limit: 1000 }).then(r => {
      const all: any[] = r.data.items || [];
      setStats({
        total:       all.length,
        active:      all.filter((s: any) => s.status === 'ACTIVE').length,
        workshops:   all.filter((s: any) => !!s.vendor || s.categories?.some((c: string) => WORKSHOP_CATS.includes(c))).length,
        blacklisted: all.filter((s: any) => s.status === 'BLACKLISTED').length,
      });
    }).catch(() => {});
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <CinematicHeader kicker="Finance · Directory" title="Business Partners" count="Unified supplier & vendor directory">
        <Link href="/finance/suppliers/new" className="btn btn-primary flex items-center gap-1.5">
          <Plus size={16} /> Add Partner
        </Link>
      </CinematicHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total Partners',   value: stats.total,       icon: Building2, color: 'text-gray-600' },
          { label: 'Active',           value: stats.active,      icon: Building2, color: 'text-green-600' },
          { label: 'Workshops / Vendors', value: stats.workshops, icon: Wrench,   color: 'text-orange-600' },
          { label: 'Blacklisted',      value: stats.blacklisted, icon: Building2, color: 'text-red-600' },
        ].map(card => (
          <div key={card.label} className="card py-3 px-4 flex items-center gap-3">
            <card.icon size={20} className={cn('shrink-0', card.color)} />
            <div>
              <p className="text-xs text-gray-400">{card.label}</p>
              <p className="text-xl font-bold text-gray-900">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9 w-full" placeholder="Search name, code, TRN…"
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="input w-52" value={catFilter}
          onChange={e => { setCatFilter(e.target.value); setPage(1); }}>
          <option value="">All Categories</option>
          {SUPPLIER_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input w-40" value={statFilter}
          onChange={e => { setStatFilter(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="BLACKLISTED">Blacklisted</option>
        </select>
        <button
          type="button"
          onClick={() => { setWorkshopOnly(v => !v); setPage(1); }}
          className={`btn flex items-center gap-1.5 text-sm ${workshopOnly ? 'btn-primary' : 'btn-secondary'}`}>
          <Wrench size={13} /> Workshops only
        </button>
        <button onClick={load} className="btn btn-secondary p-2">
          <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="table-th">Partner</th>
              <th className="table-th">Categories</th>
              <th className="table-th">Contact</th>
              <th className="table-th">Location</th>
              <th className="table-th text-center">
                <span title="Contacts"><Users size={13} className="inline" /></span>
              </th>
              <th className="table-th text-center">
                <span title="Documents"><FileText size={13} className="inline" /></span>
              </th>
              <th className="table-th text-center">
                <span title="Expenses"><ShoppingCart size={13} className="inline" /></span>
              </th>
              <th className="table-th">Status</th>
              <th className="table-th">Links</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s: any) => (
              <tr key={s.id} className={cn('table-row', s.status === 'BLACKLISTED' && 'bg-red-50/30')}>
                <td className="table-td">
                  <Link href={`/finance/suppliers/${s.id}`}
                    className="font-medium text-gray-900 hover:text-brand-600 block">
                    {s.name}
                  </Link>
                  {s.supplierCode && (
                    <span className="text-xs font-mono text-gray-400">{s.supplierCode}</span>
                  )}
                  {s.tradeName && <p className="text-xs text-gray-400">{s.tradeName}</p>}
                  {s.vendor && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-orange-100 text-orange-700 rounded px-1.5 py-0.5 mt-0.5">
                      <Wrench size={9} /> Workshop
                    </span>
                  )}
                </td>
                <td className="table-td">
                  <CatBadges categories={s.categories} fallback={s.category} />
                </td>
                <td className="table-td text-xs text-gray-500">
                  {s.contactName && <p className="font-medium text-gray-700">{s.contactName}</p>}
                  {s.email       && <p>{s.email}</p>}
                  {s.phone       && <p>{s.phone}</p>}
                  {!s.contactName && !s.email && !s.phone && <span className="text-gray-300">—</span>}
                </td>
                <td className="table-td text-xs">
                  {(s.city || s.country) && (
                    <p className="text-gray-600">{[s.city, s.country].filter(Boolean).join(', ')}</p>
                  )}
                  {s.googleMapsUrl && (
                    <a href={s.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-brand-600 hover:underline mt-0.5">
                      <MapPin size={11} /> Maps
                    </a>
                  )}
                  {!s.city && !s.country && !s.googleMapsUrl && <span className="text-gray-300">—</span>}
                </td>
                <td className="table-td text-center text-xs text-gray-600">{s._count?.supplierContacts || 0}</td>
                <td className="table-td text-center text-xs text-gray-600">{s._count?.documents || 0}</td>
                <td className="table-td text-center text-xs text-gray-600">{s._count?.expenses || 0}</td>
                <td className="table-td">
                  <span className={cn('badge text-xs', STATUS_COLORS[s.status] ?? 'bg-gray-100 text-gray-500')}>
                    {s.status || (s.isActive ? 'ACTIVE' : 'INACTIVE')}
                  </span>
                </td>
                <td className="table-td">
                  <div className="flex items-center gap-2">
                    <Link href={`/finance/suppliers/${s.id}`}
                      className="text-gray-400 hover:text-brand-600" title="Supplier profile">
                      <ChevronRight size={16} />
                    </Link>
                    {s.vendor && (
                      <Link href={`/rental/maintenance/vendors/${s.vendor.id}`}
                        className="text-orange-400 hover:text-orange-600" title="Vendor / workshop profile">
                        <Wrench size={14} />
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="text-center py-16">
                  <Building2 size={32} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-400">No business partners found.</p>
                  <Link href="/finance/suppliers"
                    className="mt-3 text-brand-600 text-sm hover:underline block">
                    → Go to Supplier Directory to add partners
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
          <span>Page {page} of {pages} · {total} total</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="btn btn-secondary py-1 px-3 disabled:opacity-40">Prev</button>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              className="btn btn-secondary py-1 px-3 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
