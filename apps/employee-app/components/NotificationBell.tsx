"use client";

import Link from "next/link";
import { useState } from "react";
import { dismissNotificationAction } from "@/app/(app)/home/actions";

export interface NotificationItem {
  id: string;
  href: string;
  title: string;
  subtitle: string;
  kind: "checklist" | "communication" | "audit";
}

const KIND_META: Record<NotificationItem["kind"], { label: string; iconBg: string; iconText: string }> = {
  checklist: { label: "Checklist", iconBg: "bg-orange/15", iconText: "text-orange" },
  communication: { label: "Message", iconBg: "bg-primary/10", iconText: "text-primary" },
  audit: { label: "Audit", iconBg: "bg-olive/25", iconText: "text-olive-text" },
};

function KindIcon({ kind }: { kind: NotificationItem["kind"] }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "checklist") {
    return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8 12 3 3 5-6" /></svg>;
  }
  if (kind === "communication") {
    return <svg {...common}><path d="M4 5h16v11H8l-4 4V5Z" /></svg>;
  }
  return <svg {...common}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3h6v3H9z" /></svg>;
}

export function NotificationBell({ items }: { items: NotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  const visibleItems = items.filter((item) => !dismissedKeys.has(`${item.kind}-${item.id}`));
  const count = visibleItems.length;

  function handleDismiss(item: NotificationItem) {
    const key = `${item.kind}-${item.id}`;
    setDismissedKeys((prev) => new Set(prev).add(key));
    dismissNotificationAction(item.kind, item.id);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen(true)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-bg text-text-muted"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[9px] font-bold text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-[#16202E]/45 pt-16">
          <div className="mx-5 w-full max-w-lg overflow-hidden rounded-2xl bg-white">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="text-sm font-bold text-text-dark">Notifications</div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-text-muted">
                ✕
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {visibleItems.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-text-muted">You&apos;re all caught up.</div>
              ) : (
                visibleItems.map((item) => {
                  const meta = KIND_META[item.kind];
                  return (
                    <div
                      key={`${item.kind}-${item.id}`}
                      className="flex items-start gap-2 border-b border-border px-4 py-3 last:border-0"
                    >
                      <Link
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className="flex min-w-0 flex-1 items-start gap-3"
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${meta.iconBg} ${meta.iconText}`}>
                          <KindIcon kind={item.kind} />
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">{meta.label}</div>
                          <div className="truncate text-sm font-semibold text-text-dark">{item.title}</div>
                          <div className="truncate text-xs text-text-muted">{item.subtitle}</div>
                        </div>
                      </Link>
                      <button
                        type="button"
                        onClick={() => handleDismiss(item)}
                        aria-label="Dismiss notification"
                        className="shrink-0 px-1 text-sm text-text-muted"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
