import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/** SYS-LOC V2 · M5 — Movement orders & unit moves. Auto-generates draft moves from the
 *  project's confirmed locations (base → set) with haversine-estimated drive time. */
@Injectable()
export class MovementOrdersService {
  constructor(private prisma: PrismaService) {}

  list(projectId: string) {
    return (this.prisma as any).movementOrder.findMany({ where: { projectId }, orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] });
  }
  create(data: any) { return (this.prisma as any).movementOrder.create({ data: this.clean(data) }); }
  update(id: string, data: any) { return (this.prisma as any).movementOrder.update({ where: { id }, data: this.clean(data) }); }
  remove(id: string) { return (this.prisma as any).movementOrder.delete({ where: { id } }); }

  async generate(projectId: string) {
    const locs: any[] = await (this.prisma as any).location.findMany({ where: { projectId } });
    const ll = locs.filter((l) => l.lat != null && l.lng != null && (Number(l.lat) || Number(l.lng)));
    const confirmed = ll.filter((l) => l.pipelineStage === 'CONFIRMED' || l.status === 'CONFIRMED');
    const base = ll.find((l) => /base|camp/i.test(l.name || '')) || confirmed[0] || ll[0];
    if (!base) return { created: 0 };
    let created = 0;
    for (const l of confirmed) {
      if (l.id === base.id) continue;
      const exists = await (this.prisma as any).movementOrder.findFirst({ where: { projectId, locationId: l.id, kind: 'TO_LOCATION' } });
      if (exists) continue;
      const km = this.hav(Number(base.lat), Number(base.lng), Number(l.lat), Number(l.lng));
      await (this.prisma as any).movementOrder.create({
        data: {
          projectId, locationId: l.id, kind: 'TO_LOCATION', title: `Unit move → ${l.name}`,
          fromLabel: base.name, fromLat: Number(base.lat), fromLng: Number(base.lng),
          toLabel: l.name, toLat: Number(l.lat), toLng: Number(l.lng),
          distanceKm: Math.round(km * 10) / 10, driveMinutes: Math.max(1, Math.round((km * 1.3) / 50 * 60)),
          parkingNotes: l.parkingNotes ?? null, facilitiesNotes: l.basecampNotes ?? null, mapUrl: l.googleMapsUrl ?? null, status: 'DRAFT',
        },
      });
      created++;
    }
    return { created };
  }

  private hav(aLat: number, aLng: number, bLat: number, bLng: number) {
    const R = 6371, r = (x: number) => (x * Math.PI) / 180;
    const dLat = r(bLat - aLat), dLng = r(bLng - aLng);
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  private clean(d: any) {
    const o: any = {};
    const keys = ['projectId', 'locationId', 'title', 'date', 'kind', 'fromLabel', 'fromLat', 'fromLng', 'toLabel', 'toLat', 'toLng', 'distanceKm', 'driveMinutes', 'convoyVehicles', 'parkingNotes', 'facilitiesNotes', 'mapUrl', 'contacts', 'notes', 'status'];
    for (const k of keys) if (d[k] !== undefined) o[k] = d[k];
    if (o.date) o.date = new Date(o.date);
    return o;
  }
}
