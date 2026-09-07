"use client";

import Image from "next/image";
import { Dancing_Script, Playfair_Display } from "next/font/google";
import { formatDate } from "@macro/shared/datetime";
import type { InductionCertificateInfo } from "./actions";

const playfair = Playfair_Display({ subsets: ["latin"], weight: ["700", "800"] });
const signature = Dancing_Script({ subsets: ["latin"], weight: ["700"] });

function CheckIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="m8.5 12.5 2.5 2.5 5-5" />
    </svg>
  );
}

function fullDate(iso: string): string {
  return formatDate(iso, { day: "2-digit", month: "long", year: "numeric" });
}

/** One corner's stack of overlapping decorative triangles (navy / gold / crimson), mirrored via a 180° rotate for the opposite corner. */
function CornerTriangles({ corner }: { corner: "top-left" | "bottom-right" }) {
  const positionClass = corner === "top-left" ? "left-0 top-0" : "right-0 bottom-0 rotate-180";
  return (
    <div className={`pointer-events-none absolute h-40 w-40 sm:h-52 sm:w-52 ${positionClass}`}>
      <div className="absolute inset-0 bg-[#1F4E79]" style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }} />
      <div className="absolute inset-0 bg-[#EBC468]" style={{ clipPath: "polygon(0 0, 62% 0, 0 62%)" }} />
      <div className="absolute inset-0 bg-[#B23A52]" style={{ clipPath: "polygon(0 30%, 30% 0, 0 0)" }} />
    </div>
  );
}

/**
 * Shown both right after a successful submission (justSubmitted=true, a
 * celebratory "Certificate Successfully Completed" screen) and whenever the
 * employee reopens an already-completed induction link later — same
 * certificate data either way, since the certificate is never regenerated
 * independently of the original submission.
 */
export function CertificateScreen({
  employeeName,
  certificate,
  justSubmitted,
  expired,
}: {
  employeeName: string;
  certificate: InductionCertificateInfo;
  justSubmitted: boolean;
  expired: boolean;
}) {
  return (
    <div className="mx-auto min-h-screen max-w-2xl p-5 pb-10">
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <Image src="/uploads/footer.webp" alt="Macro Property Services" width={160} height={58} className="h-12 w-auto" />
      </div>

      <div className={`mb-5 flex flex-col items-center gap-2 rounded-2xl p-6 text-center ${expired ? "bg-error/10 text-error" : "bg-olive/15 text-olive-text"}`}>
        <CheckIcon />
        <h1 className="text-xl font-extrabold text-text-dark">
          {expired ? "Certificate Expired" : justSubmitted ? "Certificate Successfully Completed" : "Induction Completed"}
        </h1>
        <p className="text-sm">
          {expired
            ? "This certificate has expired. Contact your administrator if you need a new induction link."
            : justSubmitted
              ? `Thank you, ${employeeName}. Your site induction has been submitted and your certificate is ready.`
              : `You've already completed this induction, ${employeeName}. Your certificate is below.`}
        </p>
      </div>

      {/* The certificate itself — decorative frame styled like a printed award certificate. */}
      <div className="relative overflow-hidden rounded-2xl bg-[#AFC9DE] p-4 sm:p-6">
        <CornerTriangles corner="top-left" />
        <CornerTriangles corner="bottom-right" />

        <div className="relative z-10 rounded-sm border-[6px] border-white/70 bg-white p-1">
          <div className="border border-[#AFC9DE] px-6 py-10 text-center sm:px-10 sm:py-12">
            <h2 className={`${playfair.className} text-4xl font-extrabold tracking-wide text-[#1F4E79] sm:text-5xl`}>CERTIFICATE</h2>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.25em] text-[#1F4E79]/80 sm:text-sm">Of Site Induction Completion</p>

            <p className="mt-8 text-sm text-text-muted">This certificate is awarded to</p>
            <p className={`${signature.className} mt-1 text-4xl text-[#B23A52] sm:text-5xl`}>{certificate.employeeName}</p>

            <p className="mt-6 text-sm leading-relaxed text-text-dark">
              Has successfully completed the site induction for
              <br />
              <span className="font-bold text-[#1F4E79]">{certificate.assignmentName}</span>
              <br />
              at {certificate.siteName} — {certificate.companyName}
            </p>

            <div className="mx-auto mt-10 flex max-w-sm items-end justify-between gap-4 border-t border-[#AFC9DE] pt-3 text-left">
              <div>
                <div className="text-sm font-bold text-text-dark">{fullDate(certificate.issuedAt)}</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Date Completed</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-bold text-text-dark">Macro Property Services</div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Authorised</div>
              </div>
            </div>

            <div className="mt-6 text-[10.5px] text-text-muted">
              Certificate No. {certificate.certificateNumber} · Status: {expired ? "Expired" : "Completed"}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {certificate.fileUrl ? (
          <>
            <a
              href={certificate.fileUrl}
              download={`${certificate.certificateNumber}.pdf`}
              className="flex-1 rounded-xl bg-primary py-3 text-center text-sm font-bold text-white"
            >
              Download Certificate
            </a>
            <a
              href={certificate.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-xl border border-border py-3 text-center text-sm font-bold text-text-dark"
            >
              View Certificate
            </a>
          </>
        ) : (
          <div className="flex-1 rounded-xl border border-dashed border-border py-3 text-center text-sm text-text-muted">
            Your certificate PDF is being generated — check back shortly.
          </div>
        )}
      </div>
    </div>
  );
}
