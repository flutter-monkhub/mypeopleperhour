// Session archive (SPEC §6.2 A22): month-by-month history since launch. Past months are "closed".
// `?month=YYYY-MM` drills into one month and reuses the Sessions table read-only.

import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Archive, CalendarCheck, CalendarClock, CalendarX, CircleCheck, Download, Lock, Star } from 'lucide-react';
import type { DemoDatabase, MonthKey } from '@shared/types';
import { formatMonth } from '@shared/utils/dates';
import { PageHeader } from '@/components/layout';
import { Badge, Button, Card, EmptyState, KpiCard, ProgressRing, SkeletonCard, toast } from '@/components/ui';
import { describeFilters, monthlyTrend, type AnalyticsFilters, type TrendPoint } from '@/lib/analytics';
import { COMPLETION_TARGET, qualityMetrics } from '@/lib/analytics-outcomes';
import { csvFilename, downloadCsv } from '@/lib/csv';
import { formatNumber, formatPercent, pluralize } from '@/lib/format';
import { useCan } from '@/lib/rbac';
import { useMonth, useScopeFilters } from '@/lib/scope';
import { useDb } from '@/store/db';
import { useWarmup } from '@/pages/dashboard/components/useWarmup';
import { rateTone } from '@/pages/dashboard/components/shared';
import { SessionsExplorer } from './components/SessionsExplorer';
import { buildSessionRows, sessionCsvColumns } from './components/sessionRows';

function exportMonth(db: DemoDatabase, month: MonthKey, filters: AnalyticsFilters) {
  const rows = buildSessionRows(db, month, filters);
  downloadCsv(csvFilename(`mph-sessions-${month}-all`), rows, sessionCsvColumns(db));
  toast.success('Month exported', `${pluralize(rows.length, 'row')} · ${formatMonth(month)}`);
}

const RING_TONE = { success: 'success', primary: 'primary', warning: 'warning', neutral: 'neutral' } as const;

