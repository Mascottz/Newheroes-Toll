// PDF report generator (jsPDF v4 + jspdf-autotable v5, loaded on demand so
// the libraries never weigh down the initial app bundle).

import { downloadBlob } from '../csv.js';

const BRAND = [219, 39, 119]; // pink-600
const RED = [200, 16, 46]; // brand red
const INK = [55, 65, 81];
const MUTED = [120, 113, 108];

// jsPDF core fonts don't include the naira sign — print "N1,300" like the
// physical tickets do ("N1000.00 NAIRA").
const sanitize = (v) => String(v ?? '').replace(/₦/g, 'N');

const alignMap = { l: 'left', c: 'center', r: 'right' };

export async function generateReportPDF(model) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;

  /* ------------------------------- header ------------------------------- */
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, W, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...RED);
  doc.text('NEWHEROES GROUP', M, 36);
  doc.setFontSize(11.5);
  doc.setTextColor(...INK);
  doc.text(model.title, M, 55);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(model.subtitle, M, 69);

  const genStr = model.generatedAt.toLocaleString('en-NG', {
    timeZone: 'Africa/Lagos',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text(`Period: ${sanitize(model.periodLabel)}`, W - M, 36, { align: 'right' });
  doc.text(`Generated: ${genStr}`, W - M, 50, { align: 'right' });
  doc.text(`By: ${sanitize(model.generatedBy)}`, W - M, 64, { align: 'right' });

  /* ------------------------------- tables -------------------------------- */
  let y = 92;

  const drawSectionTitle = (t) => {
    if (y > H - 90) {
      doc.addPage();
      y = 48;
    }
    doc.setFillColor(...BRAND);
    doc.rect(M, y - 1, 3, 12, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(sanitize(t), M + 9, y + 9);
    y += 18;
  };

  const drawTable = (head, rows, aligns = []) => {
    autoTable(doc, {
      startY: y,
      head: [head.map(sanitize)],
      body: rows.map((r) => r.map(sanitize)),
      theme: 'striped',
      headStyles: { fillColor: BRAND, textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
      bodyStyles: { fontSize: 8.5, textColor: INK },
      alternateRowStyles: { fillColor: [253, 242, 248] },
      margin: { left: M, right: M },
      styles: { cellPadding: 4.5, lineColor: [240, 220, 232], lineWidth: 0.5 },
      columnStyles: Object.fromEntries(
        head.map((_, i) => [i, { halign: alignMap[aligns[i] || (i === 0 ? 'l' : 'r')] }])
      ),
    });
    y = (doc.lastAutoTable?.finalY || y) + 22;
  };

  drawSectionTitle('Summary');
  drawTable(['Metric', 'Value'], model.kpis.map(([k, v]) => [k, v]), ['l', 'r']);

  for (const s of model.sections) {
    if (!s.rows.length) continue;
    drawSectionTitle(s.title);
    drawTable(s.head, s.rows, s.aligns);
  }

  /* ------------------------------- footer -------------------------------- */
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(...RED);
    doc.text(model.footer[0], W / 2, H - 34, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(model.footer[1], W / 2, H - 45, { align: 'center' });
    doc.text(`Page ${p} of ${pages}`, W - M, H - 24, { align: 'right' });
    doc.text('DUTSE MODERN MARKET', M, H - 24);
  }

  downloadBlob(`${model.filename}.pdf`, doc.output('blob'));
}
