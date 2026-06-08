import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-07 V2 · Slice 1 — Location Needs (the script's locations) → candidate Options → Lock.
 * A Need is seeded from the breakdown (one per distinct ProductionStrip.location). Options
 * attach candidate Location records; locking one stamps ProductionStrip.locationId for that
 * Need's scenes so call sheets / per-diem / transport flow from the chosen place.
 */
@Injectable()
export class LocationNeedsService {
  constructor(private prisma: PrismaService) {}

  /** Sync Needs from the script breakdown — one Need per distinct ProductionStrip.location. */
  async sync(projectId: string) {
    const strips = await this.prisma.productionStrip.findMany({
      where: { projectId },
      select: { location: true, setName: true, intExt: true, sceneNumber: true },
    });
    const groups = new Map<string, { intExt: Set<string>; scenes: string[] }>();
    for (const s of strips) {
      const key = (s.location || s.setName || '').trim();
      if (!key) continue;
      let g = groups.get(key);
      if (!g) { g = { intExt: new Set(), scenes: [] }; groups.set(key, g); }
      if (s.intExt) g.intExt.add(String(s.intExt));
      if (s.sceneNumber) g.scenes.push(String(s.sceneNumber));
    }
    let created = 0;
    for (const [name, g] of groups) {
      const data = { intExt: Array.from(g.intExt).join(' / ') || null, sceneRefs: g.scenes.join(', ') || null };
      const existing = await this.prisma.locationNeed.findFirst({ where: { projectId, name } });
      if (existing) await this.prisma.locationNeed.update({ where: { id: existing.id }, data });
      else { await this.prisma.locationNeed.create({ data: { projectId, name, ...data } }); created++; }
    }
    return { created, total: groups.size };
  }

  /** Needs + their options, each option enriched with its candidate Location (plain FK resolve). */
  async list(projectId: string) {
    const needs = await this.prisma.locationNeed.findMany({
      where: { projectId },
      include: { options: { orderBy: [{ rank: 'asc' }, { createdAt: 'asc' }] } },
      orderBy: { name: 'asc' },
    });
    const locIds = Array.from(new Set(needs.flatMap(n => n.options.map(o => o.locationId))));
    const locs = locIds.length
      ? await this.prisma.location.findMany({ where: { id: { in: locIds } }, select: { id: true, name: true, status: true, emirate: true, area: true, pipelineStage: true } })
      : [];
    const locMap = new Map(locs.map(l => [l.id, l]));
    return needs.map(n => ({ ...n, options: n.options.map(o => ({ ...o, location: locMap.get(o.locationId) || null })) }));
  }

  updateNeed(id: string, data: any) {
    const d: any = {};
    if (data?.brief !== undefined) d.brief = data.brief;
    if (data?.status !== undefined) d.status = data.status;
    if (data?.name !== undefined) d.name = data.name;
    if (data?.intExt !== undefined) d.intExt = data.intExt;
    if (data?.requiredBy !== undefined) d.requiredBy = data.requiredBy ? new Date(data.requiredBy) : null;
    if (data?.visualRefs !== undefined) d.visualRefs = data.visualRefs;
    return this.prisma.locationNeed.update({ where: { id }, data: d });
  }

  async addOption(needId: string, body: any) {
    if (!body?.locationId) throw new BadRequestException('locationId is required.');
    const need = await this.prisma.locationNeed.findUnique({ where: { id: needId } });
    if (!need) throw new BadRequestException('Need not found.');
    const dupe = await this.prisma.locationNeedOption.findFirst({ where: { needId, locationId: body.locationId } });
    if (dupe) return dupe;
    const opt = await this.prisma.locationNeedOption.create({
      data: { needId, locationId: body.locationId, optionStatus: body.optionStatus || 'PROPOSED', notes: body.notes || null },
    });
    if (need.status === 'SOURCING') await this.prisma.locationNeed.update({ where: { id: needId }, data: { status: 'OPTIONS' } });
    return opt;
  }

  updateOption(id: string, data: any) {
    const d: any = {};
    if (data?.optionStatus !== undefined) d.optionStatus = data.optionStatus;
    if (data?.rank !== undefined) d.rank = data.rank === null || data.rank === '' ? null : Number(data.rank);
    if (data?.notes !== undefined) d.notes = data.notes;
    return this.prisma.locationNeedOption.update({ where: { id }, data: d });
  }

  removeOption(id: string) { return this.prisma.locationNeedOption.delete({ where: { id } }); }

  /** Lock an option → selected, Need LOCKED, and stamp strip.locationId for the Need's scenes. */
  async lock(needId: string, optionId: string) {
    const need = await this.prisma.locationNeed.findUnique({ where: { id: needId } });
    if (!need) throw new BadRequestException('Need not found.');
    const opt = await this.prisma.locationNeedOption.findUnique({ where: { id: optionId } });
    if (!opt || opt.needId !== needId) throw new BadRequestException('Option not found for this Need.');
    await this.prisma.locationNeedOption.updateMany({ where: { needId }, data: { isSelected: false } });
    await this.prisma.locationNeedOption.update({ where: { id: optionId }, data: { isSelected: true, optionStatus: 'APPROVED' } });
    await this.prisma.locationNeed.update({ where: { id: needId }, data: { selectedOptionId: optionId, status: 'LOCKED' } });
    let scenes = 0;
    if (need.projectId) {
      const r = await this.prisma.productionStrip.updateMany({ where: { projectId: need.projectId, location: need.name }, data: { locationId: opt.locationId } });
      scenes = r.count;
    }
    return { ok: true, locationId: opt.locationId, scenesLinked: scenes };
  }

  async unlock(needId: string) {
    await this.prisma.locationNeedOption.updateMany({ where: { needId }, data: { isSelected: false } });
    return this.prisma.locationNeed.update({ where: { id: needId }, data: { selectedOptionId: null, status: 'OPTIONS' } });
  }
}
