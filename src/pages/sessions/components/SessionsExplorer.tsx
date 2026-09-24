import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BellRing, CalendarClock, CalendarX, CircleCheck, Download, Inbox, MapPin, NotebookPen, Star, TriangleAlert, Video } from 'lucide-react';
import type { DemoDatabase, MonthKey } from '@shared/types';
import { MISSED_REASON_LABELS } from '@shared/content/mph';
import { formatDayShort, formatMonth, formatTime, relativeDay } from '@shared/utils/dates';
import { Badge, Button, Card, DataTable, FilterBar, FilterSelect, PersonCell, SearchInput, StatusBadge, Tabs, toast, type Column, type TabItem } from '@/components/ui';
import { programmeMonths } from '@/lib/analytics';
import { employeeTimeline } from '@/lib/analytics-outcomes';
import { cn } from '@/lib/cn';
import { csvFilename, downloadCsv } from '@/lib/csv';
import { formatNumber } from '@/lib/format';
import { employeeMap, reportsByManager, unitName } from '@/lib/lookup';
import { useCan } from '@/lib/rbac';
import { useScopeFilters } from '@/lib/scope';
import { useDb } from '@/store/db';
import { SessionDrawer, type DrawerTarget } from './SessionDrawer';
import { buildSessionRows, inTab, MODE_LABELS, SESSION_TABS, sessionCsvColumns, TAB_LABELS, tabSort, type SessionRow, type SessionTab } from './sessionRows';

function DateCell({ r }: { r: SessionRow }) {
  if (!r.session) return <span className="text-muted">Not booked</span>;
  return (
    <span className="block leading-tight">
      <span className="block font-medium text-ink">{formatDayShort(r.session.start)}</span>
      <span className="block text-xs text-ink-2">{formatTime(r.session.start)}</span>
    </span>
  );
}

function ModeCell({ r }: { r: SessionRow }) {
  if (!r.session) return <span className="text-muted">—</span>;
  const Icon = r.session.mode === 'teams' ? Video : MapPin;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-ink-2">
      <Icon className={cn('size-3.5', r.session.mode === 'teams' ? 'text-primary' : 'text-ink-2')} />
      {MODE_LABELS[r.session.mode]}
    </span>
  );
}

function PrevMonthCell({ db, r }: { db: DemoDatabase; r: SessionRow }) {
  const months = programmeMonths(db);
  const i = months.indexOf(r.month);
  if (i <= 0) return <span className="text-muted">—</span>;
  const prev = employeeTimeline(db, r.employee, [months[i - 1]])[0];
  return prev.status === 'not_eligible' ? <span className="text-muted">—</span> : <StatusBadge status={prev.status} size="sm" />;
}

export interface SessionsExplorerProps {
  month: MonthKey;
  /** Archive drill-down: no admin actions */
  readOnly?: boolean;
}

/**
 * A17–A20: tabs (All · Scheduled · Completed · Missed · To be scheduled · Awaiting update) with counts,
 * search + function/department/manager/mode filters, the session table and the detail drawer.
 * Tab and filters live in the URL (?tab=&q=&fn=&dept=&manager=&mode=) so dashboard links land here.
 */
