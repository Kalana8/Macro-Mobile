import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@macro/shared/supabase/server";
import { Card, ScreenHeader } from "@/components/ui";
import { SiteLocationGate } from "./SiteLocationGate";

export default async function SiteDetailsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const supabase = await createClient();

  const { data: site } = await supabase
    .from("sites")
    .select("id, name, address, lat, lng, allowed_radius, companies(name)")
    .eq("id", siteId)
    .maybeSingle();

  if (!site) notFound();

  const companyName = (site.companies as { name?: string } | null)?.name ?? "—";

  return (
    <div>
      <ScreenHeader title={site.name} />
      <div className="flex flex-col gap-4 p-5">
        <SiteLocationGate siteName={site.name} siteLat={site.lat} siteLng={site.lng} allowedRadius={site.allowed_radius}>
          <div className="flex flex-col gap-4">
            <Card>
              <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Company</div>
              <div className="mb-2 text-sm text-text-dark">{companyName}</div>
              <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Address</div>
              <div className="text-sm text-text-dark">{site.address}</div>
            </Card>

            <Link
              href={`/attendance?siteId=${site.id}`}
              className="rounded-xl border border-border bg-white px-4 py-3 text-center text-sm font-semibold text-primary"
            >
              Clock in / out at this site →
            </Link>
          </div>
        </SiteLocationGate>
      </div>
    </div>
  );
}
