// Word (.docx) report generator using the `docx` library (loaded on demand).
// Produces a genuine OOXML document — opens cleanly in MS Word, Google Docs
// and LibreOffice with brand-styled headings and tables.

import { downloadBlob } from '../csv.js';

const BRAND = 'DB2777';
const RED = 'C8102E';
const INK = '374151';
const MUTED = '78716C';
const GRID = 'E5E7EB';

let docxLib = null;
async function loadDocx() {
  // Loaded on demand — the docx library is heavy and only needed when the
  // manager actually exports a Word document.
  if (!docxLib) docxLib = await import('docx');
  return docxLib;
}

function makeBuilders(D) {
  const alignMap = { l: D.AlignmentType.LEFT, c: D.AlignmentType.CENTER, r: D.AlignmentType.RIGHT };
  const TOTAL_DXA = 9360; // usable width, letter/A4 portrait with 1" margins

  const cell = (text, { header = false, align = D.AlignmentType.LEFT } = {}) =>
    new D.TableCell({
      shading: header ? { fill: BRAND } : undefined,
      margins: { top: 60, bottom: 60, left: 110, right: 110 },
      children: [
        new D.Paragraph({
          alignment: align,
          children: [
            new D.TextRun({
              text: String(text ?? ''),
              bold: header,
              color: header ? 'FFFFFF' : INK,
              size: 19, // 9.5pt
            }),
          ],
        }),
      ],
    });

  const table = (head, rows, aligns = []) => {
    const n = head.length;
    const alignOf = (i) => alignMap[aligns[i] || (i === 0 ? 'l' : 'r')];
    const borders = {};
    for (const side of ['top', 'bottom', 'left', 'right', 'insideHorizontal', 'insideVertical']) {
      borders[side] = { style: D.BorderStyle.SINGLE, size: 1, color: GRID };
    }
    return new D.Table({
      width: { size: 100, type: D.WidthType.PERCENTAGE },
      columnWidths: head.map(() => Math.floor(TOTAL_DXA / n)),
      borders,
      rows: [
        new D.TableRow({
          tableHeader: true,
          children: head.map((h, i) => cell(h, { header: true, align: alignOf(i) })),
        }),
        ...rows.map((r) => new D.TableRow({ children: r.map((c, i) => cell(c, { align: alignOf(i) })) })),
      ],
    });
  };

  return { cell, table, alignMap };
}

export async function generateReportDOCX(model) {
  const D = await loadDocx();
  const { table } = makeBuilders(D);
  const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } = D;
  const children = [];

  /* ------------------------------- header -------------------------------- */
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'NEWHEROES GROUP', bold: true, size: 34, color: RED })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: model.title, bold: true, size: 26, color: INK })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: model.subtitle, size: 18, color: MUTED })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `Period: ${model.periodLabel}    •    Generated: ${model.generatedAt.toLocaleString(
            'en-NG',
            { timeZone: 'Africa/Lagos', day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }
          )}    •    By: ${model.generatedBy}`,
          size: 17,
          color: MUTED,
        }),
      ],
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BRAND, space: 6 } },
    })
  );

  /* ------------------------------ sections -------------------------------- */
  const heading = (t) =>
    new Paragraph({
      spacing: { before: 260, after: 110 },
      children: [new TextRun({ text: t, bold: true, size: 22, color: BRAND })],
    });

  children.push(heading('Summary'));
  children.push(table(['Metric', 'Value'], model.kpis, ['l', 'r']));

  for (const s of model.sections) {
    if (!s.rows.length) continue;
    children.push(heading(s.title));
    children.push(table(s.head, s.rows, s.aligns));
  }

  /* ------------------------------- footer --------------------------------- */
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [new TextRun({ text: model.footer[0], italics: true, size: 18, color: RED })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: model.footer[1], size: 17, color: MUTED })],
    })
  );

  const doc = new Document({
    creator: 'Newheroes Toll',
    title: model.title,
    description: model.subtitle,
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(`${model.filename}.docx`, blob);
}
