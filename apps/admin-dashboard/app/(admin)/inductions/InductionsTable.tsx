"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, EmptyState, IconChip, PlusIcon, PrimaryButton, Select, Table, TextInput } from "@/components/ui";
import { formatDate, formatTime } from "@macro/shared/datetime";
import { revokeInductionAction } from "./actions";
import { CreateInductionModal } from "./CreateInductionModal";
import { ExtendModal } from "./ExtendModal";
import { RegenerateButton } from "./RegenerateButton";
import { effectiveStatus, type EffectiveStatus, type InductionRow } from "./types";

const STATUS_TONE: Record<EffectiveStatus, "neutral" | "info" | "warning" | "success" | "error"> = {
  active: "info",
  expiring_soon: "warning",
  expired: "error",
  completed: "success",
  revoked: "neutral",
};
const STATUS_LABEL: Record<EffectiveStatus, string> = {
  active: "Active",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
  completed: "Completed",
  revoked: "Revoked",
};
const STATUS_FILTERS: (EffectiveStatus | "all")[] = ["all", "active", "expiring_soon", "expired", "completed", "revoked"];

function fullDate(iso: string): string {
  return `${formatDate(iso, { day: "2-digit", month: "short", year: "numeric" })}, ${formatTime(iso, { hour: "numeric", minute: "2-digit" })}`;
}

function remainingLabel(row: InductionRow): string {
  const status = effectiveStatus(row);
  if (status === "expired") return "Expired";
  if (status === "completed" || status === "revoked") return "—";
  const ms = new Date(row.expires_at).getTime() - Date.now();
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3600_000);
  const minutes = Math.floor((ms % 3600_000) / 60_000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function ViewIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function ExtendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
    </svg>
  );
}
function RevokeIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><path d="m8 8 8 8M16 8l-8 8" />
    </svg>
  );
}

