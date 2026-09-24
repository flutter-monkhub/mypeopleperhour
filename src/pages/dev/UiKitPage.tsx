// Dev-only living style guide (/dev/ui-kit, registered only in `npm run dev`).
// Shows every UI-kit component and chart wrapper wired to the real analytics primitives.

import { useMemo, useState } from 'react';
import { CalendarCheck, CalendarX, CircleCheck, Clock, Download, Inbox, Plus, Search, Trash2, Users } from 'lucide-react';
import { MISSED_REASON_LABELS } from '@shared/content/mph';
import { PageHeader } from '@/components/layout';
import { BarChart, Donut, GroupedBar, LineTrend, STATUS_COLORS, StackedBar } from '@/components/charts';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  DataTable,
  DescriptionList,
  Drawer,
  EmptyState,
  FilterBar,
  FilterSelect,
  Input,
  KpiCard,
  Modal,
  PersonCell,
  ProgressBar,
  ProgressRing,
  SearchInput,
  Select,
  Skeleton,
  SkeletonCard,
  StatusBadge,
  Tabs,
  Textarea,
  Toggle,
  confirm,
  toast,
  type Column,
} from '@/components/ui';
import { completionByUnit, completionSummary, missedReasonSplit, monthlyTrend, pairMonthStatuses, type PairStatus } from '@/lib/analytics';
import { downloadCsv } from '@/lib/csv';
import { formatMonth, formatPercent } from '@/lib/format';
import { useMonth, useScopeFilters } from '@/lib/scope';
import { useDb } from '@/store/db';

