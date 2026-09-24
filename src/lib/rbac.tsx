// Role-based access control (SPEC §2 permission matrix).
//
//   can(user, 'surveys.edit')            → boolean (pure)
//   useCan('surveys.edit')               → boolean for the signed-in admin
//   <RequirePermission perm="…">         → route guard, renders the 403 page when denied
//   <Can perm="…" fallback={…}>…</Can>   → conditional UI (hide edit buttons etc.)
//
// Unit scoping ("own unit" for hr_admin) is not a permission — use `useScope()` from lib/scope.ts.

import type { ReactNode } from 'react';
import type { AdminPermission, AdminRole, AdminUser } from '@shared/types';
import { useCurrentAdmin } from '@/store/auth';
import ForbiddenPage from '@/pages/errors/ForbiddenPage';

export const ALL_PERMISSIONS: readonly AdminPermission[] = [
  'dashboard.view',
  'employees.view',
  'employees.edit',
  'sessions.view',
  'sessions.edit',
  'surveys.view',
  'surveys.edit',
  'mentoring.view',
  'mentoring.edit',
  'reports.export',
  'settings.manage',
];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  super_admin: ALL_PERMISSIONS,
  programme_admin: ['dashboard.view', 'employees.view', 'sessions.view', 'surveys.view', 'surveys.edit', 'mentoring.view', 'mentoring.edit', 'reports.export'],
  leadership: ['dashboard.view', 'sessions.view', 'surveys.view', 'mentoring.view', 'reports.export'],
  hr_admin: ['dashboard.view', 'employees.view', 'employees.edit', 'sessions.view', 'sessions.edit', 'surveys.view', 'reports.export'],
};

/** Permissions that are limited to the admin's `unitScope` for a scoped hr_admin. */
export const UNIT_SCOPED_PERMISSIONS: readonly AdminPermission[] = ['dashboard.view', 'employees.view', 'employees.edit', 'sessions.view', 'sessions.edit'];

export const ROLES: readonly AdminRole[] = ['super_admin', 'programme_admin', 'leadership', 'hr_admin'];

export type Tone = 'primary' | 'mentor' | 'navy' | 'warning' | 'success' | 'danger' | 'neutral' | 'info';

export const ROLE_META: Record<AdminRole, { label: string; tone: Tone; description: string; access: string }> = {
  super_admin: {
    label: 'Super admin',
    tone: 'navy',
    description: 'Full access to every module, admin users and settings.',
    access: 'Everything — incl. admin users, roles & demo data',
  },
  programme_admin: {
    label: 'Programme admin',
    tone: 'mentor',
    description: 'Runs the MyPeopleHour & Mentoring programmes.',
    access: 'Dashboards, employees (view), surveys & mentoring (edit), reports',
  },
  leadership: {
    label: 'Leadership',
    tone: 'primary',
    description: 'Read-only view of programme health.',
    access: 'Read-only dashboards, sessions, pulse, mentoring, exports',
  },
  hr_admin: {
    label: 'HR admin',
    tone: 'warning',
    description: 'HR business partner, scoped to one unit.',
    access: 'Own unit only: dashboard, employees & sessions (edit), surveys (view), reports',
  },
};

export const PERMISSION_META: Record<AdminPermission, { module: string; label: string; description: string }> = {
  'dashboard.view': { module: 'Leadership dashboard', label: 'View dashboard', description: 'Completion KPIs, trends and missed flags' },
  'employees.view': { module: 'Employees & organisation', label: 'View employees', description: 'Employee directory, profiles, organisation' },
  'employees.edit': { module: 'Employees & organisation', label: 'Edit employees', description: 'Edit profiles, manager mapping, functions & departments' },
  'sessions.view': { module: 'MyPeopleHour', label: 'View sessions', description: 'Session listing, missed reasons, archive' },
  'sessions.edit': { module: 'MyPeopleHour', label: 'Manage sessions', description: 'Update session status on behalf of managers' },
  'surveys.view': { module: 'Surveys', label: 'View surveys', description: 'Survey list, responses and pulse analysis' },
  'surveys.edit': { module: 'Surveys', label: 'Manage surveys', description: 'Create, edit, publish and close surveys' },
  'mentoring.view': { module: 'Mentoring', label: 'View mentoring', description: 'Mentoring dashboard, mentors, mentees, applications' },
  'mentoring.edit': { module: 'Mentoring', label: 'Manage mentoring', description: 'Mentor profiles, application review, matching' },
  'reports.export': { module: 'Reports', label: 'Export reports', description: 'CSV exports and print-friendly reports' },
  'settings.manage': { module: 'Settings', label: 'Manage settings', description: 'Admin users & roles, demo data' },
};

export function permissionsOf(user: Pick<AdminUser, 'role' | 'active'> | null | undefined): readonly AdminPermission[] {
  return user?.active ? ROLE_PERMISSIONS[user.role] : [];
}

/** Pure permission check. Inactive or missing users have no permissions. */
export function can(user: Pick<AdminUser, 'role' | 'active'> | null | undefined, perm: AdminPermission): boolean {
  return permissionsOf(user).includes(perm);
}

/** True when this permission is limited to the user's unit (hr_admin with unitScope). */
export function isUnitScoped(user: Pick<AdminUser, 'role' | 'unitScope'> | null | undefined, perm: AdminPermission): boolean {
  return !!user && user.role === 'hr_admin' && !!user.unitScope && UNIT_SCOPED_PERMISSIONS.includes(perm);
}

/** Does the signed-in admin have this permission? */
export function useCan(perm: AdminPermission): boolean {
  return can(useCurrentAdmin(), perm);
}

/** All permissions of the signed-in admin. */
export function usePermissions(): readonly AdminPermission[] {
  return permissionsOf(useCurrentAdmin());
}

/** Route guard: renders children only with the permission, otherwise the 403 page. */
export function RequirePermission({ perm, children }: { perm: AdminPermission | AdminPermission[]; children: ReactNode }) {
  const user = useCurrentAdmin();
  const perms = Array.isArray(perm) ? perm : [perm];
  if (!perms.every((p) => can(user, p))) return <ForbiddenPage missing={perms.find((p) => !can(user, p))} />;
  return <>{children}</>;
}

/** Conditional UI: `<Can perm="sessions.edit"><Button …/></Can>` */
export function Can({ perm, children, fallback = null }: { perm: AdminPermission; children: ReactNode; fallback?: ReactNode }) {
  return <>{useCan(perm) ? children : fallback}</>;
}
