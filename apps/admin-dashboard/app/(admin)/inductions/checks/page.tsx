import { createClient } from "@macro/shared/supabase/server";
import { todayInBusinessTimezone } from "@macro/shared/datetime";
import { PageHeader } from "@/components/ui";
import { checksNotSetUp, type CheckType, type EmployeeCheck } from "@/lib/checks";
import { PartSwitch } from "../InductionTabs";
import { ChecksTable } from "./ChecksTable";

export default async function ChecksPage() {
  const supabase = await createClient();
  const [{ data: types, error }, { data: employees }, { data: checks }] = await Promise.all([
    supabase.from("check_types").select("id, name, description, sort, active").order("sort").order("name"),
    supabase.from("employees").select("id, full_name, status").eq("status", "active").order("full_name"),
    supabase.from("employee_checks").select("id, employee_id, check_type_id, status, document_path, file_name, note, expires_on, review_note, submitted_at, reviewed_at"),
  ]);

  return (
    <div>
      <PageHeader title="Induction and Check Links" subtitle="Documents every employee hands in, like the Police and VEVO checks" />
      <PartSwitch active="checks" />
      {error ? (
        <div className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          {checksNotSetUp(error.message) ? "Checks aren't set up yet. Run migration 0057_employee_checks.sql in Supabase." : "Couldn't load checks."}
        </div>
      ) : (
        <ChecksTable
          types={(types ?? []) as CheckType[]}
          employees={(employees ?? []).map((e) => ({ id: e.id as string, full_name: e.full_name as string }))}
          checks={(checks ?? []) as EmployeeCheck[]}
          today={todayInBusinessTimezone()}
        />
      )}
    </div>
  );
}
