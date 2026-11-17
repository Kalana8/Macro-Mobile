"use client";

import { useState } from "react";
import { getTempPasswordAction, type TempPasswordResult } from "./actions";

/**
 * The login the office gave this employee, shown whenever an admin needs it,
 * until the employee sets their own password. Hidden until Show is pressed.
 */
export function PasswordCell({ employeeId, username, ownPassword }: { employeeId: string; username: string; ownPassword: boolean }) {
  const [result, setResult] = useState<TempPasswordResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  if (ownPassword) return <span className="text-xs text-text-muted">Set by employee</span>;

  async function show() {
    setLoading(true);
    setResult(await getTempPasswordAction(employeeId));
    setLoading(false);
  }

  async function copy(what: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // still on screen to select by hand
    }
  }

  if (!result || result.status !== "ok") {
    const note =
      result?.status === "changed"
        ? "Not saved. Reset the password to set one."
        : result?.status === "unreadable"
          ? "Can't be read. Reset the password."
          : result?.status === "unavailable"
            ? "Run migration 0063 to keep passwords."
            : result?.status === "denied"
              ? "Admins only."
              : null;
    return (
      <div className="flex flex-col items-start gap-0.5">
        <button type="button" onClick={show} disabled={loading} className="text-[12.5px] font-semibold text-primary disabled:opacity-50">
          {loading ? "Loading…" : "Show"}
        </button>
        {note && <span className="text-[11px] text-text-muted">{note}</span>}
      </div>
    );
  }

  const password = result.password!;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <code className="rounded bg-bg px-2 py-0.5 text-[12.5px] text-text-dark">{password}</code>
      <button type="button" onClick={() => copy("pw", password)} className="text-[12px] font-semibold text-primary">
        {copied === "pw" ? "Copied ✓" : "Copy"}
      </button>
      <button type="button" onClick={() => copy("both", `Username: ${username}\nPassword: ${password}`)} className="text-[12px] font-semibold text-primary">
        {copied === "both" ? "Copied ✓" : "Copy login"}
      </button>
      <button type="button" onClick={() => setResult(null)} className="text-[12px] text-text-muted">
        Hide
      </button>
    </div>
  );
}
