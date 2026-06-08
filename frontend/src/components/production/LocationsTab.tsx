'use client';

import { useState } from 'react';
import { Tabs } from './ui';
import LocationsPanel from './LocationsPanel';
import LocationNeedsPanel from './LocationNeedsPanel';
import ScoutVisitsPanel from './ScoutVisitsPanel';
import ClearancePacksPanel from './ClearancePacksPanel';
import LocationReportPanel from './LocationReportPanel';
import ReadinessPanel from './ReadinessPanel';

/**
 * Project Locations tab — inner tabs: the location library/list, and the
 * breakdown-driven Needs → Options → Lock board (SYS-07 V2 · Slice 1).
 */
export default function LocationsTab({ projectId, currency = 'AED' }: { projectId: string; currency?: string }) {
  const [inner, setInner] = useState('library');
  return (
    <div className="font-sans">
      <Tabs active={inner} onChange={setInner} tabs={[['library', 'Locations'], ['needs', 'Breakdown & options'], ['scouts', 'Scout visits'], ['clearance', 'Clearance packs'], ['report', 'Report & plates'], ['readiness', 'Readiness']]} />
      {inner === 'library' && <LocationsPanel projectId={projectId} currency={currency} />}
      {inner === 'needs' && <LocationNeedsPanel projectId={projectId} />}
      {inner === 'scouts' && <ScoutVisitsPanel projectId={projectId} />}
      {inner === 'clearance' && <ClearancePacksPanel projectId={projectId} />}
      {inner === 'report' && <LocationReportPanel projectId={projectId} />}
      {inner === 'readiness' && <ReadinessPanel projectId={projectId} />}
    </div>
  );
}
