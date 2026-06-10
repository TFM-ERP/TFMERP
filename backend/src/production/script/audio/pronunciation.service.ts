import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

/**
 * SYS-13c — Pronunciation dictionary. Scope cascade SCRIPT → MASTER → PROJECT → GLOBAL
 * (most specific wins). Applied to text before synthesis; bumping an entry changes the
 * effective version so the line cache invalidates.
 */
@Injectable()
export class PronunciationService {
  constructor(private prisma: PrismaService) {}

  list(q: { projectId?: string; masterScriptId?: string; revisionId?: string }) {
    return this.prisma.pronunciationEntry.findMany({
      where: {
        OR: [
          { scope: 'GLOBAL' },
          q.projectId ? { scope: 'PROJECT', projectId: q.projectId } : undefined,
          q.masterScriptId ? { scope: 'MASTER', masterScriptId: q.masterScriptId } : undefined,
          q.revisionId ? { scope: 'SCRIPT', revisionId: q.revisionId } : undefined,
        ].filter(Boolean) as any,
      },
      orderBy: [{ scope: 'asc' }, { term: 'asc' }],
    });
  }

  create(b: any, userId?: string) {
    return this.prisma.pronunciationEntry.create({ data: {
      scope: b?.scope || 'PROJECT', projectId: b?.projectId || null, masterScriptId: b?.masterScriptId || null, revisionId: b?.revisionId || null,
      term: b?.term || '', alias: b?.alias || null, ipa: b?.ipa || null, ssmlPhoneme: b?.ssmlPhoneme || null, locale: b?.locale || null,
      category: b?.category || 'OTHER', caseSensitive: !!b?.caseSensitive, createdById: userId || null,
    } });
  }
  update(id: string, b: any) {
    const d: any = {};
    for (const k of ['term', 'alias', 'ipa', 'ssmlPhoneme', 'locale', 'category', 'caseSensitive']) if (b?.[k] !== undefined) d[k] = b[k];
    return this.prisma.pronunciationEntry.update({ where: { id }, data: d });
  }
  remove(id: string) { return this.prisma.pronunciationEntry.delete({ where: { id } }); }

  /** Resolve the effective dictionary (specific scope overrides general) → {term: replacement}. */
  async resolveMap(q: { projectId?: string; masterScriptId?: string; revisionId?: string }) {
    const order = ['GLOBAL', 'PROJECT', 'MASTER', 'SCRIPT']; // later wins
    const rows = await this.list(q);
    const map = new Map<string, { replacement: string; caseSensitive: boolean }>();
    for (const sc of order) for (const r of rows.filter((x) => x.scope === sc)) {
      map.set(r.term, { replacement: r.alias || r.ssmlPhoneme || r.term, caseSensitive: r.caseSensitive });
    }
    return Object.fromEntries(map);
  }

  /** Apply the dictionary to a line of text (plain respelling). */
  applyTo(text: string, dict: Record<string, { replacement: string; caseSensitive: boolean }>) {
    let out = text;
    for (const [term, v] of Object.entries(dict)) {
      const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      out = out.replace(new RegExp(`\\b${esc}\\b`, v.caseSensitive ? 'g' : 'gi'), v.replacement);
    }
    return out;
  }
}