export default function UiKitPage() {
  const db = useDb();
  const { month, months } = useMonth();
  const filters = useScopeFilters();
  const [tab, setTab] = useState('overview');
  const [q, setQ] = useState('');
  const [unit, setUnit] = useState('');
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(true);

  const summary = completionSummary(db, month, filters);
  const prev = completionSummary(db, months[months.length - 2] ?? month, filters);
  const byUnit = completionByUnit(db, month, filters);
  const trend = monthlyTrend(db, months, filters);
  const reasons = missedReasonSplit(db, months, filters);
  const pairs = useMemo(() => {
    const s = q.trim().toLowerCase();
    return pairMonthStatuses(db, month, { ...filters, unitId: unit || filters.unitId }).filter((p) => !s || p.employee.name.toLowerCase().includes(s) || p.manager?.name.toLowerCase().includes(s));
  }, [db, month, filters, unit, q]);

  const columns: Column<PairStatus>[] = [
    { key: 'employee', header: 'Employee', sortValue: (p) => p.employee.name, cell: (p) => <PersonCell name={p.employee.name} secondary={`${p.employee.code} · ${p.employee.designation}`} /> },
    { key: 'manager', header: 'Manager', sortValue: (p) => p.manager?.name, hideBelow: 'lg' },
    { key: 'dept', header: 'Department', sortValue: (p) => p.employee.department, hideBelow: 'xl' },
    { key: 'status', header: 'Status', sortValue: (p) => p.status, cell: (p) => <StatusBadge status={p.awaitingUpdate ? 'awaiting_update' : p.status} /> },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Developer"
        title="UI kit & charts"
        subtitle={`Every shared component, wired to real analytics for ${formatMonth(month, true)}. Dev builds only.`}
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={() => downloadCsv('pairs', pairs, [{ header: 'Employee', value: (p) => p.employee.name }, { header: 'Status', value: (p) => p.status }])}>
              Export CSV
            </Button>
            <Button icon={Plus} onClick={() => toast.success('Saved', 'Toasts stack bottom-right.')}>
              Primary action
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Completion rate" value={formatPercent(summary.completionRate)} icon={CircleCheck} tone="success" delta={{ value: (summary.completionRate - prev.completionRate) * 100, suffix: ' pts', label: 'vs last month' }} hint={`${summary.completed} of ${summary.total} pairs`} />
        <KpiCard label="Scheduled" value={summary.scheduled} icon={CalendarCheck} tone="primary" to="/sessions" linkLabel="View sessions" />
        <KpiCard label="To be scheduled" value={summary.toBeScheduled} icon={Clock} tone="warning" delta={{ value: summary.toBeScheduled - prev.toBeScheduled, goodWhen: 'down', label: 'vs last month' }} />
        <KpiCard label="Missed" value={summary.missed} icon={CalendarX} tone="danger" toneValue hint="Requires attention" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Completion by unit" subtitle="BarChart · layout vertical · target line" />
          <BarChart data={byUnit.map((u) => ({ unit: u.shortLabel, rate: Math.round(u.completionRate * 100) }))} xKey="unit" yKey="rate" label="Completion" layout="vertical" domain={[0, 100]} valueFormatter={(v) => `${v}%`} showValues target={{ value: 80, label: 'Goal 80%' }} categoryWidth={80} />
        </Card>
        <Card>
          <CardHeader title="Monthly trend" subtitle="LineTrend · area" />
          <LineTrend data={trend.map((t) => ({ m: t.shortLabel, rate: Math.round(t.completionRate * 100) }))} xKey="m" series={[{ key: 'rate', label: 'Completion %' }]} domain={[0, 100]} valueFormatter={(v) => `${v}%`} />
        </Card>
        <Card>
          <CardHeader title="Scheduled vs completed" subtitle="GroupedBar" />
          <GroupedBar
            data={trend.map((t) => ({ m: t.shortLabel, scheduled: t.scheduled + t.completed, completed: t.completed }))}
            xKey="m"
            series={[
              { key: 'scheduled', label: 'Scheduled', color: STATUS_COLORS.scheduled },
              { key: 'completed', label: 'Completed', color: STATUS_COLORS.completed },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Status mix by unit" subtitle="StackedBar · percent" />
          <StackedBar
            data={byUnit.map((u) => ({ unit: u.shortLabel, completed: u.completed, scheduled: u.scheduled, tbs: u.toBeScheduled, missed: u.missed }))}
            xKey="unit"
            percent
            series={[
              { key: 'completed', label: 'Completed', color: STATUS_COLORS.completed },
              { key: 'scheduled', label: 'Scheduled', color: STATUS_COLORS.scheduled },
              { key: 'tbs', label: 'To be scheduled', color: STATUS_COLORS.to_be_scheduled },
              { key: 'missed', label: 'Missed', color: STATUS_COLORS.missed },
            ]}
          />
        </Card>
        <Card>
          <CardHeader title="Missed reasons" subtitle="Donut · since launch" />
          <Donut
            data={[
              { name: MISSED_REASON_LABELS.business_emergency, value: reasons.business_emergency, color: '#2F56E8' },
              { name: MISSED_REASON_LABELS.personal_emergency, value: reasons.personal_emergency, color: '#EB6834' },
            ]}
            center={
              <div>
                <p className="text-2xl font-bold text-ink tabular">{reasons.total}</p>
                <p className="text-xs text-ink-2">missed</p>
              </div>
            }
          />
        </Card>
        <Card>
          <CardHeader title="Progress" subtitle="ProgressRing · ProgressBar" />
          <div className="flex flex-wrap items-center gap-8">
            <ProgressRing value={summary.completionRate * 100} tone="primary">
              <div>
                <p className="text-2xl font-bold text-ink tabular">{formatPercent(summary.completionRate)}</p>
                <p className="text-xs text-ink-2">Completed</p>
              </div>
            </ProgressRing>
            <div className="flex min-w-60 flex-1 flex-col gap-4">
              {byUnit.slice(0, 4).map((u) => (
                <ProgressBar key={u.key} label={u.label} value={u.completed} max={u.total} valueLabel={`${u.completed} of ${u.total}`} tone={u.completionRate >= 0.8 ? 'success' : u.completionRate >= 0.6 ? 'primary' : 'warning'} />
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <FilterBar activeCount={(unit ? 1 : 0) + (q ? 1 : 0)} onReset={() => (setUnit(''), setQ(''))} actions={<SearchInput value={q} onChange={setQ} placeholder="Search employee or manager" size="sm" />}>
          <FilterSelect label="Unit" value={unit} onChange={setUnit} allLabel="All units" options={db.units.map((u) => ({ value: u.id, label: u.name }))} />
          <FilterSelect label="Status" value="" onChange={() => {}} allLabel="Any" options={[{ value: 'completed', label: 'Completed' }]} />
        </FilterBar>
        <Card padding="none" className="mt-4">
          <CardHeader divider title="Pairs this month" subtitle="DataTable · sortable, paginated, row click" actions={<Badge tone="primary">{pairs.length} pairs</Badge>} />
          <DataTable columns={columns} rows={pairs} rowKey={(p) => p.employeeId} onRowClick={(p) => toast.info(p.employee.name, p.status)} initialSort={{ key: 'employee', dir: 'asc' }} />
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Buttons & badges" />
          <div className="flex flex-wrap gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline" icon={CalendarCheck}>
              Outline
            </Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger" icon={Trash2} onClick={() => void confirm({ title: 'Delete this?', message: 'ConfirmDialog via confirm()', tone: 'danger', confirmLabel: 'Delete' })}>
              Danger
            </Button>
            <Button variant="mentor">Mentor</Button>
            <Button loading>Saving</Button>
            <Button variant="link">Link →</Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(['completed', 'scheduled', 'to_be_scheduled', 'missed', 'awaiting_update', 'cancelled'] as const).map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
            <StatusBadge status="under_review" kind="application" />
            <StatusBadge status="shortlisted" kind="application" />
            <StatusBadge status="proposed" kind="match" />
            <StatusBadge status="published" kind="survey" />
            <StatusBadge status="draft" kind="survey" />
          </div>
          <div className="mt-4 flex items-center gap-2">
            {['Aarav Sharma', 'Priya Mehta', 'Anjali Deshmukh', 'Riya Das'].map((n) => (
              <Avatar key={n} name={n} />
            ))}
            <Button variant="secondary" size="sm" onClick={() => setModal(true)}>
              Open modal
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDrawer(true)}>
              Open drawer
            </Button>
          </div>
        </Card>
        <Card>
          <CardHeader title="Form controls" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Name" placeholder="Type…" icon={Search} hint="Hint text" />
            <Input label="With error" defaultValue="bad" error="This field is required" />
            <Select label="Unit" placeholder="All units" options={db.units.map((u) => ({ value: u.id, label: u.name }))} />
            <div className="flex flex-col justify-end gap-3">
              <Toggle checked={on} onChange={setOn} label="Add to Outlook" description="Invite both people" />
              <Checkbox checked={checked} onChange={setChecked} label="Anonymous survey" />
            </div>
            <Textarea label="Notes" maxLength={250} value="" onChange={() => {}} containerClassName="sm:col-span-2" rows={2} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Tabs" />
          <Tabs value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'scheduled', label: 'Scheduled', count: summary.scheduled }, { id: 'missed', label: 'Missed', count: summary.missed }]} />
          <Tabs className="mt-4" variant="pills" value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Overview' }, { id: 'scheduled', label: 'Scheduled' }, { id: 'missed', label: 'Missed' }]} />
          <Tabs className="mt-4" variant="segmented" value={tab} onChange={setTab} tabs={[{ id: 'overview', label: 'Month' }, { id: 'scheduled', label: 'Quarter' }, { id: 'missed', label: 'Year' }]} />
        </Card>
        <Card>
          <CardHeader title="Empty & loading" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <EmptyState size="sm" bordered icon={Inbox} title="No sessions" message="Nothing scheduled yet." />
            <div className="flex flex-col gap-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-56" />
              <SkeletonCard lines={2} />
            </div>
          </div>
        </Card>
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Modal title" description="Supporting text" icon={Users} footer={<Button onClick={() => setModal(false)}>Done</Button>}>
        <DescriptionList items={[{ label: 'Unit', value: 'Durgapur Plant' }, { label: 'Pairs', value: summary.total }]} />
      </Modal>
      <Drawer open={drawer} onClose={() => setDrawer(false)} title="Drawer" subtitle="Right side sheet" footer={<Button onClick={() => setDrawer(false)}>Close</Button>}>
        <p className="text-sm text-ink-2">Use for details and edit forms.</p>
      </Drawer>
    </>
  );
}
