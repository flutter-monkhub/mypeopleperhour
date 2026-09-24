// Admin users & roles (Settings). Owned by the core/foundation layer.

import type { AdminRole, AdminUser, ID } from '@shared/types';
import { getDb, insert, patch } from '../db';

export type AdminUserChange = Partial<Pick<AdminUser, 'role' | 'unitScope' | 'active' | 'title'>>;

/** Update an admin user. Clears `unitScope` when the role is not hr_admin. */
export function updateAdminUser(id: ID, change: AdminUserChange): void {
  patch('adminUsers', id, (u) => {
    const next: AdminUser = { ...u, ...change };
    if (next.role !== 'hr_admin') delete next.unitScope;
    return next;
  });
}

export interface NewAdminInput {
  employeeId: ID;
  role: AdminRole;
  unitScope?: ID;
}

/** Grant admin access to an employee. Returns the new AdminUser. */
export function addAdminUser(input: NewAdminInput): AdminUser {
  const db = getDb();
  const emp = db.employees.find((e) => e.id === input.employeeId);
  if (!emp) throw new Error(`Unknown employee ${input.employeeId}`);
  if (db.adminUsers.some((u) => u.employeeId === emp.id)) throw new Error(`${emp.name} is already an admin user`);
  const maxN = db.adminUsers.reduce((m, u) => Math.max(m, Number(u.id.replace(/\D/g, '')) || 0), 0);
  const user: AdminUser = {
    id: `AD${String(maxN + 1).padStart(2, '0')}`,
    employeeId: emp.id,
    name: emp.name,
    email: emp.email,
    title: emp.designation,
    role: input.role,
    active: true,
    ...(input.role === 'hr_admin' && input.unitScope ? { unitScope: input.unitScope } : {}),
  };
  insert('adminUsers', user);
  return user;
}
