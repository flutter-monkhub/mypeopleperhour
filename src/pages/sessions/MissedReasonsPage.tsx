// Missed reasons (SPEC §6.2 A21): why MyPeopleHour sessions were missed — reason split, by unit
// (or department inside a unit), by month, top managers and the remarks log. The range ends at the
// global month: last 3 / last 6 months / since launch (?range=3|6|all).

import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, CalendarRange, CalendarX, Download, MessageSquareText, PieChart, Repeat2, RotateCcw, UserRound } from 'lucide-react';
import type { MissedReason } from '@shared/types';
import { MISSED_REASON_LABELS } from '@shared/content/mph';
import { formatDate, formatMonth } from '@shared/utils/dates';
import { Donut, StackedBar } from '@/components/charts';
import { PageHeader } from '@/components/layout';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  FilterBar,
  FilterSelect,
  KpiCard,
  PersonCell,
  SearchInput,
  SkeletonCard,
  Tabs,
  toast,
  type Column,
} from '@/components/ui';
import { describeFilters, missedFlags } from '@/lib/analytics';
import { missedRecords, monthSpanLabel, type MissedRecord } from '@/lib/analytics-outcomes';
import { csvFilename, downloadCsv } from '@/lib/csv';
import { formatNumber, formatPercent, pluralize } from '@/lib/format';
import { unitName } from '@/lib/lookup';
import { useCan } from '@/lib/rbac';
import { useMonth, useScopeFilters } from '@/lib/scope';
import { useDb } from '@/store/db';
import { useWarmup } from '@/pages/dashboard/components/useWarmup';
import { REASON_COLORS } from '@/pages/dashboard/components/MissedIndicators';

type Range = '3' | '6' | 'all';
const REASON_SERIES = [
  { key: 'business', label: MISSED_REASON_LABELS.business_emergency, color: REASON_COLORS.business_emergency },
  { key: 'personal', label: MISSED_REASON_LABELS.personal_emergency, color: REASON_COLORS.personal_emergency },
];

const tally = (list: MissedRecord[]) => ({
  total: list.length,
  business: list.filter((r) => r.reason === 'business_emergency').length,
  personal: list.filter((r) => r.reason === 'personal_emergency').length,
  unspecified: list.filter((r) => r.reason === 'unspecified').length,
});

