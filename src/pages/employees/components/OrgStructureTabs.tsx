// Organisation tabs: functions & departments, units & locations, grades (SPEC §6.2 A14–A15).

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, FolderPlus, Layers, Lock, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import type { Employee, EmployeeLevel, FunctionArea } from '@shared/types';
import { formatMonth } from '@shared/utils/dates';
import { Badge, Button, Card, CardHeader, DataTable, IconButton, ProgressBar, confirm, toast, type Column } from '@/components/ui';
import { completionByUnit } from '@/lib/analytics';
import { formatNumber, formatPercent, pluralize } from '@/lib/format';
import { reportsByManager } from '@/lib/lookup';
import { addDepartment, addFunction, addLocation, removeDepartment, removeLocation, renameDepartment, renameFunction } from '@/store/actions';
import type { DemoDatabase, Unit } from '@shared/types';
import { RateCell } from '@/pages/dashboard/components/shared';
import { LEVEL_LABELS } from './employeeRows';
import { TextPromptModal } from './TextPromptModal';

export interface OrgTabProps {
  db: DemoDatabase;
  /** In-scope employees (active + on leave; inactive excluded) */
  people: Employee[];
  /** May edit organisation-wide lists (not unit-scoped) */
  canEditOrg: boolean;
  scopeLabel: string;
  month: string;
}

function ReadOnlyNote({ scoped }: { scoped: boolean }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-ink-2">
      <Lock className="size-3" />
      {scoped ? 'Organisation-wide lists are managed by Corporate HR — headcounts show your unit.' : 'Read-only — editing needs the “Edit employees” permission.'}
    </p>
  );
}

// ───────────────────────── functions & departments ─────────────────────────

type Prompt =
  | { kind: 'add-function' }
  | { kind: 'rename-function'; fn: FunctionArea }
  | { kind: 'add-dept'; fn: FunctionArea }
  | { kind: 'rename-dept'; fn: FunctionArea; dept: string };

