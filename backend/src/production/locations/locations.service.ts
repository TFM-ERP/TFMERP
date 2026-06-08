import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { readFileSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { parseMsg } from './msg-parser';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LedgerService } from '../ledger/ledger.service';
import { LocationsLibraryService } from '../../locations-library/locations-library.service';
import { LocationOpsService } from '../../locations-library/location-ops.service';
import { WorkflowService } from '../../workflow/workflow.service';

@Injectable()
export class LocationsService {
  constructor(
    private prisma: PrismaService,
    private ledger: LedgerService,
    private library: LocationsLibraryService,
    private ops: LocationOpsService,
    private workflow: WorkflowService,
  ) {}

  // ── SYS-07 slice 7 — project-scoped security & payments (delegate CRUD to the
  //    shared ops service; ledger posting stays here where LedgerService lives) ──
  authorities() { return this.ops.listAuthorities(); }

  listSecurity(id: string) { return this.ops.listSecurity('project', id); }
  createSecurity(id: string, b: any, userId?: string) { return this.ops.createSecurity('project', id, b, userId); }
  updateSecurity(sid: string, b: any) { return this.ops.updateSecurity(sid, b); }
  removeSecurity(sid: string) { return this.ops.removeSecurity(sid); }
  /** Post a security arrangement's cost to the project ledger. */
  async postSecurityCost(sid: string, userId?: string) {
    const s = await this.prisma.locationSecurity.findUnique({ where: { id: sid }, include: { location: true } });
    if (!s || !s.location) throw new NotFoundException('Security record (project) not found');
    const amount = Math.round(Number(s.totalCost || 0) * 100) / 100;
    if (amount <= 0) throw new BadRequestException('Set a total cost (or guards × rate × days) first.');
    const txn = await this.ledger.create({
      projectId: s.location.projectId, kind: 'COST', date: new Date(), category: 'Location',
      description: `Location security — ${s.location.name}${s.company ? ` (${s.company})` : ''} · ${s.guards} guard(s)/${s.marshals} marshal(s)`,
      party: s.company || 'Security vendor', amount, taxAmount: 0, status: 'APPROVED', currency: s.currency || 'AED',
    }, userId);
    await this.prisma.locationSecurity.update({ where: { id: sid }, data: { postedTxnId: txn.id, status: 'CONFIRMED' } });
    await this.accrueToMaster(s.location.masterLocationId);
    return { posted: true, amount, transactionId: txn.id };
  }

  /** Guess a document category from a filename / subject. */
  private guessDocCategory(name: string): string {
    const s = (name || '').toLowerCase();
    if (/no.?objection|\bnoc\b/.test(s)) return 'NOC';
    if (/agreement|contract|\btcs?\b|terms/.test(s)) return 'LOCATION_AGREEMENT';
    if (/release/.test(s)) return 'RELEASE';
    if (/insurance|\bpll\b|liability|\bcoi\b/.test(s)) return 'INSURANCE';
    if (/risk.?assessment/.test(s)) return 'RISK_ASSESSMENT';
    if (/method.?statement/.test(s)) return 'METHOD_STATEMENT';
    if (/location.?guide|locations?.?guide|guide|pack/.test(s)) return 'LOCATION_GUIDE';
    if (/permit/.test(s)) return 'PERMIT_DOC';
    if (/quote|quotation|invoice|\bpo[-_ ]/.test(s)) return 'QUOTE';
    if (/emirates.?id|\beid\b|passport|licen[cs]e|trade.?licen/.test(s)) return 'ID_DOCUMENT';
    return 'OTHER';
  }

