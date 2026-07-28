"use client";

import Image from "next/image";
import { Suspense, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { PrimaryButton, TextInput, FieldLabel } from "@/components/ui";
import { verifyCredentialsAction, type LoginState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Please wait…" : "Log In"}</PrimaryButton>;
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const [credState, credAction] = useActionState<LoginState, FormData>(verifyCredentialsAction, {});
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("reason") === "session-expired";

  return (
    <div className="min-h-screen bg-page-bg">
      <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center bg-white px-6 py-14 sm:px-7">
        <div className="mb-9 flex justify-center">
          <Image src="/uploads/footer.webp" alt="MACRO Property Services" width={180} height={84} className="h-[84px] w-auto" priority />
        </div>
        <h1 className="mb-1.5 text-center text-[24px] font-bold text-text-dark sm:text-[26px]">Welcome back</h1>
        <p className="mb-8 text-center text-[14px] text-text-muted sm:text-[15px]">Sign in to continue to your workspace</p>

        {sessionExpired && (
          <div className="mb-4 rounded-lg bg-orange/10 px-3 py-2 text-center text-[12.5px] text-[#B35A10]">
            Your session expired. Log in again to continue.
          </div>
        )}

        <form action={credAction} className="flex flex-col gap-3.5">
          <div>
            <FieldLabel>Email</FieldLabel>
            <TextInput type="email" name="email" placeholder="you@company.com" required autoComplete="username" />
          </div>
          <div>
            <FieldLabel>Password</FieldLabel>
            <TextInput type="password" name="password" placeholder="••••••••" required autoComplete="current-password" />
          </div>
          <div className="mb-1.5 mt-0.5 flex items-center justify-between">
            <label className="flex items-center gap-2 text-[13px] text-text-dark">
              <input type="checkbox" className="h-4 w-4 accent-orange" />
              Remember me
            </label>
            <span className="text-[13px] font-semibold text-primary">Forgot Password?</span>
          </div>

          {credState.error && (
            <div className="rounded-lg bg-error/10 px-3 py-2 text-[12.5px] text-error">{credState.error}</div>
          )}

          <SubmitButton />
        </form>

        <div className="mt-10 text-center text-xs text-placeholder">
          v0.1 · Field Audit &amp; Attendance
        </div>
      </div>
    </div>
  );
}
