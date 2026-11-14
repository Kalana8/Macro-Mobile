import { createClient } from "@macro/shared/supabase/server";
import { PageHeader } from "@/components/ui";
import type { Audit } from "@macro/shared/types";
import { AuditsTable, type AuditRow } from "./AuditsTable";

export default async function AuditsPage() {
  const supabase = await createClient();
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - 2);

  const [{ data: audits, error }, { data: companies }, { data: sites }, { data: employees }, { data: memberships }] =
    await Promise.all([
      supabase
        .from("audits")
        .select("*, companies(name), employees(full_name)")
        .gte("date", cutoff.toISOString().slice(0, 10))
        .order("date", { ascending: false }),
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("sites").select("id, name, company_id").order("name"),
      supabase.from("employees").select("id, full_name").order("full_name"),
      supabase.from("employee_companies").select("employee_id, company_id"),
    ]);

  const companyIdsByEmployee: Record<string, string[]> = {};
  for (const m of memberships ?? []) {
    (companyIdsByEmployee[m.employee_id] ??= []).push(m.company_id);
  }
  const employeeOptions = (employees ?? []).map((e) => ({
    id: e.id,
    full_name: e.full_name,
    companyIds: companyIdsByEmployee[e.id] ?? [],
  }));

  const rows: AuditRow[] = (audits ?? []).map((a) => ({
    ...(a as unknown as Audit),
    companyName: (a.companies as { name?: string } | null)?.name ?? "—",
    employeeName: (a.employees as { full_name?: string } | null)?.full_name ?? "—",
  }));

  // Photos employees add from the app are private storage paths; sign them for display.
  const paths = rows
    .flatMap((r) => [...(r.main_audits ?? []).flatMap((m) => m.images ?? []), ...(r.employee_images ?? [])])
    .filter((u) => !/^https?:/i.test(u));
  const photoUrls: Record<string, string> = {};
  if (paths.length) {
    const { data: signed } = await supabase.storage.from("audit-images").createSignedUrls([...new Set(paths)], 60 * 60);
    for (const s of signed ?? []) if (s.path && s.signedUrl) photoUrls[s.path] = s.signedUrl;
  }

  return (
    <div>
      <PageHeader title="Audits" subtitle="Showing audits from the last 2 months" />

      {error && (
        <div className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          Couldn&apos;t load audits — connect Supabase to see live data.
        </div>
      )}

      {!error && (
        <AuditsTable audits={rows} companies={companies ?? []} sites={sites ?? []} employees={employeeOptions} photoUrls={photoUrls} />
      )}
    </div>
  );
}
