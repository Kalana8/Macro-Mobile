import { ScreenHeader } from "@/components/ui";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ChangePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ first?: string }>;
}) {
  const { first } = await searchParams;
  const isFirstLogin = first === "1";

  return (
    <div>
      <ScreenHeader
        title={isFirstLogin ? "Set a New Password" : "Change Password"}
        subtitle={isFirstLogin ? "For your security, set your own password before continuing." : undefined}
      />
      <div className="p-5">
        <ChangePasswordForm isFirstLogin={isFirstLogin} />
      </div>
    </div>
  );
}
