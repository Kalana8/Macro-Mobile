const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 10;
const FOOTER_RESERVE_MM = 8;
const USABLE_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;
const USABLE_HEIGHT_MM = A4_HEIGHT_MM - MARGIN_MM * 2 - FOOTER_RESERVE_MM;
const BLOCK_GAP_MM = 6;

async function waitForImages(el: HTMLElement) {
  const images = Array.from(el.querySelectorAll("img"));
  await Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    ...images.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))),
  ]);
}

async function captureBlock(el: HTMLElement): Promise<{ dataUrl: string; widthMm: number; heightMm: number }> {
  await waitForImages(el);
  const { toPng } = await import("html-to-image");
  const dataUrl = await toPng(el, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const widthMm = USABLE_WIDTH_MM;
  const heightMm = (img.height * widthMm) / img.width;
  return { dataUrl, widthMm, heightMm };
}

/**
 * Renders each registered block (cover + one per section, see
 * WeeklyReportDocument) to its own image and packs them onto A4 pages —
 * starting a new page whenever a block wouldn't fully fit in what's left,
 * so page breaks land between sections/photos rather than through them.
 * A single block taller than one page (an unusually photo-heavy section)
 * falls back to slicing across consecutive pages so nothing is lost.
 * Returns a Blob (not a base64 data URL — a multi-page report's PDF can
 * easily be several MB as base64 text, which would need to travel to the
 * server as a giant string; a real file upload has no such size concern).
 */
export async function generateReportPdf(
  blocks: { key: string; el: HTMLDivElement }[],
  footerLabel: string
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let cursorY = MARGIN_MM;
  let onFirstPage = true;

  for (const block of blocks) {
    const { dataUrl, widthMm, heightMm } = await captureBlock(block.el);

    if (heightMm > USABLE_HEIGHT_MM) {
      // Oversized block — slice it across as many pages as needed rather
      // than letting it overflow past the page edge and get lost.
      if (!onFirstPage) doc.addPage();
      let heightLeft = heightMm;
      let offset = 0;
      doc.addImage(dataUrl, "PNG", MARGIN_MM, MARGIN_MM, widthMm, heightMm);
      heightLeft -= USABLE_HEIGHT_MM;
      while (heightLeft > 0) {
        offset -= USABLE_HEIGHT_MM;
        doc.addPage();
        doc.addImage(dataUrl, "PNG", MARGIN_MM, MARGIN_MM + offset, widthMm, heightMm);
        heightLeft -= USABLE_HEIGHT_MM;
      }
      cursorY = MARGIN_MM + (heightMm % USABLE_HEIGHT_MM) + BLOCK_GAP_MM;
      onFirstPage = false;
      continue;
    }

    if (!onFirstPage && cursorY + heightMm > MARGIN_MM + USABLE_HEIGHT_MM) {
      doc.addPage();
      cursorY = MARGIN_MM;
    }

    doc.addImage(dataUrl, "PNG", MARGIN_MM, cursorY, widthMm, heightMm);
    cursorY += heightMm + BLOCK_GAP_MM;
    onFirstPage = false;
  }

  const pageCount = doc.getNumberOfPages();
  const generatedOn = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text(`${footerLabel} · Generated ${generatedOn}`, MARGIN_MM, A4_HEIGHT_MM - 6);
    doc.text(`Page ${p} of ${pageCount}`, A4_WIDTH_MM - MARGIN_MM, A4_HEIGHT_MM - 6, { align: "right" });
  }

  return doc.output("blob");
}
