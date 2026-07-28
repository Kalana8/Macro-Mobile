import Link from "next/link";
import { createClient } from "@macro/shared/supabase/server";
import { getCurrentEmployee } from "@/lib/session";
import { EmptyState } from "@/components/ui";
import { logoutAction } from "../actions";

function companyOf(companies: { name?: string; logo?: string | null } | { name?: string; logo?: string | null }[] | null) {
  const c = Array.isArray(companies) ? companies[0] : companies;
  return { name: c?.name ?? "—", logo: c?.logo ?? null };
}

export default async function HomePage() {
  const session = await getCurrentEmployee();
  const supabase = await createClient();
  const headerName = session?.employee?.full_name ?? "Field Employee";
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: sites, error }, { data: activeRecord }] = await Promise.all([
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
  ]);

  const activeSiteId = activeRecord?.site_id ?? null;

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
                  <img src={company.logo} alt={company.name} className="h-44 w-full object-cover" />
                ) : (
                  <div className="flex h-44 w-full items-center justify-center bg-bg text-sm font-semibold text-text-muted">
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
