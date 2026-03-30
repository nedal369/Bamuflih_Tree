import jsPDF from 'jspdf';
import type { EventReport } from '../types';

function fmtNum(n: number): string {
  return n.toLocaleString('ar-SA') + ' ر.س';
}

const costItemAr: Record<string, string> = {
  dinner: 'العشاء',
  venue: 'المكان',
  hospitality: 'الضيافة',
  other: 'أخرى',
};

export async function generateEventReportPdf(report: EventReport): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  // Helper: add a line and move y
  const line = (from: number, to: number, yPos: number, color = [200, 200, 200] as [number, number, number]) => {
    pdf.setDrawColor(...color);
    pdf.line(from, yPos, to, yPos);
  };

  // Helper: right-aligned text
  const rtl = (text: string, x: number, yPos: number, size = 10, bold = false, color = [30, 30, 30] as [number, number, number]) => {
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    // jsPDF doesn't support Arabic natively — we'll use latin fallback for numbers,
    // and store Arabic as-is (PDF viewers usually handle it)
    const w = pdf.getTextWidth(text);
    pdf.text(text, x - w, yPos);
  };

  const ltr = (text: string, x: number, yPos: number, size = 10, bold = false, color = [30, 30, 30] as [number, number, number]) => {
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    pdf.text(text, x, yPos);
  };

  const centerText = (text: string, yPos: number, size = 10, bold = false, color = [30, 30, 30] as [number, number, number]) => {
    pdf.setFontSize(size);
    pdf.setTextColor(...color);
    pdf.setFont('helvetica', bold ? 'bold' : 'normal');
    const w = pdf.getTextWidth(text);
    pdf.text(text, (pageW - w) / 2, yPos);
  };

  // ── Header ──
  pdf.setFillColor(0, 82, 204);
  pdf.rect(0, 0, pageW, 28, 'F');

  pdf.setFontSize(16);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  const title = report.event.name || 'تقرير المناسبة';
  const titleW = pdf.getTextWidth(title);
  pdf.text(title, (pageW - titleW) / 2, 13);

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  const subLine = `${report.event.date || ''} | Al-Bamuflih Family`;
  const subW = pdf.getTextWidth(subLine);
  pdf.text(subLine, (pageW - subW) / 2, 22);

  y = 36;

  // ── Cost Breakdown Box ──
  pdf.setFillColor(245, 248, 255);
  pdf.setDrawColor(200, 215, 245);
  pdf.roundedRect(margin, y, pageW - margin * 2, 38, 3, 3, 'FD');
  y += 7;

  ltr('Cost Breakdown:', margin + 4, y, 9, true, [50, 80, 180]);
  y += 6;

  const items = Object.entries(report.cost_breakdown).filter(([, v]) => v > 0);
  const colW = (pageW - margin * 2 - 8) / Math.max(items.length, 1);
  items.forEach(([key, val], idx) => {
    const x = margin + 4 + idx * colW;
    ltr(`${costItemAr[key] || key}: ${fmtNum(val)}`, x, y, 8, false, [60, 60, 60]);
  });
  y += 8;

  const totalCost = Object.values(report.cost_breakdown).reduce((s, v) => s + v, 0);
  ltr(`Total per person: ${fmtNum(totalCost)}`, margin + 4, y, 9, true, [30, 30, 30]);
  if ((report.subscriber_exemptions || []).length > 0) {
    const exemptNames = (report.subscriber_exemptions || []).map(k => costItemAr[k] || k).join(', ');
    rtl(`Subscriber exemptions: ${exemptNames}`, pageW - margin - 4, y, 8, false, [0, 140, 80]);
  }
  y += 14;

  // ── Rates Table ──
  pdf.setFillColor(240, 255, 240);
  pdf.setDrawColor(180, 220, 180);
  pdf.roundedRect(margin, y, (pageW - margin * 2) / 2 - 3, 28, 3, 3, 'FD');
  pdf.setFillColor(255, 245, 235);
  pdf.setDrawColor(220, 190, 150);
  pdf.roundedRect(margin + (pageW - margin * 2) / 2 + 3, y, (pageW - margin * 2) / 2 - 3, 28, 3, 3, 'FD');

  y += 6;
  ltr('Subscriber', margin + 4, y, 9, true, [0, 130, 60]);
  ltr('Non-Subscriber', margin + (pageW - margin * 2) / 2 + 7, y, 9, true, [200, 80, 0]);
  y += 6;
  ltr(`Adult: ${fmtNum(report.rates.subscriber_adult)}`, margin + 4, y, 8, false, [30, 30, 30]);
  ltr(`Adult: ${fmtNum(report.rates.non_subscriber_adult)}`, margin + (pageW - margin * 2) / 2 + 7, y, 8, false, [30, 30, 30]);
  y += 5;
  if (report.rates.subscriber_young > 0) {
    ltr(`Young: ${fmtNum(report.rates.subscriber_young)}`, margin + 4, y, 8, false, [80, 80, 80]);
    ltr(`Young: ${fmtNum(report.rates.non_subscriber_young)}`, margin + (pageW - margin * 2) / 2 + 7, y, 8, false, [80, 80, 80]);
  }
  y += 14;

  // ── Summary ──
  pdf.setFontSize(8);
  pdf.setTextColor(100, 100, 100);
  pdf.setFont('helvetica', 'normal');
  const summaryText = `Families: ${report.summary.total_families}  |  Subscribers: ${report.summary.subscriber_families}  |  Non-Subscribers: ${report.summary.non_subscriber_families}  |  Total People: ${report.summary.total_people}`;
  const sumW = pdf.getTextWidth(summaryText);
  pdf.text(summaryText, (pageW - sumW) / 2, y);
  y += 10;

  line(margin, pageW - margin, y, [180, 180, 200]);
  y += 6;

  // ── Families Table Header ──
  pdf.setFillColor(40, 80, 180);
  pdf.rect(margin, y, pageW - margin * 2, 8, 'F');

  const cols = [
    { label: 'Family Head', x: margin + 2, w: 55 },
    { label: 'Status', x: margin + 58, w: 22 },
    { label: 'Adults', x: margin + 82, w: 16 },
    { label: 'Young', x: margin + 100, w: 16 },
    { label: 'Children', x: margin + 118, w: 18 },
    { label: 'Total', x: margin + 138, w: 35 },
  ];

  pdf.setFontSize(8);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold');
  cols.forEach(col => pdf.text(col.label, col.x, y + 5.5));
  y += 10;

  // ── Families Rows ──
  let rowIdx = 0;
  for (const fam of report.families) {
    // New page if needed
    if (y > pageH - 25) {
      pdf.addPage();
      y = margin;
      // Reprint header
      pdf.setFillColor(40, 80, 180);
      pdf.rect(margin, y, pageW - margin * 2, 8, 'F');
      pdf.setFontSize(8);
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      cols.forEach(col => pdf.text(col.label, col.x, y + 5.5));
      y += 10;
      rowIdx = 0;
    }

    // Alternating row bg
    if (rowIdx % 2 === 0) {
      pdf.setFillColor(248, 249, 252);
    } else {
      pdf.setFillColor(255, 255, 255);
    }
    const totalMembers = fam.adult_count + fam.young_count + fam.child_count;
    const isFullyExempt = (fam.exempt_count || 0) >= totalMembers;
    if (isFullyExempt) {
      pdf.setFillColor(245, 240, 255);
    } else if (!fam.is_subscriber) {
      pdf.setFillColor(255, 250, 240);
    }
    pdf.rect(margin, y - 1, pageW - margin * 2, 7.5, 'F');

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(30, 30, 30);

    pdf.text(fam.head_name.substring(0, 28), cols[0].x, y + 4.5);
    pdf.setTextColor(fam.is_subscriber ? 0 : 180, fam.is_subscriber ? 130 : 80, fam.is_subscriber ? 60 : 0);
    const statusText = fam.is_subscriber ? 'Subscribed' : 'Not Sub.';
    const exemptText = (fam.exempt_count || 0) > 0 ? ` (${fam.exempt_count} exempt)` : '';
    pdf.text(statusText + exemptText, cols[1].x, y + 4.5);
    pdf.setTextColor(60, 60, 60);
    pdf.text(String(fam.adult_count), cols[2].x, y + 4.5);
    pdf.text(String(fam.young_count), cols[3].x, y + 4.5);
    pdf.text(String(fam.child_count), cols[4].x, y + 4.5);
    pdf.setFont('helvetica', 'bold');
    if (isFullyExempt) {
      pdf.setTextColor(120, 80, 200);
      pdf.text('Exempt', cols[5].x, y + 4.5);
    } else {
      pdf.setTextColor(0, 82, 204);
      pdf.text(fmtNum(fam.total_cost), cols[5].x, y + 4.5);
    }

    y += 7.5;
    rowIdx++;
  }

  // ── Grand Total ──
  y += 3;
  line(margin, pageW - margin, y, [100, 120, 200]);
  y += 5;
  pdf.setFillColor(0, 82, 204);
  pdf.rect(margin, y, pageW - margin * 2, 10, 'F');
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(255, 255, 255);
  pdf.text('Grand Total:', margin + 3, y + 6.5);
  const totalStr = fmtNum(report.summary.grand_total);
  const tW = pdf.getTextWidth(totalStr);
  pdf.text(totalStr, pageW - margin - tW - 3, y + 6.5);
  y += 15;

  // ── Footer ──
  const footerY = pageH - 8;
  line(margin, pageW - margin, footerY - 2, [200, 200, 200]);
  pdf.setFontSize(7);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(150, 150, 150);
  centerText(`Generated: ${new Date().toLocaleDateString('en-SA')} | Al-Bamuflih Family Tree`, footerY, 7);

  const safeName = (report.event.name || 'report').replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '').trim();
  pdf.save(`تقرير_${safeName}.pdf`);
}
