"use client";

import { useRef } from "react";
import type { Checklist } from "@macro/shared/types";
import { ChecklistDocument } from "@/app/(admin)/checklists/ChecklistDocument";
import { ChecklistShareBar } from "@/app/(admin)/checklists/ChecklistShareBar";

/** Client-side half of the public share page — needs a ref for the PDF/Image capture target and the browser's own origin for the share link, neither of which the server page itself can provide. */
export function SharedChecklistView({
  checklist,
  companyName,
  employeeName,
}: {
  checklist: Checklist;
  companyName: string;
  employeeName: string;
}) {
  // Capture from a dedicated fixed-width copy (same as the admin modal) so
  // the downloaded PDF/Image always come out at a consistent, properly
  // proportioned width, regardless of how narrow the viewer's own browser
  // window happens to be.
  const captureRef = useRef<HTMLDivElement>(null);
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  return (
    <div className="mx-auto max-w-2xl p-5">
      <ChecklistShareBar targetRef={captureRef} checklist={checklist} shareUrl={shareUrl} />
      <div className="overflow-hidden rounded-2xl border border-border">
        <ChecklistDocument checklist={checklist} companyName={companyName} employeeName={employeeName} />
      </div>

      <div className="fixed left-[-10000px] top-0 w-[900px]" aria-hidden="true">
        <ChecklistDocument
          ref={captureRef}
          checklist={checklist}
          companyName={companyName}
          employeeName={employeeName}
          imageGridClassName="grid grid-cols-4 gap-2.5"
        />
      </div>
    </div>
  );
}
