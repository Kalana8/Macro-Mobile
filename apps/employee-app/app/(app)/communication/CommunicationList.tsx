"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Card, EmptyState } from "@/components/ui";

interface Communication {
  id: string;
  title: string;
  priority: "low" | "medium" | "high";
  status: "open" | "closed";
  last_update: string;
  created_at: string;
}

const PRIORITY_TONE = { low: "neutral", medium: "warning", high: "error" } as const;

export function CommunicationList({ communications }: { communications: Communication[] }) {
  const [tab, setTab] = useState<"open" | "closed">("open");
  const filtered = communications.filter((c) => c.status === tab);

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-lg bg-bg p-1">
        {(["open", "closed"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-md py-2 text-xs font-semibold capitalize ${
              tab === t ? "bg-white text-primary shadow-sm" : "text-text-muted"
            }`}
          >
            {t === "open" ? "Comm Log" : "Closed"}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nothing here yet" />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((c) => (
            <Link key={c.id} href={`/communication/${c.id}`}>
              <Card>
                <div className="flex items-start justify-between">
                  <div className="text-sm font-semibold text-text-dark">{c.title}</div>
                  <Badge tone={PRIORITY_TONE[c.priority]}>{c.priority}</Badge>
                </div>
                <div className="mt-1 text-xs text-text-muted">{c.last_update || "No messages yet"}</div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Link
        href="/communication/new"
        className="mt-4 block w-full rounded-lg bg-orange px-4 py-3 text-center text-sm font-bold text-white"
      >
        + Report an issue
      </Link>
    </div>
  );
}
