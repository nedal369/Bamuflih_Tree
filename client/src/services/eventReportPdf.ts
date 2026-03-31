import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { EventReport } from '../types';

function fmt(n: number): string {
  return n.toLocaleString('en-US') + ' ر.س';
}

const costItemAr: Record<string, string> = {
  dinner: 'العشاء',
  venue: 'المكان',
  hospitality: 'الضيافة',
  other: 'أخرى',
};

function buildReportHtml(report: EventReport): string {
  const totalCost = Object.values(report.cost_breakdown).reduce((s, v) => s + v, 0);
  const costItems = Object.entries(report.cost_breakdown).filter(([, v]) => v > 0);
  const exemptNames = (report.subscriber_exemptions || []).map(k => costItemAr[k] || k).join('، ');
  const hasFamilies = report.families && report.families.length > 0;

  const familyRows = (report.families || []).map((fam, i) => {
    const totalMembers = fam.adult_count + fam.young_count + fam.child_count;
    const isFullyExempt = (fam.exempt_count || 0) >= totalMembers;
    const rowBg = isFullyExempt ? '#f3f0ff' : !fam.is_subscriber ? '#fff8f0' : (i % 2 === 0 ? '#f8f9fc' : '#ffffff');
    const costCell = isFullyExempt
      ? `<span style="color:#7c3aed;font-weight:700">معفى بالكامل</span>`
      : `<span style="color:#0052cc;font-weight:700">${fmt(fam.total_cost)}</span>`;
    const exemptBadge = (fam.exempt_count || 0) > 0 ? ` <span style="color:#7c3aed;font-size:10px">(${fam.exempt_count} معفى)</span>` : '';
    return `
      <tr style="background:${rowBg};border-bottom:1px solid #eee">
        <td style="padding:6px 8px;font-size:11px">${fam.head_name}</td>
        <td style="padding:6px 8px;text-align:center;font-size:10px">
          <span style="color:${fam.is_subscriber ? '#16a34a' : '#c2410c'};font-weight:600">
            ${fam.is_subscriber ? 'مشترك' : 'غير مشترك'}
          </span>${exemptBadge}
        </td>
        <td style="padding:6px 8px;text-align:center;font-size:11px">${fam.adult_count}</td>
        <td style="padding:6px 8px;text-align:center;font-size:11px">${fam.young_count}</td>
        <td style="padding:6px 8px;text-align:center;font-size:11px">${fam.child_count}</td>
        <td style="padding:6px 8px;text-align:start;font-size:11px">${costCell}</td>
      </tr>`;
  }).join('');

  return `
    <div dir="rtl" style="font-family:'Tajawal',sans-serif;width:794px;background:#fff;color:#1a1a1a;padding:0">

      <!-- Header -->
      <div style="background:#0052cc;padding:20px 24px;margin-bottom:0">
        <div style="color:#fff;font-size:20px;font-weight:800;text-align:center;margin-bottom:4px">
          ${report.event.name || 'تقرير المناسبة'}
        </div>
        <div style="color:#b3d1ff;font-size:12px;text-align:center">
          ${report.event.date || ''} | صندوق آل بامفلح العائلي
        </div>
      </div>

      <!-- Cost breakdown -->
      <div style="background:#f5f8ff;border:1px solid #c8d7f5;margin:16px;padding:14px;border-radius:8px">
        <div style="color:#3250b4;font-weight:700;font-size:12px;margin-bottom:8px">تفصيل التكاليف:</div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px">
          ${costItems.map(([k, v]) => `
            <span style="font-size:11px;color:#444">${costItemAr[k] || k}: <strong>${fmt(v)}</strong></span>
          `).join('')}
        </div>
        <div style="font-size:12px;font-weight:700;color:#1a1a1a">
          إجمالي التكاليف: ${fmt(totalCost)}
        </div>
        ${exemptNames ? `<div style="font-size:10px;color:#16a34a;margin-top:4px">إعفاءات المشتركين: ${exemptNames}</div>` : ''}
      </div>

      <!-- Rates -->
      ${hasFamilies ? `
      <div style="display:flex;gap:12px;margin:0 16px 16px">
        <div style="flex:1;background:#f0fff4;border:1px solid #bbf7d0;padding:12px;border-radius:8px">
          <div style="color:#16a34a;font-weight:700;font-size:12px;margin-bottom:6px">✓ المشترك</div>
          <div style="font-size:12px;font-weight:800;color:#15803d">بالغ: ${fmt(report.rates.subscriber_adult)}</div>
          ${report.rates.subscriber_young > 0 ? `<div style="font-size:11px;color:#16a34a;margin-top:2px">صغير: ${fmt(report.rates.subscriber_young)}</div>` : ''}
        </div>
        <div style="flex:1;background:#fff7ed;border:1px solid #fed7aa;padding:12px;border-radius:8px">
          <div style="color:#c2410c;font-weight:700;font-size:12px;margin-bottom:6px">✗ غير المشترك</div>
          <div style="font-size:12px;font-weight:800;color:#b45309">بالغ: ${fmt(report.rates.non_subscriber_adult)}</div>
          ${report.rates.non_subscriber_young > 0 ? `<div style="font-size:11px;color:#c2410c;margin-top:2px">صغير: ${fmt(report.rates.non_subscriber_young)}</div>` : ''}
        </div>
      </div>
      ` : ''}

      <!-- Summary bar -->
      <div style="margin:0 16px 12px;padding:8px 12px;background:#f1f5f9;border-radius:8px;font-size:11px;color:#555;display:flex;gap:20px;flex-wrap:wrap">
        <span>العائلات: <strong>${report.summary.total_families}</strong></span>
        <span style="color:#16a34a">المشتركون: <strong>${report.summary.subscriber_families}</strong></span>
        <span style="color:#c2410c">غير المشتركين: <strong>${report.summary.non_subscriber_families}</strong></span>
        <span>إجمالي الأفراد: <strong>${report.summary.total_people}</strong></span>
      </div>

      <!-- Families table -->
      <div style="margin:0 16px 16px;border-radius:8px;overflow:hidden;border:1px solid #e2e8f0">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead>
            <tr style="background:#2850b4;color:#fff">
              <th style="padding:8px;text-align:start;font-size:11px">رب الأسرة</th>
              <th style="padding:8px;text-align:center;font-size:11px">الاشتراك</th>
              <th style="padding:8px;text-align:center;font-size:11px">بالغ</th>
              <th style="padding:8px;text-align:center;font-size:11px">صغير</th>
              <th style="padding:8px;text-align:center;font-size:11px">طفل</th>
              <th style="padding:8px;text-align:start;font-size:11px">المطلوب</th>
            </tr>
          </thead>
          <tbody>
            ${familyRows}
          </tbody>
        </table>
      </div>

      <!-- Grand total -->
      <div style="margin:0 16px 16px;background:#0052cc;padding:12px 16px;border-radius:8px;display:flex;justify-content:space-between;align-items:center">
        <span style="color:#fff;font-weight:700;font-size:13px">الإجمالي الكلي</span>
        <span style="color:#fff;font-weight:800;font-size:16px">${fmt(report.summary.grand_total)}</span>
      </div>

      <!-- Footer -->
      <div style="margin:0 16px 16px;text-align:center;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:8px">
        تاريخ الإصدار: ${new Date().toLocaleDateString('en-SA')} | صندوق آل بامفلح العائلي
      </div>

    </div>
  `;
}

