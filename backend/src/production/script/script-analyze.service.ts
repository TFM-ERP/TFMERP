import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

/**
 * SYS-13b · P6 — Analyze (local heuristic, $0).
 * Reads a revision's captured pageText + parsed scenes and derives a script breakdown entirely
 * on-machine — NO external/paid AI. Produces scene/format/day-night distribution, page-eighths,
 * a speaking-character table (line counts + scene span), location list, and dialogue/action mix.
 * Also hosts browser-recorded audio notes (voice memos) per revision.
 */
@Injectable()
export class ScriptAnalyzeService {
  constructor(private prisma: PrismaService) {}

  // A cue line: an ALL-CAPS name on its own line (allow (V.O.)/(O.S.)/(CONT'D) suffixes).
  private readonly CUE_RE = /^\s*([A-Z][A-Z0-9 .'\-]{1,30})(\s*\((?:V\.?O\.?|O\.?S\.?|CONT'?D|PRE-?LAP)\.?\))?\s*$/;
  private readonly NON_CUE = new Set(['INT', 'EXT', 'CUT TO', 'FADE IN', 'FADE OUT', 'DISSOLVE TO', 'SMASH CUT', 'CONTINUED', 'THE END', 'TITLE', 'SUPER', 'INTERCUT', 'MONTAGE', 'OMITTED']);

  async analyze(revisionId: string) {
    const rev = await this.prisma.scriptRevision.findUnique({
      where: { id: revisionId },
      include: { scenes: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!rev) throw new NotFoundException('Revision not found.');
    const pages: { page: number; text: string }[] = (rev.pageText as any[]) || [];
    const scenes = rev.scenes;

    // ── Format & day/night distribution from sluglines ─────────────────────────
    const fmt: Record<string, number> = { INT: 0, EXT: 0, 'INT/EXT': 0, OTHER: 0 };
    const dn: Record<string, number> = {};
    const locationCount: Record<string, number> = {};
    for (const s of scenes) {
      const ie = (s.intExt || 'OTHER').toUpperCase();
      fmt[ie in fmt ? ie : 'OTHER'] += 1;
      const d = (s.dayNight || 'UNSPEC').toUpperCase();
      dn[d] = (dn[d] || 0) + 1;
      const loc = this.locationName(s.slugline || '');
      if (loc) locationCount[loc] = (locationCount[loc] || 0) + 1;
    }

    // ── Page-eighths (rough): a scene spans (pageEnd - pageStart + 1) pages → ×8 ──
    let eighths = 0;
    for (const s of scenes) eighths += Math.max(1, (s.pageEnd - s.pageStart + 1)) * 8;

    // ── Characters: scan cue lines per page, attribute to the current scene ──────
    type Ch = { name: string; lines: number; scenes: Set<string> };
    const chars = new Map<string, Ch>();
    // Build a page → sceneNumber lookup using scene page ranges (first scene covering the page).
    const sceneForPage = (p: number) => {
      const hit = scenes.find((s) => s.pageStart <= p && s.pageEnd >= p);
      return hit?.sceneNumber || hit?.slugline || `p${p}`;
    };
    let dialogueLines = 0, actionLines = 0;
    for (const pg of pages) {
      const sc = sceneForPage(pg.page);
      for (const raw of (pg.text || '').split('\n')) {
        const line = raw.trim();
        if (!line) continue;
        const m = line.match(this.CUE_RE);
        const name = m ? m[1].trim().replace(/\s+/g, ' ') : '';
        if (m && name.length >= 2 && !this.NON_CUE.has(name) && !/^\d/.test(name) && name.split(' ').length <= 4) {
          dialogueLines += 1;
          let c = chars.get(name);
          if (!c) { c = { name, lines: 0, scenes: new Set() }; chars.set(name, c); }
          c.lines += 1; c.scenes.add(String(sc));
        } else {
          actionLines += 1;
        }
      }
    }
    const characters = [...chars.values()]
      .map((c) => ({ name: c.name, cues: c.lines, scenes: c.scenes.size }))
      .sort((a, b) => b.cues - a.cues);

    // ── Largest scenes by page span ──────────────────────────────────────────────
    const largestScenes = [...scenes]
      .map((s) => ({ sceneNumber: s.sceneNumber, slugline: s.slugline, pages: Math.max(1, s.pageEnd - s.pageStart + 1) }))
      .sort((a, b) => b.pages - a.pages).slice(0, 8);

    const locations = Object.entries(locationCount).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

    return {
      revisionLabel: rev.revisionLabel,
      totals: {
        pages: rev.pageCount,
        scenes: scenes.length,
        eighths,
        speakingRoles: characters.length,
        locations: locations.length,
      },
      format: fmt,
      dayNight: dn,
      dialogueActionRatio: { dialogue: dialogueLines, action: actionLines, pctDialogue: dialogueLines + actionLines ? Math.round((dialogueLines / (dialogueLines + actionLines)) * 100) : 0 },
      characters,
      locations,
      largestScenes,
      note: 'Computed locally on-machine — no external AI. Heuristic; verify against a manual breakdown.',
    };
  }

  /** "INT. WAREHOUSE - NIGHT" → "WAREHOUSE". Strips format prefix + day/night suffix. */
  private locationName(slug: string): string {
    let s = slug.replace(/^\s*(INT\.?\/EXT\.?|I\/E\.?|INT\.?|EXT\.?)\s*/i, '');
    s = s.split(/\s+[-–—]\s+/)[0]; // before " - DAY"
    return s.trim().toUpperCase().slice(0, 60);
  }

  // ── Audio notes ─────────────────────────────────────────────────────────────────
  listAudio(revisionId: string) {
    return this.prisma.scriptAudioNote.findMany({ where: { revisionId }, orderBy: { createdAt: 'desc' } });
  }
  async addAudio(revisionId: string, fileUrl: string, body: any, userId?: string) {
    const rev = await this.prisma.scriptRevision.findUnique({ where: { id: revisionId }, select: { id: true } });
    if (!rev) throw new NotFoundException('Revision not found.');
    return this.prisma.scriptAudioNote.create({
      data: {
        revisionId, audioUrl: fileUrl,
        page: body?.page != null ? Number(body.page) : null,
        label: body?.label || null,
        durationSec: body?.durationSec != null ? Math.round(Number(body.durationSec)) : null,
        createdById: userId || null,
      },
    });
  }
  removeAudio(id: string) { return this.prisma.scriptAudioNote.delete({ where: { id } }); }
}
