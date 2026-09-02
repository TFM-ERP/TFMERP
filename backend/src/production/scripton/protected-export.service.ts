import { Injectable, BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import { writeFileSync, readFileSync, mkdtempSync, readdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ScripOnService } from './scripton.service';
import { ReviewProtectionService } from './review-protection.service';

/**
 * ScripON Review Protection — Phase 4 PDF security pipeline.
 *
 * Takes the base script HTML the reader already builds, then server-authoritatively layers protection:
 *   • a recipient-specific Copy-ID (generated here, never trusted from the client)
 *   • a mandatory notice cover page (resolved from the active notice template)
 *   • a per-page watermark + recipient/Copy-ID trace footer (repeat on every printed page)
 * then renders to PDF (Chromium), sanitises document metadata, computes a checksum,
 * and best-effort hardens the file (non-selectable rasterisation for "enhanced", PDF permission flags).
 *
 * Hard rule (no-unprotected-fallback): if protection is enabled and required, a failure throws —
 * we never return the raw, unprotected script.
 */

type Recipient = { name?: string; email?: string; company?: string; role?: string; note?: string };
type Meta = { projectTitle?: string; scriptTitle?: string; scriptVersion?: string; exportedBy?: string };

export interface ProtectedExportInput {
  projectId?: string;
  scriptDocumentId?: string;
  revisionId?: string;
  baseHtml: string;            // HTML from the reader's buildScriptPrintHtml
  docTitle?: string;           // neutral title for the PDF metadata
  lang?: string;               // 'ar' | 'en'
  recipient?: Recipient;
  meta?: Meta;
  profileId?: string;          // optional profile override for this export
  channel?: string;            // download | print | preview
  userId?: string;
}

export interface ProtectedExportResult {
  buffer: Buffer;
  copyId: string;
  mode: string;
  pageCount: number;
  checksum: string;
  bytes: number;
  degraded: string[];          // best-effort steps that could not run (visual protection still applied)
  fileName: string;
}

const esc = (s: any) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

@Injectable()
export class ProtectedExportService {
  constructor(private scripton: ScripOnService, private rp: ReviewProtectionService) {}

  private maskEmail(email?: string, display: string = 'masked'): string {
    const e = String(email || '').trim();
    if (!e) return '';
    if (display === 'hidden') return '';
    if (display === 'full') return e;
    const at = e.indexOf('@');
    if (at < 1) return '***';
    const user = e.slice(0, at);
    const dom = e.slice(at + 1);
    const dot = dom.lastIndexOf('.');
    const tld = dot > 0 ? dom.slice(dot) : '';
    return user[0] + '***@' + (dom[0] || '') + '***' + tld;
  }

  private fill(tpl: string, vars: Record<string, string>): string {
    return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  }

  // Build the placeholder map shared by notice / footer / watermark templates.
  private buildVars(copyId: string, r: Recipient, meta: Meta, emailDisplay: string): Record<string, string> {
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const datetime = now.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
    return {
      recipient_name: r.name || '—',
      recipient_email: this.maskEmail(r.email, emailDisplay),
      recipient_company: r.company || '',
      recipient_role: r.role || '',
      copy_id: copyId,
      project_title: meta.projectTitle || '',
      script_title: meta.scriptTitle || '',
      script_version: meta.scriptVersion || '',
      exported_by: meta.exportedBy || '',
      export_date: date,
      export_datetime: datetime,
    };
  }

  // A fixed full-bleed watermark layer (Chromium repeats position:fixed on every printed page).
  private watermarkLayer(cfg: any, vars: Record<string, string>): string {
    const primary = esc(this.fill(cfg.watermarkText || 'CONFIDENTIAL', vars));
    const secondary = esc(this.fill(cfg.watermarkSecondaryText || '', vars));
    const op = Math.max(0.03, Math.min(0.3, Number(cfg.watermarkOpacity) || 0.1));
    const rot = Number(cfg.watermarkRotation);
    const rotation = isFinite(rot) ? rot : -35;
    const pattern = cfg.watermarkPattern || 'single_diagonal';
    if (pattern === 'repeated_diagonal') {
      // Tile via an inline-SVG background so it repeats cleanly across the whole page.
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='320'><text x='210' y='170' font-family='Arial, sans-serif' font-size='30' font-weight='700' fill='black' fill-opacity='${op}' text-anchor='middle' transform='rotate(${rotation} 210 160)'>${primary.replace(/'/g, '')}</text></svg>`;
      const uri = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
      return `<div class="rp-wm rp-wm-rep" aria-hidden="true" style="background-image:url(&quot;${uri}&quot;)"></div>`;
    }
    const transform = pattern === 'horizontal_center' ? 'none' : `rotate(${rotation}deg)`;
    return `<div class="rp-wm" aria-hidden="true"><div class="rp-wm-box" style="transform:${transform}">`
      + `<div class="rp-wm-1" style="opacity:${op}">${primary}</div>`
      + (secondary ? `<div class="rp-wm-2" style="opacity:${Math.min(0.4, op + 0.06)}">${secondary}</div>` : '')
      + `</div></div>`;
  }

  private footerLayer(cfg: any, vars: Record<string, string>): string {
    if (!cfg.traceFooterEnabled) return '';
    const tpl = cfg.traceFooterTemplate || '{copy_id} · {recipient_name} · {export_date} · Confidential';
    return `<div class="rp-ft" aria-hidden="true">${esc(this.fill(tpl, vars))}</div>`;
  }

  // Puppeteer native footer — rendered in the RESERVED bottom page margin on every page (never over text).
  private footerTemplate(cfg: any, vars: Record<string, string>): string {
    if (!cfg.traceFooterEnabled) return '';
    const tpl = cfg.traceFooterTemplate || '{copy_id} · {recipient_name} · {export_date} · Confidential';
    return `<div style="width:100%;box-sizing:border-box;padding:0 14mm;font-family:Arial,Helvetica,sans-serif;font-size:7pt;color:#666;text-align:center;">${esc(this.fill(tpl, vars))}</div>`;
  }

  private noticeLayer(cfg: any, noticeBody: string, vars: Record<string, string>): string {
    if (!cfg.noticeRequired || !noticeBody) return '';
    const body = esc(this.fill(noticeBody, vars)).replace(/\n/g, '<br>');
    const placement = cfg.noticePlacement || 'dedicated_cover';
    if (placement === 'dedicated_cover') {
      return `<section class="rp-cover"><div class="rp-cover-inner">${body}</div></section>`;
    }
    const pos = placement === 'first_page_bottom' ? ' rp-banner-bottom' : '';
    return `<section class="rp-banner${pos}">${body}</section>`;
  }

  private protectionCss(cfg: any): string {
    const everyPage = cfg.watermarkEveryPage !== false;
    return [
      '.rp-wm{position:fixed;inset:0;z-index:9990;pointer-events:none;display:flex;align-items:center;justify-content:center;overflow:hidden}',
      everyPage ? '' : '.rp-wm{position:absolute}',
      '.rp-wm-rep{display:block}',
      '.rp-wm-box{text-align:center;white-space:normal;max-width:150mm;line-height:1.12}',
      '.rp-wm-1{font:700 40pt/1.12 Arial,Helvetica,sans-serif;color:#000;letter-spacing:.02em;overflow-wrap:break-word}',
      '.rp-wm-2{font:700 13pt/1.3 Arial,Helvetica,sans-serif;color:#000;margin-top:.4em}',
      '.rp-ft{position:fixed;left:0;right:0;bottom:6mm;z-index:9991;pointer-events:none;font:8.5pt/1.3 Arial,Helvetica,sans-serif;color:#333;text-align:center;letter-spacing:.02em}',
      '.rp-cover{break-after:page;page-break-after:always;min-height:calc(297mm - 44mm);display:flex;align-items:center;justify-content:center}',
      '.rp-cover-inner{max-width:6.2in;font:10.5pt/1.55 Arial,Helvetica,sans-serif;color:#1d1d1b;text-align:left}',
      '.rp-banner{border:1.5px solid #b91c1c;background:#fff5f5;color:#7f1d1d;padding:10px 14px;margin:0 0 14px;font:9pt/1.45 Arial,Helvetica,sans-serif;break-inside:avoid}',
      '.rp-banner-bottom{margin:14px 0 0}',
      // The title page sets `min-height: calc(297mm - 44mm)` so it fills a page on its own. With a
      // banner above it that no longer fits, so the title block spilled onto a second page — a
      // notice page, then an orphaned half-title. Under a banner the title sizes to its content and
      // the two share one page, which is what a review copy should look like.
      '.rp-banner ~ .uvp-page{min-height:0;justify-content:flex-start;padding-top:10mm}',
    ].filter(Boolean).join('');
  }

  // Server-authoritative injection of cover + watermark + footer into the reader's base HTML.
  injectProtection(baseHtml: string, cfg: any, copyId: string, recipient: Recipient, noticeBody: string, meta: Meta): string {
    const vars = this.buildVars(copyId, recipient || {}, meta || {}, cfg.recipientEmailDisplay || 'masked');
    let html = String(baseHtml || '');
    const css = '<style>' + this.protectionCss(cfg) + '</style>';
    if (html.includes('</head>')) html = html.replace('</head>', css + '</head>');
    else html = css + html;
    const layers = this.noticeLayer(cfg, noticeBody, vars) + this.watermarkLayer(cfg, vars); // trace footer is drawn in the reserved page margin (renderPdf), never over the script text
    if (html.includes('<body>')) html = html.replace('<body>', '<body>' + layers);
    else html = layers + html;
    return html;
  }

  private safeFileName(meta: Meta, copyId: string): string {
    const base = [meta.projectTitle, meta.scriptVersion].filter(Boolean).join('_') || meta.scriptTitle || 'Script';
    const cleaned = String(base).replace(/[^\w؀-ۿ\-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60);
    return (cleaned || 'Script') + '_PROTECTED_' + copyId + '.pdf';
  }

  // ── best-effort hardening (runtime tool detection; never required) ──
  private hasBinary(bin: string): boolean {
    try { const r = spawnSync(bin, ['--version'], { timeout: 4000 }); return !r.error && (r.status === 0 || r.status === 2); } catch { return false; }
  }

  // Non-selectable rasterisation for "enhanced" mode (poppler's pdftoppm → image PDF). Best-effort.
  private async rasterize(buf: Buffer, dpi: number): Promise<Buffer | null> {
    if (!this.hasBinary('pdftoppm')) return null;
    let dir = '';
    try {
      dir = mkdtempSync(join(tmpdir(), 'rp-rast-'));
      const inPdf = join(dir, 'in.pdf');
      writeFileSync(inPdf, buf);
      const r = spawnSync('pdftoppm', ['-png', '-r', String(Math.max(120, Math.min(300, dpi || 220))), inPdf, join(dir, 'pg')], { timeout: 120000 });
      if (r.error || r.status !== 0) return null;
      const pngs = readdirSync(dir).filter((f) => f.endsWith('.png')).sort();
      if (!pngs.length) return null;
      const { PDFDocument } = await import('pdf-lib');
      const out = await PDFDocument.create();
      for (const f of pngs) {
        const img = await out.embedPng(readFileSync(join(dir, f)));
        // A4 portrait at 72pt/in: 595.28 x 841.89
        const page = out.addPage([595.28, 841.89]);
        const scale = Math.min(595.28 / img.width, 841.89 / img.height);
        const w = img.width * scale, h = img.height * scale;
        page.drawImage(img, { x: (595.28 - w) / 2, y: (841.89 - h) / 2, width: w, height: h });
      }
      return Buffer.from(await out.save());
    } catch { return null; } finally { if (dir) { try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ } } }
  }

  // Strip identifying metadata and set neutral FilmOS authorship (always runs; pure-JS pdf-lib).
  private async sanitizeMetadata(buf: Buffer, neutralTitle: string): Promise<{ buf: Buffer; pageCount: number }> {
    try {
      const { PDFDocument } = await import('pdf-lib');
      const doc = await PDFDocument.load(buf, { updateMetadata: false });
      try {
        doc.setTitle(neutralTitle || 'Protected Review Copy');
        doc.setAuthor('FilmOS');
        doc.setProducer('FilmOS · ScripON');
        doc.setCreator('FilmOS · ScripON');
        doc.setSubject('Confidential review copy');
        doc.setKeywords([]);
      } catch { /* setters best-effort */ }
      const pageCount = doc.getPageCount();
      const out = Buffer.from(await doc.save({ useObjectStreams: true }));
      return { buf: out, pageCount };
    } catch { return { buf, pageCount: 0 }; }
  }

  // Apply PDF permission flags via qpdf if present (restrict copy/extract/edit/assembly; print per policy). Best-effort.
  private applyPermissions(buf: Buffer, cfg: any): { buf: Buffer; applied: boolean } {
    if (!this.hasBinary('qpdf')) return { buf, applied: false };
    let dir = '';
    try {
      dir = mkdtempSync(join(tmpdir(), 'rp-perm-'));
      const inPdf = join(dir, 'in.pdf');
      const outPdf = join(dir, 'out.pdf');
      writeFileSync(inPdf, buf);
      const ownerPw = createHash('sha256').update(String(Date.now()) + Math.random()).digest('hex').slice(0, 24);
      const printPolicy = cfg.printingPolicy === 'blocked' ? 'none' : (cfg.printingPolicy === 'allow_low_resolution' ? 'low' : 'full');
      const args = ['--encrypt', '', ownerPw, '256',
        '--modify=none',
        '--extract=' + (cfg.restrictExtraction === false ? 'y' : 'n'),
        '--print=' + printPolicy,
        '--accessibility=y',
        '--assemble=' + (cfg.restrictPageAssembly === false ? 'y' : 'n'),
        '--annotate=' + (cfg.restrictAnnotations ? 'n' : 'y'),
        '--', inPdf, outPdf];
      const r = spawnSync('qpdf', args, { timeout: 60000 });
      if (r.error || (r.status !== 0 && r.status !== 3)) return { buf, applied: false }; // status 3 = warnings only
      return { buf: readFileSync(outPdf), applied: true };
    } catch { return { buf, applied: false }; } finally { if (dir) { try { rmSync(dir, { recursive: true, force: true }); } catch { /* */ } } }
  }

  async produce(input: ProtectedExportInput): Promise<ProtectedExportResult> {
    if (!input || !input.baseHtml || typeof input.baseHtml !== 'string') throw new BadRequestException('baseHtml is required');
    const settings = await this.rp.getSettings(input.projectId || undefined);
    // Optional per-export profile override.
    let cfg = settings.config || {};
    if (input.profileId) {
      const profiles: any[] = settings.profiles || [];
      const p = profiles.find((x) => x.id === input.profileId || x.slug === input.profileId);
      if (p && p.config) cfg = { ...cfg, ...p.config };
    }
    const mode = String(cfg.mode || settings.mode || 'standard');
    const required = settings.enabled !== false && cfg.noticeRequired !== false;

    const recipient: Recipient = input.recipient || {};
    if (cfg.requireRecipient !== false && !(recipient.name || recipient.email)) {
      throw new BadRequestException('A recipient name or email is required for a protected review copy.');
    }

    const copyId = this.rp.generateCopyId({ projectId: input.projectId, recipientEmail: recipient.email, recipientName: recipient.name });
    const notice = await this.rp.noticeBySlug(cfg.noticeTemplateSlug).catch(() => null);
    const noticeBody = (notice && notice.body) || '';
    const meta: Meta = input.meta || {};
    const degraded: string[] = [];

    // 1) inject protection + render (Chromium). If this fails and protection is required → throw (no raw fallback).
    let pdf: Buffer;
    try {
      const protectedHtml = this.injectProtection(input.baseHtml, cfg, copyId, recipient, noticeBody, meta);
      const footerHtml = this.footerTemplate(cfg, this.buildVars(copyId, recipient, meta, cfg.recipientEmailDisplay || 'masked'));
      const ar = String(input.lang || '') === 'ar';
      const margin = ar ? { top: '22mm', right: '32mm', bottom: '16mm', left: '25mm' } : { top: '22mm', right: '25mm', bottom: '16mm', left: '32mm' };
      pdf = await this.scripton.renderPdf(protectedHtml, footerHtml ? { footerHtml, margin } : undefined);
    } catch (e: any) {
      await this.rp.recordExport({
        projectId: input.projectId, scriptDocumentId: input.scriptDocumentId, revisionId: input.revisionId,
        copyId, mode, profileId: input.profileId || settings.activeProfileId, recipientName: recipient.name, recipientEmail: recipient.email,
        recipientNote: recipient.note, channel: input.channel || 'download', status: 'FAILED',
        failureReason: 'render: ' + (e && e.message ? e.message : String(e)), settingsSnapshot: cfg, createdById: input.userId,
      }).catch(() => {});
      if (e && (e.code === 'NO_PUPPETEER' || e.code === 'NO_CHROMIUM')) { const er: any = new Error(e.message); er.code = e.code; throw er; }
      if (required) { const er: any = new Error('Protected render failed; unprotected fallback is blocked. ' + (e && e.message ? e.message : '')); er.code = 'PROTECTION_FAILED'; throw er; }
      throw e;
    }

    // 2) enhanced → non-selectable rasterised pages (best-effort).
    if (mode === 'enhanced') {
      const raster = await this.rasterize(pdf, Number(cfg.enhancedDpi) || 220);
      if (raster) pdf = raster; else degraded.push('rasterize_unavailable');
    }

    // 3) sanitise metadata (always).
    const neutralTitle = input.docTitle || (mode === 'enhanced' ? 'Protected Review Copy' : (meta.scriptTitle || 'Review Copy'));
    const san = await this.sanitizeMetadata(pdf, neutralTitle);
    pdf = san.buf;

    // 4) PDF permission flags (best-effort).
    if (cfg.restrictCopying !== false || cfg.restrictEditing !== false || cfg.printingPolicy === 'blocked' || cfg.printingPolicy === 'allow_low_resolution') {
      const perm = this.applyPermissions(pdf, cfg);
      if (perm.applied) pdf = perm.buf; else degraded.push('permissions_unavailable');
    }

    const checksum = createHash('sha256').update(pdf).digest('hex');
    const pageCount = san.pageCount || 0;

    await this.rp.recordExport({
      projectId: input.projectId, scriptDocumentId: input.scriptDocumentId, revisionId: input.revisionId,
      copyId, mode, profileId: input.profileId || settings.activeProfileId,
      recipientName: recipient.name, recipientEmail: recipient.email, recipientNote: recipient.note,
      channel: input.channel || 'download', pageCount, checksum, bytes: pdf.length,
      status: 'CREATED', settingsSnapshot: cfg, createdById: input.userId,
    }).catch(() => {});

    return { buffer: pdf, copyId, mode, pageCount, checksum, bytes: pdf.length, degraded, fileName: this.safeFileName(meta, copyId) };
  }
}
