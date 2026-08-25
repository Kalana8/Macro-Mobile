"use client";

import type { ReactNode } from "react";

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(22,32,46,0.45)] p-4 pt-10 sm:items-center sm:pt-4">
      {/*
        Aligned to the top on mobile (sm:items-center recenters on larger
        screens) — a vertically centered modal sits relative to the full
        layout viewport height, which mobile browsers don't shrink when the
        on-screen keyboard opens, so a field near the top of a centered
        modal (e.g. Report Title, the first field) can end up hidden behind
        the keyboard. Anchoring to the top keeps it in the visible area
        above the keyboard instead. max-h uses dvh (dynamic viewport height)
        where supported, so it also shrinks to fit the space actually left
        once the keyboard is open, rather than overflowing off-screen.
      */}
      <div className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-lg font-extrabold text-text-dark">{title}</div>
          <button onClick={onClose} className="text-text-muted" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