  /**
   * Email intake — parse an uploaded Outlook .msg, file the email + its attachments
   * into the location document vault. Works for a project or master location.
   */
  async importEmail(scope: 'project' | 'master', id: string, file: any, userId?: string) {
    if (!file) throw new BadRequestException('No .msg file uploaded.');
    let parsed;
    try { parsed = parseMsg(readFileSync(file.path)); }
    catch (e: any) { throw new BadRequestException(`Could not read the .msg: ${e?.message || e}`); }

    const saveBuf = (data: Buffer, original: string) => {
      const ext = extname(original || '') || '.bin';
      const fn = `${randomUUID()}${ext}`;
      writeFileSync(join(process.cwd(), 'uploads', fn), data);
      return `/uploads/${fn}`;
    };
    const created: any[] = [];
    const party = parsed.from || parsed.fromEmail || null;

    // The email itself (keep the original .msg as the file)
    const emailDoc = await this.ops.createDocument(scope, id, {
      category: this.guessDocCategory(parsed.subject || ''), title: parsed.subject || file.originalname || 'Email',
      status: 'RECEIVED', partyName: party, notes: parsed.body ? parsed.body.slice(0, 1500) : null,
      fileUrl: `/uploads/${file.filename}`,
    }, userId);
    created.push(emailDoc);

    // Each attachment as its own categorised document
    for (const att of parsed.attachments || []) {
      if (!att.data?.length) continue;
      if (/\.(png|jpg|jpeg|gif|bmp)$/i.test(att.filename) && att.data.length < 25000) continue; // skip inline signature images
      const url = saveBuf(att.data, att.filename);
      created.push(await this.ops.createDocument(scope, id, {
        category: this.guessDocCategory(att.filename), title: att.filename, status: 'RECEIVED',
        partyName: party, fileUrl: url,
      }, userId));
    }
    return { imported: true, subject: parsed.subject, from: party, documents: created.length, attachments: (parsed.attachments || []).length };
  }

  listPayments(id: string) { return this.ops.listPayments('project', id); }
  paymentSummary(id: string) { return this.ops.paymentSummary('project', id); }
  createPayment(id: string, b: any, userId?: string) { return this.ops.createPayment('project', id, b, userId); }
  updatePayment(pid: string, b: any) { return this.ops.updatePayment(pid, b); }
  removePayment(pid: string) { return this.ops.removePayment(pid); }
  /** Pay a scheduled location payment → post to the ledger + mark paid. */
  async payPayment(payId: string, userId?: string) {
    const p = await this.prisma.locationPayment.findUnique({ where: { id: payId }, include: { location: true } });
    if (!p || !p.location) throw new NotFoundException('Payment (project) not found');
    if (p.status === 'PAID') return p;
    const amount = Math.round(Number(p.amount || 0) * 100) / 100;
    if (amount <= 0) throw new BadRequestException('Payment amount must be greater than zero.');
    const txn = await this.ledger.create({
      projectId: p.location.projectId, kind: 'COST', date: new Date(), category: 'Location',
      description: `Location ${String(p.kind).toLowerCase()} — ${p.location.name}${p.description ? ` (${p.description})` : ''}`,
      party: p.payeeName || p.location.ownerContactName || p.location.name,
      amount, taxAmount: 0, status: 'APPROVED', currency: p.currency || 'AED',
    }, userId);
    await this.ops.markPaid(payId, txn.id);
    await this.accrueToMaster(p.location.masterLocationId);
    return { paid: true, amount, transactionId: txn.id };
  }

  /** After any location cost posts, refresh the linked master library aggregates. */
  private async accrueToMaster(masterLocationId?: string | null) {
    if (masterLocationId) await this.library.recomputeHistory(masterLocationId).catch(() => {});
  }

  list(projectId: string) {
    return this.prisma.location.findMany({ where: { projectId }, orderBy: [{ status: 'asc' }, { name: 'asc' }] });
  }
  get(id: string) { return this.prisma.location.findUnique({ where: { id } }); }

  private clean(data: any) {
    const out: any = {};
    const DATES = ['permitExpiry', 'shootStart', 'shootEnd'];
    const SKIP = ['id', 'projectId', 'project', 'createdAt', 'updatedAt', 'masterLocation'];
    for (const [k, v] of Object.entries(data || {})) {
      if (SKIP.includes(k)) continue;
      if (v === '' ) { out[k] = null; continue; }
      if (DATES.includes(k)) out[k] = v ? new Date(v as string) : null;
      else out[k] = v;
    }
    return out;
  }

  async create(projectId: string, data: any) {
    // Idempotency for the offline PWA queue: reuse a client-minted cuid if provided.
    if (data?.clientId) {
      const existing = await this.prisma.location.findUnique({ where: { id: data.clientId } });
      if (existing) return existing;
    }
    const { clientId, ...rest } = data || {};
    return this.prisma.location.create({ data: { id: clientId || undefined, projectId, name: rest.name || 'Location', ...this.clean(rest) } });
  }
  async update(id: string, data: any) {
    const exists = await this.prisma.location.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException();
    return this.prisma.location.update({ where: { id }, data: this.clean(data) });
  }
  remove(id: string) { return this.prisma.location.delete({ where: { id } }); }

