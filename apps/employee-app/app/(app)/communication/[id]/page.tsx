import { notFound } from "next/navigation";
import { createClient } from "@macro/shared/supabase/server";
import { getCurrentEmployee } from "@/lib/session";
import { Badge, ScreenHeader } from "@/components/ui";
import { ChatThread } from "@/components/ChatThread";

const PRIORITY_TONE = { low: "neutral", medium: "warning", high: "error" } as const;

export default async function CommunicationThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const session = await getCurrentEmployee();

  // RLS (communications_employee_select) scopes this to the signed-in
  // employee's own threads — there's nothing else to authorize here.
  const { data: thread } = await supabase
    .from("communications")
    .select("id, title, priority, status, companies(name), sites(name)")
    .eq("id", id)
    .maybeSingle();

  if (!thread || !session?.employee) notFound();

  const companyName = (thread.companies as { name?: string } | null)?.name ?? "—";
  const siteName = (thread.sites as { name?: string } | null)?.name;

  return (
    <div>
      <ScreenHeader title={thread.title} subtitle={siteName ? `${companyName} · ${siteName}` : companyName} />
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-1.5">
          <Badge tone={PRIORITY_TONE[thread.priority as keyof typeof PRIORITY_TONE]}>{thread.priority}</Badge>
          <Badge tone={thread.status === "open" ? "info" : "neutral"}>{thread.status}</Badge>
        </div>

        <ChatThread
          conversationId={thread.id}
          currentUserId={session.employee.id}
          currentUserName={session.employee.full_name}
        />
      </div>
    </div>
  );
}
