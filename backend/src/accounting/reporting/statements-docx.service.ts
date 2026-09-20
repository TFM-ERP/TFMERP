import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ShadingType,
  Header,
  PageBreak,
  ImageRun,
  TextWrappingType,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
} from 'docx';
import { StatementsService } from './statements.service';
import { COMPANY_PROFILE } from './company-profile';

/**
 * The financial statements as a Word document, on the company letterhead.
 *
 * This is the deliverable the auditor and the licensing authority actually
 * receive, so it is generated from the same service that produces the figures on
 * screen. There is no second set of numbers and no manual transcription step:
 * if the ledger changes, the document changes.
 *
 * Uses the `docx` dependency already present in the backend. No new package is
 * introduced.
 */

const GOLD = 'B08D3F';
const DARK = '2B2B2B';
const GREY = '6E6E6E';
const LINE = 'CCCCCC';
const SHADE = 'F2EFE9';
const FONT = 'Calibri';

/** A4 at 96dpi. The page is 8.27in wide; an image sized in points would render short. */
const A4_PX = { width: 794, height: 1123 };

const TABLE_WIDTH = 9029;
const COLS = [5300, 900, 2829];

export interface StatementsDocOptions {
  year: number;
  entityName?: string;
  trn?: string;
  licence?: string;
  /** Absolute path to a full-page letterhead image. Omitted renders a typographic header. */
  letterheadPath?: string;
  /** Marks the document DRAFT until the preparer says otherwise. */
  draft?: boolean;
  preparedOn?: Date;
}

@Injectable()
export class StatementsDocxService {
  constructor(private statements: StatementsService) {}

