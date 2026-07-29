import Link from "next/link";
import { createClient } from "@macro/shared/supabase/server";
import { getCurrentEmployee } from "@/lib/session";
import { EmptyState } from "@/components/ui";
import { LogoutButton } from "@/components/LogoutButton";
import { NotificationBell, type NotificationItem } from "@/components/NotificationBell";
import type { ChecklistArea } from "@macro/shared/types";

function companyOf(companies: { name?: string; logo?: string | null } | { name?: string; logo?: string | null }[] | null) {
  const c = Array.isArray(companies) ? companies[0] : companies;
  return { name: c?.name ?? "—", logo: c?.logo ?? null };
}

function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default async function HomePage() {
  const session = await getCurrentEmployee();
  const supabase = await createClient();
  const headerName = session?.employee?.full_name ?? "Field Employee";
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: sites, error },
    { data: activeRecord },
    { data: pendingChecklists },
    { data: openComms },
    { data: recentAudits },
  ] = await Promise.all([
    supabase
      .from("sites")
      .select("id, name, company_id, companies(name, logo)")
      .order("name"),
    supabase
      .from("attendance")
      .select("site_id")
      .eq("date", today)
      .neq("status", "complete")
      .order("clock_in_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("checklists")
      .select("id, site, assigned_date, areas, companies(name)")
      .eq("status", "pending")
      .order("assigned_date", { ascending: false })
      .limit(5),
    supabase
      .from("communications")
      .select("id, title, last_update, status")
      .eq("status", "open")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(5),
    // No updated_at column on audits, so "recent" here means recently
    // created rather than recently reviewed — an accepted approximation
    // rather than adding a column just for notification ordering.
    supabase
      .from("audits")
      .select("id, title, final_marks, max_marks, status")
      .eq("status", "complete")
      .not("final_marks", "is", null)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const activeSiteId = activeRecord?.site_id ?? null;

  const notifications: NotificationItem[] = [
    ...(pendingChecklists ?? []).map((c) => {
      const areas = (c.areas as ChecklistArea[]) ?? [];
      const title = areas.map((a) => a.main_area).join(", ") || "New checklist";
      const companyName = (c.companies as { name?: string } | null)?.name ?? "—";
      return {
        id: c.id,
        href: `/checklists/${c.id}`,
        title,
        subtitle: `${companyName} · ${c.site || "Checklist"} due`,
        kind: "checklist" as const,
      };
    }),
    ...(openComms ?? []).map((m) => ({
      id: m.id,
      href: `/communication/${m.id}`,
      title: m.title,
      subtitle: m.last_update || "New message",
      kind: "communication" as const,
    })),
    ...(recentAudits ?? []).map((a) => ({
      id: a.id,
      href: `/audits/${a.id}`,
      title: a.title || "Audit reviewed",
      subtitle: `Marks ${a.final_marks} / ${a.max_marks}`,
      kind: "audit" as const,
    })),
  ];

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-primary/20 bg-primary/15 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-white">
            {headerName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-xs font-medium text-text-muted">{greetingFor(new Date().getHours())} 👋</div>
            <div className="text-[17px] font-extrabold leading-tight text-text-dark">{headerName}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell items={notifications} />
          <Link
            href="/profile"
            aria-label="Profile"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg text-text-muted"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
            </svg>
          </Link>
          <LogoutButton />
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        {error && (
          <div className="rounded-lg bg-error/10 px-3 py-2 text-[12.5px] text-error">
            Couldn&apos;t load your sites — connect Supabase to see live data.
          </div>
        )}

        {!error && (sites?.length ?? 0) === 0 && (
          <EmptyState title="No sites assigned yet" hint="Your admin will assign you to a company and site." />
        )}

        {(sites ?? []).map((site) => {
          const company = companyOf(site.companies);
          const isActiveHere = activeSiteId === site.id;
          return (
            <div key={site.id} className="overflow-hidden rounded-2xl border border-border bg-white">
              <Link href={`/sites/${site.id}`}>
                <div className="bg-primary px-4 py-3 text-white">
                  <div className="text-xs text-white/80">{company.name}</div>
                  <div className="text-[15px] font-bold">{site.name}</div>
                </div>
                {company.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={company.logo} alt={company.name} className="h-28 w-full object-cover" />
                ) : (
                  <div className="flex h-28 w-full items-center justify-center bg-bg text-sm font-semibold text-text-muted">
                    {company.name}
                  </div>
                )}
              </Link>
              <div className="p-4">
                <Link
                  href={`/attendance?siteId=${site.id}`}
                  className={`block rounded-full py-2.5 text-center text-sm font-bold ${
                    isActiveHere ? "bg-error text-white" : "bg-bg text-primary"
                  }`}
                >
                  {isActiveHere ? "Clock Out" : "Clock In"}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
