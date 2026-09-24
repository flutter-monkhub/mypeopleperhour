// Employees (SPEC §6.2 A11–A12): everyone in scope with their manager and this month's
// MyPeopleHour status. Search + filters live in the URL so the list survives a round trip to a profile.

import { useMemo } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Download, Lock, Network, Users, X } from 'lucide-react';
import type { EmployeeLevel, EmployeeStatus } from '@shared/types';
import { formatMonth } from '@shared/utils/dates';
import { PageHeader } from '@/components/layout';
import {
  Badge,
  Button,
  Card,
  DataTable,
  FilterBar,
  FilterSelect,
  LinkButton,
  PersonCell,
  SearchInput,
  SkeletonTable,
  StatusBadge,
  Tabs,
  toast,
  type Column,
} from '@/components/ui';
import type { EmployeeMonthStatus } from '@/lib/analytics-outcomes';
import { csvFilename, downloadCsv } from '@/lib/csv';
import { formatNumber, pluralize } from '@/lib/format';
import { functionName, unitName } from '@/lib/lookup';
import { useCan } from '@/lib/rbac';
import { useMonth, useScope, useScopedEmployees } from '@/lib/scope';
import { useDb } from '@/store/db';
import { useUiStore } from '@/store/ui';
import { useWarmup } from '@/pages/dashboard/components/useWarmup';
import { buildEmployeeRows, employeeCsvColumns, LEVEL_LABELS, MPH_FILTER_LABELS, type EmployeeRow } from './components/employeeRows';

const MPH_ORDER: EmployeeMonthStatus[] = ['completed', 'scheduled', 'missed', 'to_be_scheduled', 'not_eligible'];
const STATUS_LABELS: Record<EmployeeStatus, string> = { active: 'Active', on_leave: 'On leave', inactive: 'Inactive' };
type FilterKey = 'fn' | 'dept' | 'grade' | 'loc' | 'level' | 'manager' | 'status';

