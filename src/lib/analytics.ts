// MyPeopleHour completion analytics — pure functions over DemoDatabase (SPEC §3 rules 1, 2, 16).
//
// A "pair" for month M = an employee with status `active`, a manager, and a joining date on or before
// the end of M. Its status comes from the shared `monthlyStatus` (completed > scheduled > missed >
// to be scheduled; cancelled ignored). Every function takes optional filters
// { unitId, functionId, department, managerId } that apply to the *employee* side of the pair.
//
// Results are memoised per (db.sessions, db.employees) reference + arguments, so calling them
// from render is cheap; wrap in useMemo anyway when you post-process.

import type { DemoDatabase, Employee, ID, MissedReason, MonthKey, MonthlyStatus, Session } from '@shared/types';
import { isAwaitingUpdate, monthlySession, monthlyStatus } from '@shared/logic';
import { addMonthsToKey, formatMonth, formatMonthShort, monthKey, monthKeyToDate, monthRange } from '@shared/utils/dates';
import { employeeMap, functionMap, unitMap } from './lookup';
import { memoOn } from './memo';

export interface AnalyticsFilters {
  unitId?: ID | null;
  functionId?: ID | null;
  department?: string | null;
  managerId?: ID | null;
}

export interface PairStatus {
  employee: Employee;
  manager: Employee | undefined;
  employeeId: ID;
  managerId: ID;
  month: MonthKey;
  status: MonthlyStatus;
  /** The session that represents the month (same priority as the status), if any */
  session?: Session;
  /** Scheduled session whose end time has passed (rule 2) */
  awaitingUpdate: boolean;
}

export interface CompletionSummary {
  total: number;
  completed: number;
  scheduled: number;
  missed: number;
  toBeScheduled: number;
  /** completed / total, 0–1 (0 when total = 0) */
  completionRate: number;
}

export interface CompletionGroup extends CompletionSummary {
  key: string;
  label: string;
  shortLabel: string;
}

export interface TrendPoint extends CompletionSummary {
  month: MonthKey;
  /** "Sep 2026" */
  label: string;
  /** "Sep" */
  shortLabel: string;
}

export interface MissedPairFlag {
  pair: PairStatus;
  /** missed = pair's month status is Missed; unscheduled_late = still To be scheduled after the 20th (or month closed) */
  reason: 'missed' | 'unscheduled_late';
}

export interface RepeatMissFlag {
  managerId: ID;
  manager: Employee | undefined;
  /** Missed sessions in the 3-month window ending at `month` */
  missedCount: number;
  months: MonthKey[];
  employeeIds: ID[];
}

export interface MissedFlags {
  pairs: MissedPairFlag[];
  managers: RepeatMissFlag[];
  /** true when "to be scheduled" pairs count as flagged (after the 20th, or the month has closed) */
  lateCutoffPassed: boolean;
  /** pairs.length + managers.length */
  total: number;
}

const filterKey = (f: AnalyticsFilters = {}) => `${f.unitId ?? ''}|${f.functionId ?? ''}|${f.department ?? ''}|${f.managerId ?? ''}`;

/** Does this employee pass the filters? */
export function matchesFilters(e: Employee, f: AnalyticsFilters = {}): boolean {
  if (f.unitId && e.unitId !== f.unitId) return false;
  if (f.functionId && e.functionId !== f.functionId) return false;
  if (f.department && e.department !== f.department) return false;
  if (f.managerId && e.managerId !== f.managerId) return false;
  return true;
}

/** Sessions grouped by `employeeId|month` (cached per sessions array). */
export function sessionIndex(sessions: Session[]): Map<string, Session[]> {
  return memoOn([sessions], 'sessionIndex', () => {
    const m = new Map<string, Session[]>();
    for (const s of sessions) {
      const k = `${s.employeeId}|${s.month}`;
      const list = m.get(k);
      if (list) list.push(s);
      else m.set(k, [s]);
    }
    return m;
  });
}

/** Sessions of one pair in one month (any manager). */
export const pairSessions = (db: Pick<DemoDatabase, 'sessions'>, employeeId: ID, month: MonthKey): Session[] =>
  sessionIndex(db.sessions).get(`${employeeId}|${month}`) ?? [];

/** Month keys from the first MyPeopleHour session to the current month (inclusive, ascending). */
export function programmeMonths(db: Pick<DemoDatabase, 'sessions'>, now: Date = new Date()): MonthKey[] {
  const current = monthKey(now);
  return memoOn([db.sessions], `programmeMonths|${current}`, () => {
    let first = current;
    for (const s of db.sessions) if (s.month < first) first = s.month;
    return monthRange(first, current);
  });
}

