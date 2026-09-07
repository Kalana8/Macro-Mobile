"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, EmptyState, IconChip, Select, Table, TextInput } from "@/components/ui";
import { formatDate } from "@macro/shared/datetime";
import { effectiveSubmissionStatus, expiryBucket, type EffectiveSubmissionStatus, type ExpiryFilter, type SubmissionRow } from "./types";

const STATUS_TONE: Record<EffectiveSubmissionStatus, "info" | "success" | "warning" | "error" | "neutral"> = {
  completed: "success",
  pending_approval: "warning",
  approved: "success",
  rejected: "error",
  expired: "error",
};
const STATUS_LABEL: Record<EffectiveSubmissionStatus, string> = {
  completed: "Completed",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
};
const STATUS_FILTERS: (EffectiveSubmissionStatus | "all")[] = ["all", "completed", "pending_approval", "approved", "rejected", "expired"];
const EXPIRY_FILTERS: ExpiryFilter[] = ["all", "valid", "expiring_soon", "expired"];
const EXPIRY_LABEL: Record<ExpiryFilter, string> = { all: "Any expiry", valid: "Valid", expiring_soon: "Expiring within 30 days", expired: "Expired" };

function fullDate(iso: string | null): string {
  if (!iso) return "—";
  return formatDate(iso, { day: "2-digit", month: "short", year: "numeric" });
}

function ViewIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function SubmissionsTable({ rows }: { rows: SubmissionRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [expiry, setExpiry] = useState<ExpiryFilter>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && effectiveSubmissionStatus(r) !== status) return false;
      if (expiry !== "all" && expiryBucket(r) !== expiry) return false;
      if (fromDate && (!r.submittedAt || new Date(r.submittedAt) < new Date(fromDate))) return false;
      if (toDate && (!r.submittedAt || new Date(r.submittedAt) > new Date(`${toDate}T23:59:59`))) return false;
      if (q) {
        const haystack = `${r.employeeName} ${r.assignmentName} ${r.siteName} ${r.companyName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, status, expiry, fromDate, toDate]);

  const counts = useMemo(() => {
    const c: Record<EffectiveSubmissionStatus, number> = { completed: 0, pending_approval: 0, approved: 0, rejected: 0, expired: 0 };
    for (const r of rows) c[effectiveSubmissionStatus(r)] += 1;
    return c;
  }, [rows]);

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(["completed", "pending_approval", "approved", "rejected", "expired"] as const).map((s) => (
          <div key={s} className="rounded-[14px] border border-border bg-white p-4">
            <div className="text-2xl font-extrabold text-text-dark">{counts[s]}</div>
            <div className="text-xs font-semibold text-text-muted">{STATUS_LABEL[s]}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-[14px] border border-border bg-white p-4">
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by employee, induction, or site…"
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Select value={expiry} onChange={(e) => setExpiry(e.target.value as ExpiryFilter)}>
            {EXPIRY_FILTERS.map((e) => (
              <option key={e} value={e}>
                {EXPIRY_LABEL[e]}
              </option>
            ))}
          </Select>
          <TextInput type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} title="Submitted from" />
          <TextInput type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} title="Submitted to" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No submitted forms match" hint="Try clearing your search or filters." />
      ) : (
        <>
          {/* Mobile: stacked cards — no fixed-width columns to scroll to. */}
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((r) => {
              const eStatus = effectiveSubmissionStatus(r);
              return (
                <div key={r.id} className="rounded-[14px] border border-border bg-white p-4">
                  <button type="button" onClick={() => router.push(`/inductions/${r.tokenId}`)} className="flex w-full items-start justify-between gap-2 text-left">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-text-dark">{r.employeeName}</div>
                      <div className="truncate text-xs text-text-muted">{r.assignmentName} · {r.siteName}</div>
                    </div>
                    <Badge tone={STATUS_TONE[eStatus]}>{STATUS_LABEL[eStatus]}</Badge>
                  </button>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div>
                      <div className="font-bold uppercase tracking-wide text-text-muted">Submitted</div>
                      <div className="text-text-dark">{fullDate(r.submittedAt)}</div>
                    </div>
                    <div>
                      <div className="font-bold uppercase tracking-wide text-text-muted">Expires</div>
                      <div className="text-text-dark">{r.certificate ? fullDate(r.certificate.expires_at) : "—"}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                    <IconChip onClick={() => router.push(`/inductions/${r.tokenId}`)} aria-label="View" title="View">
                      <ViewIcon />
                    </IconChip>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden md:block">
            <Table head={["Employee", "Company", "Induction", "Site", "Submitted", "Expires", "Status", "Actions"]}>
              {filtered.map((r) => {
                const eStatus = effectiveSubmissionStatus(r);
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="cursor-pointer px-5 py-3.5 font-semibold text-text-dark" onClick={() => router.push(`/inductions/${r.tokenId}`)}>
                      {r.employeeName}
                    </td>
                    <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => router.push(`/inductions/${r.tokenId}`)}>{r.companyName}</td>
                    <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => router.push(`/inductions/${r.tokenId}`)}>{r.assignmentName}</td>
                    <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => router.push(`/inductions/${r.tokenId}`)}>{r.siteName}</td>
                    <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => router.push(`/inductions/${r.tokenId}`)}>{fullDate(r.submittedAt)}</td>
                    <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => router.push(`/inductions/${r.tokenId}`)}>
                      {r.certificate ? fullDate(r.certificate.expires_at) : "—"}
                    </td>
                    <td className="cursor-pointer px-5 py-3.5" onClick={() => router.push(`/inductions/${r.tokenId}`)}>
                      <Badge tone={STATUS_TONE[eStatus]}>{STATUS_LABEL[eStatus]}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <IconChip onClick={() => router.push(`/inductions/${r.tokenId}`)} aria-label="View" title="View">
                        <ViewIcon />
                      </IconChip>
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