export async function generateEventReportPdf(report: EventReport): Promise<void> {
  // Wait for fonts to be ready
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  // Build HTML
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.innerHTML = buildReportHtml(report);
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

    const pageW = pdf.internal.pageSize.getWidth();   // 595.28 pt
    const pageH = pdf.internal.pageSize.getHeight();  // 841.89 pt

    const imgW = canvas.width;
    const imgH = canvas.height;
    const ratio = pageW / imgW;
    const scaledH = imgH * ratio;

    if (scaledH <= pageH) {
      pdf.addImage(imgData, 'PNG', 0, 0, pageW, scaledH);
    } else {
      // Paginate: slice the canvas vertically in page-sized chunks
      const sliceH = Math.floor(pageH / ratio); // canvas pixels per page
      let offsetY = 0;
      let page = 0;
      while (offsetY < imgH) {
        if (page > 0) pdf.addPage();
        const remaining = imgH - offsetY;
        const thisSlice = Math.min(sliceH, remaining);
        // Use a slice canvas
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = imgW;
        sliceCanvas.height = thisSlice;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(canvas, 0, offsetY, imgW, thisSlice, 0, 0, imgW, thisSlice);
          const sliceData = sliceCanvas.toDataURL('image/png');
          pdf.addImage(sliceData, 'PNG', 0, 0, pageW, thisSlice * ratio);
        }
        offsetY += sliceH;
        page++;
      }
    }

    const safeName = (report.event.name || 'report').replace(/[^a-zA-Z0-9\u0600-\u06FF\s]/g, '').trim();
    pdf.save(`تقرير_${safeName}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}
