"use client";

import { Modal } from "@/components/Modal";
import type { ChecklistTemplate } from "@macro/shared/types";

export function TemplateDetailModal({
  template,
  companyName,
  onClose,
}: {
  template: ChecklistTemplate;
  companyName: string;
  onClose: () => void;
}) {
  const subtaskCount = template.areas.reduce((n, a) => n + a.subtasks.length, 0);

  return (
    <Modal title={companyName} onClose={onClose}>
      <div className="mb-5 text-sm text-text-muted">{template.site} · {subtaskCount} subtasks</div>
      {template.areas.map((area, i) => (
        <div key={i} className="mb-4">
          <div className="mb-2 text-[13.5px] font-bold text-text-dark">{area.main_area}</div>
          <div className="flex flex-col gap-1.5">
            {area.subtasks.map((s) => (
              <div key={s.id} className="rounded-lg bg-bg px-3 py-2 text-sm text-text-dark">{s.text}</div>
            ))}
          </div>
        </div>
      ))}
      <button type="button" onClick={onClose} className="mt-2 w-full rounded-[12px] bg-bg py-3 text-sm font-bold text-text-dark">
        Close
      </button>
    </Modal>
  );
}
