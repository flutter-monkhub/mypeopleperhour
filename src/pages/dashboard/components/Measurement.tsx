import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, CalendarCheck, HeartHandshake, Lock, MessagesSquare, Sparkles, TrendingUp } from 'lucide-react';
import { MPH_MEASUREMENT_LEVELS } from '@shared/content/mph';
import { BarChart, LineTrend } from '@/components/charts';
import { Badge, Card, CardHeader, DeltaChip, EmptyState, ProgressBar } from '@/components/ui';
import type { CompletionSummary } from '@/lib/analytics';
import { MIN_GROUP, ON_TIME_DAY, monthSpanLabel, type CompletionBand, type CompletionPulseCorrelation, type PulseQuarter, type QualityMetrics } from '@/lib/analytics-outcomes';
import { cn } from '@/lib/cn';
import { formatDecimal, formatNumber, formatPercent, pluralize } from '@/lib/format';

const LEVEL_STYLE = [
  { icon: CalendarCheck, tone: 'bg-primary-soft text-primary', ring: 'ring-primary/15' },
  { icon: MessagesSquare, tone: 'bg-mentor-soft text-mentor', ring: 'ring-mentor/15' },
  { icon: TrendingUp, tone: 'bg-success-soft text-success', ring: 'ring-success/15' },
] as const;

