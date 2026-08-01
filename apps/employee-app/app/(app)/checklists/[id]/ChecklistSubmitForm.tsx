"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Card, FieldLabel, PrimaryButton, TextArea } from "@/components/ui";
import { ImagePicker } from "@/components/ImagePicker";
import { SuccessOverlay } from "@/components/SuccessOverlay";
import type { ChecklistArea } from "@macro/shared/types";
import { submitChecklistAction, uploadChecklistImageAction, type SubmitChecklistState } from "./actions";

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  const result = await uploadChecklistImageAction(formData);
  if (result.error || !result.url) throw new Error(result.error ?? "Upload failed.");
  return result.url;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>Submit</PrimaryButton>;
}

export function ChecklistSubmitForm({
  checklistId,
  initialAreas,
  initialNotes,
}: {
  checklistId: string;
  initialAreas: ChecklistArea[];
  initialNotes: string;
}) {
  const [state, formAction] = useActionState<SubmitChecklistState, FormData>(submitChecklistAction, {});
  const router = useRouter();
  const [areas, setAreas] = useState<ChecklistArea[]>(initialAreas);
  const [notes, setNotes] = useState(initialNotes);
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    if (state.success) {
      const timeout = setTimeout(() => router.push("/checklists"), 1400);
      return () => clearTimeout(timeout);
    }
  }, [state.success, router]);

  if (state.success) return <SuccessOverlay message="Checklist Sent" />;

  function toggleSubtask(areaIdx: number, subtaskId: string) {
    setAreas((prev) =>
      prev.map((area, i) =>
        i === areaIdx
          ? {
              ...area,
              subtasks: area.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)),
            }
          : area
      )
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="checklistId" value={checklistId} />
      <input type="hidden" name="areasJson" value={JSON.stringify(areas)} />

      {areas.map((area, areaIdx) => (
        <Card key={areaIdx}>
          <div className="mb-2 text-sm font-semibold text-text-dark">{area.main_area}</div>
          <div className="flex flex-col gap-2">
            {area.subtasks.map((task) => (
              <button
                type="button"
                key={task.id}
                onClick={() => toggleSubtask(areaIdx, task.id)}
                className="flex items-center justify-between gap-2 text-left text-sm text-text-dark"
              >
                <span>{task.text}</span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                    task.done ? "bg-primary text-white" : "border border-border"
                  }`}
                >
                  {task.done && "✓"}
                </span>
              </button>
            ))}
          </div>
          {area.note && <div className="mt-2 text-xs text-text-muted">{area.note}</div>}
        </Card>
      ))}

      <div>
        <FieldLabel>Notes</FieldLabel>
        <TextArea
          name="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Anything the admin should know"
        />
      </div>

      <div>
        <FieldLabel>Images</FieldLabel>
        <ImagePicker images={images} onChange={setImages} uploadFile={uploadFile} />
        {images.map((url) => (
          <input key={url} type="hidden" name="images" value={url} />
        ))}
      </div>

      {state.error && (
        <div className="rounded-lg bg-error/10 px-3 py-2 text-[12.5px] text-error">{state.error}</div>
      )}

      <SubmitButton />
    </form>
  );
}
