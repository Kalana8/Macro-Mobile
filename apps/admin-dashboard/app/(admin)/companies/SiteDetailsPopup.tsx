"use client";

import { Modal } from "@/components/Modal";
import { Badge } from "@/components/ui";
import type { Site } from "@macro/shared/types";

/** Read-only popup for inspecting an existing site's details — surfaced from the Add Site name picker so an admin can check a site's address before deciding whether to add another one alongside it. */
export function SiteDetailsPopup({ site, onClose }: { site: Site; onClose: () => void }) {
  return (
    <Modal title={site.name} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-text-muted">Status</span>
          <Badge tone={site.status === "open" ? "success" : "neutral"}>{site.status === "open" ? "Open" : "Closed"}</Badge>
        </div>
        <div>
          <div className="text-[13px] text-text-muted">Address</div>
          <div className="text-sm font-semibold text-text-dark">{site.address || "—"}</div>
        </div>
        <div>
          <div className="text-[13px] text-text-muted">Coordinates</div>
          <div className="text-sm font-semibold text-text-dark">{site.lat.toFixed(5)}, {site.lng.toFixed(5)}</div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-2 w-full rounded-[12px] bg-bg py-3 text-sm font-bold text-text-dark"
        >
          Close
        </button>
      </div>
    </Modal>
  );
}
