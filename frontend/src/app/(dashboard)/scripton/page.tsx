'use client';
/**
 * ScriptON — OS Home. Always renders the new-OS Home/Slate. The legacy command-centre dashboard
 * (ScriptOnDashboard desktop/tablet/mobile) is retired; do not reintroduce an osShell fallback here.
 */
import ScriptonHome from '@/components/scripton/home/ScriptonHome';

export default function ScriptOnHomePage() {
  return <ScriptonHome />;
}
