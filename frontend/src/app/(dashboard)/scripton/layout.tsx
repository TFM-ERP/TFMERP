'use client';
import React from 'react';
import ScriptOnCmdK from '@/components/scripton/ScriptOnCmdK';
import ScriptonBindBar from '@/components/scripton/ScriptonBindBar';
import ScriptonGenPill from '@/components/scripton/ScriptonGenPill';
export default function ScriptonLayout({ children }: { children: React.ReactNode }) {
  // Three floating pieces, mounted once for every ScriptON route: the command palette, the
  // workspace bind bar (bottom-START), and the live-generation pill (bottom-END). The pill draws
  // nothing at all unless a generation is known, so an idle ScriptON is unchanged.
  return (<>{children}<ScriptOnCmdK /><ScriptonBindBar /><ScriptonGenPill /></>);
}
