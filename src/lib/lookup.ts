// Fast id → record lookups, cached per collection array (rebuilt only when it changes).

import type { DemoDatabase, Employee, FunctionArea, MentorProfile, Unit } from '@shared/types';
import { memoOn } from './memo';

export const employeeMap = (db: Pick<DemoDatabase, 'employees'>): Map<string, Employee> =>
  memoOn([db.employees], 'employeeMap', () => new Map(db.employees.map((e) => [e.id, e])));

export const unitMap = (db: Pick<DemoDatabase, 'units'>): Map<string, Unit> => memoOn([db.units], 'unitMap', () => new Map(db.units.map((u) => [u.id, u])));

export const functionMap = (db: Pick<DemoDatabase, 'functions'>): Map<string, FunctionArea> =>
  memoOn([db.functions], 'functionMap', () => new Map(db.functions.map((f) => [f.id, f])));

export const mentorMap = (db: Pick<DemoDatabase, 'mentors'>): Map<string, MentorProfile> =>
  memoOn([db.mentors], 'mentorMap', () => new Map(db.mentors.map((m) => [m.employeeId, m])));

/** Direct reports by manager id (active + on leave; inactive excluded). */
export const reportsByManager = (db: Pick<DemoDatabase, 'employees'>): Map<string, Employee[]> =>
  memoOn([db.employees], 'reportsByManager', () => {
    const m = new Map<string, Employee[]>();
    for (const e of db.employees) {
      if (!e.managerId || e.status === 'inactive') continue;
      const list = m.get(e.managerId);
      if (list) list.push(e);
      else m.set(e.managerId, [e]);
    }
    return m;
  });

export const employeeName = (db: Pick<DemoDatabase, 'employees'>, id: string | null | undefined) => (id ? (employeeMap(db).get(id)?.name ?? id) : '—');
export const unitName = (db: Pick<DemoDatabase, 'units'>, id: string | null | undefined, short = false) => {
  const u = id ? unitMap(db).get(id) : undefined;
  return u ? (short ? u.shortName : u.name) : '—';
};
export const functionName = (db: Pick<DemoDatabase, 'functions'>, id: string | null | undefined) => (id ? (functionMap(db).get(id)?.name ?? id) : '—');
