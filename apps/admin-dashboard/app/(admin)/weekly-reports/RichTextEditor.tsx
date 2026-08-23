"use client";

import { useEffect, useRef } from "react";

function ToolbarButton({ onClick, label, children }: { onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      // mousedown (not click) so the contentEditable selection isn't lost before execCommand runs.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-md text-text-dark hover:bg-white"
    >
      {children}
    </button>
  );
}

/**
 * Minimal rich text field for section notes (Observation/Required
 * Improvement/Action Taken/Additional Notes) — Bold/Italic/bullet/numbered
 * list via contentEditable + execCommand, storing sanitized-by-authorship
 * HTML (same trust model as the rest of the dashboard, which has no
 * end-user-facing sanitization elsewhere either).
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const focused = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || focused.current) return;
    if (el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  function exec(command: string) {
    ref.current?.focus();
    document.execCommand(command);
    if (ref.current) onChange(ref.current.innerHTML);
  }

  return (
    <div className="overflow-hidden rounded-[11px] border border-border bg-bg">
      <div className="flex items-center gap-0.5 border-b border-border bg-white px-1.5 py-1">
        <ToolbarButton onClick={() => exec("bold")} label="Bold">
          <span className="text-[13px] font-extrabold">B</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("italic")} label="Italic">
          <span className="text-[13px] italic">I</span>
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("insertUnorderedList")} label="Bullet list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="4" cy="6" r="1.3" fill="currentColor" /><path d="M9 6h11" />
            <circle cx="4" cy="12" r="1.3" fill="currentColor" /><path d="M9 12h11" />
            <circle cx="4" cy="18" r="1.3" fill="currentColor" /><path d="M9 18h11" />
          </svg>
        </ToolbarButton>
        <ToolbarButton onClick={() => exec("insertOrderedList")} label="Numbered list">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6h11M9 12h11M9 18h11" />
            <text x="1" y="8" fontSize="7" fill="currentColor" stroke="none">1</text>
            <text x="1" y="14" fontSize="7" fill="currentColor" stroke="none">2</text>
            <text x="1" y="20" fontSize="7" fill="currentColor" stroke="none">3</text>
          </svg>
        </ToolbarButton>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          if (ref.current) onChange(ref.current.innerHTML);
        }}
        onInput={() => {
          if (ref.current) onChange(ref.current.innerHTML);
        }}
        data-placeholder={placeholder}
        className="min-h-[70px] px-3.5 py-2.5 text-sm text-text-dark outline-none empty:before:text-placeholder empty:before:content-[attr(data-placeholder)]"
      />
    </div>
  );
}