function MonthCard({ t, closed, canExport, onExport }: { t: TrendPoint; closed: boolean; canExport: boolean; onExport: () => void }) {
  const tone = rateTone(t.completionRate, t.total);
  const stats = [
    { label: 'Completed', value: t.completed, icon: CircleCheck, cls: 'text-success' },
    { label: 'Scheduled', value: t.scheduled, icon: CalendarCheck, cls: 'text-info' },
    { label: 'Missed', value: t.missed, icon: CalendarX, cls: 'text-danger' },
    { label: 'Not booked', value: t.toBeScheduled, icon: CalendarClock, cls: 'text-warning' },
  ];
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base leading-6 font-semibold text-ink">{formatMonth(t.month, true)}</p>
          <p className="text-[13px] text-ink-2">{pluralize(t.total, 'pair')}</p>
        </div>
        {closed ? (
          <Badge tone="outline" icon={Lock}>
            Closed
          </Badge>
        ) : (
          <Badge tone="success" dot>
            In progress
          </Badge>
        )}
      </div>
      <div className="mt-4 flex items-center gap-5">
        <ProgressRing value={t.completionRate * 100} size={84} stroke={9} tone={RING_TONE[tone]}>
          <span className="text-base font-bold text-ink">{formatPercent(t.completionRate)}</span>
        </ProgressRing>
        <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
          {stats.map((s) => (
            <li key={s.label} className="flex min-w-0 items-center gap-2">
              <s.icon className={`size-3.5 shrink-0 ${s.cls}`} />
              <span className="flex-1 truncate text-[13px] text-ink-2">{s.label}</span>
              <span className="text-[13px] font-semibold text-ink tabular">{formatNumber(s.value)}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-xs text-ink-2">
        {t.completionRate >= COMPLETION_TARGET ? <span className="font-medium text-success">Met the {formatPercent(COMPLETION_TARGET)} target</span> : `${formatPercent(COMPLETION_TARGET)} target · ${formatNumber(Math.max(0, Math.ceil(COMPLETION_TARGET * t.total) - t.completed))} pairs short`}
      </p>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3">
        <Link to={`/sessions/archive?month=${t.month}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary-dark">
          View month <ArrowRight className="size-3.5" />
        </Link>
        {canExport && (
          <Button variant="ghost" size="xs" icon={Download} onClick={onExport}>
            CSV
          </Button>
        )}
      </div>
    </Card>
  );
}

function MonthDetail({ month, closed }: { month: MonthKey; closed: boolean }) {
  const db = useDb();
  const filters = useScopeFilters();
  const canExport = useCan('reports.export');
  const [t] = monthlyTrend(db, [month], filters);
  const q = qualityMetrics(db, [month], filters);
  return (
    <>
      <PageHeader
        backTo="/sessions/archive"
        backLabel="All months"
        eyebrow="Archive"
        title={formatMonth(month, true)}
        subtitle={`${describeFilters(db, filters)} · ${closed ? 'Closed month — read-only record of every pair and session.' : 'Current month — still in progress. Manage sessions from the Sessions page.'}`}
        meta={
          closed ? (
            <Badge tone="outline" icon={Lock}>
              Closed
            </Badge>
          ) : (
            <Badge tone="success" dot>
              In progress
            </Badge>
          )
        }
        actions={
          canExport && (
            <Button variant="secondary" icon={Download} onClick={() => exportMonth(db, month, filters)}>
              Export month CSV
            </Button>
          )
        }
      />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Completion" value={formatPercent(t.completionRate)} icon={CircleCheck} tone="success" hint={`${formatNumber(t.completed)} of ${pluralize(t.total, 'pair')}`} />
        <KpiCard label="Missed" value={formatNumber(t.missed)} icon={CalendarX} tone="danger" hint={`${formatPercent(t.total ? t.missed / t.total : 0)} of pairs`} />
        <KpiCard label={closed ? 'Never booked' : 'To be scheduled'} value={formatNumber(t.toBeScheduled)} icon={CalendarClock} tone="warning" hint={t.scheduled ? `${formatNumber(t.scheduled)} still scheduled` : undefined} />
        <KpiCard label="Conversation score" value={q.avgRating != null ? `${formatNumber(q.avgRating, 1)} / 5` : '—'} icon={Star} tone="mentor" hint={`${pluralize(q.rated, 'rating')} · ${formatPercent(q.notesRate)} with notes`} />
      </div>
      <SessionsExplorer month={month} readOnly />
    </>
  );
}

export default function SessionArchivePage() {
  const db = useDb();
  const [params] = useSearchParams();
  const { months, currentMonth } = useMonth();
  const filters = useScopeFilters();
  const canExport = useCan('reports.export');
  const ready = useWarmup('archive', 300);
  const trend = useMemo(() => monthlyTrend(db, months, filters), [db, months, filters]);
  const requested = params.get('month');

  if (requested && months.includes(requested)) return <MonthDetail month={requested} closed={requested < currentMonth} />;

  const closed = trend.filter((t) => t.month < currentMonth);
  const avg = closed.length ? closed.reduce((s, t) => s + t.completionRate, 0) / closed.length : null;
  const hours = trend.reduce((s, t) => s + t.completed, 0);

  return (
    <>
      <PageHeader
        eyebrow="MyPeopleHour"
        title="Session archive"
        subtitle={`Month-by-month record since launch in ${months[0] ? formatMonth(months[0], true) : '—'} · ${describeFilters(db, filters)}. Past months are closed and kept read-only.`}
        meta={
          <>
            <Badge tone="outline" icon={Archive}>
              {pluralize(closed.length, 'closed month')}
            </Badge>
            <Badge tone="success">{formatNumber(hours)} hours held</Badge>
            {avg != null && <Badge tone="primary">{formatPercent(avg)} average completion</Badge>}
          </>
        }
      />
      {requested && !months.includes(requested) && (
        <p className="mb-4 rounded-card border border-warning/30 bg-warning-soft px-4 py-3 text-[13px] text-[#9A5200]">{formatMonth(requested)} is outside the programme — showing every month instead.</p>
      )}
      {!ready ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} lines={4} />
          ))}
        </div>
      ) : !trend.some((t) => t.total) ? (
        <Card padding="none">
          <EmptyState size="lg" icon={Archive} title="No history yet" message="Months appear here once the first MyPeopleHour pairs exist in this scope." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...trend].reverse().map((t) => (
            <MonthCard key={t.month} t={t} closed={t.month < currentMonth} canExport={canExport} onExport={() => exportMonth(db, t.month, filters)} />
          ))}
        </div>
      )}
    </>
  );
}
