'use client';
import React from 'react';
import ScripOnCmdK from '@/components/scripon/ScripOnCmdK';
import ScriponBindBar from '@/components/scripon/ScriponBindBar';
export default function ScriponLayout({ children }: { children: React.ReactNode }) {
  return (<>{children}<ScripOnCmdK /><ScriponBindBar /></>);
}
