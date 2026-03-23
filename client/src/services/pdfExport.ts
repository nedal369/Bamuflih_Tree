import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportToPdf(element: HTMLElement, memberName: string) {
  try {
    // Create a clone for PDF rendering
    const clone = element.cloneNode(true) as HTMLElement;
    clone.style.background = 'white';
    clone.style.padding = '40px';
    clone.style.width = element.scrollWidth + 'px';
    clone.style.height = element.scrollHeight + 'px';
    clone.style.position = 'absolute';
    clone.style.left = '-9999px';
    clone.style.top = '0';
    document.body.appendChild(clone);

    // Add header to clone
    const header = document.createElement('div');
    header.style.textAlign = 'center';
    header.style.marginBottom = '30px';
    header.style.fontFamily = 'Tajawal, sans-serif';
    header.style.direction = 'rtl';
    header.innerHTML = `
      <div style="font-size: 28px; font-weight: 800; color: #1D1D1F; margin-bottom: 8px;">
        شجرة عائلة آل بامفلح
      </div>
      <div style="font-size: 20px; font-weight: 600; color: #007AFF; margin-bottom: 4px;">
        ${memberName}
      </div>
      <div style="font-size: 12px; color: #86868B;">
        ${new Date().toLocaleDateString('ar-SA')}
      </div>
      <div style="height: 2px; background: linear-gradient(90deg, transparent, #007AFF, transparent); margin-top: 16px;"></div>
    `;
    clone.insertBefore(header, clone.firstChild);

    const canvas = await html2canvas(clone, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#FFFFFF',
      logging: false,
    });

    document.body.removeChild(clone);

    const imgData = canvas.toDataURL('image/png');
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;

    // Determine orientation
    const isLandscape = imgWidth > imgHeight;
    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: 'a3',
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2;

    const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
    const pdfImgWidth = imgWidth * ratio;
    const pdfImgHeight = imgHeight * ratio;

    const x = (pageWidth - pdfImgWidth) / 2;
    const y = (pageHeight - pdfImgHeight) / 2;

    // Decorative border
    pdf.setDrawColor(0, 122, 255);
    pdf.setLineWidth(0.5);
    pdf.rect(5, 5, pageWidth - 10, pageHeight - 10);

    pdf.addImage(imgData, 'PNG', x, y, pdfImgWidth, pdfImgHeight);

    pdf.save(`شجرة_${memberName}.pdf`);
  } catch (error) {
    console.error('PDF export error:', error);
    alert('حدث خطأ أثناء تصدير الملف');
  }
}
