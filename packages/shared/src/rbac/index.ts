import type {
  AppPermissions,
  DashboardPermissions,
  RolePermissions,
} from "../types";

/** Zero-access default — used as a safe fallback when a role can't be resolved. */
export const EMPTY_PERMISSIONS: RolePermissions = {
  dashboard: {
    dashboard: { view: false },
    companies: { view: false, create: false, edit: false, delete: false, assignEmployees: false },
    employees: { view: false, create: false, assignAccessRole: false },
    attendance: { view: false },
    audits: { view: false, createEdit: false, delete: false, enterMarks: false, sendResults: false },
    checklists: { view: false, create: false, assign: false, delete: false },
    communication: { view: false, respond: false },
    roles: { view: false, manage: false },
  },
  app: {
    home: { view: false },
    attendance: { clockInOut: false, viewHistory: false },
    checklists: { view: false, submit: false, imagesOnly: false, reviewAll: false },
    audits: { view: false },
    communication: { view: false, send: false },
    profile: { view: false, changePassword: false },
  },
};

export const FULL_PERMISSIONS: RolePermissions = {
  dashboard: {
    dashboard: { view: true },
    companies: { view: true, create: true, edit: true, delete: true, assignEmployees: true },
    employees: { view: true, create: true, assignAccessRole: true },
    attendance: { view: true },
    audits: { view: true, createEdit: true, delete: true, enterMarks: true, sendResults: true },
    checklists: { view: true, create: true, assign: true, delete: true },
    communication: { view: true, respond: true },
    roles: { view: true, manage: true },
  },
  app: {
    home: { view: true },
    attendance: { clockInOut: true, viewHistory: true },
    checklists: { view: true, submit: true, imagesOnly: false, reviewAll: false },
    audits: { view: true },
    communication: { view: true, send: true },
    profile: { view: true, changePassword: true },
  },
};

type DashboardArea = keyof DashboardPermissions;
type AppArea = keyof AppPermissions;

/** Does this role have `key` enabled under dashboard area `area`? */
export function hasDashboardAccess<A extends DashboardArea>(
  permissions: RolePermissions | null | undefined,
  area: A,
  key: keyof DashboardPermissions[A]
): boolean {
  if (!permissions) return false;
  const areaPerms = permissions.dashboard[area] as Record<string, boolean>;
  return Boolean(areaPerms?.[key as string]);
}

/** Does this role have `key` enabled under app area `area`? */
export function hasAppAccess<A extends AppArea>(
  permissions: RolePermissions | null | undefined,
  area: A,
  key: keyof AppPermissions[A]
): boolean {
  if (!permissions) return false;
  const areaPerms = permissions.app[area] as Record<string, boolean>;
  return Boolean(areaPerms?.[key as string]);
}

/** True if the role can see this dashboard area's page at all (any function enabled, or explicit `view`). */
export function canViewDashboardArea(
  permissions: RolePermissions | null | undefined,
  area: DashboardArea
): boolean {
  if (!permissions) return false;
  const areaPerms = permissions.dashboard[area] as Record<string, boolean>;
  return Object.values(areaPerms ?? {}).some(Boolean);
}

/** True if the role can see this app area's page at all. */
export function canViewAppArea(
  permissions: RolePermissions | null | undefined,
  area: AppArea
): boolean {
  if (!permissions) return false;
  const areaPerms = permissions.app[area] as Record<string, boolean>;
  return Object.values(areaPerms ?? {}).some(Boolean);
}

/**
 * True if this role has ANY dashboard-side permission enabled, anywhere —
 * this is the gate for "can this account open the Admin Dashboard at all",
 * not just "can it see the Dashboard/overview page specifically". A role
 * like Supervisor (Architecture Doc Appendix C) can have Attendance/Audits/
 * Checklists/Communication dashboard access without the overview page.
 */
export function hasAnyDashboardAccess(permissions: RolePermissions | null | undefined): boolean {
  if (!permissions) return false;
  return (Object.keys(permissions.dashboard) as DashboardArea[]).some((area) =>
    canViewDashboardArea(permissions, area)
  );
}

/**
 * True if this role has ANY app-side permission enabled, anywhere — the
 * gate for "can this account open the employee app at all", not just "can
 * it see Home specifically". A role like Client can have Communication/
 * Checklists/Profile access with Home turned off.
 */
export function hasAnyAppAccess(permissions: RolePermissions | null | undefined): boolean {
  if (!permissions) return false;
  return (Object.keys(permissions.app) as AppArea[]).some((area) => canViewAppArea(permissions, area));
}

// Priority order for picking a landing route — first area the role
// actually grants wins. Profile isn't listed: it's always reachable
// regardless of role (see employee-app/middleware.ts), so it's the safe
// fallback here rather than a "first choice" landing page.
const APP_AREA_ROUTES: [AppArea, string][] = [
  ["home", "/home"],
  ["attendance", "/attendance"],
  ["checklists", "/checklists"],
  ["audits", "/audits"],
  ["communication", "/communication"],
];

/** Which employee-app route to land a role on — after login, or when they hit an area they don't have access to. */
export function firstAvailableAppRoute(permissions: RolePermissions | null | undefined): string {
  if (!permissions) return "/profile";
  const match = APP_AREA_ROUTES.find(([area]) => canViewAppArea(permissions, area));
  return match?.[1] ?? "/profile";
}
