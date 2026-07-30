"use client";

import Image from "next/image";
import { useState } from "react";
import type { RolePermissions } from "@macro/shared/types";
import { Sidebar } from "./Sidebar";

export function AdminShell({
  permissions,
  onLogout,
  children,
}: {
  permissions: RolePermissions | null;
  onLogout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-page-bg">
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between border-b border-border bg-white px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-text-dark"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Image src="/favicon-icon.png" alt="MACRO" width={28} height={28} className="h-7 w-7" />
        <div className="h-9 w-9" />
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[rgba(22,32,46,0.45)] md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        permissions={permissions}
        onLogout={onLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <main className="min-w-0 flex-1 overflow-y-auto px-4 pb-8 pt-20 md:px-10 md:py-8">{children}</main>
    </div>
  );
}
