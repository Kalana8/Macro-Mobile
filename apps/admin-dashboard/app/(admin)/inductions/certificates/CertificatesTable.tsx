"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, EmptyState, Select, Table, TextInput } from "@/components/ui";
import { formatDate } from "@macro/shared/datetime";
import type { InductionCertificateStatus } from "@macro/shared/types";
import { setCertificateStatusAction } from "../actions";

export interface CertificateRow {
  id: string;
  tokenId: string;
  certificateNumber: string;
  employeeName: string;
  companyName: string;
  siteName: string;
  assignmentName: string;
  scorePercent: number | null;
  status: InductionCertificateStatus;
  issuedAt: string;
  expiresAt: string;
  fileUrl: string | null;
}

type EffectiveStatus = "active" | "expired" | "revoked" | "pending";

function effectiveStatus(row: CertificateRow): EffectiveStatus {
  if (row.status === "revoked") return "revoked";
  if (new Date() > new Date(row.expiresAt) || row.status === "expired") return "expired";
  if (row.status === "pending") return "pending";
  return "active";
}

const STATUS_TONE: Record<EffectiveStatus, "success" | "error" | "neutral" | "warning"> = {
  active: "success",
  expired: "error",
  revoked: "neutral",
  pending: "warning",
};
const STATUS_LABEL: Record<EffectiveStatus, string> = { active: "Valid", expired: "Expired", revoked: "Revoked", pending: "Pending" };

function fullDate(iso: string): string {
  return formatDate(iso, { day: "2-digit", month: "short", year: "numeric" });
}

export function CertificatesTable({ rows }: { rows: CertificateRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EffectiveStatus | "all">("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && effectiveStatus(r) !== status) return false;
      if (q) {
        const haystack = `${r.employeeName} ${r.assignmentName} ${r.siteName} ${r.companyName} ${r.certificateNumber}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, status]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 rounded-[14px] border border-border bg-white p-4 sm:flex-row sm:items-center">
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by employee, induction, site, or certificate no…" className="sm:flex-1" />
        <Select value={status} onChange={(e) => setStatus(e.target.value as EffectiveStatus | "all")} className="sm:w-fit">
          <option value="all">All statuses</option>
          <option value="active">Valid</option>
          <option value="expired">Expired</option>
          <option value="revoked">Revoked</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No certificates match" hint="Try clearing your search or filters." />
      ) : (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((r) => {
              const eStatus = effectiveStatus(r);
              return (
                <div key={r.id} className="rounded-[14px] border border-border bg-white p-4">
                  <button type="button" onClick={() => router.push(`/inductions/${r.tokenId}`)} className="flex w-full items-start justify-between gap-2 text-left">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-text-dark">{r.employeeName}</div>
                      <div className="truncate text-xs text-text-muted">{r.assignmentName} · {r.siteName}</div>
                    </div>
                    <Badge tone={STATUS_TONE[eStatus]}>{STATUS_LABEL[eStatus]}</Badge>
                  </button>
                  <div className="mt-2 text-xs text-text-muted">
                    {r.certificateNumber} · {r.scorePercent !== null ? `${r.scorePercent}%` : "—"} · Expires {fullDate(r.expiresAt)}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
                    {r.fileUrl && (
                      <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary">
                        View PDF
                      </a>
                    )}
                    <form action={setCertificateStatusAction}>
                      <input type="hidden" name="certificateId" value={r.id} />
                      <input type="hidden" name="status" value={eStatus === "revoked" ? "active" : "revoked"} />
                      <button type="submit" className="text-xs font-semibold text-error">
                        {eStatus === "revoked" ? "Reactivate" : "Revoke"}
                      </button>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden md:block">
            <Table head={["Employee", "Company", "Induction", "Site", "Score", "Cert No.", "Expires", "Status", "Actions"]}>
              {filtered.map((r) => {
                const eStatus = effectiveStatus(r);
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="cursor-pointer px-5 py-3.5 font-semibold text-text-dark" onClick={() => router.push(`/inductions/${r.tokenId}`)}>
                      {r.employeeName}
                    </td>
                    <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => router.push(`/inductions/${r.tokenId}`)}>{r.companyName}</td>
                    <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => router.push(`/inductions/${r.tokenId}`)}>{r.assignmentName}</td>
                    <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => router.push(`/inductions/${r.tokenId}`)}>{r.siteName}</td>
                    <td className="cursor-pointer px-5 py-3.5 text-text-dark" onClick={() => router.push(`/inductions/${r.tokenId}`)}>
                      {r.scorePercent !== null ? `${r.scorePercent}%` : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-text-muted">{r.certificateNumber}</td>
                    <td className="px-5 py-3.5 text-text-muted">{fullDate(r.expiresAt)}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={STATUS_TONE[eStatus]}>{STATUS_LABEL[eStatus]}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {r.fileUrl && (
                          <a href={r.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary">
                            View
                          </a>
                        )}
                        <form action={setCertificateStatusAction}>
                          <input type="hidden" name="certificateId" value={r.id} />
                          <input type="hidden" name="status" value={eStatus === "revoked" ? "active" : "revoked"} />
                          <button type="submit" className="text-xs font-semibold text-error">
                            {eStatus === "revoked" ? "Reactivate" : "Revoke"}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
