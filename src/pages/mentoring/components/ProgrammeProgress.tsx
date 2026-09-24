// A44 — six-month programme progress: month strip with a today marker, where the three anchor
// conversations should happen (months 1, 3, 6), and the share of pairs that completed each anchor
// against what the programme expects by now.

import { CalendarRange, Flag } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDate, formatPercent } from '@/lib/format';
import { anchorGuide, type AnchorProgress, type CohortTimeline } from '@/lib/analytics-mentoring';
import { Badge, Card, CardHeader } from '@/components/ui';

const HATCH = 'repeating-linear-gradient(135deg, rgba(126,55,148,.45) 0 3px, rgba(126,55,148,.12) 3px 6px)';

function monthBadge(t: CohortTimeline) {
  if (!t.started) return <Badge tone="info">Starts in {t.daysToStart} days</Badge>;
  if (t.ended) return <Badge tone="mentor">Completed</Badge>;
  return (
    <Badge tone="mentor" className="text-[13px]">
      Month {t.monthIndex} of {t.months.length}
    </Badge>
  );
}

const STATE_LABEL: Record<AnchorProgress['state'], { text: string; tone: 'neutral' | 'warning' | 'info' | 'mentor' }> = {
  upcoming: { text: 'Upcoming', tone: 'neutral' },
  due: { text: 'Due this month', tone: 'warning' },
  overdue_window: { text: 'Window passed', tone: 'neutral' },
  closed: { text: 'Closed', tone: 'mentor' },
};

export function ProgrammeProgress({ timeline: t, anchors }: { timeline: CohortTimeline; anchors: AnchorProgress[] }) {
  const today = new Date();
  const markerAt = (m: number) => ((m - 0.5) / t.months.length) * 100;
  return (
    <Card>
      <CardHeader
        icon={CalendarRange}
        iconTone="mentor"
        title="Six-month programme progress"
        subtitle={`${t.cohort.name} · ${formatDate(t.cohort.startDate)} → ${formatDate(t.endsAt)}${t.started && !t.ended ? ` · ${t.daysLeft} days to go` : ''}`}
        actions={monthBadge(t)}
      />

      {/* Month strip */}
      <div className="relative px-1 pt-7 pb-1">
        {t.started && !t.ended && (
          <div className="absolute top-0 z-[2] -translate-x-1/2" style={{ left: `${t.todayPos * 100}%` }}>
            <span className="block rounded-full bg-navy px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white shadow-card">
              Today · {formatDate(today).replace(/ \d{4}$/, '')}
            </span>
          </div>
        )}
        <div className="relative h-3 rounded-full bg-[#EDF0F6]">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#B57CC7] to-mentor transition-[width] duration-700"
            style={{ width: `${t.todayPos * 100}%` }}
          />
          {t.months.slice(1).map((m) => (
            <span key={m.key} className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${((m.index - 1) / t.months.length) * 100}%` }} aria-hidden />
          ))}
          {t.started && !t.ended && (
            <span className="absolute -top-1.5 -bottom-1.5 z-[1] w-0.5 -translate-x-1/2 rounded bg-navy" style={{ left: `${t.todayPos * 100}%` }} aria-hidden />
          )}
          {anchors.map((a) => {
            const done = a.total > 0 && a.completedShare >= 0.999;
            return (
              <span
                key={a.anchor}
                title={`Conversation ${a.anchor} · ${a.title} — month ${a.dueMonth}`}
                className={cn(
                  'absolute top-1/2 z-[1] grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 text-[11px] font-bold shadow-card',
                  done ? 'border-white bg-success text-white' : a.state === 'upcoming' ? 'border-mentor/40 bg-white text-mentor' : 'border-white bg-mentor text-white',
                )}
                style={{ left: `${markerAt(a.dueMonth)}%` }}
              >
                {a.anchor}
              </span>
            );
          })}
        </div>
        <div className="mt-2.5 grid" style={{ gridTemplateColumns: `repeat(${t.months.length}, minmax(0, 1fr))` }}>
          {t.months.map((m) => {
            const anchor = anchors.find((a) => a.dueMonth === m.index);
            return (
              <div key={m.key} className="min-w-0 px-1 text-center">
                <p className={cn('text-xs font-semibold', m.state === 'current' ? 'text-mentor' : m.state === 'past' ? 'text-ink' : 'text-muted')}>
                  M{m.index} · {m.short}
                </p>
                {anchor && <p className="truncate text-[11px] text-ink-2">{anchorGuide(anchor.anchor).title}</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Anchor completion vs expected */}
      <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-3">
        {anchors.map((a) => {
          const st = STATE_LABEL[a.state];
          const gap = a.expectedShare > 0 ? a.total - a.completed : 0;
          return (
            <div key={a.anchor} className={cn('rounded-xl border p-4', a.state === 'due' ? 'border-mentor/30 bg-mentor-soft/40' : 'border-line bg-white')}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-ink-2">
                    Conversation {a.anchor} · Month {a.dueMonth} · {a.dueLabel}
                  </p>
                  <p className="truncate text-sm font-semibold text-ink">{a.title}</p>
                </div>
                <Badge tone={st.tone} size="sm">
                  {st.text}
                </Badge>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-[26px] leading-8 font-bold tracking-tight text-ink tabular">{a.total ? formatPercent(a.completedShare) : '—'}</span>
                <span className="text-xs text-ink-2">
                  {a.completed} of {a.total} pairs completed
                </span>
              </div>
              <div
                className="relative mt-2.5 h-2 overflow-hidden rounded-full bg-[#EDF0F6]"
                role="img"
                aria-label={`${formatPercent(a.completedShare)} completed, ${formatPercent(a.scheduledShare)} scheduled`}
              >
                <div className="absolute inset-y-0 left-0 bg-mentor" style={{ width: `${a.completedShare * 100}%` }} />
                <div className="absolute inset-y-0" style={{ left: `${a.completedShare * 100}%`, width: `${a.scheduledShare * 100}%`, background: HATCH }} />
              </div>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
                <span className="text-ink-2">
                  {a.scheduled > 0 ? `${a.scheduled} scheduled · ` : ''}expected {a.expectedShare ? '100%' : '0%'}{' '}
                  {a.state === 'upcoming' ? `from ${a.dueLabel}` : a.state === 'due' ? 'by month end' : 'by now'}
                </span>
                {gap > 0 && a.state !== 'upcoming' && (
                  <span className={cn('inline-flex items-center gap-1 font-semibold', a.state === 'due' ? 'text-warning' : 'text-danger')}>
                    <Flag className="size-3" /> {gap} pair{gap === 1 ? '' : 's'} {a.state === 'due' ? 'to go' : 'behind'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
