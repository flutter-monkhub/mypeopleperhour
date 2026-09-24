import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck, CalendarClock, CalendarX, CircleCheck, Flag, Star, Target } from 'lucide-react';
import type { MonthKey } from '@shared/types';
import { formatMonth, formatMonthShort } from '@shared/utils/dates';
import { Card, DeltaChip, KpiCard, ProgressRing } from '@/components/ui';
import type { CompletionSummary, MissedFlags } from '@/lib/analytics';
import { COMPLETION_TARGET, type QualityMetrics } from '@/lib/analytics-outcomes';
import { cn } from '@/lib/cn';
import { formatNumber, formatPercent, pluralize } from '@/lib/format';

interface Props {
  month: MonthKey;
  currentMonth: MonthKey;
  prevMonth?: MonthKey;
  summary: CompletionSummary;
  prev?: CompletionSummary;
  quality: QualityMetrics;
  prevQuality?: QualityMetrics;
  flags: MissedFlags;
  awaiting: number;
  /** "?fn=…&dept=…" carried to the sessions page */
  query: string;
}

const tab = (t: string, query: string) => `/sessions${query ? `${query}&` : '?'}tab=${t}`;

function daysLeft(month: MonthKey) {
  const [y, m] = month.split('-').map(Number);
  const end = new Date(y, m, 0);
  return Math.max(0, end.getDate() - new Date().getDate());
}

function CompletionHero({ month, currentMonth, prevMonth, summary, prev, query }: Props) {
  const pct = summary.completionRate * 100;
  const needed = Math.max(0, Math.ceil(COMPLETION_TARGET * summary.total) - summary.completed);
  const inProgress = month === currentMonth;
  return (
    <Card className="flex flex-col sm:col-span-2 xl:col-span-1 xl:row-span-2">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-ink">Completion rate</p>
          <p className="text-[13px] text-ink-2">
            {formatMonth(month)}
            {inProgress ? ` · in progress, ${pluralize(daysLeft(month), 'day')} left` : ' · closed'}
          </p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-success-soft text-success">
          <CircleCheck className="size-4.5" />
        </span>
      </div>
      <div className="mt-5 flex flex-1 flex-wrap items-center gap-5 xl:flex-col xl:items-start">
        <ProgressRing value={pct} size={128} stroke={12} tone={summary.completionRate >= COMPLETION_TARGET ? 'success' : 'primary'}>
          <div>
            <p className="text-[28px] leading-8 font-bold text-ink">{formatPercent(summary.completionRate)}</p>
            <p className="text-xs text-ink-2">completed</p>
          </div>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-2">
            <span className="text-base font-semibold text-ink">{formatNumber(summary.completed)}</span> of {pluralize(summary.total, 'pair')}
          </p>
          {prev && prevMonth && prev.total > 0 && (
            <div className="mt-2">
              <DeltaChip value={(summary.completionRate - prev.completionRate) * 100} suffix=" pts" label={`vs ${formatMonthShort(prevMonth)} (${formatPercent(prev.completionRate)})`} />
            </div>
          )}
          <p className="mt-3 flex items-start gap-1.5 text-[13px] text-ink-2">
            <Target className="mt-0.5 size-3.5 shrink-0 text-muted" />
            {needed ? (
              <span>
                Target {formatPercent(COMPLETION_TARGET)} · <span className="font-medium text-ink">{pluralize(needed, 'more pair')}</span> to go
              </span>
            ) : (
              <span className="font-medium text-success">Target of {formatPercent(COMPLETION_TARGET)} reached</span>
            )}
          </p>
        </div>
      </div>
      <Link to={tab('completed', query)} className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary-dark">
        View completed sessions <ArrowRight className="size-3.5" />
      </Link>
    </Card>
  );
}

/** A5/A6 KPI block: completion hero + six status tiles, each linking to the Sessions tab. */
export function KpiSection(props: Props) {
  const { summary, quality, prevQuality, flags, awaiting, query, prevMonth } = props;
  const share = (n: number) => (summary.total ? `${formatPercent(n / summary.total)} of pairs` : undefined);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <CompletionHero {...props} />
      <KpiCard label="Completed" value={formatNumber(summary.completed)} icon={CircleCheck} tone="success" hint={share(summary.completed)} to={tab('completed', query)} linkLabel="View completed" />
      <KpiCard
        label="Scheduled"
        value={formatNumber(summary.scheduled)}
        icon={CalendarCheck}
        tone="info"
        hint={awaiting ? `${formatNumber(awaiting)} awaiting update` : 'Upcoming this month'}
        to={tab('scheduled', query)}
        linkLabel="View scheduled"
      />
      <KpiCard label="Missed" value={formatNumber(summary.missed)} icon={CalendarX} tone="danger" toneValue={summary.missed > 0} hint={share(summary.missed) ?? 'No pairs'} to={tab('missed', query)} linkLabel="View missed" />
      <KpiCard
        label="To be scheduled"
        value={formatNumber(summary.toBeScheduled)}
        icon={CalendarClock}
        tone="warning"
        toneValue={summary.toBeScheduled > 0}
        hint={share(summary.toBeScheduled)}
        to={tab('to_be_scheduled', query)}
        linkLabel="View pairs"
      />
      <KpiCard
        label="Avg conversation score"
        value={
          <span>
            {quality.avgRating != null ? formatNumber(quality.avgRating, 1) : '—'}
            <span className="ml-1 text-base font-semibold text-muted">/ 5</span>
          </span>
        }
        icon={Star}
        tone="mentor"
        delta={quality.avgRating != null && prevQuality?.avgRating != null && prevMonth ? { value: quality.avgRating - prevQuality.avgRating, digits: 1, label: `vs ${formatMonthShort(prevMonth)}` } : undefined}
        hint={quality.rated ? `${pluralize(quality.rated, 'rating')} by team members` : 'No ratings yet'}
        to={tab('completed', query)}
        linkLabel="View ratings"
      />
      <KpiCard
        label="Missed flags"
        value={formatNumber(flags.total)}
        icon={Flag}
        tone={flags.total ? 'danger' : 'neutral'}
        hint={
          <span className={cn(!flags.total && 'text-success')}>
            {flags.total ? `${pluralize(flags.pairs.length, 'pair')} · ${pluralize(flags.managers.length, 'manager')}` : 'Nothing flagged'}
          </span>
        }
        to={`/dashboard${query}#missed-indicators`}
        linkLabel="See flags"
      />
    </div>
  );
}