export function SessionsExplorer({ month, readOnly }: SessionsExplorerProps) {
  const db = useDb();
  const [params, setParams] = useSearchParams();
  const canExport = useCan('reports.export');
  const [target, setTarget] = useState<DrawerTarget | null>(null);

  const get = (k: string) => params.get(k) ?? '';
  const setParam = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    setParams(p, { replace: true });
  };

  const tab: SessionTab = (SESSION_TABS as readonly string[]).includes(get('tab')) ? (get('tab') as SessionTab) : 'all';
  const q = get('q');
  const fnId = db.functions.some((f) => f.id === get('fn')) ? get('fn') : '';
  const deptOptions = fnId ? (db.functions.find((f) => f.id === fnId)?.departments ?? []) : db.functions.flatMap((f) => f.departments);
  const dept = deptOptions.includes(get('dept')) ? get('dept') : '';
  const managerId = get('manager');
  const mode = get('mode') === 'teams' || get('mode') === 'in_person' ? get('mode') : '';

  const filters = useScopeFilters({ functionId: fnId || null, department: dept || null, managerId: managerId || null });
  const scopeOnly = useScopeFilters();
  const allRows = useMemo(() => buildSessionRows(db, month, filters), [db, month, filters]);

  // managers that have reports in scope (for the manager filter)
  const managerOptions = useMemo(() => {
    const emp = employeeMap(db);
    const ids = new Set<string>();
    for (const [mid, reports] of reportsByManager(db)) if (reports.some((e) => !scopeOnly.unitId || e.unitId === scopeOnly.unitId)) ids.add(mid);
    return [...ids]
      .map((id) => emp.get(id))
      .filter((e) => !!e)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => ({ value: e.id, label: e.name }));
  }, [db, scopeOnly.unitId]);

  const searched = useMemo(() => {
    const s = q.trim().toLowerCase();
    return allRows.filter((r) => {
      if (mode && r.session?.mode !== mode) return false;
      if (!s) return true;
      return r.employee.name.toLowerCase().includes(s) || r.employee.code.toLowerCase().includes(s) || !!r.manager?.name.toLowerCase().includes(s);
    });
  }, [allRows, q, mode]);

  const counts = useMemo(() => Object.fromEntries(SESSION_TABS.map((t) => [t, searched.filter((r) => inTab(r, t)).length])) as Record<SessionTab, number>, [searched]);
  const rows = useMemo(() => searched.filter((r) => inTab(r, tab)), [searched, tab]);

  const activeCount = [fnId, dept, managerId, mode, q].filter(Boolean).length;
  const reset = () => setParam({ fn: '', dept: '', manager: '', mode: '', q: '' });

  const tabs: TabItem<SessionTab>[] = SESSION_TABS.map((t) => ({ id: t, label: TAB_LABELS[t], count: counts[t] }));

  const exportCsv = () => {
    downloadCsv(csvFilename(`mph-sessions-${month}-${tab.replace(/_/g, '-')}`), rows, sessionCsvColumns(db));
    toast.success('CSV exported', `${formatNumber(rows.length)} rows · ${TAB_LABELS[tab]} · ${formatMonth(month)}`);
  };

  // ── columns per tab ──
  const col = {
    employee: {
      key: 'employee',
      header: 'Employee',
      sortValue: (r) => r.employee.name,
      cell: (r) => <PersonCell name={r.employee.name} secondary={`${r.employee.code} · ${r.employee.designation}`} className="max-w-[220px] xl:max-w-[260px]" />,
    },
    manager: { key: 'manager', header: 'Manager', sortValue: (r) => r.manager?.name ?? '', cell: (r) => <span className="whitespace-nowrap text-ink">{r.manager?.name ?? '—'}</span> },
    unit: { key: 'unit', header: 'Unit', hideBelow: 'xl', sortValue: (r) => unitName(db, r.employee.unitId, true), cell: (r) => <span className="text-ink-2">{unitName(db, r.employee.unitId, true)}</span> },
    dept: { key: 'dept', header: 'Department', hideBelow: 'lg', sortValue: (r) => r.employee.department, cell: (r) => <span className="text-ink-2">{r.employee.department}</span> },
    date: { key: 'date', header: 'Date & time', sortValue: (r) => r.session?.start ?? '', cell: (r) => <DateCell r={r} /> },
    mode: { key: 'mode', header: 'Mode', hideBelow: 'xl', sortValue: (r) => r.session?.mode ?? '', cell: (r) => <ModeCell r={r} /> },
    status: {
      key: 'status',
      header: 'Status',
      sortValue: (r) => r.status,
      cell: (r) => <StatusBadge status={r.status} kind="session" size="sm" label={r.status === 'to_be_scheduled' ? 'To be scheduled' : undefined} />,
    },
    statusReason: {
      key: 'status',
      header: 'Status',
      sortValue: (r) => r.status,
      cell: (r) => (
        <span className="flex flex-col items-start gap-0.5">
          <StatusBadge status={r.status} kind="session" size="sm" label={r.status === 'to_be_scheduled' ? 'To be scheduled' : undefined} />
          {r.session?.missedReason && <span className="pl-0.5 text-[11px] whitespace-nowrap text-ink-2">{MISSED_REASON_LABELS[r.session.missedReason]}</span>}
        </span>
      ),
    },
    calendar: {
      key: 'calendar',
      header: 'Calendar',
      hideBelow: 'xl',
      sortValue: (r) => (r.session ? r.session.calendarSynced : null),
      cell: (r) =>
        !r.session ? (
          <span className="text-muted">—</span>
        ) : r.session.calendarSynced ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <CircleCheck className="size-3.5" /> Synced
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-warning">
            <TriangleAlert className="size-3.5" /> Not synced
          </span>
        ),
    },
    reason: {
      key: 'reason',
      header: 'Missed reason',
      hideBelow: 'lg',
      sortValue: (r) => r.session?.missedReason ?? '',
      cell: (r) =>
        r.session?.missedReason ? (
          <Badge tone="outline" size="sm">
            {MISSED_REASON_LABELS[r.session.missedReason]}
          </Badge>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    remark: { key: 'remark', header: 'Remark', hideBelow: 'xl', sortValue: (r) => r.session?.missedRemark ?? '', cell: (r) => <span className="line-clamp-2 text-ink-2">{r.session?.missedRemark ?? '—'}</span> },
    rating: {
      key: 'rating',
      header: 'Rating',
      align: 'right',
      hideBelow: 'xl',
      sortValue: (r) => r.session?.employeeRating ?? null,
      cell: (r) =>
        r.session?.employeeRating ? (
          <span className="inline-flex items-center gap-1 font-semibold text-ink tabular">
            <Star className="size-3.5 fill-[#F5B400] text-[#F5B400]" />
            {r.session.employeeRating}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    notes: {
      key: 'notes',
      header: 'Notes',
      hideBelow: 'lg',
      sortValue: (r) => r.notes,
      cell: (r) =>
        r.session?.status === 'completed' ? (
          r.notes ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-success" title="Manager captured notes (content is private)">
              <NotebookPen className="size-3.5" /> Captured
            </span>
          ) : (
            <span className="text-xs text-muted">None</span>
          )
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    overdue: {
      key: 'overdue',
      header: 'Ended',
      sortValue: (r) => r.session?.end ?? '',
      cell: (r) => (r.session ? <span className="font-medium text-warning">{relativeDay(r.session.end)}</span> : '—'),
    },
    prev: { key: 'prev', header: 'Last month', hideBelow: 'md', sortable: false, cell: (r) => <PrevMonthCell db={db} r={r} /> },
  } satisfies Record<string, Column<SessionRow>>;

  const columns: Column<SessionRow>[] =
    tab === 'all'
      ? [col.employee, col.manager, col.unit, col.date, col.mode, col.statusReason, col.rating]
      : tab === 'scheduled'
        ? [col.employee, col.manager, col.unit, col.date, col.mode, col.status, col.calendar]
        : tab === 'completed'
          ? [col.employee, col.manager, col.unit, col.date, col.mode, col.notes, { ...col.rating, hideBelow: undefined }]
          : tab === 'missed'
            ? [col.employee, col.manager, col.unit, col.date, col.reason, col.remark, col.status]
            : tab === 'to_be_scheduled'
              ? [col.employee, col.manager, col.unit, col.dept, col.prev, col.status]
              : [col.employee, col.manager, col.unit, col.date, col.overdue, col.status];

  const empty: Record<SessionTab, { title: string; message: string; icon: typeof Inbox }> = {
    all: { title: 'No sessions', message: 'Nothing matches these filters for this month.', icon: Inbox },
    scheduled: { title: 'Nothing scheduled', message: 'No upcoming sessions match these filters.', icon: CalendarClock },
    completed: { title: 'No completed sessions yet', message: 'Completed conversations appear here as managers mark them.', icon: CircleCheck },
    missed: { title: 'No missed sessions', message: 'Every booked hour so far has happened or is still ahead.', icon: CircleCheck },
    to_be_scheduled: { title: 'Every pair is booked', message: 'All manager ↔ report pairs have a session this month.', icon: CircleCheck },
    awaiting: { title: 'Nothing awaiting an update', message: 'Managers have marked every past session completed or missed.', icon: CircleCheck },
  };

  const managerName = managerId ? employeeMap(db).get(managerId)?.name : undefined;

  return (
    <>
      <FilterBar
        activeCount={activeCount}
        onReset={reset}
        actions={
          <>
            <SearchInput value={q} onChange={(v) => setParam({ q: v })} placeholder="Search employee, code or manager" size="sm" />
            {canExport && (
              <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv} disabled={!rows.length}>
                Export CSV
              </Button>
            )}
          </>
        }
      >
        <FilterSelect
          label="Function"
          value={fnId}
          allLabel="All"
          onChange={(v) => setParam({ fn: v, dept: v && dept && !db.functions.find((f) => f.id === v)?.departments.includes(dept) ? '' : dept })}
          options={db.functions.map((f) => ({ value: f.id, label: f.name }))}
        />
        <FilterSelect label="Department" value={dept} allLabel="All" onChange={(v) => setParam({ dept: v })} options={deptOptions.map((d) => ({ value: d, label: d }))} />
        <FilterSelect label="Manager" value={managerId} allLabel="All" onChange={(v) => setParam({ manager: v })} options={managerName && !managerOptions.some((o) => o.value === managerId) ? [{ value: managerId, label: managerName }, ...managerOptions] : managerOptions} />
        <FilterSelect
          label="Mode"
          value={mode}
          allLabel="Any"
          onChange={(v) => setParam({ mode: v })}
          options={[
            { value: 'teams', label: 'Teams' },
            { value: 'in_person', label: 'In person' },
          ]}
        />
      </FilterBar>

      <Card padding="none" className="mt-4">
        <div className="px-5 pt-3">
          <Tabs<SessionTab> tabs={tabs} value={tab} onChange={(t) => setParam({ tab: t === 'all' ? '' : t })} />
        </div>
        {!readOnly && tab === 'to_be_scheduled' && counts.to_be_scheduled > 0 && (
          <p className="flex items-center gap-2 border-b border-line bg-warning-soft/50 px-5 py-2.5 text-[13px] text-[#9A5200]">
            <BellRing className="size-4 shrink-0" />
            These pairs have no session in {formatMonth(month)}. Open a pair to nudge the manager — scheduling stays with them.
          </p>
        )}
        {tab === 'missed' && counts.missed > 0 && (
          <p className="flex items-center gap-2 border-b border-line bg-danger-soft/40 px-5 py-2.5 text-[13px] text-danger">
            <CalendarX className="size-4 shrink-0" />
            Missed sessions can be re-booked within the month — the pair then shows as Scheduled.
          </p>
        )}
        <DataTable
          key={tab}
          columns={columns}
          rows={rows}
          rowKey={(r) => r.key}
          onRowClick={(r) => setTarget(r.session ? { kind: 'session', id: r.session.id } : { kind: 'pair', employeeId: r.employee.id, month })}
          initialSort={tabSort(tab)}
          pageSize={25}
          pageSizeOptions={[25, 50, 100]}
          dense
          minWidth={680}
          selectedKey={target ? (target.kind === 'session' ? target.id : `pair:${target.employeeId}`) : null}
          emptyTitle={empty[tab].title}
          emptyMessage={activeCount ? 'Try clearing the search or filters.' : empty[tab].message}
          emptyIcon={empty[tab].icon}
          emptyAction={
            activeCount ? (
              <Button variant="secondary" size="sm" onClick={reset}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      </Card>
      <SessionDrawer target={target} onClose={() => setTarget(null)} readOnly={readOnly} />
    </>
  );
}
