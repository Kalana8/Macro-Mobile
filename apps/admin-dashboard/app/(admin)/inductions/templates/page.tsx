import { createClient } from "@macro/shared/supabase/server";
import { PageHeader } from "@/components/ui";
import type { InductionTemplate } from "@macro/shared/types";
import { InductionTabs } from "../InductionTabs";
import { TemplatesGrid } from "./TemplatesGrid";

export interface TemplateRow extends InductionTemplate {
  ownerName: string;
  usageCount: number;
}

export default async function InductionTemplatesPage() {
  const supabase = await createClient();

  const [{ data: templates, error }, { data: tokens }, { data: employees }] = await Promise.all([
    supabase.from("induction_templates").select("*").order("updated_at", { ascending: false }),
    supabase.from("induction_tokens").select("template_id"),
    supabase.from("employees").select("id, full_name"),
  ]);

  const employeeNameById = new Map((employees ?? []).map((e) => [e.id, e.full_name]));
  const usageByTemplate = new Map<string, number>();
  for (const t of tokens ?? []) {
    if (!t.template_id) continue;
    usageByTemplate.set(t.template_id, (usageByTemplate.get(t.template_id) ?? 0) + 1);
  }

  const rows: TemplateRow[] = (templates ?? []).map((t) => ({
    ...(t as unknown as InductionTemplate),
    ownerName: t.created_by ? (employeeNameById.get(t.created_by) ?? "—") : "—",
    usageCount: usageByTemplate.get(t.id) ?? 0,
  }));

  return (
    <div>
      <PageHeader title="Assignments" subtitle="Dynamic induction/assignment forms your team can build and assign to invitations" />
      <InductionTabs active="templates" />

      {error && (
        <div className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          Couldn&apos;t load templates — connect Supabase to see live data.
        </div>
      )}

      {!error && <TemplatesGrid rows={rows} />}
    </div>
  );
}
