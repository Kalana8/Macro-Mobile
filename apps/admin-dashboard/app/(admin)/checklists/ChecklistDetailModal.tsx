"use client";

import { useRef } from "react";
import { Modal } from "@/components/Modal";
import type { Checklist } from "@macro/shared/types";
import { ChecklistDocument } from "./ChecklistDocument";
import { ChecklistShareBar } from "./ChecklistShareBar";

export function ChecklistDetailModal({
  checklist,
  companyName,
  employeeName,
  onClose,
}: {
  checklist: Checklist;
  companyName: string;
  employeeName: string;
  onClose: () => void;
}) {
  // PDF/Image capture happens off a dedicated, fixed-width copy of the
  // document rather than the one visible in the modal — the modal itself is
  // only ~460px wide, which squeezes the responsive image grid down to tiny
  // cramped thumbnails and wraps text awkwardly once captured. This hidden
  // copy renders at a proper document width regardless of the modal's size.
  const captureRef = useRef<HTMLDivElement>(null);
  const areaNames = checklist.areas.map((a) => a.main_area).join(", ") || "Checklist";
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/shared/checklists/${checklist.id}` : "";

  return (
    <Modal title={areaNames} onClose={onClose}>
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

      <button
        type="button"
        onClick={onClose}
        className="mt-4 w-full rounded-[12px] bg-bg py-3 text-sm font-bold text-text-dark"
      >
        Close
      </button>
    </Modal>
  );
}
