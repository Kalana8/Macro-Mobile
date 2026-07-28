import { createClient } from "@macro/shared/supabase/server";
import { EmptyState, ScreenHeader } from "@/components/ui";
import { CreateAuditForm } from "./CreateAuditForm";

export default async function CreateAuditPage() {
  const supabase = await createClient();
  const [{ data: companies }, { data: sites }] = await Promise.all([
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("sites").select("id, name, company_id").order("name"),
  ]);

  return (
    <div>
      <ScreenHeader title="Create Audit" />
      <div className="p-5">
        {(companies?.length ?? 0) === 0 ? (
          <EmptyState
            title="No companies assigned yet"
            hint="You need to be assigned to a company before you can submit an audit — ask your admin to assign you."
          />
        ) : (
          <CreateAuditForm companies={companies!} sites={sites ?? []} />
        )}
      </div>
    </div>
  );
}
