import type { DemoDatabase, Employee, EmployeeLevel, MonthKey } from '@shared/types';
import { employeeMonthStatus, type EmployeeMonthStatus } from '@/lib/analytics-outcomes';
import type { CsvColumn } from '@/lib/csv';
import { formatDate } from '@/lib/format';
import { employeeMap, functionName, reportsByManager, unitName } from '@/lib/lookup';

export const LEVEL_LABELS: Record<EmployeeLevel, string> = {
  executive: 'Executive',
  senior_leader: 'Senior leader',
  manager: 'Manager',
  staff: 'Staff',
};

export const MPH_FILTER_LABELS: Record<EmployeeMonthStatus, string> = {
  completed: 'Completed',
  scheduled: 'Scheduled',
  missed: 'Missed',
  to_be_scheduled: 'To be scheduled',
  not_eligible: 'Not in a pair',
};

export interface EmployeeRow {
  e: Employee;
  manager: Employee | undefined;
  mph: EmployeeMonthStatus;
  reports: number;
}

export function buildEmployeeRows(db: DemoDatabase, employees: readonly Employee[], month: MonthKey): EmployeeRow[] {
  const emp = employeeMap(db);
  const reports = reportsByManager(db);
  return employees.map((e) => ({
    e,
    manager: e.managerId ? emp.get(e.managerId) : undefined,
    mph: employeeMonthStatus(db, e, month),
    reports: reports.get(e.id)?.length ?? 0,
  }));
}

export function employeeCsvColumns(db: DemoDatabase, month: MonthKey): CsvColumn<EmployeeRow>[] {
  return [
    { header: 'Employee code', value: (r) => r.e.code },
    { header: 'Name', value: (r) => r.e.name },
    { header: 'Email', value: (r) => r.e.email },
    { header: 'Phone', value: (r) => r.e.phone },
    { header: 'Designation', value: (r) => r.e.designation },
    { header: 'Department', value: (r) => r.e.department },
    { header: 'Function', value: (r) => functionName(db, r.e.functionId) },
    { header: 'Grade', value: (r) => r.e.grade },
    { header: 'Level', value: (r) => LEVEL_LABELS[r.e.level] },
    { header: 'Unit', value: (r) => unitName(db, r.e.unitId) },
    { header: 'Location', value: (r) => r.e.location },
    { header: 'Manager code', value: (r) => r.manager?.code ?? '' },
    { header: 'Manager', value: (r) => r.manager?.name ?? '' },
    { header: 'Direct reports', value: (r) => r.reports },
    { header: 'Date of joining', value: (r) => formatDate(r.e.dateOfJoining) },
    { header: 'Status', value: (r) => (r.e.status === 'on_leave' ? 'On leave' : r.e.status === 'active' ? 'Active' : 'Inactive') },
    { header: `MyPeopleHour ${month}`, value: (r) => MPH_FILTER_LABELS[r.mph] },
  ];
}
