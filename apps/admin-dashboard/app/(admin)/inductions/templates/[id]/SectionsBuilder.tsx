"use client";

import { useRef, useState } from "react";
import { QuestionInput } from "@/components/QuestionInput";
import type { InductionFormSection, InductionQuestion, InductionQuestionType } from "@macro/shared/types";
import { updateTemplateSectionsAction } from "../actions";
import { PreviewModal } from "./PreviewModal";

function newId(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const QUESTION_TYPE_LABEL: Record<InductionQuestionType, string> = {
  short_answer: "Short Answer",
  paragraph: "Paragraph",
  multiple_choice: "Multiple Choice",
  checkboxes: "Checkboxes",
  dropdown: "Dropdown",
  yes_no: "Yes / No",
  true_false: "True / False",
  date: "Date",
  time: "Time",
  file_upload: "File Upload",
  image_upload: "Image Upload",
  video_upload: "Video Upload",
};

const QUESTION_TYPES = Object.keys(QUESTION_TYPE_LABEL) as InductionQuestionType[];

function hasOptions(type: InductionQuestionType): boolean {
  return type === "multiple_choice" || type === "checkboxes" || type === "dropdown";
}

function isUpload(type: InductionQuestionType): boolean {
  return type === "file_upload" || type === "image_upload" || type === "video_upload";
}

function blankQuestion(): InductionQuestion {
  return { id: newId("q"), type: "short_answer", title: "", required: false };
}

function blankSection(): InductionFormSection {
  return { id: newId("section"), title: "Untitled Section", description: "", questions: [blankQuestion()] };
}

function DragHandleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="8" cy="6" r="1.6" /><circle cx="16" cy="6" r="1.6" />
      <circle cx="8" cy="12" r="1.6" /><circle cx="16" cy="12" r="1.6" />
      <circle cx="8" cy="18" r="1.6" /><circle cx="16" cy="18" r="1.6" />
    </svg>
  );
}

function DuplicateIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

