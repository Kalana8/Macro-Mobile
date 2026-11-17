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
    weeklyReports: { view: false, create: false, edit: false, delete: false, generatePdf: false, share: false },
    inductions: { view: false, create: false, manage: false, approve: false },
  },
  app: {
    home: { view: false },
    attendance: { clockInOut: false, viewHistory: false },
    checklists: { view: false, submit: false, share: false, imagesOnly: false, reviewAll: false },
    audits: { view: false, respond: false },
    reports: { view: false, respond: false },
    photos: { view: false, send: false, download: false },
    communication: { view: false, send: false },
    profile: { view: false, photo: false, inductions: false, changePassword: false },
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
    weeklyReports: { view: true, create: true, edit: true, delete: true, generatePdf: true, share: true },
    inductions: { view: true, create: true, manage: true, approve: true },
  },
  app: {
    home: { view: true },
    attendance: { clockInOut: true, viewHistory: true },
    checklists: { view: true, submit: true, share: true, imagesOnly: false, reviewAll: false },
    audits: { view: true, respond: true },
    reports: { view: true, respond: true },
    photos: { view: true, send: true, download: true },
    communication: { view: true, send: true },
    profile: { view: true, photo: true, inductions: true, changePassword: true },
  },
};

/**
 * Roles saved before an app feature had its own switch don't have it yet.
 * Until the role is edited, each new switch follows what the role could
 * already do, so nobody loses a page they had:
 *   reports                 - with audits.view (the tab used to follow Audits)
 *   photos                  - with communication (the tab used to follow Messages)
 *   audits.respond          - with audits.view
 *   checklists.share        - with checklists.view, unless images only
 *   profile.photo/inductions - with profile.view
 */
export function withAppDefaults(app: Partial<AppPermissions> | null | undefined): AppPermissions {
  const a = (app ?? {}) as Partial<Record<keyof AppPermissions, Record<string, boolean | undefined>>>;
  const pick = (v: boolean | undefined, fallback: boolean) => (v === undefined ? fallback : v);
  const checklistsView = Boolean(a.checklists?.view);
  const profileView = Boolean(a.profile?.view);
  return {
    home: { view: Boolean(a.home?.view) },
    attendance: { clockInOut: Boolean(a.attendance?.clockInOut), viewHistory: Boolean(a.attendance?.viewHistory) },
    checklists: {
      view: checklistsView,
      submit: Boolean(a.checklists?.submit),
      share: pick(a.checklists?.share, checklistsView && !(a.checklists?.imagesOnly && !a.checklists?.reviewAll)),
      // The full read-only view wins over photos only if a role somehow has both.
      imagesOnly: Boolean(a.checklists?.imagesOnly) && !a.checklists?.reviewAll,
      reviewAll: Boolean(a.checklists?.reviewAll),
    },
    audits: { view: Boolean(a.audits?.view), respond: pick(a.audits?.respond, Boolean(a.audits?.view)) },
    // Reports used to show with Audits, and Photos with Messages.
    reports: { view: pick(a.reports?.view, Boolean(a.audits?.view)), respond: pick(a.reports?.respond, Boolean(a.audits?.view)) },
    photos: {
      view: pick(a.photos?.view, Boolean(a.communication?.view)),
      send: pick(a.photos?.send, Boolean(a.communication?.send)),
      download: pick(a.photos?.download, Boolean(a.communication?.view)),
    },
    communication: { view: Boolean(a.communication?.view), send: Boolean(a.communication?.send) },
    profile: {
      view: profileView,
      photo: pick(a.profile?.photo, profileView),
      inductions: pick(a.profile?.inductions, profileView),
      changePassword: Boolean(a.profile?.changePassword),
    },
  };
}

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
