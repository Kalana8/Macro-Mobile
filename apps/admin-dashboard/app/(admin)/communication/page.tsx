import { createClient } from "@macro/shared/supabase/server";
import { PageHeader } from "@/components/ui";
import { getCurrentAdmin } from "@/lib/session";
import { CommunicationTable } from "./CommunicationTable";

export default async function CommunicationPage() {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();

  const [
    { data: communications, error },
    { data: recipients },
    { data: companies },
    { data: sites },
    { data: employees },
    { data: memberships },
  ] = await Promise.all([
    supabase
      .from("communications")
      .select("id, title, priority, status, last_update, created_at, last_message_at, companies(name), sites(name)")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false }),
    supabase.from("communication_recipients").select("communication_id, employees(full_name)"),
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

  const employeeNamesByCommunication: Record<string, string[]> = {};
  for (const r of recipients ?? []) {
    const name = (r.employees as { full_name?: string } | null)?.full_name;
    if (!name) continue;
    (employeeNamesByCommunication[r.communication_id] ??= []).push(name);
  }

  const rows = (communications ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    companyName: (c.companies as { name?: string } | null)?.name ?? "—",
    siteName: (c.sites as { name?: string } | null)?.name ?? "—",
    employeeNames: employeeNamesByCommunication[c.id]?.join(", ") ?? "—",
    priority: c.priority,
    status: c.status,
    last_update: c.last_update,
  }));

  return (
    <div>
      <PageHeader title="Communication" subtitle="All company threads — click a row to open the chat" />

      {error && (
        <div className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          Couldn&apos;t load messages — connect Supabase to see live data.
        </div>
      )}

      {!error && (
        <CommunicationTable
          rows={rows}
          companies={companies ?? []}
          sites={sites ?? []}
          employees={employeeOptions}
          adminId={admin?.authUserId ?? ""}
          adminName={admin?.employee?.full_name ?? "Admin"}
        />
      )}
    </div>
  );
}
