import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/session";
import { AdminShell } from "@/components/AdminShell";
import { logoutAction } from "./actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentAdmin();
  if (!session) redirect("/login");

  if (!session.employee) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-white px-8 text-center">
        <div className="text-base font-bold text-text-dark">No employee profile found</div>
        <p className="text-sm text-text-muted">
          Your login works, but no employee record is linked to it yet.
        </p>
        <form action={logoutAction} className="mt-4">
          <button className="text-sm font-semibold text-primary">Log out</button>
        </form>
      </div>
    );
  }

  return (
    <AdminShell permissions={session.role?.permissions ?? null} onLogout={logoutAction}>
      {children}
    </AdminShell>
  );
}
