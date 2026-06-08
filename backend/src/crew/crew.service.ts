import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

const DATE_FIELDS = ['passportExpiry', 'visaExpiry', 'emiratesIdExpiry'];
const NUM_FIELDS = ['dayRateUsd', 'dayRateAed', 'weeklyRateUsd', 'weeklyRateAed'];

@Injectable()
export class CrewService {
  constructor(private prisma: PrismaService) {}

  list(q: any = {}) {
    const where: any = {};
    if (q.department) where.department = q.department;
    if (q.status) where.status = q.status;
    if (q.scope === 'local') where.isLocal = true;
    if (q.scope === 'abroad') where.isLocal = false;
    if (q.search) where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { role: { contains: q.search, mode: 'insensitive' } },
      { department: { contains: q.search, mode: 'insensitive' } },
    ];
    return this.prisma.crewMember.findMany({ where, orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const c = await this.prisma.crewMember.findUnique({
      where: { id },
      include: { parentSystemUser: { select: { id: true, fullName: true, email: true, role: true } } },
    });
    if (!c) throw new NotFoundException('Crew member not found');
    return c;
  }

  /** Bookings (project assignments) for a crew member, with overlap flags. */
  async availability(id: string) {
    await this.findOne(id);
    const rows = await this.prisma.productionCrew.findMany({
      where: { crewMemberId: id },
      include: { project: { select: { id: true, title: true, projectNumber: true, status: true } } },
      orderBy: { startDate: 'asc' },
    });
    const bookings = rows.map(r => ({
      id: r.id, projectId: r.projectId, project: r.project,
      role: r.role, location: r.location,
      startDate: r.startDate, endDate: r.endDate,
      dealMemoStatus: r.dealMemoStatus,
    }));
    // Flag overlaps (same crew double-booked on overlapping dates)
    const conflicts = new Set<string>();
    for (let i = 0; i < bookings.length; i++) {
      for (let j = i + 1; j < bookings.length; j++) {
        const a = bookings[i], b = bookings[j];
        if (!a.startDate || !a.endDate || !b.startDate || !b.endDate) continue;
        if (a.startDate <= b.endDate && b.startDate <= a.endDate) { conflicts.add(a.id); conflicts.add(b.id); }
      }
    }
    const now = new Date();
    return {
      bookings: bookings.map(b => ({ ...b, conflict: conflicts.has(b.id) })),
      activeCount: bookings.filter(b => b.endDate && b.endDate >= now).length,
      conflictCount: conflicts.size,
    };
  }

  departments() {
    return this.prisma.crewMember.findMany({ select: { department: true }, distinct: ['department'] })
      .then(rows => rows.map(r => r.department).filter(Boolean));
  }

  private clean(data: any) {
    const out: any = {};
    for (const [k, v] of Object.entries(data)) {
      if (k === 'id' || k === 'createdAt' || k === 'updatedAt') continue;
      if (v === '' || v === undefined) { out[k] = null; continue; }
      if (DATE_FIELDS.includes(k)) out[k] = v ? new Date(v as string) : null;
      else if (NUM_FIELDS.includes(k)) out[k] = v === null ? null : Number(v);
      else if (k === 'isLocal') out[k] = !!v;
      else out[k] = v;
    }
    return out;
  }

  create(data: any) { return this.prisma.crewMember.create({ data: this.clean(data) }); }
  async update(id: string, data: any) { await this.findOne(id); return this.prisma.crewMember.update({ where: { id }, data: this.clean(data) }); }
  remove(id: string) { return this.prisma.crewMember.delete({ where: { id } }); }

  /**
   * Paste-a-profile importer — turn a pasted crew profile (e.g. a CV blurb or a
   * directory listing the person shared) into structured fields for REVIEW.
   * Suggestion-only: returns parsed data; the user confirms before any save.
   * Intended for the user's own roster / crew who consent — not bulk scraping.
   */
  async parseProfile(text: string) {
    if (!text || text.trim().length < 10) throw new BadRequestException('Paste the crew member profile text first.');
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new BadRequestException('AI not configured. Set ANTHROPIC_API_KEY in the backend .env.');
    const model = process.env.LABOR_AI_MODEL || 'claude-3-5-sonnet-20241022';
    const instruction =
      'You extract a film crew member profile into STRICT JSON (no prose, no markdown). ' +
      'Keys: name (string), department (primary, UPPERCASE e.g. PRODUCTION|CAMERA|ART|LOCATIONS|…|null), ' +
      'role (primary job title|null), categories (array of {department, role} for ALL their listed roles), ' +
      'nationality (string, comma-join if several|null), phone (string|null), phone2 (string|null), email (string|null), ' +
      'bio (their description paragraph|null), skills (special skills & experience, newline-joined|null), ' +
      'links (array of {label, url} from weblinks — IMDB, showreel, website, socials), ' +
      'credits (array of {year (string|null), title, role|null} — their filmography / previous work), ' +
      'affiliations (array of strings — e.g. "Emirati Crew & Talent","International Productions Experience"), ' +
      'confidence (0-1). Use null/empty arrays when unknown. Do NOT invent data.\n\nPROFILE TEXT:\n' + text.slice(0, 12000);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 2048, messages: [{ role: 'user', content: [{ type: 'text', text: instruction }] }] }),
    } as any);
    if (!res.ok) { const t = await res.text().catch(() => ''); throw new BadRequestException(`AI parse failed (HTTP ${res.status}). ${t.slice(0, 160)}`); }
    const data: any = await res.json();
    let out = (data?.content?.[0]?.text || '').trim();
    const fence = out.match(/```(?:json)?\s*([\s\S]*?)```/i); if (fence) out = fence[1].trim();
    const s = out.indexOf('{'), e = out.lastIndexOf('}');
    if (s >= 0 && e > s) out = out.slice(s, e + 1);
    try { return { suggestion: JSON.parse(out) }; } catch { return { suggestion: {} }; }
  }

  // ── ERP identity link (V1.2 — doc system/05 §1) ─────────────────────────────────
  /** Active parent-system users available to map onto a crew record. */
  async availableParentUsers(search?: string) {
    const where: any = { isActive: true };
    if (search) where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
    return this.prisma.user.findMany({
      where, orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true, email: true, role: true },
    });
  }

  /** Link (or unlink with null) this crew member to a parent ERP user. */
  async linkParentUser(id: string, parentSystemUserId: string | null) {
    await this.findOne(id);
    if (parentSystemUserId) {
      const u = await this.prisma.user.findUnique({ where: { id: parentSystemUserId } });
      if (!u) throw new NotFoundException('Parent user not found');
      if (!u.isActive) throw new NotFoundException('Parent user is inactive');
    }
    return this.prisma.crewMember.update({
      where: { id },
      data: { parentSystemUserId: parentSystemUserId || null },
      include: { parentSystemUser: { select: { id: true, fullName: true, email: true, role: true } } },
    });
  }

  /**
   * THE access rule. A crew member reaches the ERP ledger ONLY when linked to an
   * active parent user. Null link = portal/payroll person, zero ledger access.
   * Used by ledger/PO/cost-report guards to authorize a crew-context action.
   */
  async hasErpAccess(crewMemberId: string): Promise<boolean> {
    const c = await this.prisma.crewMember.findUnique({
      where: { id: crewMemberId },
      select: { parentSystemUser: { select: { isActive: true } } },
    });
    return !!c?.parentSystemUser?.isActive;
  }
}
