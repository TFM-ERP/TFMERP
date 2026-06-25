'use client';
import React from 'react';
import ScriptOnCmdK from '@/components/scripton/ScriptOnCmdK';
import ScriptonBindBar from '@/components/scripton/ScriptonBindBar';
export default function ScriptonLayout({ children }: { children: React.ReactNode }) {
  return (<>{children}<ScriptOnCmdK /><ScriptonBindBar /></>);
}
