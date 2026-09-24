import { useState } from 'react';
import { ChartColumn, TrendingUp } from 'lucide-react';
import type { MonthKey } from '@shared/types';
import { formatMonth } from '@shared/utils/dates';
import { GroupedBar, LineTrend, STATUS_COLORS } from '@/components/charts';
import { Card, CardHeader, Tabs } from '@/components/ui';
import type { CompletionGroup, TrendPoint } from '@/lib/analytics';
import { COMPLETION_TARGET } from '@/lib/analytics-outcomes';
import { formatNumber, formatPercent } from '@/lib/format';
import { MiniStat } from './shared';

/** A10: completion % since launch with the target line. */
export function TrendCard({ trend, month, currentMonth }: { trend: TrendPoint[]; month: MonthKey; currentMonth: MonthKey }) {
  const closed = trend.filter((t) => t.month < currentMonth && t.total);
  const best = closed.reduce<TrendPoint | null>((b, t) => (!b || t.completionRate > b.completionRate ? t : b), null);
  const avgRate = closed.length ? closed.reduce((s, t) => s + t.completionRate, 0) / closed.length : null;
  const first = trend[0];
  return (
    <Card className="flex flex-col">
      <CardHeader icon={TrendingUp} title="Monthly trend" subtitle={`Completion % since launch (${first ? formatMonth(first.month) : '—'}) · target ${formatPercent(COMPLETION_TARGET)}`} />
      <LineTrend
        data={trend.map((t) => ({ m: t.shortLabel, rate: Math.round(t.completionRate * 100) }))}
        xKey="m"
        series={[{ key: 'rate', label: 'Completion' }]}
        domain={[0, 100]}
        height={236}
        valueFormatter={(v) => `${v}%`}
        target={{ value: COMPLETION_TARGET * 100, label: `Target ${formatPercent(COMPLETION_TARGET)}` }}
      />
      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-line pt-4">
        <MiniStat label="Launch month" value={first ? formatPercent(first.completionRate) : '—'} hint={first ? formatMonth(first.month) : undefined} />
        <MiniStat label="Best closed month" value={best ? formatPercent(best.completionRate) : '—'} hint={best ? formatMonth(best.month) : 'No closed months'} />
        <MiniStat label="Average (closed)" value={avgRate != null ? formatPercent(avgRate) : '—'} hint={month === currentMonth ? `${formatMonth(month)} in progress` : `${closed.length} months`} />
      </div>
    </Card>
  );
}

type CompareView = 'month' | 'group';

const SERIES = [
  { key: 'completed', label: 'Completed', color: STATUS_COLORS.completed },
  { key: 'scheduled', label: 'Scheduled', color: STATUS_COLORS.scheduled },
  { key: 'missed', label: 'Missed', color: STATUS_COLORS.missed },
  { key: 'tbs', label: 'To be scheduled', color: STATUS_COLORS.to_be_scheduled },
];

/** A7: completed vs scheduled — by month since launch, or per unit/department for the month. */
export function ComparisonCard({ trend, groups, groupKind, month }: { trend: TrendPoint[]; groups: CompletionGroup[]; groupKind: 'unit' | 'department'; month: MonthKey }) {
  const [view, setView] = useState<CompareView>('month');
  const data =
    view === 'month'
      ? trend.map((t) => ({ x: t.shortLabel, completed: t.completed, scheduled: t.scheduled, missed: t.missed, tbs: t.toBeScheduled }))
      : groups.map((g) => ({ x: groupKind === 'unit' ? g.shortLabel : g.label.length > 12 ? `${g.label.slice(0, 11)}…` : g.label, completed: g.completed, scheduled: g.scheduled, missed: g.missed, tbs: g.toBeScheduled }));
  const totals = view === 'month' ? trend.reduce((s, t) => ({ c: s.c + t.completed, m: s.m + t.missed, t: s.t + t.toBeScheduled }), { c: 0, m: 0, t: 0 }) : null;
  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={ChartColumn}
        title="Completed vs scheduled"
        subtitle={view === 'month' ? 'Pair status at month end, since launch' : `${groupKind === 'unit' ? 'Per unit' : 'Per department'} · ${formatMonth(month)}`}
        actions={
          <Tabs<CompareView>
            variant="segmented"
            value={view}
            onChange={setView}
            tabs={[
              { id: 'month', label: 'By month' },
              { id: 'group', label: groupKind === 'unit' ? 'By unit' : 'By dept' },
            ]}
          />
        }
      />
      <GroupedBar data={data} xKey="x" series={SERIES} height={248} valueFormatter={(v) => formatNumber(v)} />
      {totals && (
        <p className="mt-4 border-t border-line pt-4 text-[13px] text-ink-2">
          Since launch: <span className="font-semibold text-ink">{formatNumber(totals.c)}</span> hours completed, <span className="font-semibold text-ink">{formatNumber(totals.m)}</span> pair-months ended missed and{' '}
          <span className="font-semibold text-ink">{formatNumber(totals.t)}</span> were never booked.
        </p>
      )}
    </Card>
  );
}