  /** Post a location fee (fee/day × days) as a coded production cost. */
  async postFee(id: string, days: number, userId?: string) {
    const loc = await this.prisma.location.findUnique({ where: { id } });
    if (!loc) throw new NotFoundException();
    const fee = Number(loc.locationFeePerDay || 0);
    const d = Number(days) || 0;
    if (fee <= 0 || d <= 0) throw new BadRequestException('Set a location fee/day and a number of days.');
    const amount = Math.round(fee * d * 100) / 100;

    // find a budget account that looks like "locations" (else leave uncoded for the accountant to tag)
    const version = await this.prisma.budgetVersion.findFirst({
      where: { projectId: loc.projectId, isActive: true },
      include: { sections: { include: { accounts: true } } },
    });
    let accountCode: string | null = null, accountTitle: string | null = null;
    for (const s of version?.sections || []) for (const a of s.accounts) {
      if (/location/i.test(a.title)) { accountCode = a.code; accountTitle = a.title; break; }
    }

    const txn = await this.ledger.create({
      projectId: loc.projectId, kind: 'COST', date: new Date(),
      accountCode, accountTitle, category: 'Location',
      description: `Location fee — ${loc.name}${loc.emirate ? `, ${loc.emirate}` : ''} (${d} day${d > 1 ? 's' : ''} × ${fee})`,
      party: loc.ownerContactName || loc.name,
      amount, taxAmount: 0, status: 'APPROVED', currency: loc.currency || 'AED',
    }, userId);
    await this.accrueToMaster(loc.masterLocationId);
    return { posted: true, amount, transactionId: txn.id, coded: !!accountCode };
  }

  /** Post an arbitrary location cost (permit fee, ad-hoc charge) to the ledger + accrue. */
  async postCost(id: string, body: { amount: number; description?: string; party?: string }, userId?: string) {
    const loc = await this.prisma.location.findUnique({ where: { id } });
    if (!loc) throw new NotFoundException();
    const amount = Math.round(Number(body?.amount || 0) * 100) / 100;
    if (amount <= 0) throw new BadRequestException('Amount must be greater than zero.');

    const version = await this.prisma.budgetVersion.findFirst({
      where: { projectId: loc.projectId, isActive: true },
      include: { sections: { include: { accounts: true } } },
    });
    let accountCode: string | null = null, accountTitle: string | null = null;
    for (const s of version?.sections || []) for (const a of s.accounts) {
      if (/location/i.test(a.title)) { accountCode = a.code; accountTitle = a.title; break; }
    }
    const txn = await this.ledger.create({
      projectId: loc.projectId, kind: 'COST', date: new Date(),
      accountCode, accountTitle, category: 'Location',
      description: body?.description || `Location cost — ${loc.name}`,
      party: body?.party || loc.ownerContactName || loc.name,
      amount, taxAmount: 0, status: 'APPROVED', currency: loc.currency || 'AED',
    }, userId);
    await this.accrueToMaster(loc.masterLocationId);
    return { posted: true, amount, transactionId: txn.id, coded: !!accountCode };
  }

  // ── Permits ────────────────────────────────────────────────────────────────
  listPermits(locationId: string) {
    return this.prisma.locationPermit.findMany({ where: { locationId }, orderBy: { createdAt: 'desc' } });
  }
  async createPermit(locationId: string, data: any, userId?: string) {
    const loc = await this.prisma.location.findUnique({ where: { id: locationId }, select: { id: true } });
    if (!loc) throw new NotFoundException('Location not found');
    return this.prisma.locationPermit.create({ data: { ...this.cleanPermit(data), locationId, createdById: userId || null } });
  }
  async updatePermit(id: string, data: any) {
    const e = await this.prisma.locationPermit.findUnique({ where: { id }, select: { id: true } });
    if (!e) throw new NotFoundException('Permit not found');
    return this.prisma.locationPermit.update({ where: { id }, data: this.cleanPermit(data) });
  }
  removePermit(id: string) { return this.prisma.locationPermit.delete({ where: { id } }); }

  /** Route a permit through the universal approval engine (LOCATION entity). */
  async submitPermitForApproval(id: string, userId?: string) {
    const permit = await this.prisma.locationPermit.findUnique({
      where: { id }, include: { location: { select: { projectId: true, name: true } } },
    });
    if (!permit) throw new NotFoundException('Permit not found');
    const inst = await this.workflow.start({
      entityType: 'LOCATION', entityId: permit.id, projectId: permit.location.projectId,
      label: `Permit ${permit.type} — ${permit.location.name}`,
    }, userId);
    await this.prisma.locationPermit.update({ where: { id }, data: { status: 'IN_REVIEW' } });
    return { submitted: true, instanceId: inst.id };
  }

