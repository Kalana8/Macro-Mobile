import { createClient } from "@macro/shared/supabase/server";
import { ScreenHeader } from "@/components/ui";
import { CommunicationList } from "./CommunicationList";

export default async function CommunicationPage() {
  const supabase = await createClient();
  const { data: communications, error } = await supabase
    .from("communications")
    .select("id, title, priority, status, last_update, created_at")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  return (
    <div>
      <ScreenHeader title="Communication" subtitle="Company thread" />
      <div className="p-5">
        {error ? (
          <div className="rounded-lg bg-error/10 px-3 py-2 text-[12.5px] text-error">
            Couldn&apos;t load messages — connect Supabase to see live data.
          </div>
        ) : (
          <CommunicationList communications={communications ?? []} />
        )}
      </div>
    </div>
  );
}
