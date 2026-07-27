import Link from "next/link";
import { cookies } from "next/headers";
import { createClient } from "@macro/shared/supabase/server";
import { getCurrentEmployee } from "@/lib/session";
import { Badge, Card, EmptyState } from "@/components/ui";
import { ACTIVE_SITE_COOKIE } from "@/lib/constants";
import { logoutAction } from "../actions";

function companyNameOf(companies: { name?: string } | { name?: string }[] | null): string {
  const c = Array.isArray(companies) ? companies[0] : companies;
  return c?.name ?? "—";
}

export default async function HomePage() {
  const session = await getCurrentEmployee();
  const supabase = await createClient();

  // Once a site's been confirmed at login (geofence-checked, pinned via
  // ACTIVE_SITE_COOKIE), that's the only site relevant to this employee for
  // the rest of the session — show that one, not the full list they could
  // theoretically access. Employees whose role doesn't clock in/out (no
  // pinned site) still get the full multi-site list, grouped by company.
  const pinnedSiteId = (await cookies()).get(ACTIVE_SITE_COOKIE)?.value;

  const headerName = session?.employee?.full_name ?? "Field Employee";

  if (pinnedSiteId) {
    const { data: site } = await supabase
      .from("sites")
      .select("id, name, address, status, companies(name)")
      .eq("id", pinnedSiteId)
      .maybeSingle();

    return (
      <div>
        <HomeHeader title={site ? companyNameOf(site.companies) : "Your workspace"} subtitle={headerName} />
        <div className="flex flex-col gap-3 p-5">
          {!site ? (
            <EmptyState title="Site not found" hint="Log out and log in again to re-confirm your site." />
          ) : (
            <Link href="/attendance">
              <Card className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[14.5px] font-semibold text-text-dark">{site.name}</div>
                  <div className="text-xs text-text-muted">{companyNameOf(site.companies)}</div>
                </div>
                <Badge tone={site.status === "open" ? "success" : "neutral"}>
                  {site.status === "open" ? "Open" : "Closed"}
                </Badge>
              </Card>
            </Link>
          )}
        </div>
      </div>
    );
  }

  const { data: sites, error } = await supabase
    .from("sites")
    .select("id, name, address, status, company_id, companies(name)")
    .order("name");

  const groups = new Map<string, { companyName: string; sites: NonNullable<typeof sites> }>();
  for (const site of sites ?? []) {
    const companyName = companyNameOf(site.companies);
    const group = groups.get(site.company_id) ?? { companyName, sites: [] };
    group.sites.push(site);
    groups.set(site.company_id, group);
  }

  return (
    <div>
      <HomeHeader title="Your workspace" subtitle={headerName} />

      <div className="flex flex-col gap-4 p-5">
        {error && (
          <div className="rounded-lg bg-error/10 px-3 py-2 text-[12.5px] text-error">
            Couldn&apos;t load your sites — connect Supabase to see live data.
          </div>
        )}

        {!error && groups.size === 0 && (
          <EmptyState title="No sites assigned yet" hint="Your admin will assign you to a company and site." />
        )}

        {Array.from(groups.values()).map((group) => (
          <div key={group.companyName}>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
              {group.companyName}
            </div>
            <div className="flex flex-col gap-2">
              {group.sites.map((site) => (
                <Link key={site.id} href={`/sites/${site.id}`}>
                  <Card className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[14.5px] font-semibold text-text-dark">{site.name}</div>
                      <div className="text-xs text-text-muted">{site.address}</div>
                    </div>
                    <Badge tone={site.status === "open" ? "success" : "neutral"}>
                      {site.status === "open" ? "Open" : "Closed"}
                    </Badge>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HomeHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-white px-5 py-4">
      <div>
        <div className="text-[16px] font-extrabold text-text-dark">{title}</div>
        <div className="text-xs text-text-muted">{subtitle}</div>
      </div>
      <form action={logoutAction}>
        <button
          aria-label="Log out"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg text-text-muted"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
            <path d="M10 12h10" />
            <path d="M17 8l4 4-4 4" />
          </svg>
        </button>
      </form>
    </div>
  );
}