/** Is this employee part of a MyPeopleHour pair in `month`? */
export function isPairEligible(e: Employee, month: MonthKey): boolean {
  if (e.status !== 'active' || !e.managerId) return false;
  const d = monthKeyToDate(month);
  const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
  return new Date(e.dateOfJoining) <= monthEnd;
}

/** Every eligible manager ↔ report pair with its MonthlyStatus for `month`. */
export function pairMonthStatuses(db: DemoDatabase, month: MonthKey, filters: AnalyticsFilters = {}): PairStatus[] {
  return memoOn([db.sessions, db.employees], `pairs|${month}|${filterKey(filters)}`, () => {
    const idx = sessionIndex(db.sessions);
    const emp = employeeMap(db);
    const now = new Date();
    const out: PairStatus[] = [];
    for (const e of db.employees) {
      if (!isPairEligible(e, month) || !matchesFilters(e, filters)) continue;
      const list = idx.get(`${e.id}|${month}`) ?? [];
      const status = monthlyStatus(list, e.id, month);
      const session = list.length ? monthlySession(list, e.id, month) : undefined;
      out.push({
        employee: e,
        manager: emp.get(e.managerId as string),
        employeeId: e.id,
        managerId: e.managerId as string,
        month,
        status,
        session,
        awaitingUpdate: !!session && isAwaitingUpdate(session, now),
      });
    }
    return out;
  });
}

/** Tally a list of pairs. */
export function summarize(pairs: readonly Pick<PairStatus, 'status'>[]): CompletionSummary {
  const s: CompletionSummary = { total: pairs.length, completed: 0, scheduled: 0, missed: 0, toBeScheduled: 0, completionRate: 0 };
  for (const p of pairs) {
    if (p.status === 'completed') s.completed++;
    else if (p.status === 'scheduled') s.scheduled++;
    else if (p.status === 'missed') s.missed++;
    else s.toBeScheduled++;
  }
  s.completionRate = s.total ? s.completed / s.total : 0;
  return s;
}

/** Totals + completion rate for the month (rule 16). */
export function completionSummary(db: DemoDatabase, month: MonthKey, filters: AnalyticsFilters = {}): CompletionSummary {
  return memoOn([db.sessions, db.employees], `summary|${month}|${filterKey(filters)}`, () => summarize(pairMonthStatuses(db, month, filters)));
}

function groupBy(pairs: PairStatus[], keyOf: (p: PairStatus) => string, order: { key: string; label: string; shortLabel?: string }[]): CompletionGroup[] {
  const buckets = new Map<string, PairStatus[]>();
  for (const p of pairs) {
    const k = keyOf(p);
    const list = buckets.get(k);
    if (list) list.push(p);
    else buckets.set(k, [p]);
  }
  return order
    .filter((o) => buckets.has(o.key))
    .map((o) => ({ key: o.key, label: o.label, shortLabel: o.shortLabel ?? o.label, ...summarize(buckets.get(o.key)!) }));
}

/** Completion per unit (units without pairs are omitted; order = db.units). */
export function completionByUnit(db: DemoDatabase, month: MonthKey, filters: AnalyticsFilters = {}): CompletionGroup[] {
  return memoOn([db.sessions, db.employees, db.units], `byUnit|${month}|${filterKey(filters)}`, () =>
    groupBy(
      pairMonthStatuses(db, month, filters),
      (p) => p.employee.unitId,
      db.units.map((u) => ({ key: u.id, label: u.name, shortLabel: u.shortName })),
    ),
  );
}

/** Completion per function (order = db.functions). */
export function completionByFunction(db: DemoDatabase, month: MonthKey, filters: AnalyticsFilters = {}): CompletionGroup[] {
  return memoOn([db.sessions, db.employees, db.functions], `byFunction|${month}|${filterKey(filters)}`, () =>
    groupBy(
      pairMonthStatuses(db, month, filters),
      (p) => p.employee.functionId,
      db.functions.map((f) => ({ key: f.id, label: f.name })),
    ),
  );
}

/** Completion per department (order = functions → departments). Combine with `functionId` filter to drill down. */
export function completionByDepartment(db: DemoDatabase, month: MonthKey, filters: AnalyticsFilters = {}): CompletionGroup[] {
  return memoOn([db.sessions, db.employees, db.functions], `byDept|${month}|${filterKey(filters)}`, () => {
    const order = db.functions.flatMap((f) => f.departments.map((d) => ({ key: d, label: d })));
    const known = new Set(order.map((o) => o.key));
    // departments present on employees but missing from the functions list (e.g. after an edit)
    for (const e of db.employees) {
      if (known.has(e.department)) continue;
      known.add(e.department);
      order.push({ key: e.department, label: e.department });
    }
    return groupBy(pairMonthStatuses(db, month, filters), (p) => p.employee.department, order);
  });
}

