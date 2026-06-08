'use client';

import { useEffect } from 'react';

/**
 * Registers the production PWA: links the production manifest and the service worker.
 * Mounted once in the dashboard layout. Scoped so it doesn't disturb the /driver PWA.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!document.querySelector('link[rel="manifest"][data-prod]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/manifest.production.json';
      link.setAttribute('data-prod', '1');
      document.head.appendChild(link);
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {/* SW optional */});
    }
  }, []);
  return null;
}
