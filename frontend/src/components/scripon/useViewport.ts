'use client';
import { useEffect, useState } from 'react';
/** 'mobile' ≤640 · 'tablet' ≤1112 · else 'desktop'. SSR-safe (defaults desktop, hydrates to real width). */
export function useViewport(): 'mobile' | 'tablet' | 'desktop' {
  const [w, setW] = useState(1440);
  useEffect(() => {
    const f = () => setW(window.innerWidth);
    f(); window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return w <= 640 ? 'mobile' : w <= 1112 ? 'tablet' : 'desktop';
}
