'use client';
/** ScripON Doctor — Settings & Governance route /scripon/settings. AiRun audit + model + gates (governance wiring partial). */
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ScripOnSettings, { SxRun } from '@/components/scripon/ScripOnSettings';
import ScripOnSettingsTablet from '@/components/scripon/ScripOnSettingsTablet';
import ScripOnSettingsMobile from '@/components/scripon/ScripOnSettingsMobile';
import { useViewport } from '@/components/scripon/useViewport';
import { useLocale } from '@/lib/i18n';

const RUNS: SxRun[] = [
  { surface: 'Coverage report', model: 'claude-opus-4', tokens: '18.4k', conf: 0.84, status: 'APPROVED', statusClass: 'green', when: '2h' },
  { surface: 'Scene diagnostics', model: 'claude-opus-4', tokens: '9.1k', conf: 0.88, status: 'APPROVED', statusClass: 'green', when: '2h' },
  { surface: 'Budget-fit · apply', model: 'claude-opus-4', tokens: '12.7k', conf: 0.71, status: 'PENDING', statusClass: 'amber', when: '1d' },
  { surface: 'Breakdown tagging', model: 'claude-sonnet-4', tokens: '6.3k', conf: 0.92, status: 'APPROVED', statusClass: 'green', when: '1d' },
  { surface: 'Version compare', model: 'claude-opus-4', tokens: '7.8k', conf: 0.86, status: 'APPROVED', statusClass: 'green', when: '1d' },
  { surface: 'Culture screen', model: 'claude-opus-4', tokens: '5.2k', conf: 0.69, status: 'PENDING', statusClass: 'amber', when: '2d' },
];

export default function ScripOnSettingsPage() {
  const router = useRouter();
  const vp = useViewport();
  const { t } = useLocale();
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<any>(null);
  const flash = (m: string) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 3200); };
  const onAction = (k: string) => {
    const m: Record<string, string> = { save: t('Saving governance settings ships in the next phase — values shown are the live defaults.'), discard: t('Reverted.'), toggle: t('Confidence/approval gates are read-only here for now — wiring ships next.'), subnav: t('This settings section ships in the next phase.') };
    flash(m[k] || t('Coming soon.'));
  };
  const onNav = (k: string) => {
    if (k === 'settings') return;
    if (k === 'home') return router.push('/scripon');
    if (k === 'reader') return router.push('/scripon/reader');
    if (k === 'breakdown') return router.push('/scripon/breakdown');
    if (k === 'doctor') return router.push('/scripon/doctor');
    if (k === 'schedule') return router.push('/scripon/schedule');
    if (k === 'reports') return router.push('/scripon/reports');
    if (k === 'coverage') return router.push('/scripon/doctor');
    if (k === 'studio') return router.push('/scripon/studio');
    if (k === 'greenlight') return router.push('/scripon/greenlight');
    if (k === 'library') return router.push('/scripon/library');
    flash(`${k[0].toUpperCase() + k.slice(1)} ${t('is a later screen in the build order.')}`);
  };
  const RC: any = vp === 'mobile' ? ScripOnSettingsMobile : vp === 'tablet' ? ScripOnSettingsTablet : ScripOnSettings;
  return <RC companyName="The Film Makers" model="claude-opus-4" promptSet={t('Prompt set v3')} confidence={0.75} humanApproval={true}
    runs={RUNS} runsMeta={t('All AI flows through one service · 142 runs today')} onAction={onAction} onNav={onNav} onBack={() => router.push('/home')} toast={toast} />;
}
