import type { Metadata } from "next";
import Image from "next/image";
import { createServiceRoleClient } from "@macro/shared/supabase/server";
import { formatDate } from "@macro/shared/datetime";
import { toOne } from "@/lib/embed";

export const metadata: Metadata = {
  title: "Certificate Verification",
  robots: { index: false, follow: false },
};

/**
 * The page a QR code on a printed/downloaded certificate points to — a
 * minimal, read-only, public lookup by certificate id (not by a guessable
 * sequence: ids are uuids) so anyone holding a certificate can confirm it's
 * genuine and still valid without needing to sign in.
 */
export default async function CertificateVerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServiceRoleClient();

  const { data: certificate } = await supabase.from("induction_certificates").select("*").eq("id", id).maybeSingle();

  if (!certificate) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-4xl">⚠️</div>
        <h1 className="text-xl font-extrabold text-text-dark">Certificate Not Found</h1>
        <p className="text-sm text-text-muted">This certificate ID doesn&apos;t match any record.</p>
      </div>
    );
  }

  const [{ data: employee }, { data: site }, { data: submission }] = await Promise.all([
    supabase.from("employees").select("full_name").eq("id", certificate.employee_id).maybeSingle(),
    supabase.from("sites").select("name, companies(name)").eq("id", certificate.site_id).maybeSingle(),
    supabase.from("induction_submissions").select("token_id").eq("id", certificate.submission_id).maybeSingle(),
  ]);
  const company = toOne(site?.companies as { name?: string } | { name?: string }[] | null | undefined);

  let assignmentName = "Site Induction";
  if (submission?.token_id) {
    const { data: token } = await supabase.from("induction_tokens").select("template_id").eq("id", submission.token_id).maybeSingle();
    if (token?.template_id) {
      const { data: template } = await supabase.from("induction_templates").select("name").eq("id", token.template_id).maybeSingle();
      if (template?.name) assignmentName = template.name;
    }
  }

  const expired = new Date() > new Date(certificate.expires_at) || certificate.status === "expired";
  const revoked = certificate.status === "revoked";
  const valid = !expired && !revoked;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center gap-4 p-6 text-center">
      <Image src="/uploads/footer.webp" alt="Macro Property Services" width={140} height={52} className="mt-6 h-11 w-auto" />

      <div className={`flex flex-col items-center gap-1.5 rounded-2xl px-6 py-5 ${valid ? "bg-olive/15 text-olive-text" : "bg-error/10 text-error"}`}>
        <div className="text-3xl">{valid ? "✅" : "⚠️"}</div>
        <div className="text-lg font-extrabold">{revoked ? "Certificate Revoked" : expired ? "Certificate Expired" : "Valid Certificate"}</div>
      </div>

      <div className="w-full rounded-2xl border border-border bg-white p-5 text-left">
        <div className="mb-3 text-center text-xs font-bold uppercase tracking-wide text-text-muted">Site Induction Certificate</div>
        <div className="flex flex-col gap-2.5 text-sm">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Employee</div>
            <div className="font-semibold text-text-dark">{employee?.full_name ?? "N/A"}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Induction</div>
            <div className="font-semibold text-text-dark">{assignmentName}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Site / Company</div>
            <div className="font-semibold text-text-dark">{site?.name ?? "N/A"} — {company?.name ?? "N/A"}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Completed</div>
            <div className="text-text-dark">{formatDate(certificate.issued_at, { day: "2-digit", month: "short", year: "numeric" })}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Certificate ID</div>
            <div className="font-mono text-xs text-text-dark">{certificate.certificate_number}</div>
          </div>
        </div>
      </div>

      <p className="text-xs text-text-muted">Verified against Macro Property Services induction records.</p>
    </div>
  );
}
