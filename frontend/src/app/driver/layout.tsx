'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [name, setName] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('tfm_token');
    if (!token) { router.replace('/login'); return; }
    try { setName(JSON.parse(localStorage.getItem('tfm_user') || '{}')?.fullName || ''); } catch {}
    // PWA manifest + theme
    if (!document.querySelector('link[rel="manifest"]')) {
      const l = document.createElement('link'); l.rel = 'manifest'; l.href = '/manifest.json'; document.head.appendChild(l);
    }
    let meta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null;
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = '#14213a';
  }, [router]);

  const logout = () => { localStorage.removeItem('tfm_token'); localStorage.removeItem('tfm_user'); router.replace('/login'); };

  return (
    <div style={{ minHeight: '100vh', background: '#f4f5f7' }}>
      <header style={{ background: '#14213a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: '#fff', borderRadius: 6, padding: '3px 6px' }}><img src="/tfm-logo.svg" alt="TFM" style={{ height: 20 }} /></div>
          <span style={{ fontSize: 14, fontWeight: 500 }}>Driver</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 12.5, color: '#cdd6ea' }}>{name}</span>
          <button onClick={logout} aria-label="Log out" style={{ background: 'none', border: 'none', color: '#9fb0d0' }}><LogOut size={18} /></button>
        </div>
      </header>
      <main style={{ maxWidth: 560, margin: '0 auto', padding: '12px' }}>{children}</main>
    </div>
  );
}
