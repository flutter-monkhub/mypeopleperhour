// Row model for the Sessions table: every session of the month + one row per pair still
// "to be scheduled" (no session yet), so all six tabs read from one list.

import type { DemoDatabase, Employee, ID, MonthKey, Session } from '@shared/types';
import { MISSED_REASON_LABELS } from '@shared/content/mph';
import { formatDate, formatTime } from '@shared/utils/dates';
import { pairMonthStatuses, type AnalyticsFilters } from '@/lib/analytics';
import { monthSessions, notedSessionIds, sessionDisplayStatus, type SessionDisplayStatus } from '@/lib/analytics-outcomes';
import type { CsvColumn } from '@/lib/csv';
import { employeeMap, unitName } from '@/lib/lookup';

export type SessionTab = 'all' | 'scheduled' | 'completed' | 'missed' | 'to_be_scheduled' | 'awaiting';
export const SESSION_TABS: readonly SessionTab[] = ['all', 'scheduled', 'completed', 'missed', 'to_be_scheduled', 'awaiting'];
export const TAB_LABELS: Record<SessionTab, string> = {
  all: 'All',
  scheduled: 'Scheduled',
  completed: 'Completed',
  missed: 'Missed',
  to_be_scheduled: 'To be scheduled',
  awaiting: 'Awaiting update',
};

export type RowStatus = SessionDisplayStatus | 'to_be_scheduled';

export interface SessionRow {
  /** session id, or `pair:<employeeId>` */
  key: string;
  session?: Session;
  employee: Employee;
  manager: Employee | undefined;
  managerId: ID;
  month: MonthKey;
  status: RowStatus;
  /** Manager captured notes linked to this session (content never shown) */
  notes: boolean;
}

export function buildSessionRows(db: DemoDatabase, month: MonthKey, filters: AnalyticsFilters, now: Date = new Date()): SessionRow[] {
  const emp = employeeMap(db);
  const noted = notedSessionIds(db);
  const rows: SessionRow[] = monthSessions(db, month, filters).map((s) => ({
    key: s.id,
    session: s,
    employee: emp.get(s.employeeId) as Employee,
    manager: emp.get(s.managerId),
    managerId: s.managerId,
    month,
    status: sessionDisplayStatus(s, now),
    notes: noted.has(s.id),
  }));
  for (const p of pairMonthStatuses(db, month, filters)) {
    if (p.status !== 'to_be_scheduled') continue;
    rows.push({ key: `pair:${p.employeeId}`, employee: p.employee, manager: p.manager, managerId: p.managerId, month, status: 'to_be_scheduled', notes: false });
  }
  return rows;
}

export function inTab(r: SessionRow, tab: SessionTab): boolean {
  switch (tab) {
    case 'all':
      return true;
    case 'scheduled':
      return r.status === 'scheduled' || r.status === 'awaiting_update';
    case 'awaiting':
      return r.status === 'awaiting_update';
    case 'to_be_scheduled':
      return r.status === 'to_be_scheduled';
    default:
      return r.status === tab;
  }
}

/** Default sort per tab: upcoming first for scheduled, most recent first otherwise. */
export const tabSort = (tab: SessionTab) =>
  tab === 'scheduled' ? { key: 'date', dir: 'asc' as const } : tab === 'to_be_scheduled' ? { key: 'manager', dir: 'asc' as const } : { key: 'date', dir: 'desc' as const };

export const MODE_LABELS = { teams: 'Teams', in_person: 'In person' } as const;

export function sessionCsvColumns(db: DemoDatabase): CsvColumn<SessionRow>[] {
  return [
    { header: 'Month', value: (r) => r.month },
    { header: 'Employee code', value: (r) => r.employee.code },
    { header: 'Employee', value: (r) => r.employee.name },
    { header: 'Manager', value: (r) => r.manager?.name ?? '' },
    { header: 'Unit', value: (r) => unitName(db, r.employee.unitId) },
    { header: 'Department', value: (r) => r.employee.department },
    { header: 'Status', value: (r) => (r.status === 'to_be_scheduled' ? 'To be scheduled' : r.status === 'awaiting_update' ? 'Awaiting update' : r.status.charAt(0).toUpperCase() + r.status.slice(1)) },
    { header: 'Date', value: (r) => (r.session ? formatDate(r.session.start) : '') },
    { header: 'Time', value: (r) => (r.session ? formatTime(r.session.start) : '') },
    { header: 'Mode', value: (r) => (r.session ? MODE_LABELS[r.session.mode] : '') },
    { header: 'Calendar synced', value: (r) => (r.session ? r.session.calendarSynced : '') },
    { header: 'Missed reason', value: (r) => (r.session?.missedReason ? MISSED_REASON_LABELS[r.session.missedReason] : '') },
    { header: 'Missed remark', value: (r) => r.session?.missedRemark ?? '' },
    { header: 'Cancel reason', value: (r) => r.session?.cancelReason ?? '' },
    { header: 'Employee rating', value: (r) => r.session?.employeeRating ?? '' },
    { header: 'Notes captured', value: (r) => (r.session?.status === 'completed' ? r.notes : '') },
  ];
}