export default function EmployeesPage() {
  const db = useDb();
  const navigate = useNavigate();
  const location = useLocation();
  const ready = useWarmup('employees', 300);
  const [params, setParams] = useSearchParams();
  const { month } = useMonth();
  const { unitId, locked, unit } = useScope();
  const setUnitId = useUiStore((s) => s.setUnitId);
  const canExport = useCan('reports.export');
  const canEdit = useCan('employees.edit');
  const employees = useScopedEmployees();

  const get = (k: string) => params.get(k) ?? '';
  const setParam = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    setParams(p, { replace: true });
  };

  const q = get('q');
  const f: Record<FilterKey, string> = { fn: get('fn'), dept: get('dept'), grade: get('grade'), loc: get('loc'), level: get('level'), manager: get('manager'), status: get('status') };
  const mph = MPH_ORDER.includes(get('mph') as EmployeeMonthStatus) ? (get('mph') as EmployeeMonthStatus) : '';

  const allRows = useMemo(() => buildEmployeeRows(db, employees, month), [db, employees, month]);

  // Options come from the in-scope population so every choice returns something
  const opts = useMemo(() => {
    const uniq = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b, 'en-IN', { numeric: true }));
    const deptPool = f.fn ? employees.filter((e) => e.functionId === f.fn) : employees;
    const managers = new Map<string, string>();
    for (const r of allRows) if (r.manager) managers.set(r.manager.id, r.manager.name);
    return {
      functions: db.functions.filter((fn) => employees.some((e) => e.functionId === fn.id)).map((fn) => ({ value: fn.id, label: fn.name })),
      departments: uniq(deptPool.map((e) => e.department)).map((d) => ({ value: d, label: d })),
      grades: uniq(employees.map((e) => e.grade)).map((g) => ({ value: g, label: g })),
      locations: uniq(employees.map((e) => e.location)).map((l) => ({ value: l, label: l })),
      levels: (Object.keys(LEVEL_LABELS) as EmployeeLevel[]).filter((l) => employees.some((e) => e.level === l)).map((l) => ({ value: l, label: LEVEL_LABELS[l] })),
      managers: [...managers.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label })),
    };
  }, [db.functions, employees, allRows, f.fn]);

  const base = useMemo(() => {
    const s = q.trim().toLowerCase();
    return allRows.filter(({ e }) => {
      if (s && !e.name.toLowerCase().includes(s) && !e.code.toLowerCase().includes(s) && !e.email.toLowerCase().includes(s)) return false;
      if (f.fn && e.functionId !== f.fn) return false;
      if (f.dept && e.department !== f.dept) return false;
      if (f.grade && e.grade !== f.grade) return false;
      if (f.loc && e.location !== f.loc) return false;
      if (f.level && e.level !== f.level) return false;
      if (f.manager && e.managerId !== f.manager) return false;
      if (f.status && e.status !== f.status) return false;
      return true;
    });
  }, [allRows, q, f.fn, f.dept, f.grade, f.loc, f.level, f.manager, f.status]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(MPH_ORDER.map((k) => [k, 0])) as Record<EmployeeMonthStatus, number>;
    for (const r of base) c[r.mph]++;
    return c;
  }, [base]);
  const rows = mph ? base.filter((r) => r.mph === mph) : base;

  const chipLabel: Record<FilterKey, (v: string) => string> = {
    fn: (v) => `Function: ${functionName(db, v)}`,
    dept: (v) => `Department: ${v}`,
    grade: (v) => `Grade: ${v}`,
    loc: (v) => `Location: ${v}`,
    level: (v) => `Level: ${LEVEL_LABELS[v as EmployeeLevel] ?? v}`,
    manager: (v) => `Manager: ${opts.managers.find((m) => m.value === v)?.label ?? v}`,
    status: (v) => `Status: ${STATUS_LABELS[v as EmployeeStatus] ?? v}`,
  };
  const active = (Object.keys(f) as FilterKey[]).filter((k) => f[k]);
  const activeCount = active.length + (q ? 1 : 0) + (mph ? 1 : 0) + (unitId && !locked ? 1 : 0);
  const resetAll = () => {
    setParams(new URLSearchParams(), { replace: true });
    if (!locked) setUnitId(null);
  };

  const exportCsv = () => {
    downloadCsv(csvFilename(`employees-${unit?.shortName.toLowerCase() ?? 'all-units'}`), rows, employeeCsvColumns(db, month));
    toast.success('CSV exported', pluralize(rows.length, 'employee'));
  };

  const columns: Column<EmployeeRow>[] = [
    {
      key: 'name',
      header: 'Employee',
      sortValue: (r) => r.e.name,
      cell: (r) => <PersonCell name={r.e.name} secondary={`${r.e.code} · ${r.e.designation}`} className="max-w-[250px]" />,
    },
    {
      key: 'grade',
      header: 'Grade',
      sortValue: (r) => r.e.grade,
      cell: (r) => (
        <span className="block leading-tight whitespace-nowrap">
          <span className="block text-ink">{r.e.grade}</span>
          <span className="block text-xs text-ink-2">{LEVEL_LABELS[r.e.level]}</span>
        </span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      hideBelow: 'xl',
      sortValue: (r) => r.e.department,
      cell: (r) => (
        <span className="block max-w-[170px] leading-tight">
          <span className="block truncate text-ink">{r.e.department}</span>
          <span className="block truncate text-xs text-ink-2">{functionName(db, r.e.functionId)}</span>
        </span>
      ),
    },
    {
      key: 'unit',
      header: 'Unit',
      hideBelow: 'xl',
      sortValue: (r) => unitName(db, r.e.unitId, true),
      cell: (r) => (
        <span className="block leading-tight whitespace-nowrap">
          <span className="block text-ink">{unitName(db, r.e.unitId, true)}</span>
          <span className="block text-xs text-ink-2">{r.e.location}</span>
        </span>
      ),
    },
    {
      key: 'manager',
      header: 'Manager',
      hideBelow: 'md',
      sortValue: (r) => r.manager?.name ?? '',
      cell: (r) => (r.manager ? <span className="whitespace-nowrap text-ink">{r.manager.name}</span> : <span className="text-muted">—</span>),
    },
    {
      key: 'mph',
      header: `MPH · ${formatMonth(month).slice(0, 3)}`,
      sortValue: (r) => MPH_ORDER.indexOf(r.mph),
      cell: (r) =>
        r.mph === 'not_eligible' ? (
          <span className="text-xs text-muted">{r.e.status === 'on_leave' ? 'On leave' : r.e.managerId ? 'Joined later' : 'No manager'}</span>
        ) : (
          <StatusBadge status={r.mph} size="sm" />
        ),
    },
    {
      key: 'status',
      header: 'Status',
      hideBelow: 'xl',
      sortValue: (r) => r.e.status,
      cell: (r) => <StatusBadge status={r.e.status} kind="employee" size="sm" />,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Organisation"
        title="Employees"
        subtitle={`${pluralize(employees.length, 'person', 'people')} ${unit ? `in ${unit.name}` : 'across PCBL'} — with their manager and ${formatMonth(month)} MyPeopleHour status.`}
        meta={
          locked ? (
            <Badge tone="warning" icon={Lock}>
              {unit?.name} only
            </Badge>
          ) : undefined
        }
        actions={
          <>
            <LinkButton to="/organisation" variant="secondary" icon={Network}>
              {canEdit ? 'Manage organisation' : 'Organisation'}
            </LinkButton>
            {canExport && (
              <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!rows.length}>
                Export CSV
              </Button>
            )}
          </>
        }
      />

      <FilterBar activeCount={activeCount} onReset={resetAll} actions={<SearchInput value={q} onChange={(v) => setParam({ q: v })} placeholder="Search name, code or email" size="sm" />}>
        <FilterSelect label="Unit" value={unitId ?? ''} allLabel="All" disabled={locked} onChange={(v) => setUnitId(v || null)} options={db.units.map((u) => ({ value: u.id, label: u.name }))} />
        <FilterSelect label="Function" value={f.fn} allLabel="All" onChange={(v) => setParam({ fn: v, dept: '' })} options={opts.functions} />
        <FilterSelect label="Department" value={f.dept} allLabel="All" onChange={(v) => setParam({ dept: v })} options={opts.departments} />
        <FilterSelect label="Grade" value={f.grade} allLabel="All" onChange={(v) => setParam({ grade: v })} options={opts.grades} />
        <FilterSelect label="Location" value={f.loc} allLabel="All" onChange={(v) => setParam({ loc: v })} options={opts.locations} />
        <FilterSelect label="Level" value={f.level} allLabel="All" onChange={(v) => setParam({ level: v })} options={opts.levels} />
        <FilterSelect label="Manager" value={f.manager} allLabel="All" onChange={(v) => setParam({ manager: v })} options={opts.managers} />
        <FilterSelect
          label="Status"
          value={f.status}
          allLabel="All"
          onChange={(v) => setParam({ status: v })}
          options={(Object.keys(STATUS_LABELS) as EmployeeStatus[]).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        />
      </FilterBar>

      {active.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {active.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setParam(k === 'fn' ? { fn: '', dept: '' } : { [k]: '' })}
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-primary/30 bg-primary-soft pr-2 pl-3 text-xs font-medium text-primary hover:border-primary/60"
            >
              {chipLabel[k](f[k])}
              <X className="size-3.5" aria-label="Remove filter" />
            </button>
          ))}
        </div>
      )}

      <Card padding="none" className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
          <Tabs<EmployeeMonthStatus | 'all'>
            variant="pills"
            className="w-full"
            value={mph || 'all'}
            onChange={(v) => setParam({ mph: v === 'all' ? '' : v })}
            tabs={[{ id: 'all' as const, label: 'Everyone', count: base.length }, ...MPH_ORDER.map((k) => ({ id: k, label: MPH_FILTER_LABELS[k], count: counts[k] }))]}
          />
          <span className="text-xs text-ink-2">
            MyPeopleHour status for <span className="font-medium text-ink">{formatMonth(month)}</span>
          </span>
        </div>
        {ready ? (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.e.id}
            onRowClick={(r) => navigate(`/employees/${r.e.id}`, { state: { from: `${location.pathname}${location.search}` } })}
            initialSort={{ key: 'name', dir: 'asc' }}
            pageSize={25}
            pageSizeOptions={[25, 50, 100]}
            dense
            minWidth={820}
            emptyIcon={Users}
            emptyTitle="No employees match"
            emptyMessage="Try a different search or clear some filters."
            emptyAction={
              activeCount ? (
                <Button variant="secondary" size="sm" onClick={resetAll}>
                  Clear all filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <SkeletonTable rows={10} cols={6} />
        )}
      </Card>
      <p className="mt-3 text-xs text-muted">{formatNumber(rows.length)} shown · click a row for the full profile, MyPeopleHour history and mentoring.</p>
    </>
  );
}