export function FunctionsTab({ db, people, canEditOrg, scoped }: OrgTabProps & { scoped: boolean }) {
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [seq, setSeq] = useState(0);
  const open = (p: Prompt) => {
    setSeq((n) => n + 1);
    setPrompt(p);
  };
  const byDept = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of people) m.set(`${e.functionId}|${e.department}`, (m.get(`${e.functionId}|${e.department}`) ?? 0) + 1);
    return m;
  }, [people]);
  const allDeptCount = (d: string) => db.employees.filter((e) => e.department === d).length;
  const headcount = (fn: FunctionArea) => fn.departments.reduce((s, d) => s + (byDept.get(`${fn.id}|${d}`) ?? 0), 0);

  const removeDept = async (fn: FunctionArea, d: string) => {
    const ok = await confirm({ title: `Remove “${d}”?`, message: `It will no longer be offered as a department of ${fn.name}.`, confirmLabel: 'Remove', tone: 'danger' });
    if (!ok) return;
    const r = removeDepartment(fn.id, d);
    if (!r.ok) return toast.error('Can’t remove department', r.error);
    toast.success('Department removed', d);
  };

  const p = prompt;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {canEditOrg ? <p className="text-[13px] text-ink-2">{pluralize(db.functions.length, 'function')} · {pluralize(db.functions.reduce((s, f) => s + f.departments.length, 0), 'department')}</p> : <ReadOnlyNote scoped={scoped} />}
        {canEditOrg && (
          <Button icon={Plus} onClick={() => open({ kind: 'add-function' })}>
            Add function
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        {(scoped ? [...db.functions].sort((a, b) => headcount(b) - headcount(a)) : db.functions).map((fn) => {
          const total = fn.departments.reduce((s, d) => s + (byDept.get(`${fn.id}|${d}`) ?? 0), 0);
          const max = Math.max(1, ...fn.departments.map((d) => byDept.get(`${fn.id}|${d}`) ?? 0));
          return (
            <Card key={fn.id} padding="none">
              <CardHeader
                divider
                icon={Layers}
                title={fn.name}
                subtitle={`${pluralize(fn.departments.length, 'department')} · ${pluralize(total, 'person', 'people')}`}
                actions={
                  canEditOrg && (
                    <>
                      <IconButton icon={Pencil} label={`Rename ${fn.name}`} size="sm" onClick={() => open({ kind: 'rename-function', fn })} />
                      <Button variant="secondary" size="xs" icon={FolderPlus} onClick={() => open({ kind: 'add-dept', fn })}>
                        Department
                      </Button>
                    </>
                  )
                }
              />
              {fn.departments.length ? (
                <ul className="divide-y divide-line">
                  {fn.departments.map((d) => {
                    const n = byDept.get(`${fn.id}|${d}`) ?? 0;
                    return (
                      <li key={d} className="group flex items-center gap-3 px-5 py-2.5">
                        <Link to={`/employees?fn=${fn.id}&dept=${encodeURIComponent(d)}`} className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink hover:text-primary">
                          {d}
                        </Link>
                        <span className="hidden w-28 sm:block">
                          <ProgressBar value={n} max={max} size="xs" tone="primary" />
                        </span>
                        <span className="w-10 text-right text-[13px] font-semibold text-ink tabular">{formatNumber(n)}</span>
                        {canEditOrg && (
                          <span className="flex w-16 justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
                            <IconButton icon={Pencil} label={`Rename ${d}`} size="xs" onClick={() => open({ kind: 'rename-dept', fn, dept: d })} />
                            <IconButton icon={Trash2} label={allDeptCount(d) ? `${d} still has people` : `Remove ${d}`} size="xs" disabled={allDeptCount(d) > 0} onClick={() => void removeDept(fn, d)} />
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-5 py-4 text-[13px] text-ink-2">No departments yet.</p>
              )}
            </Card>
          );
        })}
      </div>

      {p && (
        <TextPromptModal
          key={seq}
          open
          onClose={() => setPrompt(null)}
          icon={p.kind === 'add-function' ? Plus : p.kind === 'add-dept' ? FolderPlus : Pencil}
          title={p.kind === 'add-function' ? 'Add function' : p.kind === 'rename-function' ? `Rename ${p.fn.name}` : p.kind === 'add-dept' ? `Add a department to ${p.fn.name}` : `Rename ${p.dept}`}
          description={p.kind === 'rename-dept' ? 'Everyone in this department moves with it.' : undefined}
          label={p.kind === 'add-function' || p.kind === 'rename-function' ? 'Function name' : 'Department name'}
          initial={p.kind === 'rename-function' ? p.fn.name : p.kind === 'rename-dept' ? p.dept : ''}
          submitLabel={p.kind.startsWith('add') ? 'Add' : 'Rename'}
          extra={p.kind === 'add-function' ? { label: 'First department (optional)', placeholder: 'e.g. Sustainability Office' } : undefined}
          onSubmit={(value, extra) => {
            const r =
              p.kind === 'add-function'
                ? addFunction(value, extra ? [extra] : [])
                : p.kind === 'rename-function'
                  ? renameFunction(p.fn.id, value)
                  : p.kind === 'add-dept'
                    ? addDepartment(p.fn.id, value)
                    : renameDepartment(p.fn.id, p.dept, value);
            if (!r.ok) return r.error;
            const updated = 'updated' in r && typeof r.updated === 'number' ? ` · ${pluralize(r.updated, 'person', 'people')} moved` : '';
            toast.success(p.kind.startsWith('add') ? 'Added' : 'Renamed', `${value.trim()}${updated}`);
            return null;
          }}
        />
      )}
    </div>
  );
}

// ───────────────────────── units & locations ─────────────────────────

export function UnitsTab({ db, people, canEditOrg, scoped, month, unitId }: OrgTabProps & { scoped: boolean; unitId: string | null }) {
  const [adding, setAdding] = useState(0);
  const managers = reportsByManager(db);
  const completion = completionByUnit(db, month, {});
  const units = unitId ? db.units.filter((u) => u.id === unitId) : db.units;
  type Row = { u: Unit; headcount: number; managers: number; onLeave: number };
  const rows: Row[] = units.map((u) => {
    const inUnit = people.filter((e) => e.unitId === u.id);
    return { u, headcount: inUnit.length, managers: inUnit.filter((e) => (managers.get(e.id)?.length ?? 0) > 0).length, onLeave: inUnit.filter((e) => e.status === 'on_leave').length };
  });
  const columns: Column<Row>[] = [
    {
      key: 'name',
      header: 'Unit',
      sortValue: (r) => r.u.name,
      cell: (r) => (
        <span className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary">
            <Building2 className="size-4" />
          </span>
          <span className="leading-tight">
            <span className="block font-medium whitespace-nowrap text-ink">{r.u.name}</span>
            <span className="block text-xs text-ink-2">{r.u.shortName}</span>
          </span>
        </span>
      ),
    },
    { key: 'loc', header: 'Location', sortValue: (r) => r.u.location, cell: (r) => <span className="inline-flex items-center gap-1 text-ink-2"><MapPin className="size-3.5" />{r.u.location}</span> },
    { key: 'hc', header: 'Headcount', align: 'right', sortValue: (r) => r.headcount, cell: (r) => <span className="font-semibold tabular">{formatNumber(r.headcount)}</span> },
    { key: 'mgr', header: 'Managers', align: 'right', sortValue: (r) => r.managers, cell: (r) => <span className="tabular">{formatNumber(r.managers)}</span> },
    { key: 'leave', header: 'On leave', align: 'right', hideBelow: '2xl', sortValue: (r) => r.onLeave, cell: (r) => <span className="tabular text-ink-2">{formatNumber(r.onLeave)}</span> },
    {
      key: 'rate',
      header: `MPH · ${formatMonth(month).slice(0, 3)}`,
      width: 170,
      sortValue: (r) => completion.find((c) => c.key === r.u.id)?.completionRate ?? 0,
      cell: (r) => {
        const c = completion.find((x) => x.key === r.u.id);
        return c ? <RateCell rate={c.completionRate} total={c.total} /> : <span className="text-muted">—</span>;
      },
    },
  ];

  const locCount = (l: string) => db.employees.filter((e) => e.location === l && e.status !== 'inactive').length;
  const unitAt = (l: string) => db.units.find((u) => u.location === l);
  const remove = async (l: string) => {
    const ok = await confirm({ title: `Remove ${l}?`, message: 'It will no longer be offered when editing employees.', confirmLabel: 'Remove', tone: 'danger' });
    if (!ok) return;
    const r = removeLocation(l);
    if (!r.ok) return toast.error('Can’t remove location', r.error);
    toast.success('Location removed', l);
  };

  return (
    <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <Card padding="none">
        <CardHeader divider icon={Building2} title="Units" subtitle={`${pluralize(units.length, 'unit')} · headcount excludes people who have left`} />
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.u.id} pageSize={0} dense minWidth={560} initialSort={{ key: 'hc', dir: 'desc' }} />
      </Card>
      <Card padding="none">
        <CardHeader
          divider
          icon={MapPin}
          title="Locations"
          subtitle={`${pluralize(db.locations.length, 'location')} for employee profiles`}
          actions={
            canEditOrg && (
              <Button variant="secondary" size="xs" icon={Plus} onClick={() => setAdding((n) => n + 1)}>
                Add
              </Button>
            )
          }
        />
        <ul className="divide-y divide-line">
          {db.locations.map((l) => {
            const n = locCount(l);
            const unit = unitAt(l);
            const inScope = people.filter((e) => e.location === l).length;
            return (
              <li key={l} className="group flex items-center gap-3 px-5 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">{l}</span>
                  {unit && <span className="block truncate text-xs text-ink-2">{unit.name}</span>}
                </span>
                <span className="text-[13px] font-semibold text-ink tabular">{formatNumber(scoped ? inScope : n)}</span>
                {canEditOrg && (
                  <IconButton
                    icon={Trash2}
                    label={n ? `${pluralize(n, 'person', 'people')} based here` : unit ? `${unit.name} is here` : `Remove ${l}`}
                    size="xs"
                    disabled={n > 0 || !!unit}
                    onClick={() => void remove(l)}
                  />
                )}
              </li>
            );
          })}
        </ul>
        <div className="border-t border-line px-5 py-3">{canEditOrg ? <p className="text-xs text-ink-2">Locations can be removed once nobody is based there.</p> : <ReadOnlyNote scoped={scoped} />}</div>
      </Card>
      {adding > 0 && (
        <TextPromptModal
          key={adding}
          open
          onClose={() => setAdding(0)}
          icon={MapPin}
          title="Add location"
          label="City or site"
          placeholder="e.g. Hyderabad"
          submitLabel="Add location"
          onSubmit={(v) => {
            const r = addLocation(v);
            if (!r.ok) return r.error;
            toast.success('Location added', v.trim());
            return null;
          }}
        />
      )}
    </div>
  );
}

// ───────────────────────── grades ─────────────────────────

export function GradesTab({ db, people }: OrgTabProps) {
  const total = people.length;
  const rows = db.grades.map((g) => {
    const inGrade = people.filter((e) => e.grade === g);
    const levels = (Object.keys(LEVEL_LABELS) as EmployeeLevel[]).map((l) => ({ l, n: inGrade.filter((e) => e.level === l).length })).filter((x) => x.n);
    const designations = [...new Set(inGrade.map((e) => e.designation.split(' – ')[0]))].slice(0, 3);
    return { g, n: inGrade.length, levels, designations };
  });
  const max = Math.max(1, ...rows.map((r) => r.n));
  const columns: Column<(typeof rows)[number]>[] = [
    { key: 'g', header: 'Grade', sortValue: (r) => r.g, cell: (r) => <Link to={`/employees?grade=${r.g}`} className="font-semibold text-ink hover:text-primary">{r.g}</Link> },
    { key: 'n', header: 'Headcount', align: 'right', sortValue: (r) => r.n, cell: (r) => <span className="font-semibold tabular">{formatNumber(r.n)}</span> },
    {
      key: 'share',
      header: 'Share',
      width: 180,
      sortValue: (r) => r.n,
      cell: (r) => (
        <span className="flex items-center gap-2">
          <span className="flex-1">
            <ProgressBar value={r.n} max={max} size="xs" tone="primary" />
          </span>
          <span className="w-9 text-right text-xs text-ink-2 tabular">{total ? formatPercent(r.n / total) : '—'}</span>
        </span>
      ),
    },
    {
      key: 'levels',
      header: 'Level',
      sortable: false,
      cell: (r) => (
        <span className="flex flex-wrap gap-1.5">
          {r.levels.length ? (
            r.levels.map((x) => (
              <Badge key={x.l} tone={x.l === 'executive' ? 'navy' : x.l === 'senior_leader' ? 'mentor' : x.l === 'manager' ? 'primary' : 'neutral'} size="sm">
                {LEVEL_LABELS[x.l]} · {x.n}
              </Badge>
            ))
          ) : (
            <span className="text-muted">—</span>
          )}
        </span>
      ),
    },
    { key: 'roles', header: 'Typical roles', hideBelow: 'lg', sortable: false, cell: (r) => <span className="line-clamp-1 text-ink-2">{r.designations.join(' · ') || '—'}</span> },
  ];
  return (
    <Card padding="none">
      <CardHeader divider icon={Layers} title="Grades" subtitle={`G1 (entry) to G10 (MD) · ${pluralize(total, 'person', 'people')} in scope`} />
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.g} pageSize={0} dense minWidth={640} />
    </Card>
  );
}
