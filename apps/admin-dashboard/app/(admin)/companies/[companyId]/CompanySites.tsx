"use client";

import { useState } from "react";
import { Badge, EmptyState, IconChip, PlusIcon, PrimaryButton, Table } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";
import type { Site } from "@macro/shared/types";
import { deleteSiteAction } from "./siteActions";
import { SiteModal } from "./SiteModal";

export function CompanySites({ companyId, sites }: { companyId: string; sites: Site[] }) {
  const [modalSite, setModalSite] = useState<Site | "new" | null>(null);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-text-dark">Sites</div>
        <PrimaryButton onClick={() => setModalSite("new")}>
          <PlusIcon />
          Add Site
        </PrimaryButton>
      </div>

      {sites.length === 0 ? (
        <EmptyState
          title="No sites yet"
          hint="Add a site with its coordinates before employees can clock in here — the geofenced login checks against this location."
        />
      ) : (
        <Table head={["Name", "Address", "Coordinates", "Status", "Actions"]}>
          {sites.map((site) => (
            <tr key={site.id} className="border-b border-border last:border-0">
              <td className="px-5 py-3.5 font-semibold text-text-dark">{site.name}</td>
              <td className="px-5 py-3.5 text-text-muted">{site.address || "—"}</td>
              <td className="px-5 py-3.5 text-text-muted">
                {site.lat.toFixed(5)}, {site.lng.toFixed(5)}
              </td>
              <td className="px-5 py-3.5">
                <Badge tone={site.status === "open" ? "success" : "neutral"}>
                  {site.status === "open" ? "Open" : "Closed"}
                </Badge>
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <IconChip onClick={() => setModalSite(site)} aria-label="Edit" title="Edit">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </IconChip>
                  <DeleteButton
                    action={deleteSiteAction}
                    confirmText={`Delete ${site.name}? Employees won't be able to clock in there anymore.`}
                    hiddenFields={{ id: site.id, companyId }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {modalSite && (
        <SiteModal companyId={companyId} site={modalSite === "new" ? undefined : modalSite} onClose={() => setModalSite(null)} />
      )}
    </div>
  );
}