/** Completion per manager (label = manager name), sorted by team size desc. */
export function completionByManager(db: DemoDatabase, month: MonthKey, filters: AnalyticsFilters = {}): CompletionGroup[] {
  return memoOn([db.sessions, db.employees], `byManager|${month}|${filterKey(filters)}`, () => {
    const pairs = pairMonthStatuses(db, month, filters);
    const emp = employeeMap(db);
    const ids = [...new Set(pairs.map((p) => p.managerId))];
    return groupBy(
      pairs,
      (p) => p.managerId,
      ids.map((id) => ({ key: id, label: emp.get(id)?.name ?? id })),
    ).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  });
}

/** One summary per month (ascending as given). */
export function monthlyTrend(db: DemoDatabase, months: readonly MonthKey[], filters: AnalyticsFilters = {}): TrendPoint[] {
  return months.map((m) => ({ month: m, label: formatMonth(m), shortLabel: formatMonthShort(m), ...completionSummary(db, m, filters) }));
}

/**
 * Missed flags for `month` (rule 16):
 *  • pairs whose status is Missed,
 *  • pairs still To be scheduled after the 20th of the month (or once the month has closed),
 *  • managers with ≥ 2 missed sessions in the 3 months ending at `month`.
 */
export function missedFlags(db: DemoDatabase, month: MonthKey, filters: AnalyticsFilters = {}, now: Date = new Date()): MissedFlags {
  const current = monthKey(now);
  const lateCutoffPassed = month < current || (month === current && now.getDate() > 20);
  return memoOn([db.sessions, db.employees], `missedFlags|${month}|${filterKey(filters)}|${lateCutoffPassed}`, () => {
    const pairs: MissedPairFlag[] = [];
    for (const p of pairMonthStatuses(db, month, filters)) {
      if (p.status === 'missed') pairs.push({ pair: p, reason: 'missed' });
      else if (p.status === 'to_be_scheduled' && lateCutoffPassed) pairs.push({ pair: p, reason: 'unscheduled_late' });
    }

    const window = [addMonthsToKey(month, -2), addMonthsToKey(month, -1), month];
    const emp = employeeMap(db);
    const byManager = new Map<ID, { count: number; months: Set<MonthKey>; employees: Set<ID> }>();
    for (const s of db.sessions) {
      if (s.status !== 'missed' || !window.includes(s.month)) continue;
      const e = emp.get(s.employeeId);
      if (!e || !matchesFilters(e, filters)) continue;
      const b = byManager.get(s.managerId) ?? { count: 0, months: new Set(), employees: new Set() };
      b.count++;
      b.months.add(s.month);
      b.employees.add(s.employeeId);
      byManager.set(s.managerId, b);
    }
    const managers: RepeatMissFlag[] = [...byManager.entries()]
      .filter(([, b]) => b.count >= 2)
      .map(([managerId, b]) => ({ managerId, manager: emp.get(managerId), missedCount: b.count, months: [...b.months].sort(), employeeIds: [...b.employees] }))
      .sort((a, b) => b.missedCount - a.missedCount || (a.manager?.name ?? '').localeCompare(b.manager?.name ?? ''));

    return { pairs, managers, lateCutoffPassed, total: pairs.length + managers.length };
  });
}

/** Missed sessions split by reason over the given months. */
export function missedReasonSplit(
  db: DemoDatabase,
  months: readonly MonthKey[],
  filters: AnalyticsFilters = {},
): Record<MissedReason | 'unspecified', number> & { total: number } {
  const set = new Set(months);
  const emp = employeeMap(db);
  const out = { business_emergency: 0, personal_emergency: 0, unspecified: 0, total: 0 };
  for (const s of db.sessions) {
    if (s.status !== 'missed' || !set.has(s.month)) continue;
    const e = emp.get(s.employeeId);
    if (!e || !matchesFilters(e, filters)) continue;
    out[s.missedReason ?? 'unspecified']++;
    out.total++;
  }
  return out;
}

/** Labels for filter chips / captions: "Durgapur Plant · Manufacturing · Production" */
export function describeFilters(db: DemoDatabase, f: AnalyticsFilters = {}): string {
  const parts: string[] = [];
  if (f.unitId) parts.push(unitMap(db).get(f.unitId)?.name ?? f.unitId);
  if (f.functionId) parts.push(functionMap(db).get(f.functionId)?.name ?? f.functionId);
  if (f.department) parts.push(f.department);
  if (f.managerId) parts.push(employeeMap(db).get(f.managerId)?.name ?? f.managerId);
  return parts.length ? parts.join(' · ') : 'All units';
}
