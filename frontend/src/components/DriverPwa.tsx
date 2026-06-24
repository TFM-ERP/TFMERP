'use client';

import { useEffect } from 'react';

/**
 * Driver PWA wiring — links the driver manifest + iOS meta and registers the driver
 * service worker, scoped to /driver/ only. Separate from the production PwaRegister so
 * the two installable apps don't collide (longest-scope match gives /driver/* to this SW).
 */
export default function DriverPwa() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const head = document.head;
    // Override (not just add) so a global app manifest/theme can't shadow the driver PWA.
    const setLink = (rel: string, href: string) => {
      let l = head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!l) { l = document.createElement('link'); l.rel = rel; head.appendChild(l); }
      l.href = href; l.setAttribute('data-driver', '1');
    };
    const setMeta = (name: string, content: string) => {
      let m = head.querySelector(`meta[name="${name}"]`) as HTMLMetaElement | null;
      if (!m) { m = document.createElement('meta'); m.name = name; head.appendChild(m); }
      m.content = content; m.setAttribute('data-driver', '1');
    };
    setLink('manifest', '/driver-manifest.webmanifest');
    setLink('apple-touch-icon', '/icons/driver-192.png');
    setMeta('apple-mobile-web-app-capable', 'yes');
    setMeta('theme-color', '#14213a');

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/driver-sw.js', { scope: '/driver/' }).catch(() => { /* SW optional */ });
    }
  }, []);
  return null;
}
