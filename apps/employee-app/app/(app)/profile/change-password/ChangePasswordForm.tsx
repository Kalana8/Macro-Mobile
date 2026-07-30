"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { FieldLabel, PrimaryButton } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";
import { SuccessOverlay } from "@/components/SuccessOverlay";
import { logoutAction } from "../../actions";
import { changePasswordAction, type ChangePasswordState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Updating…" : "Update Password"}</PrimaryButton>;
}

export function ChangePasswordForm({ isFirstLogin = false }: { isFirstLogin?: boolean }) {
  const [state, formAction] = useActionState<ChangePasswordState, FormData>(changePasswordAction, {});
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      const timeout = setTimeout(() => router.push(isFirstLogin ? "/home" : "/profile"), 1300);
      return () => clearTimeout(timeout);
    }
  }, [state.success, isFirstLogin, router]);

  if (state.success) return <SuccessOverlay message="Password Updated" />;

  return (
    <div className="flex flex-col gap-3.5">
      <form action={formAction} className="flex flex-col gap-3.5">
        <div>
          <FieldLabel>{isFirstLogin ? "Temporary Password" : "Current Password"}</FieldLabel>
          <PasswordInput name="currentPassword" required autoComplete="current-password" />
        </div>
        <div>
          <FieldLabel>New Password</FieldLabel>
          <PasswordInput name="newPassword" required minLength={8} autoComplete="new-password" />
        </div>
        <div>
          <FieldLabel>Confirm New Password</FieldLabel>
          <PasswordInput name="confirmPassword" required minLength={8} autoComplete="new-password" />
        </div>

        {state.error && (
          <div className="rounded-lg bg-error/10 px-3 py-2 text-[12.5px] text-error">{state.error}</div>
        )}

        <SubmitButton />
      </form>

      {isFirstLogin && (
        <form action={logoutAction} className="text-center">
          <button type="submit" className="text-[13px] font-semibold text-text-muted underline">
            Not you? Log out
          </button>
        </form>
      )}
    </div>
  );
}
