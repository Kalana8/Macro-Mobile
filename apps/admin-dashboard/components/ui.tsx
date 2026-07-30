import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-[16px] border border-border bg-white p-5 ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="text-xl font-extrabold text-text-dark sm:text-2xl">{title}</div>
        {subtitle && <div className="mt-1 text-sm text-text-muted">{subtitle}</div>}
      </div>
      {actions}
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">{children}</div>;
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-[11px] border border-border bg-bg px-3.5 py-2.5 text-sm text-text-dark outline-none focus:border-primary ${props.className ?? ""}`}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-[11px] border border-border bg-bg px-3.5 py-2.5 text-sm text-text-dark outline-none focus:border-primary ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-[11px] border border-border bg-bg px-3.5 py-2.5 text-sm text-text-dark outline-none focus:border-primary ${props.className ?? ""}`}
    />
  );
}

export function PlusIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14" /><path d="M5 12h14" />
    </svg>
  );
}

/** Primary call-to-action — the mockup uses orange (not the primary blue) for every "Add/Create/New/Save/Register" button. */
export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      className={`flex items-center gap-2 rounded-[11px] bg-orange px-[18px] py-2.5 text-[13.5px] font-bold text-white disabled:opacity-40 ${props.className ?? ""}`}
    >
      {props.children}
    </button>
  );
}

export function OutlineButton(props: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      {...props}
      className={`rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-text-dark disabled:opacity-40 ${props.className ?? ""}`}
    >
      {props.children}
    </button>
  );
}

type BadgeTone = "info" | "success" | "warning" | "neutral" | "error";

const badgeTones: Record<BadgeTone, string> = {
  info: "bg-primary/10 text-primary",
  success: "bg-olive/20 text-olive-text",
  warning: "bg-orange/15 text-[#B35A10]",
  neutral: "bg-[#EEF0F3] text-text-muted",
  error: "bg-error/10 text-error",
};

export function Badge({ tone = "neutral", children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={`rounded-[7px] px-2.5 py-1 text-[11px] font-bold ${badgeTones[tone]}`}>{children}</span>;
}

/** Custom checkbox square matching the mockup's picker-list style (native checkboxes don't match its look). */
export function CheckboxSquare({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 ${
        checked ? "border-primary bg-primary" : "border-border"
      }`}
    >
      {checked && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12.5l4.5 4.5L19 7" />
        </svg>
      )}
    </span>
  );
}

/** 32×32 rounded chip used for every row-level icon action (edit/view/add/delete) in the mockup's tables. */
export function IconChip(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; tone?: "default" | "danger" }
) {
  const { tone = "default", className, ...rest } = props;
  return (
    <button
      {...rest}
      className={`flex h-8 w-8 items-center justify-center rounded-[8px] bg-bg ${
        tone === "danger" ? "text-error" : "text-text-dark"
      } ${className ?? ""}`}
    >
      {props.children}
    </button>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-[16px] border border-dashed border-border bg-white/60 p-10 text-center">
      <div className="text-sm font-semibold text-text-dark">{title}</div>
      {hint && <div className="mt-1 text-xs text-text-muted">{hint}</div>}
    </div>
  );
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[16px] border border-border bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-bg">
            {head.map((h, i) => (
              <th key={i} className="px-5 py-3 text-xs font-bold text-text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