function Metric({ label, value, hint, children }: { label: ReactNode; value: ReactNode; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-ink-2">{label}</p>
        <p className="shrink-0 text-lg leading-6 font-bold text-ink">{value}</p>
      </div>
      {children && <div className="mt-2">{children}</div>}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const BAND_SHORT: Record<CompletionBand, string> = { high: '≥ 90%', mid: '70–89%', low: '< 70%' };

/** +12 / −4 / 0 */
const signed = (n: number) => {
  const r = Math.round(n);
  return `${r > 0 ? '+' : r < 0 ? '−' : ''}${Math.abs(r)}`;
};

const outOf5 = (v: number | null) =>
  v == null ? (
    '—'
  ) : (
    <>
      {formatNumber(v, 1)}
      <span className="ml-0.5 text-sm font-semibold text-muted">/5</span>
    </>
  );

interface LevelsProps {
  summary: CompletionSummary;
  quality: QualityMetrics;
  latest?: PulseQuarter;
  previous?: PulseQuarter;
  correlation: CompletionPulseCorrelation | null;
  monthLabel: string;
}

/** The deck's "Tracking — three levels of measurement": discipline → quality → outcome. */
export function MeasurementLevels({ summary, quality, latest, previous, correlation, monthLabel }: LevelsProps) {
  const [l1, l2, l3] = MPH_MEASUREMENT_LEVELS;
  const cmp = correlation?.compare;
  const cards = [
    {
      level: l1,
      body: (
        <>
          <Metric label="Pairs completing the hour" value={formatPercent(summary.completionRate)} hint={`${formatNumber(summary.completed)} of ${pluralize(summary.total, 'pair')} · ${monthLabel}`}>
            <ProgressBar value={summary.completionRate * 100} tone="primary" size="sm" />
          </Metric>
          <Metric label="Booked on time" value={formatPercent(quality.onTimeRate)} hint={`Hour booked by the ${ON_TIME_DAY}th of the month (pre-scheduled)`}>
            <ProgressBar value={quality.onTimeRate * 100} tone="primary" size="sm" />
          </Metric>
          <Metric label="Missed · still to be scheduled" value={`${formatNumber(summary.missed)} · ${formatNumber(summary.toBeScheduled)}`} hint="Reasons are tracked on the Missed reasons page" />
        </>
      ),
    },
    {
      level: l2,
      body: (
        <>
          <Metric label="Conversation score (team members)" value={outOf5(quality.avgRating)} hint={quality.rated ? `${pluralize(quality.rated, 'rating')} of completed sessions · ${monthLabel}` : 'No ratings yet'} />
          <Metric label="Sessions with notes captured" value={formatPercent(quality.notesRate)} hint={`${formatNumber(quality.withNotes)} of ${formatNumber(quality.completedSessions)} completed · note content stays private`}>
            <ProgressBar value={quality.notesRate * 100} tone="mentor" size="sm" />
          </Metric>
          <Metric
            label="“I feel heard by my manager”"
            value={outOf5(latest?.heard ?? null)}
            hint={latest ? `${latest.period} pulse${latest.followThrough != null ? ` · ${formatPercent(latest.followThrough)} say agreed actions were followed through` : ''}` : 'No pulse data'}
          />
        </>
      ),
    },
    {
      level: l3,
      body: (
        <>
          <Metric
            label="Quarterly pulse score"
            value={outOf5(latest?.score ?? null)}
            hint={latest ? `${latest.period}${latest.live ? ' (open)' : ''} · ${pluralize(latest.responses, 'response')}` : 'No pulse data'}
          >
            {latest?.score != null && previous?.score != null && <DeltaChip value={latest.score - previous.score} digits={1} label={`vs ${previous.period}${previous.baseline ? ' baseline' : ''}`} />}
          </Metric>
          <Metric label="Employee NPS" value={latest?.enps != null ? signed(latest.enps) : '—'} hint="% promoters − % detractors (0–10 scale)">
            {latest?.enps != null && previous?.enps != null && <DeltaChip value={latest.enps - previous.enps} label={`vs ${previous.period}`} />}
          </Metric>
          <Metric
            label="Discipline ↔ pulse"
            value={correlation?.gap != null ? `${correlation.gap >= 0 ? '+' : '−'}${formatDecimal(Math.abs(correlation.gap))}` : '—'}
            hint={
              cmp
                ? `Teams at ${BAND_SHORT[cmp.top.band]} completion score ${formatDecimal(cmp.top.score)} vs ${formatDecimal(cmp.bottom.score)} at ${BAND_SHORT[cmp.bottom.band]}`
                : `Needs ≥ ${MIN_GROUP} responses per group`
            }
          />
        </>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      {cards.map(({ level, body }, i) => {
        const st = LEVEL_STYLE[i];
        return (
          <Card key={level.id} className="flex flex-col">
            <div className="flex items-start gap-3">
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl ring-4', st.tone, st.ring)}>
                <st.icon className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">Level {i + 1}</p>
                <h3 className="text-[15px] leading-6 font-semibold text-ink">{level.title}</h3>
                <p className="text-[13px] text-ink-2 italic">{level.question}</p>
              </div>
            </div>
            <div className="mt-4 flex-1 divide-y divide-line border-t border-line pt-3">{body}</div>
          </Card>
        );
      })}
    </div>
  );
}

// ───────────────────────── pulse outcome charts ─────────────────────────

/** Deck: "Quarterly pulse trends" — pulse score & "I feel heard" per quarter, with eNPS per quarter. */
export function PulseTrendCard({ quarters, canOpenPulse }: { quarters: PulseQuarter[]; canOpenPulse: boolean }) {
  const shown = quarters.filter((q) => !q.suppressed);
  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={Activity}
        iconTone="success"
        title="Quarterly pulse trend"
        subtitle="Anonymous quarterly pulse · averages on a 1–5 scale"
        actions={
          <Badge tone="outline" icon={Lock} size="sm">
            Aggregate only
          </Badge>
        }
      />
      {shown.length ? (
        <>
          <LineTrend
            data={shown.map((q) => ({ q: q.period, score: q.score != null ? Number(q.score.toFixed(2)) : null, heard: q.heard != null ? Number(q.heard.toFixed(2)) : null }))}
            xKey="q"
            series={[
              { key: 'score', label: 'Pulse score' },
              { key: 'heard', label: '“I feel heard”' },
            ]}
            domain={[1, 5]}
            height={210}
            area={false}
            valueFormatter={(v) => formatDecimal(v)}
          />
          <div className="mt-4 grid gap-3 border-t border-line pt-4" style={{ gridTemplateColumns: `repeat(${shown.length}, minmax(0, 1fr))` }}>
            {shown.map((q) => (
              <div key={q.survey.id} className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-xs font-medium text-ink-2">
                  {q.period}
                  {q.baseline && (
                    <Badge tone="neutral" size="sm">
                      Baseline
                    </Badge>
                  )}
                  {q.live && (
                    <Badge tone="success" size="sm">
                      Open
                    </Badge>
                  )}
                </p>
                <p className="mt-0.5 text-lg leading-7 font-bold text-ink">
                  {q.enps != null ? signed(q.enps) : '—'} <span className="text-xs font-medium text-ink-2">eNPS</span>
                </p>
                <p className="truncate text-xs text-ink-2">
                  {formatPercent(q.participation)} took part ({formatNumber(q.responses)})
                </p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <EmptyState size="sm" icon={Activity} title="Not enough pulse responses" message={`Pulse results are shown for groups of ${MIN_GROUP} or more to protect anonymity.`} className="flex-1" />
      )}
      {canOpenPulse && (
        <Link to="/surveys/pulse" className="mt-auto inline-flex items-center gap-1 pt-4 text-[13px] font-medium text-primary hover:text-primary-dark">
          Pulse analysis <ArrowRight className="size-3.5" />
        </Link>
      )}
    </Card>
  );
}

/** Outcome indicator: pulse score of teams by their completion discipline. */
export function CorrelationCard({ correlation }: { correlation: CompletionPulseCorrelation | null }) {
  const bands = correlation?.bands ?? [];
  const reportable = bands.filter((b) => !b.suppressed);
  return (
    <Card className="flex flex-col">
      <CardHeader
        icon={HeartHandshake}
        iconTone="mentor"
        title="Does discipline pay off?"
        subtitle={correlation ? `${correlation.survey.period} pulse score by the team’s completion rate (${monthSpanLabel(correlation.months)})` : 'Pulse score by team completion rate'}
      />
      {reportable.length >= 2 && correlation ? (
        <>
          <BarChart
            data={reportable.map((b) => ({ band: b.label, score: b.score != null ? Number(b.score.toFixed(2)) : 0, responses: b.responses, teams: b.teams }))}
            xKey="band"
            yKey="score"
            label="Pulse score"
            layout="vertical"
            domain={[0, 5]}
            height={176}
            categoryWidth={124}
            valueFormatter={(v) => formatDecimal(v)}
            showValues
            tooltipFooter={(d) => `${formatNumber(d.responses as number)} responses · ${formatNumber(d.teams as number)} teams`}
          />
          {correlation.gap != null && (
            <div className="mt-4 flex items-start gap-3 rounded-xl bg-mentor-soft/60 px-4 py-3">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-mentor" />
              <p className="text-[13px] leading-5 text-ink">
                Team members whose managers held <strong>{BAND_SHORT[correlation.compare?.top.band ?? 'high']}</strong> of their hours rate their experience{' '}
                <strong>
                  {correlation.gap >= 0 ? '+' : '−'}
                  {formatDecimal(Math.abs(correlation.gap))} points
                </strong>{' '}
                {correlation.gap >= 0 ? 'higher' : 'lower'} than teams at {BAND_SHORT[correlation.compare?.bottom.band ?? 'low']}.
              </p>
            </div>
          )}
          <p className="mt-3 text-xs text-muted">Groups with fewer than {MIN_GROUP} responses are hidden to protect anonymity. Correlation, not causation.</p>
        </>
      ) : (
        <EmptyState size="sm" icon={HeartHandshake} title="Not enough data yet" message={`At least two completion bands need ${MIN_GROUP}+ pulse responses for this selection.`} className="flex-1" />
      )}
    </Card>
  );
}
