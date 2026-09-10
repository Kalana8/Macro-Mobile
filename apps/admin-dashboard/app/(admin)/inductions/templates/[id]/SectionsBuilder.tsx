"use client";

import { useRef } from "react";
import { QuestionInput, TRUE_FALSE_OPTIONS, YES_NO_OPTIONS } from "@/components/QuestionInput";
import { GRADABLE_QUESTION_TYPES } from "@macro/shared/types";
import type { InductionFormSection, InductionQuestion, InductionQuestionType } from "@macro/shared/types";

export function newId(prefix: string): string {
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

/** The choices a "mark the correct answer" picker should offer — the question's own options for types that have them, or the fixed pair for yes/no and true/false. */
function gradableChoices(question: InductionQuestion): string[] {
  if (question.type === "yes_no") return YES_NO_OPTIONS;
  if (question.type === "true_false") return TRUE_FALSE_OPTIONS;
  return question.options ?? [];
}

export function blankQuestion(): InductionQuestion {
  return { id: newId("q"), type: "short_answer", title: "", required: false };
}

export function blankSection(): InductionFormSection {
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
  const isGradable = GRADABLE_QUESTION_TYPES.includes(question.type);
  const correctAnswers = question.correctAnswers ?? [];

  function updateOption(i: number, value: string) {
    const oldValue = options[i];
    const next = [...options];
    next[i] = value;
    // Keep a marked-correct option's grading in sync when its text is edited.
    const patch: Partial<InductionQuestion> = { options: next };
    if (correctAnswers.includes(oldValue)) {
      patch.correctAnswers = correctAnswers.map((v) => (v === oldValue ? value : v));
    }
    onChange(patch);
  }

  function addOption() {
    onChange({ options: [...options, `Option ${options.length + 1}`] });
  }

  function removeOption(i: number) {
    const removed = options[i];
    onChange({ options: options.filter((_, idx) => idx !== i), correctAnswers: correctAnswers.filter((v) => v !== removed) });
  }

  function toggleCorrect(choice: string) {
    if (question.type === "checkboxes") {
      onChange({ correctAnswers: correctAnswers.includes(choice) ? correctAnswers.filter((v) => v !== choice) : [...correctAnswers, choice] });
    } else {
      onChange({ correctAnswers: [choice] });
    }
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
          onChange={(e) => onChange({ type: e.target.value as InductionQuestionType, correctAnswers: undefined })}
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

      {isGradable && (
        <div className="mb-3 ml-6 rounded-lg bg-primary/5 p-3">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-primary">Grading</div>
          {gradableChoices(question).length === 0 ? (
            <p className="text-xs text-text-muted">Add options above, then mark the correct one here.</p>
          ) : (
            <div className="mb-2.5 flex flex-col gap-1.5">
              {gradableChoices(question).map((choice) => (
                <label key={choice} className="flex items-center gap-2 text-sm text-text-dark">
                  <input
                    type={question.type === "checkboxes" ? "checkbox" : "radio"}
                    checked={correctAnswers.includes(choice)}
                    onChange={() => toggleCorrect(choice)}
                    className="h-4 w-4 accent-olive-text"
                  />
                  {choice}
                </label>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-text-muted">
              Marks
              <input
                type="number"
                min={0}
                value={question.marks ?? 1}
                onChange={(e) => onChange({ marks: Number(e.target.value) })}
                className="w-16 rounded-md border border-border bg-white px-2 py-1 text-sm text-text-dark outline-none focus:border-primary"
              />
            </label>
          </div>
          <textarea
            value={question.explanation ?? ""}
            onChange={(e) => onChange({ explanation: e.target.value })}
            placeholder="Explanation shown after submission (optional)"
            rows={2}
            className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-1.5 text-xs text-text-dark outline-none focus:border-primary"
          />
        </div>
      )}

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

/** Sections/questions editor — fully controlled, no save logic of its own; the parent AssignmentBuilder owns the save/publish lifecycle for the whole assignment (training + assessment + settings together). */
export function AssessmentEditor({ sections, onChange }: { sections: InductionFormSection[]; onChange: (sections: InductionFormSection[]) => void }) {
  const sectionDrag = useRef<number | null>(null);
  const questionDrag = useRef<{ sectionIndex: number; questionIndex: number } | null>(null);

  function updateSection(sectionId: string, patch: Partial<InductionFormSection>) {
    onChange(sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)));
  }

  function duplicateSection(sectionId: string) {
    const idx = sections.findIndex((s) => s.id === sectionId);
    if (idx === -1) return;
    const copy: InductionFormSection = {
      ...sections[idx],
      id: newId("section"),
      title: `${sections[idx].title} (Copy)`,
      questions: sections[idx].questions.map((q) => ({ ...q, id: newId("q") })),
    };
    const next = [...sections];
    next.splice(idx + 1, 0, copy);
    onChange(next);
  }

  function deleteSection(sectionId: string) {
    if (sections.length <= 1) return;
    onChange(sections.filter((s) => s.id !== sectionId));
  }

  function addSection() {
    onChange([...sections, blankSection()]);
  }

  function handleSectionDrop(index: number) {
    const from = sectionDrag.current;
    sectionDrag.current = null;
    if (from === null || from === index) return;
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    onChange(next);
  }

  function updateQuestion(sectionId: string, questionId: string, patch: Partial<InductionQuestion>) {
    onChange(sections.map((s) => (s.id === sectionId ? { ...s, questions: s.questions.map((q) => (q.id === questionId ? { ...q, ...patch } : q)) } : s)));
  }

  function duplicateQuestion(sectionId: string, questionId: string) {
    onChange(
      sections.map((s) => {
        if (s.id !== sectionId) return s;
        const idx = s.questions.findIndex((q) => q.id === questionId);
        if (idx === -1) return s;
        const copy = { ...s.questions[idx], id: newId("q") };
        const questions = [...s.questions];
        questions.splice(idx + 1, 0, copy);
        return { ...s, questions };
      })
    );
  }

  function deleteQuestion(sectionId: string, questionId: string) {
    onChange(sections.map((s) => (s.id === sectionId && s.questions.length > 1 ? { ...s, questions: s.questions.filter((q) => q.id !== questionId) } : s)));
  }

  function addQuestion(sectionId: string) {
    onChange(sections.map((s) => (s.id === sectionId ? { ...s, questions: [...s.questions, blankQuestion()] } : s)));
  }

  function handleQuestionDrop(sectionIndex: number, questionIndex: number) {
    const from = questionDrag.current;
    questionDrag.current = null;
    if (!from || from.sectionIndex !== sectionIndex || from.questionIndex === questionIndex) return;
    const next = [...sections];
    const questions = [...next[sectionIndex].questions];
    const [moved] = questions.splice(from.questionIndex, 1);
    questions.splice(questionIndex, 0, moved);
    next[sectionIndex] = { ...next[sectionIndex], questions };
    onChange(next);
  }

  return (
    <div>
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
    </div>
  );
}
