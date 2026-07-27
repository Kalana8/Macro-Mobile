"use client";

import Image from "next/image";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { PrimaryButton, TextInput, FieldLabel } from "@/components/ui";
import { loginAction, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending} className="w-full py-3 text-[15px]">
      {pending ? "Signing in…" : "Log In"}
    </PrimaryButton>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <div className="flex min-h-screen items-center justify-center bg-page-bg px-6">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-8">
        <div className="mb-8 flex justify-center">
          <Image src="/uploads/footer.webp" alt="MACRO Property Services" width={160} height={74} className="h-[74px] w-auto" priority />
        </div>
        <h1 className="mb-1 text-center text-xl font-bold text-text-dark">Admin Console</h1>
        <p className="mb-7 text-center text-sm text-text-muted">Sign in to manage companies, employees and audits</p>

        <form action={formAction} className="flex flex-col gap-3.5">
          <div>
            <FieldLabel>Email</FieldLabel>
            <TextInput type="email" name="email" placeholder="admin@company.com" required autoComplete="username" className="py-3" />
          </div>
          <div>
            <FieldLabel>Password</FieldLabel>
            <TextInput type="password" name="password" placeholder="••••••••" required autoComplete="current-password" className="py-3" />
          </div>

          {state.error && (
            <div className="text-[12.5px] text-error-text">{state.error}</div>
          )}

          <SubmitButton />
        </form>
      </div>
    </div>
  );
}
