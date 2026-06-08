'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * The Settings module has been consolidated into Company Management.
 * This route now redirects to /company for backwards compatibility with
 * any old links or bookmarks.
 */
export default function SettingsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/company'); }, [router]);
  return (
    <div className="p-8 text-sm text-gray-400">
      Settings has moved to Company Management. Redirecting…
    </div>
  );
}
