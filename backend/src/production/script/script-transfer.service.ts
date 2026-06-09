import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-13 · D3 — Text-anchoring note transfer + script compare.
 * On a new revision, every annotation's captured `anchorText` is matched into the new draft's
 * per-page text with a Normalized Levenshtein score; a positive match (NL ≥ 0.92) re-maps the
 * note to its new page + proportional position. Unmatched notes are carried over flagged as
 * orphans (`conflict = true`) for manual placement.
 */
@Injectable()
export class ScriptTransferService {
  constructor(private prisma: PrismaService) {}

  private readonly THRESHOLD = 0.92;

  // ── String distance ────────────────────────────────────────────────────────────
  private levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    if (!m) return n; if (!n) return m;
    let prev = new Array(n + 1);
    for (let j = 0; j <= n; j++) prev[j] = j;
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      prev = cur;
    }
    return prev[n];
  }
  private nl(a: string, b: string): number {
    if (!a && !b) return 1;
    const d = this.levenshtein(a, b);
    return 1 - d / Math.max(a.length, b.length, 1);
  }
  private norm(s: string) { return s.replace(/\s+/g, ' ').trim().toLowerCase(); }

  /** Best match of `anchor` across the target pages: scans lines + consecutive-line pairs. */
  private bestMatch(anchor: string, pages: { page: number; text: string }[]) {
    const a = this.norm(anchor);
    if (!a) return null;
    let best = { page: 1, lineIndex: 0, lineCount: 1, nl: 0 };
    for (const pg of pages) {
      const lines = pg.text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const single = this.norm(lines[i]);
        const pair = this.norm(`${lines[i]} ${lines[i + 1] || ''}`);
        const score = Math.max(this.nl(a, single), this.nl(a, pair));
        if (score > best.nl) best = { page: pg.page, lineIndex: i, lineCount: lines.length || 1, nl: score };
      }
    }
    return best;
  }

  // ── Transfer ─────────────────────────────────────────────────────────────────
  async transfer(sourceRevisionId: string, targetRevisionId: string, userId?: string) {
    if (sourceRevisionId === targetRevisionId) throw new BadRequestException('Source and target revisions must differ.');
    const [source, target] = await Promise.all([
      this.prisma.scriptRevision.findUnique({ where: { id: sourceRevisionId } }),
      this.prisma.scriptRevision.findUnique({ where: { id: targetRevisionId } }),
    ]);
    if (!source || !target) throw new NotFoundException('Revision not found.');

    const annos = await this.prisma.annotation.findMany({ where: { revisionId: sourceRevisionId } });
    const pages = (target.pageText as any[]) || [];

    let transferred = 0, orphaned = 0;
    for (const a of annos) {
      let page = a.page, x = a.x, y = a.y, conflict = false;
      const match = a.anchorText ? this.bestMatch(a.anchorText, pages) : null;
      if (match && match.nl >= this.THRESHOLD) {
        page = match.page;
        y = match.lineCount > 1 ? Math.min(0.97, match.lineIndex / match.lineCount) : a.y; // proportional re-flow
        transferred++;
      } else {
        conflict = true; // orphan — keep old coords, flag for placement
        orphaned++;
      }
      await this.prisma.annotation.create({
        data: {
          layerId: a.layerId, revisionId: targetRevisionId, documentId: target.documentId,
          page, tool: a.tool, payload: a.payload ?? undefined,
          anchorText: a.anchorText, anchorHash: a.anchorHash, anchorOffset: a.anchorOffset, surroundingContext: a.surroundingContext,
          x, y, w: a.w, h: a.h, associatedLineItemId: a.associatedLineItemId, conflict, createdById: userId || a.createdById,
        },
      });
    }
    return { total: annos.length, transferred, orphaned, matchThreshold: this.THRESHOLD };
  }

  /** Orphans on a revision — transferred notes that didn't find their text. */
  orphans(revisionId: string) {
    return this.prisma.annotation.findMany({
      where: { revisionId, conflict: true },
      include: { layer: { select: { name: true, color: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Place an orphan: set coords + page, clear the conflict flag. */
  async placeOrphan(id: string, body: any) {
    return this.prisma.annotation.update({
      where: { id },
      data: { page: Number(body.page) || 1, x: Number(body.x) || 0, y: Number(body.y) || 0, conflict: false },
    });
  }

  // ── Compare scripts ─────────────────────────────────────────────────────────────
  async compare(revAId: string, revBId: string) {
    const [a, b] = await Promise.all([
      this.prisma.scriptScene.findMany({ where: { revisionId: revAId }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.scriptScene.findMany({ where: { revisionId: revBId }, orderBy: { sortOrder: 'asc' } }),
    ]);
    const key = (s: any) => (s.sceneNumber || s.slugline || '').toLowerCase();
    const mapA = new Map(a.map((s) => [key(s), s]));
    const mapB = new Map(b.map((s) => [key(s), s]));
    const added: any[] = [], removed: any[] = [], moved: any[] = [], reworded: any[] = [], unchanged: any[] = [];
    for (const s of b) { if (!mapA.has(key(s))) added.push({ sceneNumber: s.sceneNumber, slugline: s.slugline, page: s.pageStart }); }
    for (const s of a) {
      const t = mapB.get(key(s));
      if (!t) { removed.push({ sceneNumber: s.sceneNumber, slugline: s.slugline, page: s.pageStart }); continue; }
      if (this.norm(s.slugline || '') !== this.norm(t.slugline || '')) reworded.push({ sceneNumber: s.sceneNumber, from: s.slugline, to: t.slugline });
      else if (s.pageStart !== t.pageStart) moved.push({ sceneNumber: s.sceneNumber, slugline: s.slugline, fromPage: s.pageStart, toPage: t.pageStart });
      else unchanged.push({ sceneNumber: s.sceneNumber });
    }
    return {
      summary: { added: added.length, removed: removed.length, moved: moved.length, reworded: reworded.length, unchanged: unchanged.length },
      added, removed, moved, reworded,
    };
  }
}
