'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Retired: builds are folded into the Studio "Builds" tab. This route redirects so old links keep working. */
export default function RetiredBuildsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/scripon/studio'); }, [router]);
  return null;
}
