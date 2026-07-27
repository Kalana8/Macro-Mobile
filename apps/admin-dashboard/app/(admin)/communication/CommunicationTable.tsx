"use client";

import { useState } from "react";
import { Badge, EmptyState, PlusIcon, PrimaryButton, Table } from "@/components/ui";
import { AddCommunicationModal } from "./AddCommunicationModal";
import { ThreadDetailModal } from "./ThreadDetailModal";

const PRIORITY_TONE = { low: "neutral", medium: "warning", high: "error" } as const;

interface Row {
  id: string;
  title: string;
  companyName: string;
  siteName: string;
  employeeNames: string;
  priority: "low" | "medium" | "high";
  status: "open" | "closed";
  last_update: string;
}

interface Site {
  id: string;
  name: string;
  company_id: string;
}
interface EmployeeOption {
  id: string;
  full_name: string;
  companyIds: string[];
}

export function CommunicationTable({
  rows,
  companies,
  sites,
  employees,
  adminId,
  adminName,
}: {
  rows: Row[];
  companies: { id: string; name: string }[];
  sites: Site[];
  employees: EmployeeOption[];
  adminId: string;
  adminName: string;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<Row | null>(null);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <PrimaryButton onClick={() => setShowAdd(true)}>
          <PlusIcon />
          New Communication
        </PrimaryButton>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No threads yet" hint="Start a new communication with the button above." />
      ) : (
        <Table head={["Title", "Company", "Site", "Employees", "Priority", "Status", "Last Update"]}>
          {rows.map((c) => (
            <tr key={c.id} onClick={() => setSelected(c)} className="cursor-pointer border-b border-border last:border-0">
              <td className="px-5 py-3.5 font-semibold text-text-dark">{c.title}</td>
              <td className="px-5 py-3.5 text-text-muted">{c.companyName}</td>
              <td className="px-5 py-3.5 text-text-muted">{c.siteName}</td>
              <td className="px-5 py-3.5 text-text-muted">{c.employeeNames}</td>
              <td className="px-5 py-3.5">
                <Badge tone={PRIORITY_TONE[c.priority]}>{c.priority}</Badge>
              </td>
              <td className="px-5 py-3.5">
                <Badge tone={c.status === "open" ? "info" : "neutral"}>{c.status}</Badge>
              </td>
              <td className="px-5 py-3.5 text-text-muted">{c.last_update || "—"}</td>
            </tr>
          ))}
        </Table>
      )}

      {showAdd && (
        <AddCommunicationModal
          companies={companies}
          sites={sites}
          employees={employees}
          adminId={adminId}
          adminName={adminName}
          onClose={() => setShowAdd(false)}
        />
      )}

      {selected && (
        <ThreadDetailModal thread={selected} adminId={adminId} adminName={adminName} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
