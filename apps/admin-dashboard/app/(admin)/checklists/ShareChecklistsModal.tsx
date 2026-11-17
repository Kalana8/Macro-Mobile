"use client";

import { useMemo, useRef, useState } from "react";
import { checklistFileName, checklistName } from "@/lib/checklistName";
import { Modal } from "@/components/Modal";
import type { Checklist } from "@macro/shared/types";
import { ChecklistDocument } from "./ChecklistDocument";

export interface ShareableChecklist extends Checklist {
  companyName: string;
  employeeName: string;
}

const titleOf = (c: Checklist & { companyName?: string }) => checklistName(c.companyName, c.site);

async function capture(node: HTMLDivElement) {
  // Wait for photos and the web font, or the capture can come out blank or misaligned.
  const images = Array.from(node.querySelectorAll("img"));
  await Promise.all([
    document.fonts ? document.fonts.ready : Promise.resolve(),
    ...images.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))),
  ]);
  const { toPng } = await import("html-to-image");
  return toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });
}

/**
 * Share several submitted checklists at once: one PDF with each checklist
 * starting on a new page, or their links by WhatsApp, email, copy or the
 * device's share sheet. Links open the same public page as a single share.
 */
export function ShareChecklistsModal({ checklists, onClose }: { checklists: ShareableChecklist[]; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The off-screen copies, one per checklist, found by data-capture when the PDF is made.
  const pagesRef = useRef<HTMLDivElement>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const links = useMemo(
    () => checklists.map((c) => ({ c, url: `${origin}/shared/checklists/${c.id}`, label: `${titleOf(c)} — ${c.assigned_date}` })),
    [checklists, origin],
  );
  const heading = checklists.length === 1 ? titleOf(checklists[0]) : `${checklists.length} checklists`;
  const message = links.map((l) => `${l.label}\n${l.url}`).join("\n\n");

  async function downloadPdf() {
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const W = 210;
      const H = 297;
      const nodes = Array.from(pagesRef.current?.querySelectorAll<HTMLDivElement>("[data-capture]") ?? []);
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const dataUrl = await capture(node);
        const img = new Image();
        img.src = dataUrl;
        await img.decode();
        const h = (img.height * W) / img.width;
        // Each checklist starts on a new page and runs on over as many pages as it needs.
        if (i > 0) doc.addPage();
        let offset = 0;
        doc.addImage(dataUrl, "PNG", 0, offset, W, h);
        for (let left = h - H; left > 0; left -= H) {
          offset -= H;
          doc.addPage();
          doc.addImage(dataUrl, "PNG", 0, offset, W, h);
        }
      }
      doc.save(`${checklistFileName(checklists)}.pdf`);
      setNotice(`Downloaded ${heading}.`);
    } catch {
      setError("Couldn't create the PDF. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLinks() {
    setError(null);
    try {
      await navigator.clipboard.writeText(message);
      setNotice("Links copied.");
    } catch {
      setError("Couldn't copy. Your browser may have blocked the clipboard.");
    }
  }

  async function nativeShare() {
    setError(null);
    if (!navigator.share) return copyLinks();
    try {
      await navigator.share({ title: heading, text: message });
    } catch {
      // Closing the share sheet isn't an error.
    }
  }

  const button = "flex items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[12.5px] font-bold disabled:opacity-50";

  return (
    <Modal title={`Share ${heading}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <ul className="max-h-[200px] overflow-y-auto rounded-[12px] border border-border">
          {links.map(({ c }) => (
            <li key={c.id} className="border-b border-border px-3.5 py-2 text-[13px] text-text-dark last:border-b-0">
              <div className="font-semibold">{titleOf(c)}</div>
              <div className="text-xs text-text-muted">{[c.assigned_date, c.companyName, c.employeeName].join(" · ")}</div>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <button type="button" onClick={downloadPdf} disabled={busy} className={`${button} border border-primary bg-primary text-white`}>
            {busy ? "Preparing…" : "Download PDF"}
          </button>
          <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className={`${button} border border-[#25D366] bg-[#25D366] text-white`}>
            WhatsApp
          </a>
          <a href={`mailto:?subject=${encodeURIComponent(`Checklists: ${heading}`)}&body=${encodeURIComponent(`View the checklists here:\n\n${message}`)}`} className={`${button} border border-border bg-white text-text-dark`}>
            Email
          </a>
          <button type="button" onClick={copyLinks} className={`${button} border border-border bg-white text-text-dark`}>
            Copy links
          </button>
          <button type="button" onClick={nativeShare} className={`${button} border border-border bg-white text-text-dark`}>
            Share
          </button>
        </div>

        {error && <div className="text-[12.5px] text-error-text">{error}</div>}
        {notice && <div className="rounded-lg bg-olive/15 px-3.5 py-2.5 text-sm font-semibold text-olive-text">{notice}</div>}

        <button type="button" onClick={onClose} className="w-full rounded-[12px] bg-bg py-3 text-sm font-bold text-text-dark">
          Close
        </button>
      </div>

      {/* Off-screen, document-width copies for the PDF, as in the single checklist popup. */}
      <div ref={pagesRef} className="fixed left-[-10000px] top-0 w-[900px]" aria-hidden="true">
        {checklists.map((c) => (
          <div key={c.id} data-capture>
            <ChecklistDocument checklist={c} companyName={c.companyName} employeeName={c.employeeName} imageGridClassName="grid grid-cols-4 gap-2.5" />
          </div>
        ))}
      </div>
    </Modal>
  );
}