  /** Latest workflow instances for a permit (for the UI timeline). */
  permitWorkflow(id: string) { return this.workflow.forEntity('LOCATION', id); }

  private cleanPermit(data: any) {
    const out: any = {};
    const DATES = ['applicationDate', 'approvalDate', 'expiryDate'];
    const SKIP = ['id', 'locationId', 'location', 'createdAt', 'updatedAt', 'createdById'];
    for (const [k, v] of Object.entries(data || {})) {
      if (SKIP.includes(k)) continue;
      if (v === '') { out[k] = null; continue; }
      if (DATES.includes(k)) out[k] = v ? new Date(v as string) : null;
      else out[k] = v;
    }
    return out;
  }

  /** OCR a permit document (Anthropic vision) → suggested fields for review (never auto-saved). */
  async ocrPermit(file: any) {
    if (!file) throw new BadRequestException('No file uploaded.');
    const ext = await this.extractPermitFields(file.path, file.mimetype);
    return { url: `/uploads/${file.filename}`, suggestion: ext };
  }

  private async extractPermitFields(filePath: string, mime: string): Promise<any> {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new BadRequestException('OCR not configured. Set ANTHROPIC_API_KEY in the backend .env.');
    const model = process.env.LABOR_AI_MODEL || 'claude-3-5-sonnet-20241022';
    const b64 = readFileSync(filePath).toString('base64');
    const isPdf = /pdf$/i.test(mime || '') || filePath.toLowerCase().endsWith('.pdf');
    const mediaBlock = isPdf
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } }
      : { type: 'image', source: { type: 'base64', media_type: mime || 'image/jpeg', data: b64 } };
    const instruction =
      'You are a film-permit OCR assistant. Read this location/filming permit and return ONLY strict JSON ' +
      '(no prose, no markdown) with keys: type (permit type e.g. "FILMING","DRONE","ROAD_CLOSURE"|null), ' +
      'authority (issuing body|null), jurisdiction (country/city/emirate|null), referenceNumber (string|null), ' +
      'applicationDate (YYYY-MM-DD|null), approvalDate (YYYY-MM-DD|null), expiryDate (YYYY-MM-DD|null), ' +
      'fee (number|null), currency (ISO code|null), conditions (short text of restrictions|null), confidence (0-1).';
    const headers: any = { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
    if (isPdf) headers['anthropic-beta'] = 'pdfs-2024-09-25';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers,
      body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content: [mediaBlock, { type: 'text', text: instruction }] }] }),
    } as any);
    if (!res.ok) { const t = await res.text().catch(() => ''); throw new BadRequestException(`OCR failed (HTTP ${res.status}). ${t.slice(0, 180)}`); }
    const data: any = await res.json();
    let text = (data?.content?.[0]?.text || '').trim();
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i); if (fence) text = fence[1].trim();
    const s = text.indexOf('{'), e = text.lastIndexOf('}');
    if (s >= 0 && e > s) text = text.slice(s, e + 1);
    try { return JSON.parse(text); } catch { return {}; }
  }

  // ── Risk register ──────────────────────────────────────────────────────────
  listRisks(locationId: string) {
    return this.prisma.locationRisk.findMany({ where: { locationId }, orderBy: [{ status: 'asc' }, { riskScore: 'desc' }] });
  }
  async createRisk(locationId: string, data: any, userId?: string) {
    const loc = await this.prisma.location.findUnique({ where: { id: locationId }, select: { id: true } });
    if (!loc) throw new NotFoundException('Location not found');
    const d = this.cleanRisk(data);
    return this.prisma.locationRisk.create({ data: { ...d, locationId, createdById: userId || null } });
  }
  async updateRisk(id: string, data: any) {
    const e = await this.prisma.locationRisk.findUnique({ where: { id }, select: { id: true } });
    if (!e) throw new NotFoundException('Risk not found');
    return this.prisma.locationRisk.update({ where: { id }, data: this.cleanRisk(data) });
  }
  removeRisk(id: string) { return this.prisma.locationRisk.delete({ where: { id } }); }

  private cleanRisk(data: any) {
    const out: any = {};
    const SKIP = ['id', 'locationId', 'location', 'createdAt', 'updatedAt', 'createdById', 'riskScore'];
    for (const [k, v] of Object.entries(data || {})) {
      if (SKIP.includes(k)) continue;
      if (v === '') { out[k] = null; continue; }
      out[k] = v;
    }
    const likelihood = Math.min(5, Math.max(1, Number(out.likelihood ?? 1)));
    const impact = Math.min(5, Math.max(1, Number(out.impact ?? 1)));
    out.likelihood = likelihood;
    out.impact = impact;
    out.riskScore = likelihood * impact; // 1..25
    return out;
  }

  // ── SYS-07 slice 6 — Document vault (NOC / agreement / insurance / guide…) ──
  listDocuments(locationId: string) {
    return this.prisma.locationDocument.findMany({ where: { locationId }, orderBy: [{ category: 'asc' }, { createdAt: 'desc' }] });
  }
  async createDocument(locationId: string, data: any, userId?: string) {
    const loc = await this.prisma.location.findUnique({ where: { id: locationId }, select: { id: true } });
    if (!loc) throw new NotFoundException('Location not found');
    if (!data?.title) throw new BadRequestException('title is required');
    return this.prisma.locationDocument.create({ data: { ...this.cleanDoc(data), locationId, createdById: userId || null } });
  }
  async updateDocument(id: string, data: any) {
    const e = await this.prisma.locationDocument.findUnique({ where: { id }, select: { id: true } });
    if (!e) throw new NotFoundException('Document not found');
    return this.prisma.locationDocument.update({ where: { id }, data: this.cleanDoc(data) });
  }
  removeDocument(id: string) { return this.prisma.locationDocument.delete({ where: { id } }); }

  private cleanDoc(data: any) {
    const out: any = {};
    const DATES = ['issueDate', 'signedDate', 'expiryDate'];
    const SKIP = ['id', 'locationId', 'location', 'createdAt', 'updatedAt', 'createdById'];
    for (const [k, v] of Object.entries(data || {})) {
      if (SKIP.includes(k)) continue;
      if (v === '') { out[k] = null; continue; }
      if (DATES.includes(k)) out[k] = v ? new Date(v as string) : null;
      else out[k] = v;
    }
    return out;
  }

  /** Upload a document file (+ optional OCR for permits/insurance/NOC). */
  async uploadDocument(locationId: string, file: any, body: any, userId?: string) {
    if (!file) throw new BadRequestException('No file uploaded.');
    const url = `/uploads/${file.filename}`;
    let ocrData: any = null;
    if (body?.ocr === 'true' || body?.ocr === true) {
      ocrData = await this.extractPermitFields(file.path, file.mimetype).catch(() => null);
    }
    return this.createDocument(locationId, {
      category: body?.category || 'OTHER', title: body?.title || file.originalname,
      status: body?.status || 'RECEIVED', language: body?.language || 'EN',
      partyName: body?.partyName, authority: body?.authority, refNumber: ocrData?.referenceNumber || body?.refNumber,
      expiryDate: ocrData?.expiryDate || body?.expiryDate || null, fileUrl: url, ocrData,
    }, userId);
  }

  /** Compliance summary — is this location clear to confirm? (agreement signed + valid insurance + NOC) */
  async compliance(locationId: string) {
    const docs = await this.prisma.locationDocument.findMany({ where: { locationId } });
    const now = new Date();
    const has = (cat: string, ok: (d: any) => boolean) => docs.some((d) => d.category === cat && ok(d));
    const agreementSigned = has('LOCATION_AGREEMENT', (d) => d.status === 'SIGNED');
    const insuranceValid = has('INSURANCE', (d) => ['RECEIVED', 'SIGNED', 'ISSUED'].includes(d.status) && (!d.expiryDate || new Date(d.expiryDate) > now));
    const nocReady = has('NOC', (d) => ['SIGNED', 'ISSUED', 'RECEIVED'].includes(d.status));
    const expiring = docs.filter((d) => d.expiryDate && new Date(d.expiryDate) > now && (new Date(d.expiryDate).getTime() - now.getTime()) < 30 * 864e5)
      .map((d) => ({ id: d.id, title: d.title, category: d.category, expiryDate: d.expiryDate }));
    const expired = docs.filter((d) => d.expiryDate && new Date(d.expiryDate) <= now).map((d) => ({ id: d.id, title: d.title, category: d.category, expiryDate: d.expiryDate }));
    return { agreementSigned, insuranceValid, nocReady, ready: agreementSigned && insuranceValid && nocReady, counts: docs.length, expiring, expired };
  }

  async setStage(locationId: string, stage: string) {
    const loc = await this.prisma.location.findUnique({ where: { id: locationId }, select: { id: true } });
    if (!loc) throw new NotFoundException('Location not found');
    return this.prisma.location.update({ where: { id: locationId }, data: { pipelineStage: stage as any } });
  }

  /**
   * Generate a bilingual (EN + AR) No Objection Certificate letter for a location —
   * the LM's most common artifact. Returns printable HTML (review, then print/send).
   */
  async generateNoc(locationId: string, opts: any = {}) {
    const loc = await this.prisma.location.findUnique({
      where: { id: locationId },
      include: { project: { select: { title: true } } },
    });
    if (!loc) throw new NotFoundException('Location not found');
    const company = opts.company || 'The Film Makers FZ LLC';
    const authority = opts.authority || loc.ownerContactName || 'To Whom It May Concern';
    const production = loc.project?.title || opts.production || 'the production';
    const place = [loc.name, loc.area, loc.emirate, loc.country].filter(Boolean).join(', ');
    const from = opts.fromDate ? new Date(opts.fromDate).toLocaleDateString('en-GB') : (loc.shootStart ? new Date(loc.shootStart).toLocaleDateString('en-GB') : '________');
    const to = opts.toDate ? new Date(opts.toDate).toLocaleDateString('en-GB') : (loc.shootEnd ? new Date(loc.shootEnd).toLocaleDateString('en-GB') : '________');
    const today = new Date().toLocaleDateString('en-GB');
    const ref = opts.refNumber || `NOC-${(loc.id || '').slice(-6).toUpperCase()}`;

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>NOC — ${place}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;color:#222;max-width:800px;margin:24px auto;line-height:1.6}
.h{display:flex;justify-content:space-between;border-bottom:2px solid #c3a56e;padding-bottom:8px;margin-bottom:24px}
.ar{direction:rtl;text-align:right;font-size:1.05em;border-top:1px dashed #ccc;margin-top:32px;padding-top:24px}
.muted{color:#777;font-size:.9em}.sig{margin-top:48px}@media print{button{display:none}}</style></head><body>
<button onclick="window.print()" style="background:#c3a56e;color:#fff;border:0;padding:8px 14px;border-radius:6px;cursor:pointer">Print / Save PDF</button>
<div class="h"><div><b>${company}</b><br><span class="muted">Abu Dhabi, United Arab Emirates</span></div><div class="muted">Ref: ${ref}<br>Date: ${today}</div></div>
<h3>NO OBJECTION CERTIFICATE</h3>
<p>To: <b>${authority}</b></p>
<p>This is to certify that <b>${company}</b> has no objection to filming activities being carried out by the production <b>"${production}"</b> at the following location:</p>
<p><b>${place}</b></p>
<p>The filming is scheduled to take place during the period <b>${from}</b> to <b>${to}</b>. ${company} confirms that the production will comply with all applicable local laws, safety regulations and site conditions, and will hold valid public-liability insurance for the duration of the activity.</p>
<p>This certificate is issued upon the request of the above party for whatever lawful purpose it may serve.</p>
<div class="sig"><p>Yours faithfully,</p><p>______________________<br><b>${company}</b><br>Authorised Signatory</p></div>
<div class="ar">
<h3>شهادة عدم ممانعة</h3>
<p>إلى: <b>${authority}</b></p>
<p>نفيدكم بأنه لا مانع لدى <b>${company}</b> من قيام الإنتاج <b>"${production}"</b> بأعمال التصوير في الموقع التالي:</p>
<p><b>${place}</b></p>
<p>وذلك خلال الفترة من <b>${from}</b> إلى <b>${to}</b>. وتؤكد <b>${company}</b> التزام الإنتاج بكافة القوانين المحلية وأنظمة السلامة وشروط الموقع، مع توفّر تأمين ساري المفعول ضد المسؤولية المدنية طوال مدة النشاط.</p>
<p>وقد صدرت هذه الشهادة بناءً على طلب الجهة المذكورة أعلاه لتقديمها لمن يهمه الأمر.</p>
<p>وتفضلوا بقبول فائق الاحترام،</p>
<p>______________________<br><b>${company}</b><br>المفوض بالتوقيع</p></div>
</body></html>`;
    return { html, ref };
  }
}
