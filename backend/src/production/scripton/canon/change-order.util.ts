export function orderChanges<T extends { id: string; sceneOrder: number }>(changes: T[]): T[] {
  if (!Array.isArray(changes)) return [];
  return changes
    .map((c, i) => ({ c, i }))
    .sort((p, q) => p.c.sceneOrder - q.c.sceneOrder || p.i - q.i)
    .map((w) => w.c);
}
