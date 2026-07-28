import Link from "next/link";
import { createClient } from "@macro/shared/supabase/server";
import { getCurrentEmployee } from "@/lib/session";
import { Badge, Card, EmptyState } from "@/components/ui";
import { logoutAction } from "../actions";

function companyNameOf(companies: { name?: string } | { name?: string }[] | null): string {
  const c = Array.isArray(companies) ? companies[0] : companies;
  return c?.name ?? "—";
}

export default async function HomePage() {
  const session = await getCurrentEmployee();
  const supabase = await createClient();
  const headerName = session?.employee?.full_name ?? "Field Employee";

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
      <div className="flex items-center justify-between border-b border-border bg-white px-5 py-4">
        <div>
          <div className="text-[16px] font-extrabold text-text-dark">Your workspace</div>
          <div className="text-xs text-text-muted">{headerName}</div>
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
