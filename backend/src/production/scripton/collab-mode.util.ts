/** Resolve the effective ScriptON collaboration mode. A manual TEAM/SOLO override
 *  wins; otherwise AUTO follows membership (>1 member on the project = team). Pure. */
export function resolveCollabMode(
  collabMode: string | null | undefined,
  memberCount: number,
): 'team' | 'solo' {
  const m = String(collabMode || 'AUTO').toUpperCase();
  if (m === 'TEAM') return 'team';
  if (m === 'SOLO') return 'solo';
  return (memberCount || 0) > 1 ? 'team' : 'solo';
}
