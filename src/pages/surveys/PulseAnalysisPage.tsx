// Pulse analysis — /surveys/pulse (SPEC A28, "Outcome indicator" of the three levels of measurement).
// Quarterly category trends, eNPS and response-rate trends, unit × category heatmap, question-level
// deltas, MyPeopleHour impact (manager completion discipline vs pulse scores) and comment themes.
// Everything follows the unit scope (top bar; locked for a scoped HR admin) and hides groups under 5.

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, CalendarCheck, Download, Gauge, Lock, MessageSquareQuote, Quote, Sparkles, TrendingUp, Users } from 'lucide-react';
import type { PulseCategory } from '@shared/types';
import { formatMonth } from '@shared/utils/dates';
import { GroupedBar, LineTrend, BarChart, ChartLegend, SERIES_COLORS } from '@/components/charts';
import {
  DISCIPLINE_BANDS,
  DISCIPLINE_META,
  MIN_GROUP,
  PULSE_CATEGORIES,
  commentThemes,
  disciplineImpact,
  groupCategoryScores,
  pulseTrend,
  questionTrend,
  surveyComments,
  type PulsePoint,
  type QuestionTrendRow,
} from '@/lib/analytics-pulse';
import { csvFilename } from '@/lib/csv';
import { formatDate, formatDecimal, formatNumber, formatPercent, pluralize } from '@/lib/format';
import { unitName } from '@/lib/lookup';
import { buildReport, downloadReport } from '@/lib/reports';
import { useScope } from '@/lib/scope';
import { useDb } from '@/store/db';
import { PageHeader } from '@/components/layout';
import { Badge, Button, Callout, Card, CardHeader, DataTable, DeltaChip, EmptyState, KpiCard, LinkButton, Tabs, toast, type Column } from '@/components/ui';
import { HeatLegend, PulseHeatmap, heatDomain } from './components/PulseHeatmap';
import { TYPE_META } from './components/meta';

