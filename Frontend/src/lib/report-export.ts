export interface ReportSection { title: string; headings: string[]; rows: string[][] }
export interface ReportDocument { title: string; range: string; generated: string; notes: string[]; sections: ReportSection[]; source?: string }
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const csvCell = (value: string) => `"${/^[\s\uFEFF]*[=+\-@]/u.test(value) || /^[\t\r\n]/.test(value) ? "'" : ''}${value.replaceAll('"', '""')}"`;
export function downloadCsv(report: ReportDocument, filename: string) {
  const rows = [[report.title], [report.range], [report.generated], ...report.notes.map(note => [note]), ...report.sections.flatMap(section => [[section.title], section.headings, ...section.rows, []])];
  saveBlob(new Blob(['\uFEFF', rows.map(row => row.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }), filename);
}
let fontData: Promise<string> | undefined;
async function reportFont() {
  fontData ??= fetch('/assets/report-font.ttf').then(async response => {
    if (!response.ok) throw new Error('The report font could not be loaded. Please try again.');
    const bytes = new Uint8Array(await response.arrayBuffer()); let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(binary);
  }).catch(error => { fontData = undefined; throw error; });
  return fontData;
}
// Both the browser PDF preview and download use this same document.
export async function createPdf(report: ReportDocument) {
  const [{ jsPDF }, font] = await Promise.all([import('jspdf'), reportFont()]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.addFileToVFS('report.ttf', font); doc.addFont('report.ttf', 'Report', 'normal'); doc.setFont('Report');
  doc.setProperties({ title: report.title, subject: report.range, author: report.source ? 'Happy Hentie · Vertwell' : 'Happy Hentie · Vertwell preview' });
  let y = 0;
  const text = (value: string, size = 9, color = '#34302a') => {
    doc.setFontSize(size); doc.setTextColor(color); const lines = doc.splitTextToSize(value, 178) as string[];
    for (const line of lines) { if (y > 273) { doc.addPage(); header(); } doc.text(line, 16, y); y += size * .45 + 1; }
  };
  function header() { y = 18; text(report.title, 16); text(report.range, 9); text(report.generated, 8, '#71675a'); doc.setDrawColor('#d8c9ae'); doc.line(16, y + 1, 194, y + 1); y += 8; }
  header(); report.notes.forEach(note => text(note, 8)); y += 5;
  for (const section of report.sections) {
    const widths = section.headings.map(() => 178 / section.headings.length);
    const tableHeader = () => {
      text(section.title, 12); doc.setFontSize(8);
      const labels = section.headings.map((heading, index) => doc.splitTextToSize(heading, widths[index] - 4) as string[]);
      const height = Math.max(...labels.map(lines => lines.length)) * 4 + 6;
      doc.setFillColor('#eee8dd'); doc.rect(16, y - 4, 178, height, 'F'); doc.setTextColor('#34302a');
      let x = 18; labels.forEach((lines, index) => { doc.text(lines, x, y, { lineHeightFactor: 1.4 }); x += widths[index]; }); y += height + 2;
    };
    // Keep the section title, column headings, and first ordinary row together.
    doc.setFontSize(8);
    const firstRowLines = Math.max(1, ...(section.rows[0] ?? []).map((cell, index) => doc.splitTextToSize(cell, widths[index] - 4).length));
    const firstRowHeight = firstRowLines * 4 + 10;
    doc.setFontSize(12);
    const titleHeight = doc.splitTextToSize(section.title, 178).length * (12 * .45 + 1);
    doc.setFontSize(8);
    const headingHeight = Math.max(...section.headings.map((heading, index) => doc.splitTextToSize(heading, widths[index] - 4).length)) * 4 + 8;
    if (y + titleHeight + headingHeight + (firstRowHeight < 210 ? firstRowHeight : 24) > 272) { doc.addPage(); header(); }
    tableHeader();
    if (!section.rows.length) text('No records in this view.', 9);
    section.rows.forEach(row => {
      doc.setFontSize(8);
      const cells = row.map((cell, index) => doc.splitTextToSize(cell, widths[index] - 4) as string[]);
      // Very long values continue on new pages with repeated column headings.
      const count = Math.max(...cells.map(cell => cell.length)); let offset = 0;
      if (count * 4 + 10 < 210 && y + count * 4 + 10 > 272) { doc.addPage(); header(); tableHeader(); }
      while (offset < count) {
        if (y > 260) { doc.addPage(); header(); tableHeader(); }
        y += 3;
        const available = Math.max(1, Math.floor((272 - y - 4) / 4)); const lines = Math.min(count - offset, available); let x = 18;
        cells.forEach((cell, index) => { doc.text(cell.slice(offset, offset + lines), x, y, { lineHeightFactor: 1.4 }); x += widths[index]; });
        y += lines * 4 + 4; doc.setDrawColor('#e7dfd3'); doc.line(16, y - 2, 194, y - 2); offset += lines;
      }
    }); y += 8;
  }
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor('#71675a'); doc.text(`${report.source ?? 'Sample data'} · Page ${i} of ${pages}`, 16, 288); }
  return doc.output('blob');
}
export async function downloadPdf(report: ReportDocument, filename: string) { saveBlob(await createPdf(report), filename); }
