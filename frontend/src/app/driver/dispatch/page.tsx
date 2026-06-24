'use client';

/** SYS-12.F — Driver app route (production transport runs). Thin wrapper over the reusable
 *  DriverRunView. Resolves the driver from login; a Captain can open a specific driver via
 *  ?driverId=. Not a sidebar item — reached from the Transport module / project Captain console. */
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import DriverRunView from '@/components/production/DriverRunView';

function Inner() {
  const sp = useSearchParams();
  return <DriverRunView driverId={sp.get('driverId') || undefined} />;
}

export default function DriverDispatchPage() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
