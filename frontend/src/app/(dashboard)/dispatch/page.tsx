'use client';

/** Standalone rental dispatch (Transport module). Defaults to rental drivers; pick a project
 *  inside to view that production's slate + basecamp pins. Project crews also get this embedded
 *  in their own Transport tab via <DispatchBoard lockedProjectId={id} />. */
import DispatchBoard from '@/components/production/DispatchBoard';

export default function DispatchPage() {
  return <DispatchBoard />;
}
