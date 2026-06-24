'use client';

import LocationsWorkspace from './LocationsWorkspace';

/**
 * Project Locations tab — now a single workspace with six lifecycle surfaces
 * (Board · Map & Routes · Scouting · Clearance & Compliance · Logistics & Unit Moves · Reports).
 * Every legacy panel (library, needs/options, scout visits, clearance packs, report & plates,
 * readiness) is embedded INSIDE those surfaces via in-page sub-navs — the old top-level inner
 * tabs are retired. Legacy panel components are retained as files and reused by the workspace
 * (fully reversible — re-add the <Tabs> shell to restore the old layout).
 */
export default function LocationsTab({ projectId, currency = 'AED' }: { projectId: string; currency?: string }) {
  return (
    <div className="font-sans">
      <LocationsWorkspace projectId={projectId} currency={currency} />
    </div>
  );
}
