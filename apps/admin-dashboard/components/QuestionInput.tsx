"use client";

import { Select, TextArea, TextInput } from "@/components/ui";
import type { InductionAnswerValue, InductionQuestion } from "@macro/shared/types";

const YES_NO_OPTIONS = ["Yes", "No"];
const TRUE_FALSE_OPTIONS = ["True", "False"];

function isFileAnswer(value: InductionAnswerValue): value is { fileUrl: string; fileName: string } {
  return typeof value === "object" && value !== null && !Array.isArray(value) && "fileUrl" in value;
}

/**
 * Renders the answer field for one question, matching its type — shared by
 * the real employee submission form and the admin's interactive Preview, so
 * the two can never visually drift apart.
 */
export function QuestionInput({
  question,
  value,
  onChange,
  disabled,
  invalid,
}: {
  question: InductionQuestion;
  value: InductionAnswerValue;
  onChange: (value: InductionAnswerValue) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const name = question.id;
  const invalidClass = invalid ? "!border-error" : "";

  switch (question.type) {
    case "short_answer":
      return (
        <TextInput
          type="text"
          name={name}
          disabled={disabled}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your answer"
          className={invalidClass}
        />
      );

    case "paragraph":
      return (
        <TextArea
          name={name}
          disabled={disabled}
          rows={4}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Your answer"
          className={invalidClass}
        />
      );

    case "multiple_choice":
    case "yes_no":
    case "true_false": {
      const options = question.type === "yes_no" ? YES_NO_OPTIONS : question.type === "true_false" ? TRUE_FALSE_OPTIONS : question.options ?? [];
      return (
        <div className="flex flex-col gap-2">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2.5 text-sm text-text-dark">
              <input
                type="radio"
                disabled={disabled}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              {opt}
            </label>
          ))}
          {value && typeof value === "string" && <input type="hidden" name={name} value={value} />}
        </div>
      );
    }

    case "checkboxes": {
      const options = question.options ?? [];
      const selected = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-col gap-2">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2.5 text-sm text-text-dark">
              <input
                type="checkbox"
                disabled={disabled}
                checked={selected.includes(opt)}
                onChange={(e) => onChange(e.target.checked ? [...selected, opt] : selected.filter((v) => v !== opt))}
                className="h-4 w-4 shrink-0 accent-primary"
              />
              {opt}
            </label>
          ))}
          {selected.map((opt) => (
            <input key={opt} type="hidden" name={name} value={opt} />
          ))}
        </div>
      );
    }

    case "dropdown":
      return (
        <Select name={name} disabled={disabled} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={invalidClass}>
          <option value="" disabled>
            Select…
          </option>
          {(question.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>
      );

    case "date":
      return (
        <TextInput type="date" name={name} disabled={disabled} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={invalidClass} />
      );

    case "time":
      return (
        <TextInput type="time" name={name} disabled={disabled} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={invalidClass} />
      );

    case "file_upload":
    case "image_upload":
    case "video_upload": {
      const accept =
        question.acceptedFileTypes || (question.type === "image_upload" ? "image/*" : question.type === "video_upload" ? "video/*" : undefined);
      const existing = isFileAnswer(value) ? value : null;
      return (
        <div className="flex flex-col gap-1.5">
          <input
            type="file"
            name={name}
            disabled={disabled}
            accept={accept}
            onChange={(e) => {
              const file = e.target.files?.[0];
              onChange(file ? { fileUrl: "", fileName: file.name } : null);
            }}
            className={`w-full rounded-[11px] border border-border bg-bg px-3.5 py-2.5 text-sm text-text-dark outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-text-dark ${invalidClass}`}
          />
          {question.maxFileSizeMb && <p className="text-[11px] text-text-muted">Max file size: {question.maxFileSizeMb}MB</p>}
          {existing?.fileUrl && (
            <a href={existing.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary">
              Current file: {existing.fileName}
            </a>
          )}
        </div>
      );
    }

    default:
      return null;
  }
}
