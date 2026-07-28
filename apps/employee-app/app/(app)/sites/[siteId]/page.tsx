import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@macro/shared/supabase/server";
import { Card, ScreenHeader } from "@/components/ui";

export default async function SiteDetailsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const supabase = await createClient();

  const { data: site } = await supabase
    .from("sites")
    .select("id, name, address, companies(name)")
    .eq("id", siteId)
    .maybeSingle();

  if (!site) notFound();

  const companyName = (site.companies as { name?: string } | null)?.name ?? "—";

  const tiles = [
    { href: `/audits/new?siteId=${site.id}`, label: "Audit", color: "bg-primary" },
    { href: `/checklists?siteId=${site.id}`, label: "Checklist", color: "bg-primary-dark" },
    { href: `/communication?siteId=${site.id}`, label: "Message", color: "bg-orange" },
  ];

  return (
    <div>
      <ScreenHeader title={site.name} />
      <div className="flex flex-col gap-4 p-5">
        <Card>
          <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Company</div>
          <div className="mb-2 text-sm text-text-dark">{companyName}</div>
          <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Address</div>
          <div className="text-sm text-text-dark">{site.address}</div>
        </Card>

        <div className="grid grid-cols-3 gap-2">
          {tiles.map((tile) => (
            <Link
              key={tile.label}
              href={tile.href}
              className={`${tile.color} flex flex-col items-center justify-center gap-1 rounded-xl py-4 text-xs font-semibold text-white`}
            >
              {tile.label}
            </Link>
          ))}
        </div>

        <Link
          href={`/attendance?siteId=${site.id}`}
          className="rounded-xl border border-border bg-white px-4 py-3 text-center text-sm font-semibold text-primary"
        >
          Clock in / out at this site →
        </Link>
      </div>
    </div>
  );
}
