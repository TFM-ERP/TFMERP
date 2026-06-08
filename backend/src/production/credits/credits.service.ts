import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

// Standard screen-credit order + titles
const CREDIT_ORDER: { role: string; title: string }[] = [
  { role: 'DIRECTOR', title: 'Director' },
  { role: 'PRODUCER', title: 'Producer' },
  { role: 'LINE_PRODUCER', title: 'Line Producer' },
  { role: 'PRODUCTION_COORDINATOR', title: 'Production Coordinator' },
  { role: 'ASSISTANT_DIRECTOR', title: '1st Assistant Director' },
  { role: 'DOP', title: 'Director of Photography' },
  { role: 'CAMERA_OPERATOR', title: 'Camera Operator' },
  { role: 'GAFFER', title: 'Gaffer' },
  { role: 'GRIP', title: 'Grip' },
  { role: 'SOUND', title: 'Production Sound' },
  { role: 'ART_DIRECTOR', title: 'Art Director' },
  { role: 'EDITOR', title: 'Editor' },
  { role: 'COLORIST', title: 'Colorist' },
  { role: 'VFX_ARTIST', title: 'Visual Effects' },
  { role: 'DRIVER', title: 'Driver' },
  { role: 'OTHER', title: 'Crew' },
];

@Injectable()
export class CreditsService {
  constructor(private prisma: PrismaService) {}

  /** Build default credit blocks from the project's crew assignments. */
  private async buildDefault(projectId: string) {
    const project = await this.prisma.productionProject.findUnique({
      where: { id: projectId },
      include: { crew: true },
    });
    if (!project) throw new NotFoundException('Project not found');

    const lines: { role: string; name: string }[] = [];
    for (const def of CREDIT_ORDER) {
      const members = project.crew.filter(c => c.role === def.role);
      for (const m of members) lines.push({ role: def.title, name: m.name });
    }

    const blocks = [
      { heading: 'Cast', lines: [] as any[] },
      { heading: 'Crew', lines },
      { heading: 'Special Thanks', lines: [] as any[] },
    ];
    return { title: project.title, blocks };
  }

  async getOrBuild(projectId: string) {
    const existing = await this.prisma.creditRoll.findUnique({ where: { projectId } });
    if (existing) return existing;
    const def = await this.buildDefault(projectId);
    return { projectId, title: def.title, blocks: def.blocks, _generated: true };
  }

  async save(projectId: string, data: { title?: string; blocks?: any }) {
    return this.prisma.creditRoll.upsert({
      where: { projectId },
      update: { title: data.title ?? null, blocks: data.blocks ?? [] },
      create: { projectId, title: data.title ?? null, blocks: data.blocks ?? [] },
    });
  }

  /** Rebuild crew block from assignments while preserving Cast / Special Thanks. */
  async regenerate(projectId: string) {
    const def = await this.buildDefault(projectId);
    const existing = await this.prisma.creditRoll.findUnique({ where: { projectId } });
    let blocks = def.blocks;
    if (existing && Array.isArray(existing.blocks)) {
      const prev = existing.blocks as any[];
      blocks = def.blocks.map(b => {
        if (b.heading === 'Crew') return b; // refreshed from assignments
        const match = prev.find(p => p.heading === b.heading);
        return match || b;
      });
      // keep any extra custom blocks the user added
      for (const p of prev) if (!blocks.some(b => b.heading === p.heading)) blocks.push(p);
    }
    return this.save(projectId, { title: existing?.title || def.title, blocks });
  }
}
