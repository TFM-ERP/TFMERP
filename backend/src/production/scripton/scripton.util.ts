/**
 * Pure, framework-free helpers for the ScripON engines (no Nest/Prisma/AI imports, so unit-testable in isolation).
 * computeFacts: deterministic scene aggregation (counts, locations, pages) used by every P0-P7 engine.
 * parseJsonArray: tolerant JSON-array extraction from model output, used by every apply and format path.
 */
export function computeFacts(scenes: any[]) {
  const u = (x: any) => String(x || '').toUpperCase();
  let intC = 0, extC = 0, dayC = 0, nightC = 0; const sets = new Set<string>(); let pages = 0;
  for (const s of scenes) {
    const ie = u(s.intExt || s.slugline);
    if (ie.includes('INT')) intC++;
    if (ie.includes('EXT')) extC++;
    const dn = u(s.dayNight || s.slugline);
    if (dn.includes('NIGHT')) nightC++; else if (dn.includes('DAY')) dayC++;
    const set = s.setName || (s.slugline ? String(s.slugline).replace(/^(INT|EXT|INT\/EXT)[\.\s-]*/i, '').split(' - ')[0] : '');
    if (set) sets.add(String(set).trim().toUpperCase());
    pages += Number(s.pages || 0);
  }
  return { sceneCount: scenes.length, int: intC, ext: extC, day: dayC, night: nightC, locations: sets.size, pages: Math.round(pages * 10) / 10 };
}

export function parseJsonArray(text: string): any[] {
  let t = String(text || '');
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i); if (fence) t = fence[1].trim();
  const a = t.indexOf('['), b = t.lastIndexOf(']'); if (a >= 0 && b > a) t = t.slice(a, b + 1);
  try { const j = JSON.parse(t); return Array.isArray(j) ? j : []; } catch { return []; }
}
