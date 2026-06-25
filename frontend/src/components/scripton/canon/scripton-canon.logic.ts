// Pure logic for the ScriptON Canon screen — no React/API/DOM. Maps CanonFact
// rows (the merged kernel's read model) into the graph / entity-panel / bi-temporal
// timeline view models. resolveCanonAt mirrors the backend canon-resolve util.

export type CanonKind = 'CHARACTER' | 'WORLD' | 'LORE' | 'TIMELINE' | 'RELATIONSHIP' | 'PLOT';
export type Fact = {
  kind: CanonKind; subject: string; predicate: string; object: string; statement: string;
  validFrom: number; validTo: number | null; status?: 'ACTIVE' | 'SUPERSEDED';
  recordedAt?: number; supersedesId?: string | null; id?: string;
};
export type GraphNode = { id: string };
export type GraphEdge = { from: string; to: string; label: string; superseded: boolean };
export type EntityRow = { name: string; count: number };
export type TLPoint = { at: number; caption: string };
export type PanelFact = { statement: string; established: number; status: string; isNew: boolean; superseded: boolean };

export const TABS = ['Relationships', 'Characters', 'World', 'Lore', 'Timeline'] as const;
export type CanonTab = typeof TABS[number];
const TAB_KIND: Record<CanonTab, CanonKind> = { Relationships: 'RELATIONSHIP', Characters: 'CHARACTER', World: 'WORLD', Lore: 'LORE', Timeline: 'TIMELINE' };

export const humanPred = (p: string) => String(p || '').replace(/_/g, ' ');

/** Facts true at story-order `at` (mirrors backend canon-resolve.util). Half-open [validFrom, validTo); later recordedAt wins. */
export function resolveCanonAt(facts: Fact[], at: number): Fact[] {
  if (!Array.isArray(facts) || !facts.length) return [];
  const live = facts.filter((x) => x && (x.status ?? 'ACTIVE') === 'ACTIVE' && x.validFrom <= at && (x.validTo == null || x.validTo > at));
  const winner = new Map<string, Fact>();
  for (const x of live) {
    const key = x.subject + ' ' + x.predicate;
    const prev = winner.get(key);
    if (!prev || (x.recordedAt ?? 0) >= (prev.recordedAt ?? 0)) winner.set(key, x);
  }
  return [...winner.values()];
}

export function factsForTab(facts: Fact[], tab: CanonTab): Fact[] {
  const k = TAB_KIND[tab];
  return (facts || []).filter((f) => f.kind === k);
}

/** Distinct subjects (the selectable entities), most-documented first. */
export function entityList(facts: Fact[]): EntityRow[] {
  const m = new Map<string, number>();
  for (const f of (facts || [])) m.set(f.subject, (m.get(f.subject) || 0) + 1);
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Relationship graph: nodes = subject/object entities, edges = RELATIONSHIP facts (SUPERSEDED → dashed). */
export function buildGraph(facts: Fact[]): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const rel = (facts || []).filter((f) => f.kind === 'RELATIONSHIP');
  const nodes = new Set<string>();
  const edges = rel.map((f) => { nodes.add(f.subject); nodes.add(f.object); return { from: f.subject, to: f.object, label: humanPred(f.predicate), superseded: f.status === 'SUPERSEDED' }; });
  return { nodes: [...nodes].map((id) => ({ id })), edges };
}

/** All facts about an entity (subject = name), in story order. */
export function entityFacts(facts: Fact[], subject: string): Fact[] {
  return (facts || []).filter((f) => f.subject === subject).slice().sort((a, b) => a.validFrom - b.validFrom || (a.recordedAt ?? 0) - (b.recordedAt ?? 0));
}

/** Entity facts as panel view models (established scene, status, new/superseded flags). */
export function panelFacts(entFacts: Fact[]): PanelFact[] {
  return entFacts.map((f) => ({
    statement: f.statement, established: f.validFrom, status: f.status ?? 'ACTIVE',
    superseded: f.status === 'SUPERSEDED',
    // "new in V / superseding": an ACTIVE fact whose predicate has a retired (SUPERSEDED) prior.
    isNew: (f.status ?? 'ACTIVE') === 'ACTIVE' && entFacts.some((p) => p !== f && p.predicate === f.predicate && p.status === 'SUPERSEDED'),
  }));
}

/** Bi-temporal timeline: the scene-order points where this entity's facts change, with a transition caption. */
export function timelinePoints(entFacts: Fact[]): TLPoint[] {
  const pts = [...new Set((entFacts || []).map((f) => f.validFrom))].sort((a, b) => a - b);
  return pts.map((at) => {
    const starting = entFacts.filter((f) => f.validFrom === at);
    const caps = starting.map((f) => {
      const prior = entFacts.find((p) => p !== f && p.predicate === f.predicate && p.object !== f.object && p.validFrom < at);
      return prior ? `${humanPred(f.predicate)}: ${prior.object} → ${f.object}` : `${humanPred(f.predicate)}: ${f.object}`;
    });
    return { at, caption: caps.join(' · ') };
  });
}
