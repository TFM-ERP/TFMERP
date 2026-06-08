'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { companyApi } from '@/lib/api';

/**
 * Blocks access to dashboard modules until the company setup wizard
 * is complete. Renders children only once setupComplete === true.
 */
export default function SetupGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    companyApi.get()
      .then((r) => {
        if (!active) return;
        if (!r.data?.setupComplete) {
          router.replace('/setup');
        } else {
          setReady(true);
        }
      })
      .catch(() => { if (active) setReady(true); }); // fail open so app isn't bricked if API down
    return () => { active = false; };
  }, [pathname, router]);

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Checking company setup…</div>;
  }
  return <>{children}</>;
}
