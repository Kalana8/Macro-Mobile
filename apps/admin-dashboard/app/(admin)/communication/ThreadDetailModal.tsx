"use client";

import { Modal } from "@/components/Modal";
import { Badge } from "@/components/ui";
import { ChatThread } from "./ChatThread";
import { toggleThreadStatusAction } from "./actions";

const PRIORITY_TONE = { low: "neutral", medium: "warning", high: "error" } as const;

interface Row {
  id: string;
  title: string;
  companyName: string;
  siteName: string;
  employeeNames: string;
  priority: "low" | "medium" | "high";
  status: "open" | "closed";
}

export function ThreadDetailModal({
  thread,
  adminId,
  adminName,
  onClose,
}: {
  thread: Row;
  adminId: string;
  adminName: string;
  onClose: () => void;
}) {
  return (
    <Modal title={thread.title} onClose={onClose}>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-xs text-text-muted">
          {thread.companyName} · {thread.siteName} · {thread.employeeNames}
        </div>
        <div className="flex items-center gap-1.5">
          <Badge tone={PRIORITY_TONE[thread.priority]}>{thread.priority}</Badge>
          <Badge tone={thread.status === "open" ? "info" : "neutral"}>{thread.status}</Badge>
        </div>
      </div>

      <ChatThread conversationId={thread.id} currentUserId={adminId} currentUserName={adminName} />

      <form action={toggleThreadStatusAction} className="mt-3">
        <input type="hidden" name="id" value={thread.id} />
        <input type="hidden" name="nextStatus" value={thread.status === "open" ? "closed" : "open"} />
        <button type="submit" className="w-full rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-text-dark">
          {thread.status === "open" ? "Close Thread" : "Reopen Thread"}
        </button>
      </form>
    </Modal>
  );
}
