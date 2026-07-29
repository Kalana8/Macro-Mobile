import { redirect } from "next/navigation";
import { getCurrentEmployee } from "@/lib/session";
import { BottomNav } from "@/components/BottomNav";
import { logoutAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentEmployee();
  if (!session) redirect("/login");

  if (!session.employee) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-white px-8 text-center">
        <div className="text-base font-bold text-text-dark">No employee profile found</div>
        <p className="text-sm text-text-muted">
          Your login works, but no employee record is linked to it yet. Contact your admin.
        </p>
        <form action={logoutAction} className="mt-4">
          <button className="text-sm font-semibold text-primary">Log out</button>
        </form>
      </div>
    );
  }

  // No bottom nav while a password change is required — middleware.ts
  // redirects every other route back to /profile/change-password anyway,
  // so showing nav links here would just be misleading.
  if (session.employee.must_change_password) {
    return <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-page-bg">{children}</div>;
  }

  // h-screen (not min-h-screen) so this container never grows taller than
  // the viewport — otherwise the whole page (not just the middle content)
  // scrolls, and the header/bottom nav move with it despite being sticky.
  return (
    <div className="mx-auto flex h-screen max-w-lg flex-col bg-page-bg">
      <div className="flex-1 overflow-y-auto pb-2">{children}</div>
      <BottomNav />
    </div>
  );
}
