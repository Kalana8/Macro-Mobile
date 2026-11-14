import { createClient } from "@macro/shared/supabase/server";
import { EmptyState, PageHeader } from "@/components/ui";
import { getCurrentAdmin } from "@/lib/session";
import { PhotoShares, type ShareView } from "./PhotoShares";

// Per-user private data — never serve it from a cache across an account switch.
export const dynamic = "force-dynamic";

interface ShareRow {
  id: string;
  sender_id: string;
  note: string;
  images: string[];
  created_at: string;
  companies: { name: string } | null;
  photo_share_recipients: { recipient_id: string; seen_at: string | null }[];
}

export default async function PhotosPage() {
  const supabase = await createClient();
  const admin = await getCurrentAdmin();
  const me = admin?.authUserId ?? "";

  // RLS limits this to photos this admin sent or was sent: like chat, there is no blanket admin view.
  const [{ data, error }, { data: contacts }, { data: companies }, { data: memberships }] = await Promise.all([
    supabase
      .from("photo_shares")
      .select("id, sender_id, note, images, created_at, companies(name), photo_share_recipients(recipient_id, seen_at)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.rpc("photo_share_contacts"),
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("employee_companies").select("employee_id, company_id"),
  ]);

  if (error) {
    return (
      <div>
        <PageHeader title="Photos" subtitle="Photos employees send you, with their notes" />
        <EmptyState
          title="Photo sharing isn’t switched on yet"
          hint="Apply supabase/migrations/0044_photo_shares.sql to the Supabase project, then reload this page."
        />
      </div>
    );
  }

  const rows = (data ?? []) as unknown as ShareRow[];
  const names = new Map(((contacts ?? []) as { id: string; full_name: string }[]).map((c) => [c.id, c.full_name]));
  const paths = [...new Set(rows.flatMap((r) => r.images))];
  const { data: signed } = paths.length
    ? await supabase.storage.from("shared-photos").createSignedUrls(paths, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const urls = new Map((signed ?? []).flatMap((s) => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])));

  const toView = (r: ShareRow): ShareView => ({
    id: r.id,
    senderName: names.get(r.sender_id) ?? "Someone",
    recipientNames: r.photo_share_recipients.map((x) => names.get(x.recipient_id) ?? "Someone"),
    seenCount: r.photo_share_recipients.filter((x) => x.seen_at).length,
    isNewForMe: r.photo_share_recipients.some((x) => x.recipient_id === me && !x.seen_at),
    note: r.note,
    company: r.companies?.name ?? null,
    createdAt: r.created_at,
    photos: r.images.flatMap((p) => (urls.get(p) ? [urls.get(p)!] : [])),
  });

  const companyIdsByEmployee = new Map<string, string[]>();
  for (const m of (memberships ?? []) as { employee_id: string; company_id: string }[]) {
    companyIdsByEmployee.set(m.employee_id, [...(companyIdsByEmployee.get(m.employee_id) ?? []), m.company_id]);
  }
  const contactOptions = ((contacts ?? []) as { id: string; full_name: string; is_admin: boolean }[]).map((c) => ({
    ...c,
    companyIds: companyIdsByEmployee.get(c.id) ?? [],
  }));

  return (
    <div>
      <PageHeader title="Photos" subtitle="Photos sent between you and your team, with their notes" />
      <PhotoShares
        adminId={me}
        contacts={contactOptions}
        companies={companies ?? []}
        received={rows.filter((r) => r.sender_id !== me).map(toView)}
        sent={rows.filter((r) => r.sender_id === me).map(toView)}
      />
    </div>
  );
}
