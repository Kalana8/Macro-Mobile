import { createClient } from "@macro/shared/supabase/server";
import { ScreenHeader } from "@/components/ui";
import { NewReportForm } from "./NewReportForm";

export default async function NewCommunicationPage() {
  const supabase = await createClient();

  // RLS scopes both queries to this employee's own assigned companies/sites.
  const [{ data: companies }, { data: sites }] = await Promise.all([
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("sites").select("id, name, company_id").order("name"),
  ]);

  return (
    <div>
      <ScreenHeader title="Report an Issue" />
      <div className="p-5">
        <NewReportForm companies={companies ?? []} sites={sites ?? []} />
      </div>
    </div>
  );
}
