/**
 * WGA revision colour wheel + auto-advance (pure; no Nest/Prisma imports, so unit-testable).
 * ScriptService imports nextRevisionColor; the first revision is WHITE/round 0, and each new
 * revision steps one colour, incrementing the round on every full wrap back to WHITE.
 */
export const REV_WHEEL: { key: string; hex: string }[] = [
  { key: 'WHITE', hex: '#ffffff' }, { key: 'BLUE', hex: '#9ec5ff' }, { key: 'PINK', hex: '#ffc0cb' },
  { key: 'YELLOW', hex: '#fff27a' }, { key: 'GREEN', hex: '#b6e7a0' }, { key: 'GOLDENROD', hex: '#e7c84e' },
  { key: 'BUFF', hex: '#f3e4c0' }, { key: 'SALMON', hex: '#ff9e80' }, { key: 'CHERRY', hex: '#d6444a' }, { key: 'TAN', hex: '#d8c39a' },
];

export function nextRevisionColor(priorColor: string | null | undefined, priorRound = 0): { key: string; hex: string; round: number; index: number } {
  if (priorColor == null) return { key: REV_WHEEL[0].key, hex: REV_WHEEL[0].hex, round: 0, index: 0 };
  const base = REV_WHEEL.findIndex((c) => c.key === priorColor);
  const index = ((base >= 0 ? base : 0) + 1) % REV_WHEEL.length;
  const round = (priorRound || 0) + (index === 0 ? 1 : 0);
  return { key: REV_WHEEL[index].key, hex: REV_WHEEL[index].hex, round, index };
}