  async build(opts: StatementsDocOptions): Promise<{ filename: string; buffer: Buffer }> {
    const set = await this.statements.fullSet({ year: opts.year, comparative: true });
    // Registration details come from the VAT certificate rather than literals, so
    // the cover page and the FAF header can never state different things.
    const entity = opts.entityName ?? COMPANY_PROFILE.nameEn;
    const trn = opts.trn ?? COMPANY_PROFILE.trn;
    const licence =
      opts.licence ??
      `Licensed by ${COMPANY_PROFILE.licensingAuthority} — Creative Media Authority, ${COMPANY_PROFILE.emirate}  ·  ${COMPANY_PROFILE.licenceNumber}`;
    const preparedOn = opts.preparedOn ?? new Date();
    const draft = opts.draft ?? true;

    const header = this.letterhead(opts.letterheadPath);

    const doc = new Document({
      creator: entity,
      title: `${entity} — Financial Statements ${opts.year}`,
      description: `Financial statements for the year ended 31 December ${opts.year}`,
      sections: [
        {
          properties: {
            page: { margin: { top: 2340, right: 1440, bottom: 2100, left: 1440, header: 0, footer: 0 } },
          },
          ...(header ? { headers: { default: header } } : {}),
          children: [
            ...this.cover(entity, { ...opts, trn, licence }, preparedOn, draft),
            new Paragraph({ children: [new PageBreak()] }),
            ...this.incomeStatement(set, opts.year),
            new Paragraph({ children: [new PageBreak()] }),
            ...this.financialPosition(set, opts.year),
            new Paragraph({ children: [new PageBreak()] }),
            ...this.changesInEquity(set, opts.year),
            new Paragraph({ children: [new PageBreak()] }),
            ...this.cashFlows(set, opts.year),
            new Paragraph({ children: [new PageBreak()] }),
            ...this.integrityNote(set),
          ],
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const suffix = draft ? '-DRAFT' : '';
    return { filename: `Financial-Statements-${opts.year}${suffix}.docx`, buffer: Buffer.from(buffer) };
  }

  /**
   * The letterhead as a full-page image floating behind the text.
   *
   * Sized in pixels at A4 96dpi. `docx` treats the numbers as points unless the
   * image is given page-sized dimensions, and a letterhead sized from the PDF's
   * own 595x842 point box renders at 6.2in rather than 8.27in — which pushes the
   * printed footer into the middle of the page.
   */
  private letterhead(letterheadPath?: string): Header | null {
    if (!letterheadPath) return null;
    const resolved = path.resolve(letterheadPath);
    if (!fs.existsSync(resolved)) return null;

    return new Header({
      children: [
        new Paragraph({
          children: [
            new ImageRun({
              type: 'png',
              data: fs.readFileSync(resolved),
              transformation: A4_PX,
              floating: {
                horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: 0 },
                verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: 0 },
                wrap: { type: TextWrappingType.NONE },
                behindDocument: true,
              },
            }),
          ],
        }),
      ],
    });
  }

  private txt(text: string, o: any = {}): TextRun {
    return new TextRun({
      text,
      font: FONT,
      size: o.size ?? 20,
      bold: !!o.bold,
      italics: !!o.italics,
      color: o.color ?? DARK,
    });
  }

  private money(n: number | null | undefined): string {
    if (n === null || n === undefined) return '—';
    const v = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return n < 0 ? `(${v})` : v;
  }

  /** One statement row: label, note reference, amount, optional comparative. */
  private row(label: string, note: string, amount: number | string | null, o: any = {}): TableRow {
    const style = { bold: o.bold, italics: o.italics, color: o.color, size: o.size ?? 20 };
    const cell = (children: Paragraph[], width: number) =>
      new TableCell({
        width: { size: width, type: WidthType.DXA },
        shading: o.shade ? { type: ShadingType.CLEAR, fill: o.shade, color: 'auto' } : undefined,
        margins: { top: 60, bottom: 60, left: 110, right: 110 },
        borders: {
          top: { style: BorderStyle.NONE },
          bottom: {
            style: o.line === 'double' ? BorderStyle.DOUBLE : o.line === 'single' ? BorderStyle.SINGLE : BorderStyle.NONE,
            size: o.line === 'double' ? 6 : 4,
            color: o.line ? DARK : LINE,
          },
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
        },
        children,
      });

    return new TableRow({
      children: [
        cell(
          [new Paragraph({
            spacing: { before: o.before ?? 20, after: 20 },
            indent: o.indent ? { left: o.indent } : undefined,
            children: [this.txt(label, style)],
          })],
          COLS[0],
        ),
        cell(
          [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: o.before ?? 20, after: 20 }, children: [this.txt(note, { size: 18, color: GREY })] })],
          COLS[1],
        ),
        cell(
          [new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: o.before ?? 20, after: 20 },
            children: [this.txt(typeof amount === 'number' ? this.money(amount) : (amount ?? ''), style)],
          })],
          COLS[2],
        ),
      ],
    });
  }

  private sectionRow(label: string): TableRow {
    return this.row(label.toUpperCase(), '', '', { bold: true, size: 18, shade: SHADE, before: 80 });
  }

  private table(rows: TableRow[]): Table {
    return new Table({ width: { size: TABLE_WIDTH, type: WidthType.DXA }, rows });
  }

  private h1(text: string): Paragraph {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [this.txt(text.toUpperCase(), { bold: true, size: 24 })],
    });
  }

  private h2(text: string): Paragraph {
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [this.txt(text, { size: 18, color: GREY })],
    });
  }

  private cover(entity: string, opts: StatementsDocOptions, preparedOn: Date, draft: boolean): Paragraph[] {
    const centre = (text: string, o: any = {}, after = 100) =>
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after }, children: [this.txt(text, o)] });

    const rule = (position: 'top' | 'bottom', after: number) =>
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after },
        border: { [position]: { style: BorderStyle.SINGLE, size: 8, color: GOLD, space: 14 } } as any,
        children: [this.txt('', { size: 18 })],
      });

    return [
      new Paragraph({ spacing: { after: 1400 }, children: [this.txt('')] }),
      centre(entity, { bold: true, size: 34 }, 120),
      ...(opts.licence ? [centre(opts.licence, { size: 18, color: GREY }, 60)] : []),
      ...(opts.trn ? [centre(`TRN ${opts.trn}`, { size: 18, color: GREY }, 700)] : [centre('', {}, 700)]),
      rule('top', 100),
      centre('Financial Statements', { bold: true, size: 30 }, 100),
      centre(`For the year ended 31 December ${opts.year}`, { size: 24 }, 100),
      rule('bottom', 600),
      centre(
        'Income Statement  ·  Statement of Financial Position  ·  Statement of Changes in Equity  ·  Statement of Cash Flows',
        { size: 19, color: GREY },
        60,
      ),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 500, after: 40 },
        children: [
          this.txt(
            draft
              ? 'DRAFT — PREPARED BY MANAGEMENT FOR THE AUDITOR — NOT FOR ISSUE'
              : 'PREPARED BY MANAGEMENT',
            { bold: true, size: 17, color: GOLD },
          ),
        ],
      }),
      centre('Prepared under the IFRS for SMEs Accounting Standard from the company’s accounting records. Not audited.', { size: 17, color: GREY, italics: true }, 40),
      centre(
        `All amounts are in UAE Dirhams (AED). Generated ${preparedOn.toISOString().slice(0, 10)}.`,
        { size: 17, color: GREY, italics: true },
        0,
      ),
    ];
  }

  private incomeStatement(set: any, year: number): (Paragraph | Table)[] {
    const s = set.incomeStatement;
    const rows: TableRow[] = [this.row('', 'Note', 'AED', { bold: true, size: 18, line: 'single' })];

    for (const g of s.groups) {
      rows.push(this.sectionRow(g.label));
      for (const l of g.lines) {
        const sign = g.section === 'COST_OF_SALES' || g.section === 'OPERATING_EXPENSE' ? -1 : 1;
        rows.push(this.row(l.name, l.code, sign * l.amount, { indent: 180 }));
      }
      const gsign = g.section === 'COST_OF_SALES' || g.section === 'OPERATING_EXPENSE' ? -1 : 1;
      rows.push(this.row(`Total ${g.label.toLowerCase()}`, '', gsign * g.total, { bold: true, line: 'single' }));
      if (g.section === 'COST_OF_SALES') {
        rows.push(this.row('GROSS PROFIT', '', s.grossProfit, { bold: true, shade: SHADE, before: 60 }));
      }
    }

    rows.push(
      this.row(
        s.profitForThePeriod >= 0 ? 'PROFIT FOR THE YEAR' : 'LOSS FOR THE YEAR',
        '',
        s.profitForThePeriod,
        { bold: true, size: 22, line: 'double', before: 80 },
      ),
    );

    return [this.h1('Income Statement'), this.h2(`For the year ended 31 December ${year}  ·  Amounts in AED`), this.table(rows)];
  }

  private financialPosition(set: any, year: number): (Paragraph | Table)[] {
    const p = set.statementOfFinancialPosition;
    const rows: TableRow[] = [this.row('', 'Note', 'AED', { bold: true, size: 18, line: 'single' })];

    for (const g of p.groups) {
      rows.push(this.sectionRow(g.label));
      for (const l of g.lines) rows.push(this.row(l.name, l.code, l.amount, { indent: 180 }));
      rows.push(this.row(`Total ${g.label.toLowerCase()}`, '', g.total, { bold: true, line: 'single' }));
    }

    rows.push(this.row('TOTAL ASSETS', '', p.totalAssets, { bold: true, shade: SHADE, before: 60 }));
    rows.push(this.row('TOTAL LIABILITIES AND EQUITY', '', p.totalLiabilitiesAndEquity, { bold: true, size: 22, line: 'double', before: 80 }));
    if (!p.balances) {
      rows.push(this.row('DIFFERENCE — THIS STATEMENT DOES NOT BALANCE', '', p.difference, { bold: true, color: GOLD, before: 60 }));
    }

    return [this.h1('Statement of Financial Position'), this.h2(`As at 31 December ${year}  ·  Amounts in AED`), this.table(rows)];
  }

  private changesInEquity(set: any, year: number): (Paragraph | Table)[] {
    const e = set.statementOfChangesInEquity;
    const rows: TableRow[] = [this.row('', '', 'AED', { bold: true, size: 18, line: 'single' })];
    rows.push(this.row(`Balance at 1 January ${year}`, '', e.openingEquity, { bold: true }));
    rows.push(
      this.row(
        e.profitForThePeriod >= 0 ? 'Profit for the year' : 'Loss for the year',
        '',
        e.profitForThePeriod,
        { indent: 180 },
      ),
    );
    for (const m of e.equityMovements) rows.push(this.row(m.name, m.code, m.amount, { indent: 180 }));
    rows.push(this.row(`Balance at 31 December ${year}`, '', e.closingEquity, { bold: true, size: 22, line: 'double', before: 80 }));

    return [this.h1('Statement of Changes in Equity'), this.h2(`For the year ended 31 December ${year}  ·  Amounts in AED`), this.table(rows)];
  }

  private cashFlows(set: any, year: number): (Paragraph | Table)[] {
    const c = set.statementOfCashFlows;
    const rows: TableRow[] = [this.row('', '', 'AED', { bold: true, size: 18, line: 'single' })];

    rows.push(this.sectionRow('Cash flows from operating activities'));
    rows.push(this.row(c.operating.profitForThePeriod >= 0 ? 'Profit for the year' : 'Loss for the year', '', c.operating.profitForThePeriod, { indent: 180 }));
    for (const a of c.operating.adjustments) rows.push(this.row(`Adjustment for ${a.name}`, a.code, a.amount, { indent: 180 }));
    for (const w of c.operating.workingCapital) rows.push(this.row(`Movement in ${w.name}`, w.code, w.amount, { indent: 180 }));
    rows.push(this.row('Net cash from operating activities', '', c.operating.net, { bold: true, line: 'single' }));

    rows.push(this.sectionRow('Cash flows from investing activities'));
    for (const i of c.investing.items) rows.push(this.row(`Movement in ${i.name}`, i.code, i.amount, { indent: 180 }));
    rows.push(this.row('Net cash used in investing activities', '', c.investing.net, { bold: true, line: 'single' }));

    rows.push(this.sectionRow('Cash flows from financing activities'));
    for (const f of c.financing.items) rows.push(this.row(`Movement in ${f.name}`, f.code, f.amount, { indent: 180 }));
    rows.push(this.row('Net cash from financing activities', '', c.financing.net, { bold: true, line: 'single' }));

    rows.push(this.row('Net movement in cash and cash equivalents', '', c.netMovement, { bold: true, shade: SHADE, before: 60 }));
    rows.push(this.row(`Cash at 1 January ${year}`, '', c.openingCash, { indent: 180 }));
    rows.push(this.row(`Cash at 31 December ${year}`, '', c.closingCash, { bold: true, line: 'double', before: 80 }));

    return [this.h1('Statement of Cash Flows'), this.h2(`For the year ended 31 December ${year}  ·  Indirect method  ·  Amounts in AED`), this.table(rows)];
  }

  /**
   * The integrity checks, printed.
   *
   * A statement that does not balance, a cash flow that does not reconcile, or a
   * draft journal left unposted inside the period are facts about the accounts.
   * They go in the document rather than being left on a screen the auditor will
   * never see.
   */
  private integrityNote(set: any): Paragraph[] {
    const c = set.checks;
    const line = (text: string, ok: boolean) =>
      new Paragraph({
        spacing: { after: 80 },
        children: [
          this.txt(ok ? '✓  ' : '✗  ', { bold: true, color: ok ? DARK : GOLD }),
          this.txt(text, { size: 19, color: ok ? DARK : GOLD }),
        ],
      });

    const items: Paragraph[] = [
      this.h1('Basis of Preparation and Integrity Checks'),
      this.h2('Generated with the statements from the same accounting records'),
      new Paragraph({
        spacing: { after: 200 },
        children: [
          this.txt(
            'These statements were generated directly from the company’s general ledger. Every figure is the sum of posted journal entries; no amount has been keyed in separately or adjusted after generation. They are prepared under the IFRS for SMEs Accounting Standard and have not been audited. The checks below are produced by the system at the moment of generation.',
            { size: 19 },
          ),
        ],
      }),
      line(
        c.positionBalances
          ? 'The statement of financial position balances.'
          : `The statement of financial position does not balance. Difference: AED ${this.money(c.positionDifference)}.`,
        c.positionBalances,
      ),
      line(
        c.cashFlowReconciles
          ? 'The statement of cash flows reconciles to the movement on cash and bank.'
          : `The statement of cash flows does not reconcile. Difference: AED ${this.money(c.cashFlowDifference)}.`,
        c.cashFlowReconciles,
      ),
      line(
        c.equityTiesToPosition
          ? 'Closing equity per the statement of changes in equity agrees to the statement of financial position.'
          : `Closing equity does not agree to the statement of financial position. Difference: AED ${this.money(c.equityDifference)}.`,
        c.equityTiesToPosition,
      ),
      line(
        c.draftJournalsInPeriod === 0
          ? 'No unposted journal entries are dated within the period.'
          : `${c.draftJournalsInPeriod} journal entr${c.draftJournalsInPeriod === 1 ? 'y is' : 'ies are'} dated within the period but still in draft, and are excluded from these figures.`,
        c.draftJournalsInPeriod === 0,
      ),
    ];

    for (const j of c.draftJournals ?? []) {
      items.push(
        new Paragraph({
          indent: { left: 360 },
          spacing: { after: 40 },
          children: [this.txt(`${j.entryNumber} — ${new Date(j.date).toISOString().slice(0, 10)} — ${j.memo ?? ''}`, { size: 17, color: GREY })],
        }),
      );
    }

    return items;
  }
}
