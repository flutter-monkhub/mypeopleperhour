import type { DemoDatabase, MonthKey } from '@shared/types';
import { formatMonth } from '@shared/utils/dates';
import type { AnalyticsFilters, CompletionGroup } from '@/lib/analytics';
import { describeFilters } from '@/lib/analytics';
import { csvFilename, downloadCsv } from '@/lib/csv';
import { employeeMap, unitName } from '@/lib/lookup';

interface Row {
  level: string;
  name: string;
  unit: string;
  g: CompletionGroup;
}

/** Deck: "report export" — one CSV with the unit (or department) and manager completion tables. */
export function exportCompletionReport(
  db: DemoDatabase,
  { month, filters, groups, groupKind, managers }: { month: MonthKey; filters: AnalyticsFilters; groups: CompletionGroup[]; groupKind: 'unit' | 'department'; managers: CompletionGroup[] },
) {
  const emp = employeeMap(db);
  const scope = describeFilters(db, filters);
  const rows: Row[] = [
    ...groups.map((g) => ({ level: groupKind === 'unit' ? 'Unit' : 'Department', name: g.label, unit: groupKind === 'unit' ? g.label : unitName(db, filters.unitId), g })),
    ...managers.map((g) => ({ level: 'Manager', name: g.label, unit: unitName(db, emp.get(g.key)?.unitId), g })),
  ];
  const total = groups.reduce(
    (s, g) => ({ ...s, total: s.total + g.total, completed: s.completed + g.completed, scheduled: s.scheduled + g.scheduled, missed: s.missed + g.missed, toBeScheduled: s.toBeScheduled + g.toBeScheduled }),
    { key: 'total', label: 'Total', shortLabel: 'Total', total: 0, completed: 0, scheduled: 0, missed: 0, toBeScheduled: 0, completionRate: 0 } as CompletionGroup,
  );
  total.completionRate = total.total ? total.completed / total.total : 0;
  rows.unshift({ level: 'Total', name: scope, unit: filters.unitId ? unitName(db, filters.unitId) : 'All units', g: total });
  const slug = scope.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  downloadCsv(csvFilename(`mph-completion-${month}-${slug}`), rows, [
    { header: 'Month', value: () => formatMonth(month) },
    { header: 'Level', value: (r) => r.level },
    { header: 'Name', value: (r) => r.name },
    { header: 'Unit', value: (r) => r.unit },
    { header: 'Pairs', value: (r) => r.g.total },
    { header: 'Completed', value: (r) => r.g.completed },
    { header: 'Scheduled', value: (r) => r.g.scheduled },
    { header: 'Missed', value: (r) => r.g.missed },
    { header: 'To be scheduled', value: (r) => r.g.toBeScheduled },
    { header: 'Completion %', value: (r) => Math.round(r.g.completionRate * 1000) / 10 },
  ]);
}
