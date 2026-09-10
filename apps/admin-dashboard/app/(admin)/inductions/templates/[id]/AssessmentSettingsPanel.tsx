"use client";

import type { AssessmentSettings } from "../actions";

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3 py-1.5 text-[13px] font-semibold text-text-dark">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-border"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${checked ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </button>
    </label>
  );
}

export function AssessmentSettingsPanel({ settings, onChange }: { settings: AssessmentSettings; onChange: (patch: Partial<AssessmentSettings>) => void }) {
  return (
    <div className="mb-4 rounded-[16px] border border-border bg-white p-4">
      <div className="mb-3 text-sm font-bold text-text-dark">Assessment Settings</div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">Pass Mark</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={100}
              value={settings.pass_mark_percent}
              onChange={(e) => onChange({ pass_mark_percent: Math.min(100, Math.max(1, Number(e.target.value))) })}
              className="w-20 rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-dark outline-none focus:border-primary"
            />
            <span className="text-sm text-text-muted">%</span>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">Max Attempts</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              value={settings.max_attempts ?? ""}
              placeholder="Unlimited"
              onChange={(e) => onChange({ max_attempts: e.target.value ? Math.max(1, Number(e.target.value)) : null })}
              className="w-24 rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-dark outline-none focus:border-primary"
            />
            <span className="text-xs text-text-muted">blank = unlimited</span>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">Retake Delay</div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              value={settings.retake_delay_hours}
              onChange={(e) => onChange({ retake_delay_hours: Math.max(0, Number(e.target.value)) })}
              className="w-20 rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-dark outline-none focus:border-primary"
            />
            <span className="text-sm text-text-muted">hours</span>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-x-6 border-t border-border pt-3 sm:grid-cols-2">
        <Toggle checked={settings.shuffle_questions} onChange={(v) => onChange({ shuffle_questions: v })} label="Shuffle question order" />
        <Toggle checked={settings.shuffle_options} onChange={(v) => onChange({ shuffle_options: v })} label="Shuffle answer options" />
        <Toggle checked={settings.show_correct_answers} onChange={(v) => onChange({ show_correct_answers: v })} label="Show correct answers after submission" />
        <Toggle checked={settings.certificate_enabled} onChange={(v) => onChange({ certificate_enabled: v })} label="Issue certificate on pass" />
      </div>
    </div>
  );
}
