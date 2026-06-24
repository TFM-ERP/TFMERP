/**
 * ScripON package DOCX renderer — thin adapter from the pure doc model to a real .docx buffer.
 *
 * Everything content-related lives in package-docx.util (pure, tested). This file only maps that
 * tree onto the `docx` library's objects and packs it. Document metadata is set to neutral FilmOS
 * authorship (parity with the PDF's metadata sanitisation); a .docx cannot be hardened like the
 * protected PDF, so the description marks it explicitly as an editable review copy.
 */
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { PackageDoc, DocBlock } from './package-docx.util';

export interface PackDocxOptions {
  rtl?: boolean;
}

const GOLD = '9A7B2E';
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER };

/** Split text on newlines into runs so paragraph line breaks survive the render. */
function runsFromText(text: string, props: any = {}): TextRun[] {
  const lines = String(text == null ? '' : text).split('\n');
  const runs: TextRun[] = [];
  lines.forEach((line, i) => runs.push(new TextRun({ text: line, break: i > 0 ? 1 : 0, ...props })));
  return runs;
}

function blockToElements(block: DocBlock, align: any): Array<Paragraph | Table> {
  switch (block.kind) {
    case 'metaTable':
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          borders: NO_BORDERS,
          rows: block.rows.map(([k, v]) => new TableRow({
            children: [
              new TableCell({ width: { size: 32, type: WidthType.PERCENTAGE }, borders: NO_BORDERS, children: [new Paragraph({ alignment: align, children: [new TextRun({ text: k, color: '888888', size: 18 })] })] }),
              new TableCell({ borders: NO_BORDERS, children: [new Paragraph({ alignment: align, children: [new TextRun({ text: String(v), bold: true })] })] }),
            ],
          })),
        }),
      ];
    case 'spine':
      return block.rungs.flatMap((r) => [
        new Paragraph({ alignment: align, spacing: { before: 120, after: 20 }, children: [new TextRun({ text: r.title, bold: true, color: GOLD, size: 20, allCaps: true })] }),
        new Paragraph({ alignment: align, children: runsFromText(r.body, { size: 22, color: '333333' }) }),
      ]);
    case 'characters':
      return block.items.flatMap((c) => {
        const head: TextRun[] = [new TextRun({ text: c.name, bold: true })];
        if (c.role) head.push(new TextRun({ text: '  ' + c.role, color: GOLD, size: 18, allCaps: true }));
        const out: Paragraph[] = [new Paragraph({ alignment: align, spacing: { before: 120 }, children: head })];
        if (c.tagline) out.push(new Paragraph({ alignment: align, children: [new TextRun({ text: c.tagline, italics: true, color: '666666' })] }));
        if (c.coreIdentity) out.push(new Paragraph({ alignment: align, children: [new TextRun({ text: c.coreIdentity, size: 22 })] }));
        if (c.arc) out.push(new Paragraph({ alignment: align, children: [new TextRun({ text: c.arc, size: 20, color: '777777' })] }));
        return out;
      });
    case 'list':
      return block.items.map((item) => new Paragraph({ alignment: align, bullet: { level: 0 }, children: [new TextRun({ text: item, size: 22 })] }));
    case 'paragraph':
    default:
      return [new Paragraph({ alignment: align, children: runsFromText((block as any).text, { size: 22, color: '333333' }) })];
  }
}

export async function packDocx(doc: PackageDoc, opts: PackDocxOptions = {}): Promise<Buffer> {
  const align = opts.rtl ? AlignmentType.RIGHT : AlignmentType.LEFT;
  const children: Array<Paragraph | Table> = [];

  if (doc.eyebrow) children.push(new Paragraph({ alignment: align, children: [new TextRun({ text: doc.eyebrow, color: GOLD, size: 16, bold: true, allCaps: true })] }));
  children.push(new Paragraph({ alignment: align, heading: HeadingLevel.TITLE, children: [new TextRun({ text: doc.title, bold: true })] }));
  if (doc.logline) children.push(new Paragraph({ alignment: align, spacing: { after: 160 }, children: [new TextRun({ text: doc.logline, italics: true, color: '444444', size: 24 })] }));

  for (const section of doc.sections) {
    children.push(new Paragraph({ alignment: align, heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 80 }, children: [new TextRun({ text: section.heading, bold: true, color: GOLD, allCaps: true })] }));
    for (const block of section.blocks) children.push(...blockToElements(block, align));
  }

  const document = new Document({
    creator: 'FilmOS · ScripON',
    title: doc.title,
    description: 'Editable review copy — not a protected export.',
    subject: 'Development package',
    sections: [{ properties: {}, children }],
  });
  return Packer.toBuffer(document);
}
