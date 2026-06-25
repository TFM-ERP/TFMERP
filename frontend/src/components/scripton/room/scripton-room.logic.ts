// Pure logic for the ScriptON Room (Notes + Approvals + Distribution) — no
// React/API/DOM. Maps the existing scriptAnnotations / approvalsApi.forProject
// / review-protection listExports shapes into the 3-column view models.

// Relative time (kept local so the module is dependency-free for node:test).
function relTime(iso: string | undefined | null, now: number = Date.now()): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!t) return '';
  const days = Math.round((now - t) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1d';
  if (days < 7) return days + 'd';
  if (days < 30) return Math.round(days / 7) + 'w';
  return new Date(iso).toLocaleDateString();
}

export type RoomNote = {
  id: string; av: string; author: string; scene: string; text: string;
  meta: string; color: string; status: 'open' | 'resolved';
};
export type ChainStage = { name: string; role: string; state: 'done' | 'current' | 'pending' | 'rejected'; by?: string };
export type DistRow = { name: string; role: string; status: 'viewed' | 'sent'; when: string; watermarked: boolean };
export type Bubble = { av: string; author: string; time: string; text: string; color: string; doc?: boolean };
export type Thread = { scene: string; badge: string; badgeClass: string; bubbles: Bubble[] };

const AV = ['#5b8def', '#8b7cf0', '#57b368', '#e0a23b', '#d6649a', '#48b6a0'];
const initials = (who: string) => String(who || '?').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

// scriptAnnotations.list rows → note cards (mirrors the existing notes page).
export function toNoteCards(annotations: any[], now: number = Date.now()): RoomNote[] {
  return (Array.isArray(annotations) ? annotations : [])
    .filter((a) => a?.body || a?.text || a?.note)
    .slice(0, 40)
    .map((a, i): RoomNote => {
      const who = a.author || a.createdBy || 'Collaborator';
      return {
        id: a.id || ('a' + i), av: initials(who), author: who,
        scene: a.sceneNumber ? `Sc ${a.sceneNumber}` : (a.sceneRef || 'Script'),
        text: a.body || a.text || a.note,
        meta: (a.resolved ? 'resolved' : 'open') + (a.createdAt ? ' · ' + relTime(a.createdAt, now) : ''),
        color: AV[i % AV.length], status: a.resolved ? 'resolved' : 'open',
      };
    });
}

// Filters (All/@me/Story/Production show all — advanced filters are next-phase).
export function filterNotes(notes: RoomNote[], filter: string): RoomNote[] {
  if (filter === 'Open') return notes.filter((n) => n.status === 'open');
  if (filter === 'Resolved') return notes.filter((n) => n.status === 'resolved');
  return notes;
}

export function openCount(notes: RoomNote[]): number { return notes.filter((n) => n.status === 'open').length; }

// An approval request (approvalsApi.forProject) → ordered chain stages.
export function toChainStages(req: any): ChainStage[] {
  if (!req || !Array.isArray(req.steps)) return [];
  const cur = req.currentStep ?? 0;
  const pendingReq = String(req.status || '').toUpperCase() === 'PENDING';
  return req.steps.slice().sort((a: any, b: any) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0)).map((s: any): ChainStage => {
    const st = String(s.status || '').toUpperCase();
    const state: ChainStage['state'] = st === 'APPROVED' ? 'done' : st === 'REJECTED' ? 'rejected'
      : (pendingReq && (s.stepOrder ?? 0) === cur) ? 'current' : 'pending';
    return { name: s.approverRole || 'Approver', role: s.approverRole || '', state, by: s.decidedByName || undefined };
  });
}

// Pick the chain to show: the note-resolve request for the selected note if any,
// else the most relevant project request.
export function pickChainRequest(requests: any[], selectedNoteId?: string): any | null {
  const arr = Array.isArray(requests) ? requests : [];
  if (!arr.length) return null;
  if (selectedNoteId) { const hit = arr.find((r) => r.entityId === selectedNoteId); if (hit) return hit; }
  const pending = arr.find((r) => String(r.status || '').toUpperCase() === 'PENDING');
  return pending || arr[0];
}

// review-protection listExports → distribution rows (empty array when none yet).
export function toDistribution(exports: any, now: number = Date.now()): DistRow[] {
  return (Array.isArray(exports) ? exports : []).map((e): DistRow => {
    const name = e.recipientName || e.recipient?.name || e.recipientEmail || e.recipient?.email || e.copyId || 'Recipient';
    const role = e.recipientRole || e.recipient?.role || e.channel || '';
    const viewed = e.viewedAt || e.firstViewedAt || e.lastViewedAt;
    return { name, role, status: viewed ? 'viewed' : 'sent', when: relTime(viewed || e.createdAt || e.when, now), watermarked: true };
  });
}

// Thread for the selected note — single real bubble (replies are an honest
// next-phase stub; no comments endpoint exists). kernelInert hides the pass chip.
export function buildThread(note: RoomNote | null | undefined): Thread | null {
  if (!note) return null;
  return {
    scene: note.scene.toUpperCase(),
    badge: note.status === 'resolved' ? 'RESOLVED' : 'OPEN',
    badgeClass: note.status === 'resolved' ? 'green' : 'amber',
    bubbles: [{ av: note.av, author: String(note.author).split(' · ')[0], time: note.meta, text: note.text, color: note.color }],
  };
}
