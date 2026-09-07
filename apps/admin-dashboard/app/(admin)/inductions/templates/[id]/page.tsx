import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@macro/shared/supabase/server";
import { PageHeader } from "@/components/ui";
import type { InductionTemplate } from "@macro/shared/types";
import { TemplateDetailsForm } from "./TemplateDetailsForm";
import { SectionsBuilder } from "./SectionsBuilder";

export default async function TemplateEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: template } = await supabase.from("induction_templates").select("*").eq("id", id).maybeSingle();
  if (!template) notFound();

  const { count } = await supabase
    .from("induction_tokens")
    .select("*", { count: "exact", head: true })
    .eq("template_id", id);

  const t = template as unknown as InductionTemplate;

  return (
    <div>
      <PageHeader title={t.name} subtitle={`Used in ${count ?? 0} invitation${count === 1 ? "" : "s"}`} />
      <Link href="/inductions/templates" className="mb-4 inline-block text-sm font-semibold text-primary">
        ← All Assignments
      </Link>

      <div className="flex flex-col gap-4">
        <TemplateDetailsForm template={t} />
        <SectionsBuilder templateId={t.id} templateName={t.name} templateDescription={t.description} initialSections={t.sections} />
      </div>
    </div>
  );
}