export default function MissedReasonsPage() {
  const db = useDb();
  const navigate = useNavigate();
  const ready = useWarmup('missed-reasons', 320);
  const [params, setParams] = useSearchParams();
  const { month, months } = useMonth();
  const canExport = useCan('reports.export');
  const canViewEmployees = useCan('employees.view');

  const get = (k: string) => params.get(k) ?? '';
  const setParam = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    setParams(p, { replace: true });
  };
  const range: Range = get('range') === '6' ? '6' : get('range') === 'all' ? 'all' : '3';
  const fnId = db.functions.some((f) => f.id === get('fn')) ? get('fn') : '';
  const reasonFilter = (['business_emergency', 'personal_emergency'] as string[]).includes(get('reason')) ? (get('reason') as MissedReason) : '';
  const q = get('q');

  const filters = useScopeFilters({ functionId: fnId || null });
  const monthIdx = months.indexOf(month);
  const rangeMonths = useMemo(() => {
    const upto = months.slice(0, monthIdx + 1);
    return range === 'all' ? upto : upto.slice(-Number(range));
  }, [months, monthIdx, range]);

  const records = missedRecords(db, rangeMonths, filters);
  const t = tally(records);
  const recovered = records.filter((r) => r.recovered).length;
  const flags = missedFlags(db, month, filters);
  const byDept = !!filters.unitId;

  const byMonth = rangeMonths.map((m) => {
    const x = tally(records.filter((r) => r.session.month === m));
    return { m: formatMonth(m).slice(0, 3), business: x.business, personal: x.personal };
  });
  const byGroup = (() => {
    const map = new Map<string, MissedRecord[]>();
    for (const r of records) {
      const k = byDept ? r.employee.department : r.employee.unitId;
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()]
      .map(([k, list]) => ({ key: k, label: byDept ? k : unitName(db, k, true), ...tally(list) }))
      .sort((a, b) => b.total - a.total);
  })();
  const byManager = (() => {
    const map = new Map<string, MissedRecord[]>();
    for (const r of records) map.set(r.session.managerId, [...(map.get(r.session.managerId) ?? []), r]);
    return [...map.entries()]
      .map(([id, list]) => ({ id, manager: list[0].manager, ...tally(list), reports: new Set(list.map((r) => r.employee.id)).size }))
      .sort((a, b) => b.total - a.total || (a.manager?.name ?? '').localeCompare(b.manager?.name ?? ''))
      .slice(0, 7);
  })();
  const maxManager = Math.max(1, ...byManager.map((m) => m.total));

  const remarks = (() => {
    const s = q.trim().toLowerCase();
    return records.filter(
      (r) =>
        (!reasonFilter || r.reason === reasonFilter) &&
        (!s || r.employee.name.toLowerCase().includes(s) || !!r.manager?.name.toLowerCase().includes(s) || (r.session.missedRemark ?? '').toLowerCase().includes(s)),
    );
  })();

  const exportCsv = () => {
    downloadCsv(csvFilename(`mph-missed-${rangeMonths[0]}-to-${rangeMonths[rangeMonths.length - 1]}`), remarks, [
      { header: 'Month', value: (r) => r.session.month },
      { header: 'Session date', value: (r) => formatDate(r.session.start) },
      { header: 'Employee code', value: (r) => r.employee.code },
      { header: 'Employee', value: (r) => r.employee.name },
      { header: 'Manager', value: (r) => r.manager?.name ?? '' },
      { header: 'Unit', value: (r) => unitName(db, r.employee.unitId) },
      { header: 'Department', value: (r) => r.employee.department },
      { header: 'Reason', value: (r) => (r.reason === 'unspecified' ? 'Not given' : MISSED_REASON_LABELS[r.reason]) },
      { header: 'Remark', value: (r) => r.session.missedRemark ?? '' },
      { header: 'Re-booked in month', value: (r) => r.recovered },
    ]);
    toast.success('CSV exported', `${pluralize(remarks.length, 'missed session')} · ${monthSpanLabel(rangeMonths)}`);
  };

  const columns: Column<MissedRecord>[] = [
    { key: 'date', header: 'Session', sortValue: (r) => r.session.start, cell: (r) => <span className="whitespace-nowrap text-ink">{formatDate(r.session.start)}</span> },
    { key: 'employee', header: 'Employee', sortValue: (r) => r.employee.name, cell: (r) => <PersonCell name={r.employee.name} secondary={r.employee.designation} className="max-w-[220px]" /> },
    { key: 'manager', header: 'Manager', sortValue: (r) => r.manager?.name ?? '', cell: (r) => <span className="whitespace-nowrap">{r.manager?.name ?? '—'}</span> },
    { key: 'unit', header: 'Unit', hideBelow: 'xl', sortValue: (r) => unitName(db, r.employee.unitId, true), cell: (r) => <span className="text-ink-2">{unitName(db, r.employee.unitId, true)}</span> },
    {
      key: 'reason',
      header: 'Reason',
      sortValue: (r) => r.reason,
      cell: (r) =>
        r.reason === 'unspecified' ? (
          <Badge tone="neutral" size="sm">
            Not given
          </Badge>
        ) : (
          <Badge tone={r.reason === 'business_emergency' ? 'primary' : 'warning'} size="sm">
            {MISSED_REASON_LABELS[r.reason]}
          </Badge>
        ),
    },
    { key: 'remark', header: 'Remark', sortValue: (r) => r.session.missedRemark ?? '', cell: (r) => <span className="line-clamp-2 min-w-40 text-ink-2">{r.session.missedRemark ?? <span className="text-muted">—</span>}</span> },
    {
      key: 'recovered',
      header: 'Re-booked',
      hideBelow: 'lg',
      sortValue: (r) => r.recovered,
      cell: (r) =>
        r.recovered ? (
          <Badge tone="success" size="sm" dot>
            Yes
          </Badge>
        ) : (
          <span className="text-xs text-muted">No</span>
        ),
    },
  ];

  const scopeLabel = describeFilters(db, filters);
  const activeCount = [fnId, reasonFilter, q].filter(Boolean).length;

  return (
    <>
      <PageHeader
        eyebrow="MyPeopleHour"
        title="Missed reasons"
        subtitle={`Why conversations didn’t happen — ${scopeLabel} · ${monthSpanLabel(rangeMonths)}. The deck allows rescheduling only for genuine business or personal emergencies.`}
        actions={
          canExport && (
            <Button variant="secondary" icon={Download} onClick={exportCsv} disabled={!remarks.length}>
              Export CSV
            </Button>
          )
        }
      />
      <FilterBar
        className="mb-6"
        activeCount={activeCount}
        onReset={() => setParam({ fn: '', reason: '', q: '' })}
        actions={
          <Tabs<Range>
            variant="segmented"
            value={range}
            onChange={(r) => setParam({ range: r === '3' ? '' : r })}
            tabs={[
              { id: '3', label: 'Last 3 months' },
              { id: '6', label: 'Last 6 months' },
              { id: 'all', label: 'Since launch' },
            ]}
          />
        }
      >
        <FilterSelect label="Function" value={fnId} allLabel="All" onChange={(v) => setParam({ fn: v })} options={db.functions.map((f) => ({ value: f.id, label: f.name }))} />
        <FilterSelect
          label="Reason"
          value={reasonFilter}
          allLabel="Any"
          onChange={(v) => setParam({ reason: v })}
          options={(Object.keys(MISSED_REASON_LABELS) as MissedReason[]).map((r) => ({ value: r, label: MISSED_REASON_LABELS[r] }))}
        />
      </FilterBar>

      {!ready ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} lines={1} />
          ))}
          <SkeletonCard className="sm:col-span-2" lines={6} />
          <SkeletonCard className="sm:col-span-2" lines={6} />
        </div>
      ) : !t.total ? (
        <Card padding="none">
          <EmptyState
            size="lg"
            icon={CalendarX}
            title="No missed sessions in this range"
            message={`Nothing was marked missed for ${scopeLabel} in ${monthSpanLabel(rangeMonths)}.`}
            action={
              activeCount || range !== 'all' ? (
                <Button variant="secondary" icon={RotateCcw} onClick={() => setParam({ fn: '', reason: '', q: '', range: 'all' })}>
                  Widen to since launch
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Missed sessions" value={formatNumber(t.total)} icon={CalendarX} tone="danger" hint={monthSpanLabel(rangeMonths)} />
            <KpiCard
              label="Business emergency"
              value={t.total ? formatPercent(t.business / t.total) : '—'}
              icon={Building2}
              tone="primary"
              hint={`${formatNumber(t.business)} sessions`}
            />
            <KpiCard label="Personal emergency" value={t.total ? formatPercent(t.personal / t.total) : '—'} icon={UserRound} tone="warning" hint={`${formatNumber(t.personal)} sessions`} />
            <KpiCard
              label="Re-booked in month"
              value={t.total ? formatPercent(recovered / t.total) : '—'}
              icon={Repeat2}
              tone="success"
              hint={`${formatNumber(recovered)} of ${formatNumber(t.total)} · ${pluralize(flags.managers.length, 'repeat-miss manager')}`}
            />
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <Card>
              <CardHeader icon={PieChart} iconTone="warning" title="Reason split" subtitle={monthSpanLabel(rangeMonths)} />
              <Donut
                data={[
                  { name: MISSED_REASON_LABELS.business_emergency, value: t.business, color: REASON_COLORS.business_emergency },
                  { name: MISSED_REASON_LABELS.personal_emergency, value: t.personal, color: REASON_COLORS.personal_emergency },
                  ...(t.unspecified ? [{ name: 'Not given', value: t.unspecified, color: REASON_COLORS.unspecified }] : []),
                ]}
                size={176}
                center={
                  <div>
                    <p className="text-2xl leading-7 font-bold text-ink">{formatNumber(t.total)}</p>
                    <p className="text-xs text-ink-2">missed</p>
                  </div>
                }
              />
            </Card>
            <Card>
              <CardHeader icon={CalendarRange} title="By month" subtitle="Missed sessions per month, by reason" />
              <StackedBar data={byMonth} xKey="m" series={REASON_SERIES} height={220} valueFormatter={(v) => formatNumber(v)} />
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <Card>
              <CardHeader icon={Building2} title={byDept ? 'By department' : 'By unit'} subtitle={byDept ? `${scopeLabel} · departments with misses` : 'Where misses happen, by reason'} />
              <StackedBar
                data={byGroup.map((g) => ({ g: g.label.length > 16 ? `${g.label.slice(0, 15)}…` : g.label, business: g.business, personal: g.personal }))}
                xKey="g"
                layout="vertical"
                categoryWidth={byDept ? 130 : 84}
                series={REASON_SERIES}
                height={Math.max(360, byGroup.length * 36 + 60)}
                valueFormatter={(v) => formatNumber(v)}
              />
            </Card>
            <Card padding="none">
              <CardHeader divider icon={UserRound} iconTone="danger" title="Top managers by missed sessions" subtitle={monthSpanLabel(rangeMonths)} />
              <ul className="divide-y divide-line">
                {byManager.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      disabled={!canViewEmployees}
                      onClick={() => navigate(`/employees/${m.id}`)}
                      className="flex w-full items-center gap-3 px-5 py-2.5 text-left enabled:hover:bg-[#F8FAFE]"
                    >
                      <Avatar name={m.manager?.name ?? m.id} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-medium text-ink">{m.manager?.name ?? m.id}</span>
                          <span className="shrink-0 text-[13px] font-semibold text-ink tabular">{m.total}</span>
                        </span>
                        <span className="mt-1 flex h-1.5 gap-0.5 overflow-hidden rounded-full bg-[#EDF0F6]" title={`${m.business} business · ${m.personal} personal`}>
                          <span style={{ width: `${(m.business / maxManager) * 100}%`, background: REASON_COLORS.business_emergency }} />
                          <span style={{ width: `${(m.personal / maxManager) * 100}%`, background: REASON_COLORS.personal_emergency }} />
                        </span>
                        <span className="mt-1 block truncate text-xs text-ink-2">
                          {m.manager ? `${unitName(db, m.manager.unitId, true)} · ` : ''}
                          {pluralize(m.reports, 'report')} affected
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card padding="none" className="mt-6">
            <CardHeader
              divider
              icon={MessageSquareText}
              title="Remarks log"
              subtitle="Remarks managers added when marking a session missed"
              actions={<SearchInput value={q} onChange={(v) => setParam({ q: v })} placeholder="Search name or remark" size="sm" />}
            />
            <DataTable
              columns={columns}
              rows={remarks}
              rowKey={(r) => r.session.id}
              initialSort={{ key: 'date', dir: 'desc' }}
              pageSize={10}
              dense
              minWidth={760}
              onRowClick={canViewEmployees ? (r) => navigate(`/employees/${r.employee.id}`) : undefined}
              emptyTitle="No remarks match"
              emptyIcon={MessageSquareText}
            />
          </Card>
        </>
      )}
    </>
  );
}
