"use client";

import Image from "next/image";
import type { InductionFormSection } from "@macro/shared/types";

function ChevronDown({ className = "" }: { className?: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

const DEFAULT_INTRO =
  "This site safety induction provides essential information on site rules, personal protective equipment (PPE), emergency procedures, and workplace hazards. " +
  "All workers and visitors must follow site rules, procedures, and instructions while on site. The required PPE must be worn correctly and maintained throughout relevant work activities. " +
  "Work areas should be kept clean, organised, and free from avoidable hazards. Any hazards, unsafe conditions, incidents, or near misses must be reported to the appropriate site contact. " +
  "Everyone should be familiar with emergency exits, first-aid facilities, fire equipment, and the designated emergency assembly point. " +
  "In an emergency, stop work and follow the site's emergency and evacuation procedures while following instructions from authorised site personnel.";

/**
 * A creative landing screen shown before the actual question form — sets
 * expectations (what topics this induction covers) before the employee
 * commits to starting the assessment. Uses the app's own brand palette
 * (primary blue / orange accent) rather than an unrelated color scheme, so
 * it reads as part of Macro rather than a generic template.
 */
export function InductionIntro({
  assignmentTitle,
  assignmentDescription,
  sections,
  onStart,
}: {
  assignmentTitle: string;
  assignmentDescription: string;
  sections: InductionFormSection[];
  onStart: () => void;
}) {
  const topics = sections.map((s) => s.title).filter(Boolean);

  return (
    <div className="min-h-screen bg-[#EEF4FD]">
      <div className="relative bg-white px-6 pb-14 pt-10 sm:px-12 sm:pt-14">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center sm:items-start sm:text-left">
          <Image src="/uploads/footer.webp" alt="Macro Property Services" width={260} height={94} className="h-20 w-auto sm:h-24" />
          <h1 className="text-3xl font-extrabold leading-tight text-text-dark sm:text-4xl">Welcome to The Macro Induction</h1>
          <p className="rounded-full bg-orange px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white">{assignmentTitle}</p>
          <p className="max-w-2xl text-sm leading-relaxed text-text-muted">{assignmentDescription || DEFAULT_INTRO}</p>
        </div>
        <div className="absolute -bottom-[1px] left-8 flex h-6 w-10 items-center justify-center rounded-t-md bg-[#EEF4FD] text-primary sm:left-14">
          <ChevronDown className="h-4 w-4" />
        </div>
      </div>

      <div className="px-6 py-10 sm:px-12">
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <h2 className="text-xl font-extrabold text-text-dark sm:text-2xl">Topics I need to know</h2>

          {topics.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {topics.map((topic, i) => (
                <div key={i} className="rounded-xl bg-white p-4 text-sm font-semibold text-text-dark shadow-[0_2px_10px_rgba(0,0,0,0.06)]">
                  {topic}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">This induction covers everything you need to know before starting work on site.</p>
          )}

          <div className="mt-2 flex items-center gap-3">
            <div className="h-px flex-1 bg-primary/25" />
            <ChevronDown className="shrink-0 text-primary" />
            <div className="h-px flex-1 bg-primary/25" />
          </div>

          <div className="flex justify-center sm:justify-end">
            <button
              type="button"
              onClick={onStart}
              className="rounded-full bg-orange px-8 py-3 text-sm font-bold text-white shadow-[0_4px_14px_rgba(255,122,26,0.4)] transition-transform hover:scale-[1.02]"
            >
              Start Assessment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
