"use client";

import { useEffect, useState } from "react";
import { Badge, EmptyState, PlusIcon, PrimaryButton } from "@/components/ui";
import { formatDate, formatTime } from "@macro/shared/datetime";
import { markPhotosSeenAction } from "./actions";
import { SendPhotosModal, type Contact } from "./SendPhotosModal";

export interface ShareView {
  id: string;
  senderName: string;
  recipientNames: string[];
  seenCount: number;
  isNewForMe: boolean;
  note: string;
  company: string | null;
  createdAt: string;
  photos: string[];
}

export function PhotoShares({
  adminId,
  contacts,
  companies,
  received,
  sent,
}: {
  adminId: string;
  contacts: Contact[];
  companies: { id: string; name: string }[];
  received: ShareView[];
  sent: ShareView[];
}) {
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [composing, setComposing] = useState(false);
  const [viewing, setViewing] = useState<{ url: string; caption: string } | null>(null);
  const newCount = received.filter((s) => s.isNewForMe).length;
  const shown = tab === "received" ? received : sent;

  // Opening the page counts as seeing them; the "New" badges stay until the next visit.
  useEffect(() => {
    const ids = received.filter((s) => s.isNewForMe).map((s) => s.id);
    if (ids.length === 0) return;
    const t = setTimeout(() => markPhotosSeenAction(ids), 1200);
    return () => clearTimeout(t);
  }, [received]);

  useEffect(() => {
    if (!viewing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setViewing(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewing]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex w-fit gap-1 rounded-lg bg-bg p-1">
        {(["received", "sent"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${tab === t ? "bg-white text-primary shadow-sm" : "text-text-muted"}`}
          >
            {t === "received" ? `Received${newCount ? ` · ${newCount} new` : ` · ${received.length}`}` : `Sent · ${sent.length}`}
          </button>
        ))}
      </div>
        <PrimaryButton type="button" onClick={() => setComposing(true)}>
          <PlusIcon />
          Send Photos
        </PrimaryButton>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={tab === "received" ? "No photos received yet" : "No photos sent yet"}
          hint={tab === "received" ? "Photos employees send you from the app show up here." : "Use Send Photos to share photos and a note with employees."}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((s) => (
            <div key={s.id} className={`rounded-2xl border bg-white p-4 ${tab === "received" && s.isNewForMe ? "border-orange" : "border-border"}`}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-bold text-text-dark">
                    {tab === "received" ? `From ${s.senderName}` : `To ${s.recipientNames.join(", ")}`}
                  </div>
                  <div className="text-xs text-text-muted">
                    {formatDate(s.createdAt, { day: "numeric", month: "short", year: "numeric" })} ·{" "}
                    {formatTime(s.createdAt, { hour: "2-digit", minute: "2-digit" })}
                    {s.company ? ` · ${s.company}` : ""}
                  </div>
                </div>
                {tab === "received" && s.isNewForMe && <Badge tone="warning">New</Badge>}
                {tab === "sent" && (
                  <Badge tone="neutral">
                    {s.seenCount}/{s.recipientNames.length} seen
                  </Badge>
                )}
              </div>
              {s.note && <p className="mb-3 whitespace-pre-wrap text-sm text-text-dark">{s.note}</p>}
              <div className="flex flex-wrap gap-2">
                {s.photos.map((url, i) => (
                  <button
                    key={`${i}-${url}`}
                    type="button"
                    onClick={() => setViewing({ url, caption: s.note || `Photo ${i + 1}` })}
                    aria-label={`Open photo ${i + 1}`}
                    className="overflow-hidden rounded-lg"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Photo ${i + 1}`} className="h-24 w-24 object-cover" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {composing && (
        <SendPhotosModal
          adminId={adminId}
          contacts={contacts}
          companies={companies}
          onClose={() => {
            setComposing(false);
            setTab("sent");
          }}
        />
      )}

      {viewing && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Photo"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[rgba(5,12,24,0.92)] p-6"
          onClick={() => setViewing(null)}
        >
          <button type="button" onClick={() => setViewing(null)} aria-label="Close photo" className="absolute right-5 top-5 h-10 w-10 rounded-full bg-white/15 text-lg text-white">
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={viewing.url} alt={viewing.caption} className="max-h-[80vh] max-w-full rounded-lg object-contain" onClick={(e) => e.stopPropagation()} />
          <p className="max-w-xl text-center text-sm text-white">{viewing.caption}</p>
        </div>
      )}
    </div>
  );
}
