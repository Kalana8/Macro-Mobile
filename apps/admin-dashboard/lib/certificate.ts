export function generateCertificateNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CERT-${year}-${rand}`;
}

/**
 * Renders a one-page certificate PDF server-side (jsPDF's core text/shape
 * drawing works fine without a DOM). Returns null instead of throwing on
 * failure — a certificate DB record with no file_url yet is far better than
 * losing the whole induction submission over a PDF-rendering hiccup; the
 * admin still sees the certificate's status/dates either way.
 */
export async function generateCertificatePdfBuffer(params: {
  certificateNumber: string;
  employeeName: string;
  siteName: string;
  companyName: string;
  assignmentName: string;
  issuedAt: Date;
  scorePercent: number;
  passMarkPercent: number;
  attemptCount: number;
  /** Encoded into a QR code so a phone camera can jump straight to the verification page — omitted (no QR) if not provided. */
  verifyUrl?: string;
}): Promise<Buffer | null> {
  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = 210;
    const pageHeight = 297;
    const centerX = pageWidth / 2;

    const NAVY: [number, number, number] = [31, 78, 121];
    const GOLD: [number, number, number] = [235, 196, 104];
    const CRIMSON: [number, number, number] = [178, 58, 82];
    const PALE_BLUE: [number, number, number] = [175, 201, 222];

    // Pale-blue background with a decorative navy/gold/crimson triangle
    // cluster in two opposite corners, echoing the certificate's on-screen
    // design — then a white card floated on top for the actual content.
    doc.setFillColor(...PALE_BLUE);
    doc.rect(0, 0, pageWidth, pageHeight, "F");

    const t = 52; // corner triangle cluster size, mm
    doc.setFillColor(...NAVY);
    doc.triangle(0, 0, t, 0, 0, t, "F");
    doc.triangle(pageWidth, pageHeight, pageWidth - t, pageHeight, pageWidth, pageHeight - t, "F");
    doc.setFillColor(...GOLD);
    doc.triangle(0, 0, t * 0.62, 0, 0, t * 0.62, "F");
    doc.triangle(pageWidth, pageHeight, pageWidth - t * 0.62, pageHeight, pageWidth, pageHeight - t * 0.62, "F");
    doc.setFillColor(...CRIMSON);
    doc.triangle(0, t * 0.3, t * 0.3, 0, 0, 0, "F");
    doc.triangle(pageWidth, pageHeight - t * 0.3, pageWidth - t * 0.3, pageHeight, pageWidth, pageHeight, "F");

    doc.setFillColor(255, 255, 255);
    doc.rect(14, 14, pageWidth - 28, pageHeight - 28, "F");
    doc.setDrawColor(...PALE_BLUE);
    doc.setLineWidth(1.2);
    doc.rect(20, 20, pageWidth - 40, pageHeight - 40);

    doc.setTextColor(...NAVY);
    doc.setFont("times", "bold");
    doc.setFontSize(40);
    doc.text("CERTIFICATE", centerX, 62, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text("OF SITE INDUCTION COMPLETION", centerX, 72, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(90, 90, 90);
    doc.text("This certificate is awarded to", centerX, 100, { align: "center" });

    doc.setFont("times", "bolditalic");
    doc.setFontSize(30);
    doc.setTextColor(...CRIMSON);
    doc.text(params.employeeName, centerX, 118, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text("Has successfully completed the site induction for", centerX, 136, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...NAVY);
    doc.text(params.assignmentName, centerX, 146, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(90, 90, 90);
    doc.text(`at ${params.siteName} — ${params.companyName}`, centerX, 155, { align: "center" });

    // Assessment Result block — the certificate reflects the actual scored
    // attempt it was generated from, never a generic "completed" claim.
    doc.setDrawColor(...PALE_BLUE);
    doc.setLineWidth(0.3);
    doc.line(55, 167, pageWidth - 55, 167);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text("ASSESSMENT RESULT", centerX, 174, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text(`Score: ${params.scorePercent}%`, centerX - 55, 184, { align: "center" });
    doc.text(`Pass Mark: ${params.passMarkPercent}%`, centerX, 184, { align: "center" });
    doc.text(`Attempts: ${params.attemptCount}`, centerX + 55, 184, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(92, 105, 0);
    doc.text("STATUS: PASSED", centerX, 195, { align: "center" });

    const issued = params.issuedAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    doc.setDrawColor(...PALE_BLUE);
    doc.setLineWidth(0.4);
    doc.line(45, 205, pageWidth - 45, 205);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text(issued, 55, 213, { align: "center" });
    doc.text("Macro Property Services", pageWidth - 55, 213, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text("DATE COMPLETED", 55, 219, { align: "center" });
    doc.text("AUTHORISED", pageWidth - 55, 219, { align: "center" });

    if (params.verifyUrl) {
      try {
        const QRCode = (await import("qrcode")).default;
        const qrDataUrl = await QRCode.toDataURL(params.verifyUrl, { margin: 1, width: 200 });
        doc.addImage(qrDataUrl, "PNG", centerX - 12, 230, 24, 24);
      } catch {
        // QR code is a nice-to-have — a broken QR render should never take
        // down certificate generation.
      }
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(140, 140, 140);
    doc.text(`Certificate No. ${params.certificateNumber}`, centerX, 268, { align: "center" });

    return Buffer.from(doc.output("arraybuffer"));
  } catch {
    return null;
  }
}
