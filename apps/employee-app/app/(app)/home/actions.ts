"use server";

import { createClient } from "@macro/shared/supabase/server";

export async function dismissNotificationAction(
  itemType: "checklist" | "communication" | "audit",
  itemId: string
): Promise<void> {
  if (!itemId) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("notification_dismissals").insert({
    employee_id: user.id,
    item_type: itemType,
    item_id: itemId,
  });
}