function QuestionCard({
  question,
  onChange,
  onDuplicate,
  onDelete,
  canDelete,
  dragHandleProps,
}: {
  question: InductionQuestion;
  onChange: (patch: Partial<InductionQuestion>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canDelete: boolean;
  dragHandleProps: React.HTMLAttributes<HTMLSpanElement>;
}) {
  const options = question.options ?? [];

  function updateOption(i: number, value: string) {
    const next = [...options];
    next[i] = value;
    onChange({ options: next });
  }

  function addOption() {
    onChange({ options: [...options, `Option ${options.length + 1}`] });
  }

  function removeOption(i: number) {
    onChange({ options: options.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="rounded-[14px] border border-border bg-white p-4">
      <div className="mb-3 flex items-start gap-2">
        <span {...dragHandleProps} className="mt-2.5 shrink-0 cursor-grab text-text-muted">
          <DragHandleIcon />
        </span>
        <input
          value={question.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Question"
          className="min-w-0 flex-1 rounded-[10px] border border-border bg-bg px-3.5 py-2.5 text-sm font-semibold text-text-dark outline-none focus:border-primary"
        />
        <select
          value={question.type}
          onChange={(e) => onChange({ type: e.target.value as InductionQuestionType })}
          className="shrink-0 rounded-[10px] border border-border bg-bg px-2.5 py-2.5 text-[12.5px] font-semibold text-text-dark outline-none focus:border-primary"
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
      </div>

      {hasOptions(question.type) && (
        <div className="mb-3 flex flex-col gap-1.5 pl-6">
          {options.length === 0 && <p className="text-xs text-text-muted">No options yet — add one below.</p>}
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-text-muted">{question.type === "checkboxes" ? "☐" : "○"}</span>
              <input
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-sm text-text-dark outline-none focus:border-primary"
              />
              <button type="button" onClick={() => removeOption(i)} className="shrink-0 text-text-muted hover:text-error" aria-label="Remove option">
                ✕
              </button>
            </div>
          ))}
          <button type="button" onClick={addOption} className="mt-1 self-start text-[12.5px] font-semibold text-primary">
            + Add option
          </button>
        </div>
      )}

      {isUpload(question.type) && (
        <div className="mb-3 flex flex-col gap-2 pl-6 sm:flex-row sm:items-center">
          <input
            value={question.acceptedFileTypes ?? ""}
            onChange={(e) => onChange({ acceptedFileTypes: e.target.value })}
            placeholder={question.type === "file_upload" ? "Accepted types, e.g. .pdf,.docx" : "Accepted types (optional)"}
            className="flex-1 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-text-dark outline-none focus:border-primary"
          />
          <input
            type="number"
            min={1}
            value={question.maxFileSizeMb ?? ""}
            onChange={(e) => onChange({ maxFileSizeMb: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="Max MB"
            className="w-24 shrink-0 rounded-lg border border-border bg-bg px-3 py-1.5 text-xs text-text-dark outline-none focus:border-primary"
          />
        </div>
      )}

      <div className="mb-3 pl-6 opacity-60">
        <QuestionInput question={question} value={null} onChange={() => {}} disabled />
      </div>

      <div className="flex items-center justify-between border-t border-border pt-3">
        <label className="flex items-center gap-2 text-[12.5px] font-semibold text-text-dark">
          <span>Required</span>
          <button
            type="button"
            role="switch"
            aria-checked={question.required}
            onClick={() => onChange({ required: !question.required })}
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${question.required ? "bg-primary" : "bg-border"}`}
          >
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${question.required ? "translate-x-[18px]" : "translate-x-0.5"}`} />
          </button>
        </label>
        <div className="flex items-center gap-1">
          <button type="button" onClick={onDuplicate} className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-bg text-text-dark" aria-label="Duplicate question" title="Duplicate">
            <DuplicateIcon />
          </button>
          {canDelete && (
            <button type="button" onClick={onDelete} className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-bg text-error" aria-label="Delete question" title="Delete">
              <DeleteIcon />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function SectionsBuilder({
  templateId,
  templateName,
  templateDescription,
  initialSections,
}: {
  templateId: string;
  templateName: string;
  templateDescription: string;
  initialSections: InductionFormSection[];
}) {
  const [sections, setSections] = useState<InductionFormSection[]>(initialSections.length > 0 ? initialSections : [blankSection()]);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "unsaved">("saved");
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const sectionDrag = useRef<number | null>(null);
  const questionDrag = useRef<{ sectionIndex: number; questionIndex: number } | null>(null);

  function markUnsaved() {
    setSaveState("unsaved");
  }

  function updateSection(sectionId: string, patch: Partial<InductionFormSection>) {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)));
    markUnsaved();
  }

  function duplicateSection(sectionId: string) {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === sectionId);
      if (idx === -1) return prev;
      const copy: InductionFormSection = {
        ...prev[idx],
        id: newId("section"),
        title: `${prev[idx].title} (Copy)`,
        questions: prev[idx].questions.map((q) => ({ ...q, id: newId("q") })),
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
    markUnsaved();
  }

  function deleteSection(sectionId: string) {
    setSections((prev) => (prev.length <= 1 ? prev : prev.filter((s) => s.id !== sectionId)));
    markUnsaved();
  }

  function addSection() {
    setSections((prev) => [...prev, blankSection()]);
    markUnsaved();
  }

  function handleSectionDrop(index: number) {
    const from = sectionDrag.current;
    sectionDrag.current = null;
    if (from === null || from === index) return;
    setSections((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
    markUnsaved();
  }

  function updateQuestion(sectionId: string, questionId: string, patch: Partial<InductionQuestion>) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, questions: s.questions.map((q) => (q.id === questionId ? { ...q, ...patch } : q)) } : s))
    );
    markUnsaved();
  }

  function duplicateQuestion(sectionId: string, questionId: string) {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const idx = s.questions.findIndex((q) => q.id === questionId);
        if (idx === -1) return s;
        const copy = { ...s.questions[idx], id: newId("q") };
        const questions = [...s.questions];
        questions.splice(idx + 1, 0, copy);
        return { ...s, questions };
      })
    );
    markUnsaved();
  }

  function deleteQuestion(sectionId: string, questionId: string) {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId && s.questions.length > 1 ? { ...s, questions: s.questions.filter((q) => q.id !== questionId) } : s))
    );
    markUnsaved();
  }

  function addQuestion(sectionId: string) {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, questions: [...s.questions, blankQuestion()] } : s)));
    markUnsaved();
  }

  function handleQuestionDrop(sectionIndex: number, questionIndex: number) {
    const from = questionDrag.current;
    questionDrag.current = null;
    if (!from || from.sectionIndex !== sectionIndex || from.questionIndex === questionIndex) {
      questionDrag.current = null;
      return;
    }
    setSections((prev) => {
      const next = [...prev];
      const questions = [...next[sectionIndex].questions];
      const [moved] = questions.splice(from.questionIndex, 1);
      questions.splice(questionIndex, 0, moved);
      next[sectionIndex] = { ...next[sectionIndex], questions };
      return next;
    });
    markUnsaved();
  }

  async function save(publish?: boolean) {
    setSaveState("saving");
    setError(null);
    const result = await updateTemplateSectionsAction(templateId, sections);
    if (result.error) {
      setError(result.error);
      setSaveState("unsaved");
      return;
    }
    if (publish) {
      const { setTemplateStatusAction } = await import("../actions");
      const fd = new FormData();
      fd.set("id", templateId);
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

      <div className="flex flex-col gap-4">
        {sections.map((section, si) => (
          <div
            key={section.id}
            draggable
            onDragStart={() => (sectionDrag.current = si)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleSectionDrop(si)}
            className="rounded-[16px] border-2 border-primary/15 bg-bg p-4"
          >
            <div className="mb-3 flex items-start gap-2">
              <span className="mt-2.5 shrink-0 cursor-grab text-text-muted">
                <DragHandleIcon />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <input
                  value={section.title}
                  onChange={(e) => updateSection(section.id, { title: e.target.value })}
                  placeholder="Section title"
                  className="w-full rounded-[10px] border border-border bg-white px-3.5 py-2.5 text-[15px] font-bold text-text-dark outline-none focus:border-primary"
                />
                <input
                  value={section.description}
                  onChange={(e) => updateSection(section.id, { description: e.target.value })}
                  placeholder="Section description (optional)"
                  className="w-full rounded-[10px] border border-border bg-white px-3.5 py-2 text-[12.5px] text-text-muted outline-none focus:border-primary"
                />
              </div>
              <div className="mt-1 flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => duplicateSection(section.id)} className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white text-text-dark" aria-label="Duplicate section" title="Duplicate section">
                  <DuplicateIcon />
                </button>
                {sections.length > 1 && (
                  <button type="button" onClick={() => deleteSection(section.id)} className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-white text-error" aria-label="Delete section" title="Delete section">
                    <DeleteIcon />
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 pl-1">
              {section.questions.map((q, qi) => (
                <div
                  key={q.id}
                  draggable
                  onDragStart={() => (questionDrag.current = { sectionIndex: si, questionIndex: qi })}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleQuestionDrop(si, qi)}
                >
                  <QuestionCard
                    question={q}
                    onChange={(patch) => updateQuestion(section.id, q.id, patch)}
                    onDuplicate={() => duplicateQuestion(section.id, q.id)}
                    onDelete={() => deleteQuestion(section.id, q.id)}
                    canDelete={section.questions.length > 1}
                    dragHandleProps={{}}
                  />
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => addQuestion(section.id)}
              className="mt-3 w-full rounded-[12px] border border-dashed border-primary/40 py-2.5 text-[12.5px] font-bold text-primary hover:bg-primary/5"
            >
              + Add Question
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addSection}
        className="mt-4 w-full rounded-[14px] border-2 border-dashed border-border bg-white py-3.5 text-sm font-bold text-text-dark hover:border-primary hover:text-primary"
      >
        + Add Section
      </button>

      {showPreview && (
        <PreviewModal
          title={templateName}
          description={templateDescription}
          sections={sections}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
