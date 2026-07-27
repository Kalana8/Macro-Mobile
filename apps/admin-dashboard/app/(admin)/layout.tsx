import { redirect } from "next/navigation";
import { getCurrentAdmin } from "@/lib/session";
import { Sidebar } from "@/components/Sidebar";
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
    <div className="flex min-h-screen bg-page-bg">
      <Sidebar permissions={session.role?.permissions ?? null} onLogout={logoutAction} />
      <main className="flex-1 overflow-y-auto px-10 py-8">{children}</main>
    </div>
  );
}
