"use client";

import { useState } from "react";
import type { InputHTMLAttributes } from "react";
import { TextInput } from "./ui";

function EyeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 10.6a3 3 0 0 0 4.24 4.24" />
      <path d="M9.9 4.24A10.4 10.4 0 0 1 12 4c6.5 0 10 7 10 7a13.2 13.2 0 0 1-2.35 3.19M6.6 6.6C4.05 8.3 2 11 2 11s3.5 7 10 7a10.4 10.4 0 0 0 4.1-.84" />
    </svg>
  );
}

/** TextInput with a show/hide eye-icon toggle — pass the same props you'd give TextInput, minus `type`. */
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <TextInput {...props} type={visible ? "text" : "password"} className={`pr-10 ${props.className ?? ""}`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
