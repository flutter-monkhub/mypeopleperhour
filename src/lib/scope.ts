// Unit scoping + global top-bar filters.
//
//   const { unitId, locked, unit } = useScope();   // hr_admin → their unitScope, locked = true
//   const { month, months, setMonth } = useMonth(); // global month (defaults to current month)
//   const filters = useScopeFilters();              // { unitId } ready for lib/analytics
//   const employees = useScopedEmployees();         // employees in scope (all statuses)
//
// Always derive "what data can this admin see" from useScope(), never from the ui store directly —
// a unit-scoped hr_admin must not be able to widen the scope through the global filter.

import { useCallback, useMemo } from 'react';
import type { DemoDatabase, Employee, ID, MonthKey, Unit } from '@shared/types';
import { monthKey } from '@shared/utils/dates';
import { useCurrentAdmin } from '@/store/auth';
import { useCollection } from '@/store/db';
import { useUiStore } from '@/store/ui';
import { programmeMonths, type AnalyticsFilters } from './analytics';
import { employeeMap } from './lookup';

export interface Scope {
  /** Effective unit filter (null = all units) */
  unitId: ID | null;
  /** true for a unit-scoped hr_admin: the unit cannot be changed */
  locked: boolean;
  unit: Unit | null;
}

export function useScope(): Scope {
  const admin = useCurrentAdmin();
  const chosen = useUiStore((s) => s.unitId);
  const units = useCollection('units');
  const locked = admin?.role === 'hr_admin' && !!admin.unitScope;
  const unitId = locked ? (admin.unitScope as ID) : chosen && units.some((u) => u.id === chosen) ? chosen : null;
  const unit = useMemo(() => units.find((u) => u.id === unitId) ?? null, [units, unitId]);
  return { unitId, locked, unit };
}

/** `{ unitId }` of the current scope, merged with page-level filters. The scope's unit always wins when locked. */
export function useScopeFilters(extra: AnalyticsFilters = {}): AnalyticsFilters {
  const { unitId, locked } = useScope();
  const { functionId, department, managerId } = extra;
  const extraUnit = extra.unitId;
  return useMemo(
    () => ({ unitId: locked ? unitId : (extraUnit ?? unitId), functionId: functionId ?? null, department: department ?? null, managerId: managerId ?? null }),
    [unitId, locked, extraUnit, functionId, department, managerId],
  );
}

/** Global month + the programme's month list (ascending). */
export function useMonth(): { month: MonthKey; months: MonthKey[]; currentMonth: MonthKey; setMonth: (m: MonthKey | null) => void } {
  const sessions = useCollection('sessions');
  const chosen = useUiStore((s) => s.month);
  const setMonth = useUiStore((s) => s.setMonth);
  const currentMonth = monthKey(new Date());
  const months = useMemo(() => programmeMonths({ sessions }), [sessions]);
  const month = chosen && months.includes(chosen) ? chosen : (months[months.length - 1] ?? currentMonth);
  return { month, months, currentMonth, setMonth };
}

/** Pure helper: employees visible for a unit scope. */
export const scopeEmployees = (db: Pick<DemoDatabase, 'employees'>, unitId: ID | null): Employee[] =>
  unitId ? db.employees.filter((e) => e.unitId === unitId) : db.employees;

/** Employees in the current scope (reactive, memoised). */
export function useScopedEmployees(): Employee[] {
  const employees = useCollection('employees');
  const { unitId } = useScope();
  return useMemo(() => (unitId ? employees.filter((e) => e.unitId === unitId) : employees), [employees, unitId]);
}

/** Is an employee (by id) inside the current scope? Handy for detail-page guards. */
export function useInScope(): (employeeId: ID | null | undefined) => boolean {
  const { unitId } = useScope();
  const employees = useCollection('employees');
  return useCallback(
    (id) => {
      if (!id) return false;
      if (!unitId) return true;
      return employeeMap({ employees }).get(id)?.unitId === unitId;
    },
    [unitId, employees],
  );
}
