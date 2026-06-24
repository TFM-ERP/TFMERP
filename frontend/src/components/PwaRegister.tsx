'use client';

import { useEffect } from 'react';

/**
 * Registers the production PWA: links the production manifest and the service worker.
 * Mounted once in the dashboard layout. Scoped so it doesn't disturb the /driver PWA.
 */
export default function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = location.hostname;
    const isProd = process.env.NODE_ENV === 'production' && host !== 'localhost' && host !== '127.0.0.1';
    if (!isProd) {
      // Development: never let a stale service worker serve old cached bundles.
      // Unregister any existing SW and wipe its caches so refreshes always get fresh code.
      if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => { /* noop */ });
      if (typeof caches !== 'undefined') caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => { /* noop */ });
      return;
    }
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
