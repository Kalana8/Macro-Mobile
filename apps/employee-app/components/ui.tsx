import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-white p-4 ${className}`}>{children}</div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">
      {children}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-border bg-bg px-4 py-3 text-[15px] text-text-dark outline-none focus:border-primary ${props.className ?? ""}`}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-border bg-bg px-4 py-3 text-[15px] text-text-dark outline-none focus:border-primary ${props.className ?? ""}`}
    />
  );
}

export function PrimaryButton(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }
) {
  return (
    <button
      {...props}
      className={`w-full rounded-lg bg-orange px-4 py-3.5 text-[15px] font-bold text-white disabled:opacity-40 ${props.className ?? ""}`}
    >
      {props.children}
    </button>
  );
}

export function OutlineButton(
  props: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }
) {
  return (
    <button
      {...props}
      className={`w-full rounded-lg border border-border bg-white px-4 py-3.5 text-[15px] font-semibold text-text-dark disabled:opacity-40 ${props.className ?? ""}`}
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
  return (
    <span className={`rounded-md px-2 py-1 text-[11px] font-semibold ${badgeTones[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-white/60 p-8 text-center">
      <div className="text-sm font-semibold text-text-dark">{title}</div>
      {hint && <div className="mt-1 text-xs text-text-muted">{hint}</div>}
    </div>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-5 py-4">
      <div>
        <div className="text-[19px] font-extrabold text-text-dark">{title}</div>
        {subtitle && <div className="mt-0.5 text-xs text-text-muted">{subtitle}</div>}
      </div>
      {actions}
    </div>
  );
}
