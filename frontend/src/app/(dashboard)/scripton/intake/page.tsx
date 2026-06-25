'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Retired: the standalone intake is merged into the Studio "Start a build" overlay.
 *  This route now redirects to the canonical intake so old links keep working. */
export default function RetiredIntakeRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/scripton/studio'); }, [router]);
  return null;
}
