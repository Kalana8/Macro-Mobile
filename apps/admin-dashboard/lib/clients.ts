/**
 * Client accounts, as the employee app decides: the role named Client, or a
 * role that can neither clock in nor submit checklists.
 */
export function isClientRole(role: { name?: string | null; permissions?: unknown } | null | undefined): boolean {
  if (!role) return false;
  if ((role.name ?? "").trim().toLowerCase() === "client") return true;
  const app = (role.permissions as { app?: { attendance?: { clockInOut?: boolean }; checklists?: { submit?: boolean } } } | null)?.app;
  return !!app && !app.attendance?.clockInOut && !app.checklists?.submit;
}
