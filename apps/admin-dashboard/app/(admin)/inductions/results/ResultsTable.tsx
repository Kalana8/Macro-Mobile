"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, EmptyState, Select, Table, TextInput } from "@/components/ui";
import { formatDate, formatTime } from "@macro/shared/datetime";

export interface AttemptRow {
  key: string;
  tokenId: string;
  employeeName: string;
  companyName: string;
  siteName: string;
  assignmentName: string;
  attemptNumber: number;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  submittedAt: string;
}

type ResultFilter = "all" | "passed" | "failed";

function fullDate(iso: string): string {
  return `${formatDate(iso, { day: "2-digit", month: "short", year: "numeric" })}, ${formatTime(iso, { hour: "numeric", minute: "2-digit" })}`;
}

export function ResultsTable({ rows }: { rows: AttemptRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [result, setResult] = useState<ResultFilter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (result === "passed" && !r.passed) return false;
      if (result === "failed" && r.passed) return false;
      if (q) {
        const haystack = `${r.employeeName} ${r.assignmentName} ${r.siteName} ${r.companyName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, result]);

  const counts = useMemo(() => {
    const passed = rows.filter((r) => r.passed).length;
    return { total: rows.length, passed, failed: rows.length - passed };
  }, [rows]);

  return (
    <div>
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-[14px] border border-border bg-white p-4">
          <div className="text-2xl font-extrabold text-text-dark">{counts.total}</div>
          <div className="text-xs font-semibold text-text-muted">Total Attempts</div>
        </div>
        <div className="rounded-[14px] border border-border bg-white p-4">
          <div className="text-2xl font-extrabold text-olive-text">{counts.passed}</div>
          <div className="text-xs font-semibold text-text-muted">Passed</div>
        </div>
        <div className="rounded-[14px] border border-border bg-white p-4">
          <div className="text-2xl font-extrabold text-error">{counts.failed}</div>
          <div className="text-xs font-semibold text-text-muted">Failed</div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-[14px] border border-border bg-white p-4 sm:flex-row sm:items-center">
        <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by employee, induction, or site…" className="sm:flex-1" />
        <Select value={result} onChange={(e) => setResult(e.target.value as ResultFilter)} className="sm:w-fit">
          <option value="all">All results</option>
          <option value="passed">Passed only</option>
          <option value="failed">Failed only</option>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No attempts match" hint="Try clearing your search or filters." />
      ) : (
        <>
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => router.push(`/inductions/${r.tokenId}`)}
                className="w-full rounded-[14px] border border-border bg-white p-4 text-left"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-text-dark">{r.employeeName}</div>
                    <div className="truncate text-xs text-text-muted">{r.assignmentName} · {r.siteName}</div>
                  </div>
                  <Badge tone={r.passed ? "success" : "error"}>{r.passed ? "Passed" : "Failed"}</Badge>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
                  <span>Attempt {r.attemptNumber} — {r.score}/{r.maxScore} ({r.percentage}%)</span>
                  <span>{fullDate(r.submittedAt)}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="hidden md:block">
            <Table head={["Employee", "Induction", "Site", "Attempt", "Score", "Result", "Date"]}>
              {filtered.map((r) => (
                <tr key={r.key} className="cursor-pointer border-b border-border last:border-0" onClick={() => router.push(`/inductions/${r.tokenId}`)}>
                  <td className="px-5 py-3.5 font-semibold text-text-dark">{r.employeeName}</td>
                  <td className="px-5 py-3.5 text-text-muted">{r.assignmentName}</td>
                  <td className="px-5 py-3.5 text-text-muted">{r.siteName}</td>
                  <td className="px-5 py-3.5 text-text-muted">#{r.attemptNumber}</td>
                  <td className="px-5 py-3.5 text-text-dark">
                    {r.score}/{r.maxScore} ({r.percentage}%)
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge tone={r.passed ? "success" : "error"}>{r.passed ? "Passed" : "Failed"}</Badge>
                  </td>
                  <td className="px-5 py-3.5 text-text-muted">{fullDate(r.submittedAt)}</td>
                </tr>
              ))}
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
