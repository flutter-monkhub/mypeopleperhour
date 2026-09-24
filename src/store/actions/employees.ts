// Employees & organisation (EmployeesPage, EmployeeDetailPage, OrganisationPage):
// edit employee, change manager (no cycles), functions/departments, locations.
//
// Pure data operations (no React, no toasts). Validation helpers are exported so pages can show
// the same messages inline before calling the action.

import type { Employee, EmployeeLevel, EmployeeStatus, FunctionArea, ID } from '@shared/types';
import { getDb, patch, setDb, update } from '../db';

export type EmployeeActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): EmployeeActionResult => ({ ok: false, error });
const OK: EmployeeActionResult = { ok: true };

// ───────────────────────── reporting lines ─────────────────────────

/** Everyone who reports (directly or indirectly) to `rootId` — excludes the root itself. */
export function reportingSubtree(employees: readonly Employee[], rootId: ID): Set<ID> {
  const children = new Map<ID, ID[]>();
  for (const e of employees) {
    if (!e.managerId) continue;
    const list = children.get(e.managerId);
    if (list) list.push(e.id);
    else children.set(e.managerId, [e.id]);
  }
  const out = new Set<ID>();
  const stack = [...(children.get(rootId) ?? [])];
  while (stack.length) {
    const id = stack.pop() as ID;
    if (out.has(id) || id === rootId) continue;
    out.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  return out;
}

export type ManagerCheck = { ok: true } | { ok: false; code: 'missing' | 'self' | 'same' | 'cycle' | 'inactive'; message: string };

/**
 * Can `newManagerId` become the manager of every employee in `employeeIds`?
 * Blocks: self, someone in any of the employees' reporting subtrees (→ loop), inactive managers.
 */
export function checkManagerChange(employees: readonly Employee[], employeeIds: readonly ID[], newManagerId: ID): ManagerCheck {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const mgr = byId.get(newManagerId);
  if (!mgr) return { ok: false, code: 'missing', message: 'This person is not in the directory' };
  if (employeeIds.includes(newManagerId)) return { ok: false, code: 'self', message: employeeIds.length > 1 ? 'Part of the selection — can’t manage themselves' : 'Can’t report to themselves' };
  if (mgr.status === 'inactive') return { ok: false, code: 'inactive', message: `${mgr.name} is inactive` };
  for (const id of employeeIds) {
    if (reportingSubtree(employees, id).has(newManagerId)) {
      const who = byId.get(id)?.name ?? id;
      return { ok: false, code: 'cycle', message: `Reports into ${who} — would create a reporting loop` };
    }
  }
  if (employeeIds.length === 1 && byId.get(employeeIds[0])?.managerId === newManagerId) return { ok: false, code: 'same', message: 'Already the current manager' };
  return { ok: true };
}

/** Re-map one employee to a new manager (validated). */
export function changeManager(employeeId: ID, newManagerId: ID): EmployeeActionResult {
  const db = getDb();
  if (!db.employees.some((e) => e.id === employeeId)) return fail('Employee not found');
  const check = checkManagerChange(db.employees, [employeeId], newManagerId);
  if (!check.ok) return fail(check.message);
  patch('employees', employeeId, { managerId: newManagerId });
  return OK;
}

/** Re-map several employees at once. Employees already reporting to the manager are skipped. */
export function bulkChangeManager(employeeIds: readonly ID[], newManagerId: ID): { ok: true; moved: ID[]; unchanged: ID[] } | { ok: false; error: string } {
  const db = getDb();
  const check = checkManagerChange(db.employees, employeeIds, newManagerId);
  if (!check.ok && check.code !== 'same') return { ok: false, error: check.message };
  const ids = new Set(employeeIds);
  const moved: ID[] = [];
  const unchanged: ID[] = [];
  update('employees', (draft) => {
    draft.forEach((e, i) => {
      if (!ids.has(e.id)) return;
      if (e.managerId === newManagerId) return void unchanged.push(e.id);
      draft[i] = { ...e, managerId: newManagerId };
      moved.push(e.id);
    });
  });
  return { ok: true, moved, unchanged };
}

// ───────────────────────── employee profile ─────────────────────────

export interface EmployeeEdit {
  designation: string;
  department: string;
  functionId: ID;
  grade: string;
  level: EmployeeLevel;
  unitId: ID;
  location: string;
  status: EmployeeStatus;
}

/** Validate an employee edit against the organisation lists. Returns field → message. */
export function validateEmployeeEdit(change: EmployeeEdit): Partial<Record<keyof EmployeeEdit, string>> {
  const db = getDb();
  const errors: Partial<Record<keyof EmployeeEdit, string>> = {};
  if (change.designation.trim().length < 2) errors.designation = 'Enter a designation';
  const fn = db.functions.find((f) => f.id === change.functionId);
  if (!fn) errors.functionId = 'Choose a function';
  else if (!fn.departments.includes(change.department)) errors.department = `Choose a department of ${fn.name}`;
  if (!db.grades.includes(change.grade)) errors.grade = 'Choose a grade';
  if (!db.units.some((u) => u.id === change.unitId)) errors.unitId = 'Choose a unit';
  if (!db.locations.includes(change.location)) errors.location = 'Choose a location';
  return errors;
}

export function updateEmployee(id: ID, change: EmployeeEdit): EmployeeActionResult {
  const errors = validateEmployeeEdit(change);
  const first = Object.values(errors)[0];
  if (first) return fail(first);
  const found = patch('employees', id, { ...change, designation: change.designation.trim() });
  return found ? OK : fail('Employee not found');
}

// ───────────────────────── functions & departments ─────────────────────────

const norm = (s: string) => s.trim().replace(/\s+/g, ' ');
const sameName = (a: string, b: string) => norm(a).toLowerCase() === norm(b).toLowerCase();

export function addFunction(name: string, departments: string[] = []): EmployeeActionResult & { id?: ID } {
  const db = getDb();
  const n = norm(name);
  if (n.length < 2) return fail('Enter a function name');
  if (db.functions.some((f) => sameName(f.name, n))) return fail(`“${n}” already exists`);
  const depts = [...new Set(departments.map(norm).filter(Boolean))];
  const taken = new Set(db.functions.flatMap((f) => f.departments.map((d) => d.toLowerCase())));
  const dup = depts.find((d) => taken.has(d.toLowerCase()));
  if (dup) return fail(`Department “${dup}” already belongs to another function`);
  const base = `F-${n.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'FN'}`;
  let id = base;
  for (let i = 2; db.functions.some((f) => f.id === id); i++) id = `${base}${i}`;
  const fn: FunctionArea = { id, name: n, departments: depts };
  setDb((d) => ({ functions: [...d.functions, fn] }));
  return { ok: true, id };
}

export function renameFunction(id: ID, name: string): EmployeeActionResult {
  const db = getDb();
  const n = norm(name);
  if (n.length < 2) return fail('Enter a function name');
  if (db.functions.some((f) => f.id !== id && sameName(f.name, n))) return fail(`“${n}” already exists`);
  return patch('functions', id, { name: n }) ? OK : fail('Function not found');
}

export function addDepartment(functionId: ID, name: string): EmployeeActionResult {
  const db = getDb();
  const n = norm(name);
  if (n.length < 2) return fail('Enter a department name');
  const fn = db.functions.find((f) => f.id === functionId);
  if (!fn) return fail('Function not found');
  const owner = db.functions.find((f) => f.departments.some((d) => sameName(d, n)));
  if (owner) return fail(owner.id === functionId ? `“${n}” already exists` : `“${n}” already belongs to ${owner.name}`);
  patch('functions', functionId, { departments: [...fn.departments, n] });
  return OK;
}

/** Rename a department everywhere (function list + every employee in it). Returns employees updated. */
export function renameDepartment(functionId: ID, from: string, to: string): EmployeeActionResult & { updated?: number } {
  const db = getDb();
  const n = norm(to);
  if (n.length < 2) return fail('Enter a department name');
  const fn = db.functions.find((f) => f.id === functionId);
  if (!fn || !fn.departments.includes(from)) return fail('Department not found');
  if (from === n) return { ok: true, updated: 0 };
  const owner = db.functions.find((f) => f.departments.some((d) => d !== from && sameName(d, n)));
  if (owner) return fail(`“${n}” already exists in ${owner.name}`);
  let updated = 0;
  setDb((d) => ({
    functions: d.functions.map((f) => (f.id === functionId ? { ...f, departments: f.departments.map((x) => (x === from ? n : x)) } : f)),
    employees: d.employees.map((e) => {
      if (e.functionId !== functionId || e.department !== from) return e;
      updated++;
      return { ...e, department: n };
    }),
  }));
  return { ok: true, updated };
}

/** Remove a department that nobody belongs to. */
export function removeDepartment(functionId: ID, name: string): EmployeeActionResult {
  const db = getDb();
  const fn = db.functions.find((f) => f.id === functionId);
  if (!fn) return fail('Function not found');
  const used = db.employees.filter((e) => e.department === name).length;
  if (used) return fail(`${used} ${used === 1 ? 'person is' : 'people are'} still in ${name}`);
  patch('functions', functionId, { departments: fn.departments.filter((d) => d !== name) });
  return OK;
}

// ───────────────────────── locations ─────────────────────────

export function addLocation(name: string): EmployeeActionResult {
  const db = getDb();
  const n = norm(name);
  if (n.length < 2) return fail('Enter a location');
  if (db.locations.some((l) => sameName(l, n))) return fail(`“${n}” is already in the list`);
  setDb((d) => ({ locations: [...d.locations, n] }));
  return OK;
}

/** Remove a location that no employee or unit uses. */
export function removeLocation(name: string): EmployeeActionResult {
  const db = getDb();
  const people = db.employees.filter((e) => e.location === name).length;
  if (people) return fail(`${people} ${people === 1 ? 'person is' : 'people are'} based in ${name}`);
  const unit = db.units.find((u) => u.location === name);
  if (unit) return fail(`${unit.name} is located in ${name}`);
  setDb((d) => ({ locations: d.locations.filter((l) => l !== name) }));
  return OK;
}
