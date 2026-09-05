export function generateCertificateNumber(): string {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `CERT-${year}-${rand}`;
}

/**
 * Renders a simple one-page certificate PDF server-side (jsPDF's core text
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
  issuedAt: Date;
  expiresAt: Date;
}): Promise<Buffer | null> {
  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    const pageWidth = 210;
    const centerX = pageWidth / 2;

    doc.setDrawColor(14, 98, 209);
    doc.setLineWidth(1.5);
    doc.rect(10, 10, pageWidth - 20, 277);

    doc.setTextColor(14, 98, 209);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("MACRO PROPERTY SERVICES", centerX, 35, { align: "center" });

    doc.setTextColor(20, 20, 20);
    doc.setFontSize(26);
    doc.text("Certificate of Site Induction", centerX, 55, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text("This certifies that", centerX, 80, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(params.employeeName, centerX, 95, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.text("has successfully completed the site induction for", centerX, 110, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(`${params.siteName} — ${params.companyName}`, centerX, 122, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const issued = params.issuedAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    const expires = params.expiresAt.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    doc.text(`Issued: ${issued}`, centerX, 145, { align: "center" });
    doc.text(`Valid until: ${expires}`, centerX, 153, { align: "center" });

    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Certificate No. ${params.certificateNumber}`, centerX, 270, { align: "center" });

    return Buffer.from(doc.output("arraybuffer"));
  } catch {
    return null;
  }
}
