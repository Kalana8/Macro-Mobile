"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { logoutAction } from "@/app/(app)/actions";

export function LogoutButton({ variant = "icon" }: { variant?: "icon" | "menu-item" }) {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleConfirm() {
    setLoggingOut(true);
    await logoutAction();
  }

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          aria-label="Log out"
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg text-text-muted"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
            <path d="M10 12h10" />
            <path d="M17 8l4 4-4 4" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full px-4 py-3.5 text-left text-sm font-semibold text-error"
        >
          Log Out
        </button>
      )}
      <ConfirmDialog
        open={open}
        title="Log out?"
        message="You'll need to log in again to continue."
        confirmLabel={loggingOut ? "Logging out…" : "Log Out"}
        danger
        busy={loggingOut}
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
