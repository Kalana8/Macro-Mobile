import type { Metadata } from "next";
import { createServiceRoleClient } from "@macro/shared/supabase/server";
import type { Checklist } from "@macro/shared/types";
import { SharedChecklistView } from "./SharedChecklistView";

// Unlisted, not indexed — reachable only by whoever holds the exact link.
export const metadata: Metadata = {
  title: "Checklist",
  robots: { index: false, follow: false },
};

export default async function SharedChecklistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Public link: fetched with the service-role client (bypasses RLS) scoped
  // to this exact id only — anon RLS access was deliberately not opened up
  // here, since that would let anyone with the anon key enumerate every
  // checklist rather than just the one this link points to.
  const supabase = createServiceRoleClient();
  const { data: checklist } = await supabase
    .from("checklists")
    .select("*, companies(name), employees(full_name)")
    .eq("id", id)
    .maybeSingle();

  if (!checklist) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <div className="text-lg font-bold text-text-dark">Link not found</div>
        <p className="mt-2 text-sm text-text-muted">This link is invalid or no longer available.</p>
      </div>
    );
  }

  const companyName = (checklist.companies as { name?: string } | null)?.name ?? "—";
  const employeeName = (checklist.employees as { full_name?: string } | null)?.full_name ?? "—";

  return (
    <SharedChecklistView
      checklist={checklist as unknown as Checklist}
      companyName={companyName}
      employeeName={employeeName}
    />
  );
}
