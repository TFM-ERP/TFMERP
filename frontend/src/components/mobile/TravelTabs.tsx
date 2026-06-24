'use client';

/** SYS-mobile — shared sub-nav that ties the travel journey together
 *  (Travel itinerary → Stay → Transport), so the three pages read as one flow. */
import Link from 'next/link';
import { ChevronLeft, Plane, BedDouble, Route } from 'lucide-react';

const TABS = [
  { key: 'travel', href: '/m/travel', label: 'Travel', icon: Plane },
  { key: 'stay', href: '/m/accommodation', label: 'Stay', icon: BedDouble },
  { key: 'transport', href: '/m/transport', label: 'Transport', icon: Route },
] as const;

export default function TravelTabs({ active }: { active: 'travel' | 'stay' | 'transport' }) {
  return (
    <div className="mb-3">
      <Link href="/m/me" className="inline-flex items-center gap-1 text-sm mb-3" style={{ color: 'var(--text-3)' }}>
        <ChevronLeft size={16} /> Tools
      </Link>
      <div className="flex gap-1.5">
        {TABS.map((t) => {
          const on = t.key === active;
          const Icon = t.icon;
          return (
            <Link
              key={t.key}
              href={t.href}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold"
              style={{ background: on ? 'var(--gold)' : 'var(--surface-1)', color: on ? '#161C28' : 'var(--text-3)', border: '1px solid var(--border-1)' }}
            >
              <Icon size={14} /> {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
