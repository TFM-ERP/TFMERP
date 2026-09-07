'use client';
/** ScriptON Doctor — Approval Workflow route /scripton/approvals. Live ApprovalRequest engine, project-scoped. */
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { productionApi , approvalsApi } from '@/lib/api';
import { pickScriptonProject } from '@/components/scripton/useScriptonProject';
import ScriptOnApprovals, { SxKCol, SxStep } from '@/components/scripton/ScriptOnApprovals';
import ScriptOnApprovalsTablet from '@/components/scripton/ScriptOnApprovalsTablet';
import ScriptOnApprovalsMobile from '@/components/scripton/ScriptOnApprovalsMobile';
import { useViewport } from '@/components/scripton/useViewport';
import ScriptOnCompliancePanel from '@/components/scripton/ScriptOnCompliancePanel';
import { useLocale } from '@/lib/i18n';
import { useScriptonBack } from '@/components/scripton/useScriptonBack';
const initials = (s: string) => String(s || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
const ago = (d?: string) => { if (!d) return ''; const ms = Date.now() - new Date(d).getTime(); const h = Math.floor(ms / 3.6e6); if (h < 1) return 'now'; if (h < 24) return h + 'h'; return Math.floor(h / 24) + 'd'; };
const COLOR: Record<string, string> = { PENDING: 'var(--blue)', APPROVED: '#57b368', REJECTED: '#e0a23b' };

export default function ScriptOnApprovalsPage() {
  const router = useRouter();
  const vp = useViewport();
  const { t } = useLocale();
  const onBack = useScriptonBack();
  const SAMPLE_STEPS: SxStep[] = [
    { name: 'S. Okonkwo', role: t('Writer · approved 2d'), state: 'done' },
    { name: 'Lena Park', role: t('Producer · approved 1d'), state: 'done' },
    { name: 'Marcus Rao', role: t('Director · reviewing now'), state: 'current' },
    { name: 'Legal', role: t('Pending · after Director'), state: 'pending' },
  ];
  const SAMPLE_COLS = (chainRev: string): SxKCol[] => [
    { label: 'In review', color: 'var(--blue)', count: 1, cards: [{ title: chainRev + ' — ' + t('full script'), sub: t('Demo data — connect a project'), av: 'MR', avColor: '#5b8def', when: t('now'), selected: true }] },
    { label: 'Approved', color: 'var(--green)', count: 1, cards: [{ title: t('Cast list — principals'), sub: t('Demo'), av: 'LP', avColor: '#57b368', when: '2d' }] },
  ];
  const [title, setTitle] = useState('Midnight Run');
  const [chainRev, setChainRev] = useState('Blue v4');
  const [chainColor, setChainColor] = useState('#ffffff');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [revId, setRevId] = useState<string | undefined>(undefined);
  const [reqs, setReqs] = useState<any[] | null>(null);
  const [surface, setSurface] = useState<null | 'compliance'>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastT = useRef<any>(null);
  const flash = (m: string) => { setToast(m); clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(null), 3200); };

  const loadReqs = async (pid: string) => { try { const r: any = await approvalsApi.forProject(pid); setReqs(Array.isArray(r.data) ? r.data : []); } catch { setReqs([]); } };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const pr: any = await productionApi.projects.list();
        const projects = pr.data?.items ?? (Array.isArray(pr.data) ? pr.data : []);
        const proj = pickScriptonProject(projects); if (!proj?.id) return;
        const dr: any = await productionApi.script.list(proj.id);
        const docs = Array.isArray(dr.data) ? dr.data : (dr.data?.items ?? []);
        const doc = docs[0]; const rev = doc?.revisions?.find((r: any) => r.id === doc.activeRevisionId) || doc?.revisions?.[0];
        if (!alive) return;
        setTitle(proj.name || proj.title || 'Project');
        if (rev) { setChainRev(rev.revisionLabel || 'Current'); setChainColor(rev.hex || '#ffffff'); }
        setProjectId(proj.id); if (rev) setRevId(rev.id);
        await loadReqs(proj.id);
      } catch { /* keep sample */ }
    })();
    return () => { alive = false; };
  }, []);

  const live = !!(projectId && reqs);
  const active = (reqs || []).find((r) => r.status === 'PENDING') || (reqs || [])[0] || null;

  const columns: SxKCol[] = live
    ? (() => {
        const by = (st: string) => (reqs as any[]).filter((r) => r.status === st);
        const mk = (r: any): any => ({ title: r.title || r.entityType, sub: String(r.entityType || '').replace(/_/g, ' ').toLowerCase() + (r.steps && r.steps[r.currentStep]?.approverRole ? ' · ' + r.steps[r.currentStep].approverRole : ''), av: initials(r.steps && r.steps[r.currentStep]?.approverRole || r.entityType), avColor: COLOR[r.status] || '#6b727d', when: ago(r.createdAt), selected: r.id === (active && active.id) });
        return [
          { label: 'In review', color: 'var(--blue)', count: by('PENDING').length, cards: by('PENDING').map(mk) },
          { label: 'Approved', color: 'var(--green)', count: by('APPROVED').length, cards: by('APPROVED').map(mk) },
          { label: 'Changes', color: 'var(--amber)', count: by('REJECTED').length, cards: by('REJECTED').map(mk) },
        ];
      })()
    : SAMPLE_COLS(chainRev);

  const stepList: SxStep[] = live && active && active.steps && active.steps.length
    ? active.steps.map((s: any): SxStep => ({ name: s.decidedByName || s.approverRole, role: s.approverRole + (s.status === 'APPROVED' ? ' · ' + t('approved') : s.status === 'REJECTED' ? ' · ' + t('rejected') : s.stepOrder === active.currentStep ? ' · ' + t('reviewing now') : ' · ' + t('pending')), state: (s.status === 'APPROVED' || s.status === 'REJECTED' ? 'done' : s.stepOrder === active.currentStep ? 'current' : 'pending') as any }))
    : SAMPLE_STEPS;

  const stepsLeft = active && active.steps ? active.steps.length - (active.currentStep || 0) : 0;
  const lockLabel = live
    ? (active && active.status === 'PENDING' ? `${t('Sign off —')} ${stepsLeft} ${stepsLeft === 1 ? t('step left') : t('steps left')}` : t('Nothing to sign off'))
    : t('Lock revision · 2 steps left');

  const onAction = async (k: string) => {
    if (k === 'compliance') { if (!projectId || !revId) { flash(t('Connect a project with a script to screen.')); return; } return setSurface('compliance'); }
    if (k === 'lock') {
      if (!live || !active || active.status !== 'PENDING') { flash(t('No pending item to sign off.')); return; }
      try { await approvalsApi.approveChange(active.id); flash(t('Signed off.')); if (projectId) await loadReqs(projectId); }
      catch (e: any) { flash(e?.response?.data?.message || t('Sign-off failed — is the backend on :3001?')); }
      return;
    }
    if (k === 'reject') {
      if (!live || !active || active.status !== 'PENDING') { flash(t('No pending item to send back.')); return; }
      try { await approvalsApi.rejectChange(active.id); flash(t('Sent back for changes.')); if (projectId) await loadReqs(projectId); }
      catch (e: any) { flash(e?.response?.data?.message || t('Reject failed.')); }
      return;
    }
    const m: Record<string, string> = { new: t('Route a change from the Reader, Breakdown or Doctor — it lands here for sign-off.'), activity: t('Approval activity log ships in the next phase.'), card: t('Tap Sign off to advance the chain.') };
    flash(m[k] || t('Coming soon.'));
  };
  const onNav = (k: string) => {
    if (k === 'home') return router.push('/scripton');
    if (k === 'reader') return router.push('/scripton/reader');
    if (k === 'breakdown') return router.push('/scripton/breakdown');
    if (k === 'doctor') return router.push('/scripton/doctor');
    if (k === 'schedule') return router.push('/scripton/schedule');
    if (k === 'reports') return router.push('/scripton/reports');
    if (k === 'coverage') return router.push('/scripton/doctor');
    if (k === 'studio') return router.push('/scripton/studio');
    if (k === 'greenlight') return router.push('/scripton/greenlight');
    if (k === 'library') return router.push('/scripton/library');
    if (k === 'settings') return router.push('/scripton/settings');
    flash(`${k[0].toUpperCase() + k.slice(1)} ${t('is a later screen in the build order.')}`);
  };

  const RC: any = vp === 'mobile' ? ScriptOnApprovalsMobile : vp === 'tablet' ? ScriptOnApprovalsTablet : ScriptOnApprovals;
  const el = <RC title={title} meta={live ? `${t('Approvals')} · ${(reqs || []).filter((r: any) => r.status === 'PENDING').length} ${t('in review')}` : `${t('Approvals')} · ${t('demo')}`} columns={columns} chainRev={chainRev} chainColor={chainColor} steps={stepList} lockLabel={lockLabel}
    onAction={onAction} onNav={onNav} onBack={onBack} toast={toast} />;
  return (<>{el}{surface === 'compliance' && revId && (<ScriptOnCompliancePanel projectId={projectId!} revisionId={revId} onClose={() => setSurface(null)} />)}</>);
}