const CAT_COLOR: Record<PulseCategory, string> = {
  Engagement: SERIES_COLORS[0],
  'Manager Support': SERIES_COLORS[1],
  Growth: SERIES_COLORS[2],
  Wellbeing: SERIES_COLORS[3],
  Recognition: SERIES_COLORS[4],
  Programme: SERIES_COLORS[5],
};
const catKey = (c: PulseCategory) => c.replace(/\s+/g, '');
const signed = (n: number, digits = 0) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`;
const quarterLabel = (p: PulsePoint) => `${p.period}${p.baseline ? ' · baseline' : ''}`;

export default function PulseAnalysisPage() {
  const db = useDb();
  const { unitId, locked, unit } = useScope();
  const [params, setParams] = useSearchParams();
  const [heatBy, setHeatBy] = useState<'unit' | 'function'>(unitId ? 'function' : 'unit');
  const filters = useMemo(() => ({ unitId }), [unitId]);

  const trend = pulseTrend(db, filters);
  const withData = trend.filter((p) => !p.suppressed);
  const requested = params.get('quarter');
  const focus = trend.find((p) => p.survey.id === requested) ?? withData[withData.length - 1] ?? trend[trend.length - 1];
  const focusIdx = focus ? trend.indexOf(focus) : -1;
  const prev = focusIdx > 0 ? trend.slice(0, focusIdx).reverse().find((p) => !p.suppressed) : undefined;
  const baseline = trend.find((p) => p.baseline && !p.suppressed);
  const effectiveHeatBy = unitId && heatBy === 'unit' ? 'function' : heatBy;

  const impact = focus ? disciplineImpact(db, focus.survey.id, filters) : null;
  const heat = focus ? groupCategoryScores(db, focus.survey.id, effectiveHeatBy, filters) : [];
  const domain = heatDomain(heat);
  // (all memoised underneath via memoOn)
  const qRows = questionTrend(db, trend.map((p) => p.survey), filters);
  const comments = focus ? surveyComments(db, [focus.survey], filters) : [];
  const themes = commentThemes(comments);

  if (!trend.length)
    return (
      <>
        <PageHeader title="Pulse analysis" subtitle="Quarterly pulse trends by category, eNPS and the link with completion discipline." />
        <Card>
          <EmptyState icon={Activity} title="No pulse surveys yet" message="Publish a quarterly pulse to start tracking how people feel quarter on quarter." action={<LinkButton to="/surveys">Go to surveys</LinkButton>} />
        </Card>
      </>
    );

  const exportCsv = () => {
    downloadReport(buildReport(db, 'pulse', { months: [], unitId, functionId: null }), csvFilename(`pulse-results${unitId ? `-${unitName(db, unitId, true).toLowerCase()}` : ''}`));
    toast.success('CSV downloaded', 'Pulse results by quarter & category (aggregated, anonymised).');
  };

  const chartData = trend.map((p) => {
    const d: Record<string, string | number | null> = { q: p.period + (p.baseline ? '*' : ''), enps: p.enps?.score ?? null, rate: p.responseRate == null ? null : Math.round(p.responseRate * 100) };
    for (const c of PULSE_CATEGORIES) d[catKey(c)] = p.categories[c] ? Number(p.categories[c]!.avg.toFixed(2)) : null;
    return d;
  });

  return (
    <>
      <PageHeader
        eyebrow="Outcome indicator"
        title="Pulse analysis"
        subtitle="How people feel quarter on quarter — and whether regular MyPeopleHour conversations are moving the needle."
        actions={
          <>
            {focus && (
              <LinkButton to={`/surveys/${focus.survey.id}/responses`} variant="secondary" icon={Users}>
                {focus.period} responses
              </LinkButton>
            )}
            <Button icon={Download} onClick={exportCsv}>
              Export CSV
            </Button>
          </>
        }
      />

      {locked && unit && (
        <Callout tone="warning" icon={Lock} className="mb-5">
          Showing pulse results for <strong className="text-ink">{unit.name}</strong> only. Groups with fewer than {MIN_GROUP} responses are hidden to protect anonymity.
        </Callout>
      )}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-medium text-ink-2">Focus quarter</span>
          <Tabs<string>
            variant="segmented"
            value={focus?.survey.id ?? ''}
            onChange={(id) => setParams({ quarter: id }, { replace: true })}
            tabs={trend.map((p) => ({ id: p.survey.id, label: `${p.period}${p.baseline ? ' (baseline)' : p.live ? ' (live)' : ''}`, disabled: p.suppressed }))}
          />
        </div>
        <p className="text-xs text-ink-2">{unitId ? unitName(db, unitId) : 'All units'} · anonymous, aggregated</p>
      </div>

      {focus?.suppressed ? (
        <Card>
          <EmptyState icon={Lock} tone="neutral" title="Not enough responses in this quarter" message={`Fewer than ${MIN_GROUP} people responded for this selection, so scores are hidden.`} />
        </Card>
      ) : (
        focus && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Pulse index"
                value={
                  <span>
                    {formatDecimal(focus.index)} <span className="text-base font-semibold text-muted">/ 5</span>
                  </span>
                }
                icon={Activity}
                tone="primary"
                delta={prev?.index != null && focus.index != null ? { value: focus.index - prev.index, digits: 2, label: `vs ${prev.period}` } : undefined}
                hint={baseline && baseline !== focus && baseline.index != null && focus.index != null ? `${signed(focus.index - baseline.index, 2)} since baseline (${baseline.period})` : 'Mean of the five categories'}
              />
              <KpiCard
                label="Employee NPS"
                value={focus.enps?.score == null ? '—' : signed(focus.enps.score)}
                icon={Gauge}
                tone="success"
                delta={prev?.enps?.score != null && focus.enps?.score != null ? { value: focus.enps.score - prev.enps.score, suffix: ' pts', label: `vs ${prev.period}` } : undefined}
                hint={focus.enps ? `${formatPercent(focus.enps.promoters / Math.max(1, focus.enps.n))} promoters · ${formatPercent(focus.enps.detractors / Math.max(1, focus.enps.n))} detractors` : undefined}
              />
              <KpiCard
                label="Response rate"
                value={focus.responseRate == null ? '—' : formatPercent(focus.responseRate)}
                icon={Users}
                tone="info"
                delta={prev?.responseRate != null && focus.responseRate != null && !focus.live ? { value: (focus.responseRate - prev.responseRate) * 100, suffix: ' pts', label: `vs ${prev.period}` } : undefined}
                hint={`${formatNumber(focus.respondents)} of ${formatNumber(focus.audience)}${focus.live ? ' · still open' : ''}`}
              />
              <KpiCard
                label="MyPeopleHour impact"
                value={impact?.indexGap != null ? signed(impact.indexGap, 2) : '—'}
                icon={Sparkles}
                tone="mentor"
                hint={impact?.indexGap != null ? 'Pulse index, high- vs low-discipline managers' : focus.baseline ? 'Baseline — before MyPeopleHour launched' : 'Not enough responses per group'}
              />
            </div>

            {/* ── trends ── */}
            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <CardHeader title="Category trends" subtitle="Average score (1–5) by quarter. * baseline, before MyPeopleHour launched." icon={TrendingUp} />
                <LineTrend
                  data={chartData}
                  xKey="q"
                  series={PULSE_CATEGORIES.map((c) => ({ key: catKey(c), label: c, color: CAT_COLOR[c] }))}
                  domain={[3, 5]}
                  area={false}
                  height={346}
                  valueFormatter={(v) => v.toFixed(1)}
                />
              </Card>
              <div className="flex flex-col gap-6">
                <Card>
                  <CardHeader title="eNPS by quarter" subtitle="% promoters − % detractors" icon={Gauge} iconTone="success" />
                  <LineTrend data={chartData} xKey="q" series={[{ key: 'enps', label: 'eNPS', color: SERIES_COLORS[0] }]} domain={[-60, 60]} height={150} target={{ value: 0 }} valueFormatter={(v) => signed(v)} />
                </Card>
                <Card>
                  <CardHeader title="Response rate" subtitle="Share of employees who responded" icon={Users} iconTone="neutral" />
                  <BarChart data={chartData} xKey="q" yKey="rate" label="Response rate" height={150} domain={[0, 100]} valueFormatter={(v) => `${v}%`} showValues />
                </Card>
              </div>
            </div>

            {/* ── heatmap ── */}
            <Card className="mt-6">
              <CardHeader
                title={`${effectiveHeatBy === 'unit' ? 'Unit' : 'Function'} × category · ${focus.period}`}
                subtitle="Darker = higher average. Hover a cell for the favourable share."
                icon={CalendarCheck}
                actions={
                  <Tabs<'unit' | 'function'>
                    variant="segmented"
                    value={effectiveHeatBy}
                    onChange={setHeatBy}
                    tabs={[
                      { id: 'unit', label: 'By unit', disabled: !!unitId },
                      { id: 'function', label: 'By function' },
                    ]}
                  />
                }
              />
              {heat.length ? <PulseHeatmap rows={heat} domain={domain} groupLabel={effectiveHeatBy === 'unit' ? 'Unit' : 'Function'} /> : <EmptyState size="sm" icon={Lock} title="No responses for this selection" />}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <HeatLegend domain={domain} />
                <span className="text-xs text-muted">Rows with fewer than {MIN_GROUP} responses are hidden.</span>
              </div>
            </Card>

            {/* ── impact ── */}
            <ImpactCard impact={impact} baseline={focus.baseline} period={focus.period} />

            {/* ── questions ── */}
            <QuestionTrendCard rows={qRows} periods={trend.map(quarterLabel)} />

            {/* ── comments ── */}
            <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
              <Card className="xl:col-span-2">
                <CardHeader title="Comment themes" subtitle={`${pluralize(comments.length, 'comment')} in ${focus.period}, grouped by keyword`} icon={Sparkles} iconTone="mentor" />
                {themes.length === 0 ? (
                  <EmptyState size="sm" icon={MessageSquareQuote} title="No comments this quarter" />
                ) : (
                  <ul className="flex flex-col gap-3.5">
                    {themes.map((t) => (
                      <li key={t.id}>
                        <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
                          <span className="font-medium text-ink">{t.label}</span>
                          <span className="shrink-0 text-ink-2 tabular">
                            <span className="font-semibold text-ink">{t.count}</span> · {formatPercent(t.share)}
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#EDF0F6]">
                          <div className="h-full rounded-full bg-mentor" style={{ width: `${(t.count / themes[0].count) * 100}%` }} />
                        </div>
                        <p className="mt-1 truncate text-xs text-ink-2 italic" title={t.examples[0]}>
                          “{t.examples[0]}”
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card className="xl:col-span-3" padding="none">
                <CardHeader divider title="Latest comments" subtitle="Shown without names — unit and date only" icon={MessageSquareQuote} />
                {comments.length === 0 ? (
                  <EmptyState size="sm" icon={MessageSquareQuote} title="No comments yet" />
                ) : (
                  <ul className="divide-y divide-line">
                    {comments.slice(0, 7).map((c) => (
                      <li key={c.id} className="flex gap-3 px-5 py-3.5">
                        <Quote className="mt-0.5 size-4 shrink-0 text-mentor/60" />
                        <div className="min-w-0">
                          <p className="text-[13.5px] leading-relaxed text-ink">{c.text}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
                            <Badge tone="outline" size="sm">
                              {unitName(db, c.unitId, true)}
                            </Badge>
                            {c.at && formatDate(c.at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </>
        )
      )}
    </>
  );
}

function ImpactCard({ impact, baseline, period }: { impact: ReturnType<typeof disciplineImpact>; baseline: boolean; period: string }) {
  if (!impact)
    return (
      <Card className="mt-6">
        <CardHeader title="MyPeopleHour impact" subtitle="Pulse scores by the manager’s completion discipline" icon={Sparkles} iconTone="mentor" />
        <EmptyState
          size="sm"
          icon={CalendarCheck}
          tone="neutral"
          title={baseline ? `${period} is the baseline` : 'No completed MyPeopleHour months yet'}
          message={baseline ? 'This pulse ran before MyPeopleHour launched — pick a later quarter to compare discipline groups.' : 'Discipline is measured on closed months; check back after the first month closes.'}
        />
      </Card>
    );
  const { groups, months } = impact;
  const data = PULSE_CATEGORIES.map((c) => {
    const d: Record<string, string | number | null> = { cat: c === 'Manager Support' ? 'Mgr support' : c };
    for (const b of DISCIPLINE_BANDS) d[b] = groups[b].categories[c] ? Number(groups[b].categories[c]!.avg.toFixed(2)) : null;
    return d;
  });
  const window = months.length > 1 ? `${formatMonth(months[0])} – ${formatMonth(months[months.length - 1])}` : formatMonth(months[0]);
  return (
    <Card className="mt-6">
      <CardHeader
        title="MyPeopleHour impact"
        subtitle={`${period} pulse scores of people whose manager completed ≥ 90% vs < 70% of their monthly hours (${window}).`}
        icon={Sparkles}
        iconTone="mentor"
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          {(['high', 'low'] as const).map((b) => {
            const g = groups[b];
            return (
              <div key={b} className="rounded-xl border border-line p-3.5">
                <p className="flex items-center gap-2 text-xs font-semibold text-ink-2">
                  <span className="size-2.5 rounded-[3px]" style={{ background: DISCIPLINE_META[b].color }} />
                  {DISCIPLINE_META[b].label}
                </p>
                {g.suppressed ? (
                  <p className="mt-2 text-sm text-ink-2">Fewer than {MIN_GROUP} respondents — hidden.</p>
                ) : (
                  <div className="mt-2 flex items-end gap-6">
                    <div>
                      <p className="text-2xl leading-7 font-bold text-ink tabular">{g.index == null ? '—' : g.index.toFixed(2)}</p>
                      <p className="text-xs text-ink-2">pulse index</p>
                    </div>
                    <div>
                      <p className="text-2xl leading-7 font-bold text-ink tabular">{g.enps == null ? '—' : signed(g.enps)}</p>
                      <p className="text-xs text-ink-2">eNPS</p>
                    </div>
                  </div>
                )}
                <p className="mt-2 text-xs text-muted">
                  {pluralize(g.respondents, 'respondent')} · {pluralize(g.managers, 'manager')}
                </p>
              </div>
            );
          })}
          {impact.indexGap != null && (
            <p className="rounded-xl bg-mentor-soft px-3.5 py-3 text-[13px] leading-5 text-ink">
              Teams of disciplined managers score <strong>{signed(impact.indexGap, 2)}</strong> higher on the pulse index
              {impact.enpsGap != null ? (
                <>
                  {' '}
                  and <strong>{signed(impact.enpsGap)} pts</strong> on eNPS
                </>
              ) : null}
              .
            </p>
          )}
        </div>
        {groups.high.suppressed || groups.low.suppressed ? (
          <div className="grid place-items-center rounded-xl border border-dashed border-line-strong bg-canvas/60 p-6">
            <EmptyState
              size="sm"
              icon={Lock}
              tone="neutral"
              title="Too few people to compare"
              message={`The high- and low-discipline groups each need at least ${MIN_GROUP} respondents in this selection. Across all units the pattern is visible — ask the programme team for the organisation-wide view.`}
            />
          </div>
        ) : (
        <div>
          <GroupedBar
            data={data}
            xKey="cat"
            series={DISCIPLINE_BANDS.map((b) => ({ key: b, label: DISCIPLINE_META[b].label, color: DISCIPLINE_META[b].color }))}
            domain={[0, 5]}
            height={280}
            valueFormatter={(v) => v.toFixed(1)}
            legend={false}
          />
          <ChartLegend className="mt-3" items={DISCIPLINE_BANDS.map((b) => ({ label: `${DISCIPLINE_META[b].label} · n=${groups[b].respondents}`, color: DISCIPLINE_META[b].color }))} />
          <p className="mt-2 text-xs text-muted">Correlation, not proof of cause — but a consistent pattern quarter after quarter is the outcome the programme is designed for.</p>
        </div>
        )}
      </div>
    </Card>
  );
}

function QuestionTrendCard({ rows, periods }: { rows: QuestionTrendRow[]; periods: string[] }) {
  const columns: Column<QuestionTrendRow>[] = [
    {
      key: 'q',
      header: 'Question',
      cell: (r) => {
        const m = TYPE_META[r.type];
        return (
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-md bg-primary-soft text-primary" title={m.label}>
              <m.icon className="size-3.5" />
            </span>
            <div className="min-w-0">
              <p className="leading-snug text-ink">{r.text}</p>
              <p className="mt-0.5 text-xs text-ink-2">
                {r.category ?? 'No category'} · {r.metric === 'avg' ? 'average /5' : r.metric === 'enps' ? 'eNPS' : r.metric === 'pct' ? '% yes' : r.metric === 'count' ? 'comments' : 'most chosen'}
              </p>
            </div>
          </div>
        );
      },
    },
    ...periods.map(
      (p, i): Column<QuestionTrendRow> => ({
        key: `p${i}`,
        header: p,
        align: 'right',
        width: 150,
        hideBelow: i < periods.length - 2 ? 'lg' : undefined,
        cell: (r) => <span className={i === periods.length - 1 ? 'font-semibold whitespace-nowrap text-ink tabular' : 'whitespace-nowrap text-ink-2 tabular'}>{r.cells[i]?.display ?? '—'}</span>,
      }),
    ),
    {
      key: 'delta',
      header: 'Change',
      align: 'right',
      width: 120,
      sortValue: (r) => r.delta,
      cell: (r) =>
        r.delta == null ? (
          <span className="text-muted">—</span>
        ) : (
          <DeltaChip value={r.delta} digits={r.metric === 'avg' ? 2 : 0} suffix={r.metric === 'pct' ? ' pts' : r.metric === 'enps' ? '' : ''} />
        ),
    },
  ];
  return (
    <Card className="mt-6" padding="none">
      <CardHeader divider title="Question-level trend" subtitle="Every pulse question by quarter — change is the latest quarter vs the one before." icon={Activity} />
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} pageSize={0} minWidth={760} />
    </Card>
  );
}

