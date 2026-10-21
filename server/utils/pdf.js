// Server-generated PDFs: certificates (PRD §6) and teacher reports (PRD §4).
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';

const PURPLE = '#5b4bff';
const GOLD = '#f5a623';
const INK = '#22284a';

export async function certificatePdf({ profile, certificate, baseUrl = 'http://localhost:5173' }) {
  const verifyUrl = `${baseUrl}/verify/${certificate.serial}`;
  const qr = await QRCode.toDataURL(verifyUrl, { margin: 0, width: 180 });
  const qrBuf = Buffer.from(qr.split(',')[1], 'base64');

  return new Promise((resolve) => {
    const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    const W = doc.page.width;
    const H = doc.page.height;

    // Background & border
    doc.rect(0, 0, W, H).fill('#fffdf5');
    doc.lineWidth(14).strokeColor(PURPLE).rect(18, 18, W - 36, H - 36).stroke();
    doc.lineWidth(3).strokeColor(GOLD).rect(30, 30, W - 60, H - 60).stroke();

    // Corner ornaments
    for (const [x, y] of [[46, 46], [W - 46, 46], [46, H - 46], [W - 46, H - 46]]) {
      doc.circle(x, y, 7).fill(GOLD);
    }

    // Header
    doc.fillColor(PURPLE).font('Helvetica-Bold').fontSize(22).text('KNOWLEDGE BANK', 0, 62, { align: 'center', characterSpacing: 3 });
    doc.fillColor(INK).font('Helvetica').fontSize(12).text('Certificate of Achievement', 0, 92, { align: 'center' });

    // Ribbon
    doc.roundedRect(W / 2 - 90, 118, 180, 6, 3).fill(GOLD);

    doc.fillColor(INK).font('Helvetica').fontSize(14).text('This certifies that', 0, 150, { align: 'center' });
    doc.fillColor(PURPLE).font('Helvetica-Bold').fontSize(40).text(`${profile.avatar || '⭐'}  ${profile.name}`, 0, 176, { align: 'center' });

    const kindLine = certificate.kind === 'top'
      ? 'was a TOP PERFORMER in a group quiz session'
      : 'has PASSED the practice quiz';
    doc.fillColor(INK).font('Helvetica').fontSize(15).text(kindLine, 0, 236, { align: 'center' });

    doc.font('Helvetica-Bold').fontSize(20).fillColor(INK).text(`“${certificate.title}”`, 0, 266, { align: 'center' });
    doc.font('Helvetica').fontSize(13).fillColor('#555b7e')
      .text(`Score: ${certificate.pct}%   •   Source: ${certificate.source}`, 0, 300, { align: 'center' });

    // Footer: date, serial, QR
    const footY = H - 130;
    doc.font('Helvetica').fontSize(11).fillColor(INK)
      .text(`Awarded on ${new Date(certificate.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, 70, footY, { width: 220 });
    doc.fontSize(9).fillColor('#7a80a0')
      .text('Verify this certificate by scanning the QR code.', 70, footY + 40, { width: 220 });

    doc.image(qrBuf, W / 2 - 55, footY - 10, { width: 110 });

    doc.font('Helvetica').fontSize(11).fillColor(INK)
      .text(`Serial: ${certificate.serial}`, W - 290, footY, { width: 220, align: 'right' });
    doc.fontSize(9).fillColor('#7a80a0')
      .text('Knowledge Bank • Learn • Practice • Achieve', W - 290, footY + 40, { width: 220, align: 'right' });

    // Signature line
    doc.lineWidth(1).strokeColor('#c9cde3').moveTo(W / 2 - 120, H - 72).lineTo(W / 2 + 120, H - 72).stroke();
    doc.fontSize(9).fillColor('#7a80a0').text('Knowledge Bank Team', 0, H - 66, { align: 'center' });

    doc.end();
  });
}

export async function classReportPdf({ teacherClass, rows, summary }) {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4', margin: 46 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    doc.fillColor(PURPLE).font('Helvetica-Bold').fontSize(20).text('Class Performance Report', 46, 46);
    doc.fillColor(INK).font('Helvetica').fontSize(11)
      .text(`${teacherClass.name}  •  Class code ${teacherClass.code}`, 46, 78);
    doc.fillColor('#7a80a0').text(`Generated ${new Date().toLocaleString('en-IN')}`, 46, 96);

    doc.roundedRect(46, 120, doc.page.width - 92, 54, 8).fill('#f2f1ff');
    doc.fillColor(PURPLE).font('Helvetica-Bold').fontSize(12)
      .text(`Students: ${summary.students}    Quizzes attempted: ${summary.attempts}    Class average: ${summary.avgPct}%    Pass rate: ${summary.passRate}%`, 60, 142);

    let y = 200;
    doc.fillColor(INK).font('Helvetica-Bold').fontSize(11);
    doc.text('Student', 46, y); doc.text('Nickname', 170, y); doc.text('Attempts', 300, y);
    doc.text('Avg %', 370, y); doc.text('Best %', 430, y); doc.text('Certificates', 490, y);
    y += 8;
    doc.lineWidth(1).strokeColor('#d9dcef').moveTo(46, y).lineTo(doc.page.width - 46, y).stroke();

    doc.font('Helvetica').fontSize(10);
    for (const r of rows) {
      y += 18;
      if (y > 780) { doc.addPage(); y = 60; }
      doc.fillColor(INK).text(r.name, 46, y);
      doc.fillColor('#555b7e').text(r.nickname, 170, y);
      doc.fillColor(INK).text(String(r.attempts), 300, y);
      doc.text(`${r.avgPct}%`, 370, y);
      doc.text(`${r.bestPct}%`, 430, y);
      doc.text(String(r.certificates), 490, y);
    }

    y += 30;
    doc.fillColor('#7a80a0').fontSize(9)
      .text('Knowledge Bank for Schools — report covers quizzes taken on the platform. Prices and invoices exclude GST.', 46, y);

    doc.end();
  });
}