export function InductionsTable({
  rows,
  employees,
  sites,
}: {
  rows: InductionRow[];
  employees: { id: string; full_name: string }[];
  sites: { id: string; name: string; company_id: string }[];
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && effectiveStatus(r) !== status) return false;
      if (q) {
        const haystack = `${r.employeeName} ${r.siteName} ${r.companyName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, status]);

  const counts = useMemo(() => {
    const c: Record<EffectiveStatus, number> = { active: 0, expiring_soon: 0, expired: 0, completed: 0, revoked: 0 };
    for (const r of rows) c[effectiveStatus(r)] += 1;
    return c;
  }, [rows]);

  const extendingRow = extendingId ? rows.find((r) => r.id === extendingId) : null;

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {(["active", "expiring_soon", "expired", "completed", "revoked"] as const).map((s) => (
          <div key={s} className="rounded-[14px] border border-border bg-white p-4">
            <div className="text-2xl font-extrabold text-text-dark">{counts[s]}</div>
            <div className="text-xs font-semibold text-text-muted">{STATUS_LABEL[s]}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-[14px] border border-border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by employee, site, or company…"
            className="sm:flex-1"
          />
          <PrimaryButton onClick={() => setShowNew(true)} className="sm:w-fit">
            <PlusIcon />
            Create Induction
          </PrimaryButton>
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="sm:w-fit">
          {STATUS_FILTERS.map((s) => (
            <option key={s} value={s}>
              {s === "all" ? "All statuses" : STATUS_LABEL[s]}
            </option>
          ))}
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No inductions match" hint="Try clearing filters, or create a new induction invitation." />
      ) : (
        <>
          {/* Mobile: stacked cards — no fixed-width columns to scroll to. */}
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((r) => {
              const eStatus = effectiveStatus(r);
              return (
                <div key={r.id} className="rounded-[14px] border border-border bg-white p-4">
                  <button type="button" onClick={() => router.push(`/inductions/${r.id}`)} className="flex w-full items-start justify-between gap-2 text-left">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-text-dark">{r.employeeName}</div>
                      <div className="truncate text-xs text-text-muted">{r.siteName} · {r.companyName}</div>
                    </div>
                    <Badge tone={STATUS_TONE[eStatus]}>{STATUS_LABEL[eStatus]}</Badge>
                  </button>
                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                    <div>
                      <div className="font-bold uppercase tracking-wide text-text-muted">Created</div>
                      <div className="text-text-dark">{fullDate(r.created_at)}</div>
                    </div>
                    <div>
                      <div className="font-bold uppercase tracking-wide text-text-muted">Expires</div>
                      <div className="text-text-dark">{fullDate(r.expires_at)}</div>
                    </div>
                    <div className="col-span-2">
                      <div className="font-bold uppercase tracking-wide text-text-muted">Remaining</div>
                      <div className={eStatus === "expiring_soon" ? "font-bold text-orange" : eStatus === "expired" ? "font-bold text-error" : "text-text-dark"}>
                        {remainingLabel(r)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                    <IconChip onClick={() => router.push(`/inductions/${r.id}`)} aria-label="View" title="View">
                      <ViewIcon />
                    </IconChip>
                    {(eStatus === "active" || eStatus === "expiring_soon" || eStatus === "expired") && (
                      <IconChip onClick={() => setExtendingId(r.id)} aria-label="Extend" title="Extend">
                        <ExtendIcon />
                      </IconChip>
                    )}
                    {eStatus !== "completed" && eStatus !== "revoked" && <RegenerateButton tokenId={r.id} />}
                    {eStatus !== "revoked" && eStatus !== "completed" && (
                      <form action={revokeInductionAction} onSubmit={(e) => { if (!window.confirm("Revoke this link? It can no longer be used.")) e.preventDefault(); }}>
                        <input type="hidden" name="tokenId" value={r.id} />
                        <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg text-error" aria-label="Revoke" title="Revoke">
                          <RevokeIcon />
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden md:block">
            <Table head={["Employee", "Site", "Status", "Created", "Expires", "Remaining", "Actions"]}>
              {filtered.map((r) => {
                const eStatus = effectiveStatus(r);
                return (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="cursor-pointer px-5 py-3.5 font-semibold text-text-dark" onClick={() => router.push(`/inductions/${r.id}`)}>
                      {r.employeeName}
                    </td>
                    <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => router.push(`/inductions/${r.id}`)}>
                      {r.siteName}
                      <div className="text-[11px] text-text-muted">{r.companyName}</div>
                    </td>
                    <td className="cursor-pointer px-5 py-3.5" onClick={() => router.push(`/inductions/${r.id}`)}>
                      <Badge tone={STATUS_TONE[eStatus]}>{STATUS_LABEL[eStatus]}</Badge>
                    </td>
                    <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => router.push(`/inductions/${r.id}`)}>{fullDate(r.created_at)}</td>
                    <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => router.push(`/inductions/${r.id}`)}>{fullDate(r.expires_at)}</td>
                    <td className="cursor-pointer px-5 py-3.5" onClick={() => router.push(`/inductions/${r.id}`)}>
                      <span className={eStatus === "expiring_soon" ? "font-bold text-orange" : eStatus === "expired" ? "font-bold text-error" : "text-text-muted"}>
                        {remainingLabel(r)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <IconChip onClick={() => router.push(`/inductions/${r.id}`)} aria-label="View" title="View">
                          <ViewIcon />
                        </IconChip>
                        {(eStatus === "active" || eStatus === "expiring_soon" || eStatus === "expired") && (
                          <IconChip onClick={() => setExtendingId(r.id)} aria-label="Extend" title="Extend">
                            <ExtendIcon />
                          </IconChip>
                        )}
                        {eStatus !== "completed" && eStatus !== "revoked" && <RegenerateButton tokenId={r.id} />}
                        {eStatus !== "revoked" && eStatus !== "completed" && (
                          <form action={revokeInductionAction} onSubmit={(e) => { if (!window.confirm("Revoke this link? It can no longer be used.")) e.preventDefault(); }}>
                            <input type="hidden" name="tokenId" value={r.id} />
                            <button type="submit" className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg text-error" aria-label="Revoke" title="Revoke">
                              <RevokeIcon />
                            </button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          </div>
        </>
      )}

      {showNew && <CreateInductionModal employees={employees} sites={sites} onClose={() => setShowNew(false)} />}
      {extendingRow && (
        <ExtendModal tokenId={extendingRow.id} currentExpiresAt={extendingRow.expires_at} onClose={() => setExtendingId(null)} />
      )}
    </div>
  );
}
