"use client";

import { useState } from "react";
import type { InductionFormSection, InductionTemplate, InductionTrainingSlide } from "@macro/shared/types";
import { updateAssignmentContentAction, setTemplateStatusAction, type AssessmentSettings } from "../actions";
import { AssessmentEditor, blankSection } from "./SectionsBuilder";
import { TrainingSlidesEditor } from "./TrainingSlidesEditor";
import { AssessmentSettingsPanel } from "./AssessmentSettingsPanel";
import { PreviewModal } from "./PreviewModal";

type Tab = "training" | "assessment";

export function AssignmentBuilder({ template }: { template: InductionTemplate }) {
  const [tab, setTab] = useState<Tab>("training");
  const [sections, setSections] = useState<InductionFormSection[]>(template.sections.length > 0 ? template.sections : [blankSection()]);
  const [trainingSlides, setTrainingSlides] = useState<InductionTrainingSlide[]>(template.training_slides);
  const [settings, setSettings] = useState<AssessmentSettings>({
    pass_mark_percent: template.pass_mark_percent,
    max_attempts: template.max_attempts,
    retake_delay_hours: template.retake_delay_hours,
    shuffle_questions: template.shuffle_questions,
    shuffle_options: template.shuffle_options,
    show_correct_answers: template.show_correct_answers,
    certificate_enabled: template.certificate_enabled,
  });
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  function markUnsaved() {
    setSaveState("unsaved");
  }

  async function save(publish?: boolean) {
    setSaveState("saving");
    setError(null);
    const result = await updateAssignmentContentAction(template.id, sections, trainingSlides, settings);
    if (result.error) {
      setError(result.error);
      setSaveState("unsaved");
      return;
    }
    if (publish) {
      const fd = new FormData();
      fd.set("id", template.id);
      fd.set("status", "published");
      await setTemplateStatusAction(fd);
    }
    setSaveState("saved");
  }

  return (
    <div>
      <div className="sticky top-0 z-20 mb-4 flex items-center justify-between gap-3 rounded-[14px] border border-border bg-white/95 px-4 py-3 backdrop-blur">
        <span className={`text-xs font-semibold ${saveState === "unsaved" ? "text-orange" : saveState === "saving" ? "text-text-muted" : "text-olive-text"}`}>
          {saveState === "saving" ? "Saving…" : saveState === "unsaved" ? "Unsaved changes" : "Saved"}
        </span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowPreview(true)} className="rounded-[10px] border border-border px-4 py-2 text-[12.5px] font-bold text-text-dark">
            Preview
          </button>
          <button
            type="button"
            onClick={() => save(false)}
            disabled={saveState === "saving"}
            className="rounded-[10px] border border-border px-4 py-2 text-[12.5px] font-bold text-text-dark disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            type="button"
            onClick={() => save(true)}
            disabled={saveState === "saving"}
            className="rounded-[10px] bg-primary px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-50"
          >
            Publish
          </button>
        </div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-error/10 px-3.5 py-2.5 text-[12.5px] text-error">{error}</div>}

      <div className="mb-4 flex w-fit gap-1.5 rounded-lg bg-bg p-1">
        <button
          type="button"
          onClick={() => setTab("training")}
          className={`rounded-md px-4 py-2 text-sm font-bold ${tab === "training" ? "bg-white text-primary shadow-sm" : "text-text-muted"}`}
        >
          Training Content
        </button>
        <button
          type="button"
          onClick={() => setTab("assessment")}
          className={`rounded-md px-4 py-2 text-sm font-bold ${tab === "assessment" ? "bg-white text-primary shadow-sm" : "text-text-muted"}`}
        >
          Assessment
        </button>
      </div>

      {tab === "training" ? (
        <TrainingSlidesEditor
          slides={trainingSlides}
          onChange={(next) => {
            setTrainingSlides(next);
            markUnsaved();
          }}
        />
      ) : (
        <>
          <AssessmentSettingsPanel
            settings={settings}
            onChange={(patch) => {
              setSettings((prev) => ({ ...prev, ...patch }));
              markUnsaved();
            }}
          />
          <AssessmentEditor
            sections={sections}
            onChange={(next) => {
              setSections(next);
              markUnsaved();
            }}
          />
        </>
      )}

      {showPreview && (
        <PreviewModal title={template.name} description={template.description} sections={sections} onClose={() => setShowPreview(false)} />
      )}
    </div>
  );
}
