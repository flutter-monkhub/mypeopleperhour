// Mentoring dashboard — Admin rows A39–A45.
// Cohort (default: running cohort) + mentee function + mentor filters; KPIs; six-month progress;
// hours invested & sessions by month; sentiment split / trend / comments; mentor of the month;
// the four deck metrics; mentor–mentee progress table with CSV export.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  CircleCheck,
  Clock,
  Download,
  HeartHandshake,
  ListTodo,
  MessageSquareQuote,
  Quote,
  Shuffle,
  Smile,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  UsersRound,
} from 'lucide-react';
import type { MonthKey, Sentiment } from '@shared/types';
import { MENTORING_FRAMEWORK, MENTORING_METRICS, MENTORING_TAGLINE } from '@shared/content/mentoring';
import { monthKey } from '@shared/utils/dates';
import { BarChart, Donut, SENTIMENT_COLORS, StackedBar } from '@/components/charts';
import { PageHeader } from '@/components/layout';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  FilterBar,
  FilterSelect,
  KpiCard,
  LinkButton,
  PersonCell,
  SearchInput,
  Tabs,
  toast,
  type Column,
} from '@/components/ui';
import { downloadCsv, csvFilename } from '@/lib/csv';
import { formatDate, formatDecimal, formatMonth, formatNumber, formatPercent, timeAgo } from '@/lib/format';
import { functionName } from '@/lib/lookup';
import { useCan } from '@/lib/rbac';
import {
  ANCHORS,
  PAIR_HEALTH_META,
  anchorGuide,
  anchorProgress,
  cohortPairs,
  cohortTimeline,
  latestComments,
  mentorOfTheMonth,
  mentoringKpis,
  monthlyMentoring,
  pairProgress,
  sentimentSplit,
  type PairHealth,
  type PairProgress,
} from '@/lib/analytics-mentoring';
import { useDb } from '@/store/db';
import { AnchorDots, MentoringEyebrow, PairHealthBadge, Rating, ViewOnlyBadge } from './components/bits';
import { CohortPicker, useCohortParam } from './components/cohort';
import { MentorOfMonth } from './components/MentorOfMonth';
import { ProgrammeProgress } from './components/ProgrammeProgress';

const ANCHOR_COLORS = { a1: '#C995D9', a2: '#9A52B0', a3: '#62247A', extra: '#94A3B8' } as const;
const SENTIMENT_LABEL: Record<Sentiment, string> = { positive: 'Positive', neutral: 'Neutral', negative: 'Negative' };
const ANCHOR_STATE_TEXT = { completed: 'Completed', scheduled: 'Scheduled', none: 'Not yet' } as const;

type HealthTab = 'all' | PairHealth;

export default function MentoringDashboard() {
  const db = useDb();
  const navigate = useNavigate();
  const canEdit = useCan('mentoring.edit');
  const { cohortId, cohort, cohorts, setCohortId } = useCohortParam('programme');
  const [functionId, setFunctionId] = useState('');
  const [mentorId, setMentorId] = useState('');
  const [healthTab, setHealthTab] = useState<HealthTab>('all');
  const [q, setQ] = useState('');
  const now = useMemo(() => new Date(), []);

  const filters = useMemo(() => ({ cohortId, functionId: functionId || null, mentorId: mentorId || null }), [cohortId, functionId, mentorId]);
  const timeline = cohort ? cohortTimeline(cohort, now) : null;
  const kpis = mentoringKpis(db, filters, now);
  const monthly = monthlyMentoring(db, filters, now);
  const pairs = pairProgress(db, filters, now);
  const anchors = anchorProgress(db, filters, now);
  const sentiment = sentimentSplit(db, filters);
  const comments = latestComments(db, filters, 4);

  // Mentor of the month — current month when it is part of the cohort, else the last cohort month
  const motmMonths = useMemo(() => monthly.map((m) => m.key).reverse(), [monthly]);
  const [motmPick, setMotmPick] = useState<MonthKey | null>(null);
  const motmMonth = motmPick && motmMonths.includes(motmPick) ? motmPick : (motmMonths[0] ?? monthKey(now));
  const motm = mentorOfTheMonth(db, filters, motmMonth);

  // Filter options (mentor list ignores the mentor filter itself)
  const functionOptions = useMemo(() => db.functions.filter((f) => f.id !== 'F-EXE').map((f) => ({ value: f.id, label: f.name })), [db.functions]);
  const mentorOptions = useMemo(() => {
    const ids = [...new Set(cohortPairs(db, { cohortId, functionId: functionId || null }).map((m) => m.mentorId))];
    return ids.map((id) => ({ value: id, label: db.employees.find((e) => e.id === id)?.name ?? id })).sort((a, b) => a.label.localeCompare(b.label));
  }, [db, cohortId, functionId]);
  const activeFilters = (functionId ? 1 : 0) + (mentorId ? 1 : 0);

  const healthCounts = useMemo(() => {
    const c: Record<HealthTab, number> = { all: pairs.length, on_track: 0, at_risk: 0, behind: 0 };
    for (const p of pairs) c[p.health]++;
    return c;
  }, [pairs]);
  const visiblePairs = useMemo(() => {
    const s = q.trim().toLowerCase();
    return pairs.filter((p) => (healthTab === 'all' || p.health === healthTab) && (!s || `${p.mentor?.name} ${p.mentee?.name}`.toLowerCase().includes(s)));
  }, [pairs, healthTab, q]);

  const exportPairs = () => {
    if (!pairs.length) return toast.info('Nothing to export', 'There are no pairs for these filters.');
    downloadCsv(csvFilename(`mentoring-pairs-${cohortId.toLowerCase()}`), pairs, [
      { header: 'Cohort', value: () => cohort?.name ?? '' },
      { header: 'Mentor', value: (p) => p.mentor?.name ?? p.match.mentorId },
      { header: 'Mentor function', value: (p) => functionName(db, p.mentor?.functionId) },
      { header: 'Mentee', value: (p) => p.mentee?.name ?? p.match.menteeId },
      { header: 'Mentee function', value: (p) => functionName(db, p.mentee?.functionId) },
      ...ANCHORS.map((a) => ({ header: `Conversation ${a} · ${anchorGuide(a).title}`, value: (p: PairProgress) => ANCHOR_STATE_TEXT[p.anchors[a]] })),
      { header: 'Additional touchpoints', value: (p) => p.extraCompleted },
      { header: 'Conversations completed', value: (p) => p.completed },
      { header: 'Hours invested', value: (p) => p.completed },
      { header: 'Last conversation', value: (p) => (p.lastConversation ? formatDate(p.lastConversation.start) : '') },
      { header: 'Next scheduled', value: (p) => (p.nextScheduled ? formatDate(p.nextScheduled.start) : '') },
      { header: 'Open action items', value: (p) => p.openActions },
      { header: 'Overdue action items', value: (p) => p.overdueActions },
      { header: 'Average mentee rating', value: (p) => (p.avgRating != null ? Number(p.avgRating.toFixed(2)) : '') },
      { header: 'Status', value: (p) => PAIR_HEALTH_META[p.health].label },
      { header: 'Status note', value: (p) => p.healthNote },
    ]);
    toast.success('Export ready', `${pluralRows(pairs.length)} downloaded as CSV.`);
  };

  const columns: Column<PairProgress>[] = [
    {
      key: 'mentee',
      header: 'Mentee',
      sortValue: (p) => p.mentee?.name,
      cell: (p) => <PersonCell name={p.mentee?.name ?? p.match.menteeId} secondary={functionName(db, p.mentee?.functionId)} />,
    },
    {
      key: 'mentor',
      header: 'Mentor',
      sortValue: (p) => p.mentor?.name,
      cell: (p) => <PersonCell name={p.mentor?.name ?? p.match.mentorId} secondary={functionName(db, p.mentor?.functionId)} />,
    },
    {
      key: 'conversations',
      header: 'Conversations',
      sortValue: (p) => p.anchorsCompleted * 10 + p.extraCompleted,
      cell: (p) => <AnchorDots anchors={p.anchors} extra={p.extraCompleted} size="sm" />,
    },
    {
      key: 'last',
      header: 'Last · next',
      hideBelow: 'xl',
      sortValue: (p) => p.lastConversation?.start,
      cell: (p) => (
        <span className="flex flex-col text-xs leading-5 whitespace-nowrap">
          <span className={p.lastConversation ? 'text-ink' : 'text-muted'}>{p.lastConversation ? `Last ${formatDate(p.lastConversation.start)}` : 'No conversation yet'}</span>
          <span className={p.nextScheduled ? 'text-mentor' : 'text-muted'}>
            {p.nextScheduled ? `Next ${formatDate(p.nextScheduled.start)} · ${p.nextScheduled.anchor ? `C${p.nextScheduled.anchor}` : 'touchpoint'}` : 'Nothing scheduled'}
          </span>
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Open actions',
      align: 'center',
      sortValue: (p) => p.openActions,
      cell: (p) =>
        p.openActions ? (
          <span className="inline-flex flex-col items-center leading-5">
            <span className="font-semibold text-ink tabular">{p.openActions}</span>
            {p.overdueActions > 0 && <span className="text-[11px] font-medium text-danger">{p.overdueActions} overdue</span>}
          </span>
        ) : (
          <span className="text-muted">0</span>
        ),
    },
    { key: 'rating', header: 'Avg rating', align: 'center', hideBelow: 'md', sortValue: (p) => p.avgRating ?? -1, cell: (p) => <Rating value={p.avgRating} /> },
    {
      key: 'health',
      header: 'Status',
      sortValue: (p) => ['behind', 'at_risk', 'on_track'].indexOf(p.health),
      cell: (p) => <PairHealthBadge health={p.health} note={p.healthNote} />,
    },
  ];

  const started = !!timeline?.started;
  const hoursThisMonth = monthly.find((m) => m.key === monthKey(now))?.hours ?? 0;
  const sentimentTotal = sentiment.positive + sentiment.neutral + sentiment.negative;
  const cohortApps = db.applications.filter((a) => a.cohortId === cohortId && a.status !== 'draft');
  const cohortMatches = db.matches.filter((m) => m.cohortId === cohortId);
  const appCount = (...s: string[]) => cohortApps.filter((a) => s.includes(a.status)).length;
  const pipeline = [
    { label: 'Applied', value: cohortApps.length, hint: `${appCount('withdrawn')} withdrawn`, bar: 'bg-info' },
    { label: 'In review', value: appCount('submitted', 'under_review'), hint: `${appCount('submitted')} not started`, bar: 'bg-warning' },
    { label: 'With mentors', value: cohortMatches.filter((m) => m.status === 'proposed').length, hint: 'awaiting a reply', bar: 'bg-[#B57CC7]' },
    { label: 'Accepted', value: cohortMatches.filter((m) => m.status === 'accepted').length, hint: 'ready for final match', bar: 'bg-mentor' },
    { label: 'Matched', value: appCount('matched'), hint: 'final match confirmed', bar: 'bg-success' },
    { label: 'Not matched', value: appCount('not_matched'), hint: `${cohortMatches.filter((m) => m.status === 'declined').length} mentor declines`, bar: 'bg-danger' },
  ];
  const cohortMentors = new Set(cohortPairs(db, { cohortId }).map((m) => m.mentorId)).size;
  const framework = [
    { label: 'Senior-leader mentors', actual: formatNumber(db.mentors.filter((m) => m.active).length), target: MENTORING_FRAMEWORK.mentors.replace('Around ', '~') },
    { label: 'Mentees per mentor', actual: cohortMentors ? formatDecimal(kpis.activePairs / cohortMentors) : '—', target: MENTORING_FRAMEWORK.menteesPerMentor },
    { label: 'Programme month', actual: timeline ? String(Math.min(timeline.monthIndex, 6)) : '—', target: String(MENTORING_FRAMEWORK.durationMonths) },
    { label: 'Conversations / mentee', actual: kpis.activePairs ? formatDecimal(kpis.sessionsCompleted / kpis.activePairs) : '—', target: MENTORING_FRAMEWORK.conversations },
  ];

  return (
    <>
      <PageHeader
        eyebrow={<MentoringEyebrow />}
        title="Mentoring dashboard"
        subtitle={`${MENTORING_TAGLINE}. Conversations, hours invested and how mentees feel — tracked across the six-month cohort.`}
        meta={!canEdit ? <ViewOnlyBadge /> : undefined}
        actions={
          <>
            <Button variant="secondary" icon={Download} onClick={exportPairs}>
              Export pairs
            </Button>
            {canEdit && (
              <LinkButton to="/mentoring/matching" variant="mentor" icon={Shuffle}>
                Matching workspace
              </LinkButton>
            )}
          </>
        }
      />

      <FilterBar
        className="mb-6"
        activeCount={activeFilters}
        onReset={() => (setFunctionId(''), setMentorId(''))}
        actions={<CohortPicker cohorts={cohorts} value={cohortId} onChange={(id) => (setCohortId(id), setMentorId(''))} />}
      >
        <FilterSelect label="Mentee function" value={functionId} onChange={(v) => (setFunctionId(v), setMentorId(''))} options={functionOptions} allLabel="All functions" />
        <FilterSelect label="Mentor" value={mentorId} onChange={setMentorId} options={mentorOptions} allLabel="All mentors" disabled={!mentorOptions.length} />
      </FilterBar>

      {/* KPIs — or, before the cohort starts, the matching pipeline */}
      {started ? (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          <KpiCard
            label="Active pairs"
            value={formatNumber(kpis.activePairs)}
            icon={HeartHandshake}
            tone="mentor"
            hint={started ? `${pairs.length ? formatPercent(healthCounts.on_track / pairs.length) : '—'} on track` : 'Pairs start with the cohort'}
          />
          <KpiCard
            label="Sessions completed"
            value={formatNumber(kpis.sessionsCompleted)}
            icon={CircleCheck}
            tone="success"
            hint={`${kpis.sessionsThisMonth} this month · ${kpis.sessionsScheduled} scheduled`}
          />
          <KpiCard
            label="Hours invested"
            value={`${formatNumber(kpis.hoursInvested)} h`}
            icon={Clock}
            tone="mentor"
            hint={`${formatNumber(hoursThisMonth)} h this month · 60 min each`}
          />
          <KpiCard
            label="Avg mentee rating"
            value={
              kpis.avgRating != null ? (
                <>
                  {kpis.avgRating.toFixed(1)}
                  <span className="text-base font-semibold text-muted"> / 5</span>
                </>
              ) : (
                '—'
              )
            }
            icon={Star}
            tone="warning"
            hint={kpis.ratingCount ? `From ${formatNumber(kpis.ratingCount)} ratings` : 'No feedback yet'}
          />
          <KpiCard
            label="Positive sentiment"
            value={kpis.positiveShare != null ? formatPercent(kpis.positiveShare) : '—'}
            icon={Smile}
            tone="success"
            hint={kpis.feedbackCount ? `${sentiment.negative} negative of ${kpis.feedbackCount}` : 'No feedback yet'}
          />
          <KpiCard
            label="Open action items"
            value={formatNumber(kpis.openActions)}
            icon={ListTodo}
            tone={kpis.overdueActions ? 'danger' : 'info'}
            hint={kpis.overdueActions ? <span className="font-medium text-danger">{kpis.overdueActions} overdue</span> : 'None overdue'}
          />
        </div>
      ) : (
        <Card className="mb-6">
          <CardHeader icon={Shuffle} iconTone="mentor" title="Matching pipeline" subtitle={`Where ${cohort?.name ?? 'this cohort'}’s applicants are before the programme begins`} />
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {pipeline.map((p, i) => (
              <li key={p.label} className="relative rounded-xl border border-line bg-white px-4 py-3">
                <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-2 uppercase">
                  {i + 1}. {p.label}
                </p>
                <p className="mt-1 text-2xl font-bold text-ink tabular">{p.value}</p>
                <p className="truncate text-xs text-ink-2">{p.hint}</p>
                <span className={`absolute inset-x-4 bottom-0 h-0.5 rounded-full ${p.bar}`} aria-hidden />
              </li>
            ))}
          </ol>
          <EmptyState
            tone="mentor"
            icon={Sparkles}
            title={`${cohort?.name ?? 'This cohort'} hasn’t started yet`}
            message={
              cohort
                ? `Pairs begin meeting on ${formatDate(cohort.startDate)}. Hours invested, sentiment and mentor of the month appear here once the first conversations are completed.`
                : 'Choose a cohort.'
            }
            action={
              canEdit ? (
                <>
                  <LinkButton to={`/mentoring/applications?cohort=${cohortId}`} variant="secondary">
                    Review applications
                  </LinkButton>
                  <LinkButton to={`/mentoring/matching?cohort=${cohortId}`} variant="mentor" icon={Shuffle}>
                    Open matching workspace
                  </LinkButton>
                </>
              ) : (
                <LinkButton to={`/mentoring/applications?cohort=${cohortId}`} variant="secondary">
                  View applications
                </LinkButton>
              )
            }
          />
        </Card>
      )}

      {timeline && (
        <div className="mb-6">
          <ProgrammeProgress timeline={timeline} anchors={anchors} />
        </div>
      )}

      {started && (
        <>
          {/* A41 / A40 */}
          <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader
                icon={Clock}
                iconTone="mentor"
                title="Hours invested"
                subtitle="Completed conversations × 60 minutes, by programme month"
                actions={<Badge tone="mentor">{formatNumber(kpis.hoursInvested)} h total</Badge>}
              />
              <BarChart data={monthly} xKey="axis" yKey="hours" label="Hours invested" color="#7E3794" height={240} showValues valueFormatter={(v) => `${v} h`} />
            </Card>
            <Card>
              <CardHeader
                icon={CalendarCheck}
                iconTone="mentor"
                title="Sessions completed"
                subtitle={`By conversation, per month · ${kpis.sessionsScheduled} more scheduled`}
                actions={<Badge tone="success">{formatNumber(kpis.sessionsCompleted)} completed</Badge>}
              />
              <StackedBar
                data={monthly}
                xKey="axis"
                height={214}
                series={[
                  { key: 'a1', label: `1 · ${anchorGuide(1).title}`, color: ANCHOR_COLORS.a1 },
                  { key: 'a2', label: `2 · ${anchorGuide(2).title}`, color: ANCHOR_COLORS.a2 },
                  { key: 'a3', label: `3 · ${anchorGuide(3).title}`, color: ANCHOR_COLORS.a3 },
                  { key: 'extra', label: 'Additional touchpoint', color: ANCHOR_COLORS.extra },
                ]}
              />
            </Card>
          </div>

          {/* A42 */}
          <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-12">
            <Card className="xl:col-span-7">
              <CardHeader icon={Smile} iconTone="success" title="Mentee sentiment" subtitle="From feedback after each completed conversation — split and trend by month" />
              {sentimentTotal ? (
                <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                  <Donut
                    size={150}
                    thickness={18}
                    legend="bottom"
                    data={(['positive', 'neutral', 'negative'] as Sentiment[]).map((s) => ({ name: SENTIMENT_LABEL[s], value: sentiment[s], color: SENTIMENT_COLORS[s] }))}
                    center={
                      <span>
                        <span className="block text-2xl leading-7 font-bold text-ink tabular">{formatPercent(sentiment.positive / sentimentTotal)}</span>
                        <span className="text-[11px] text-ink-2">positive</span>
                      </span>
                    }
                  />
                  <div className="min-w-0">
                    <p className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold text-ink-2">
                      <TrendingUp className="size-3.5" /> Trend by month
                    </p>
                    <StackedBar
                      data={monthly}
                      xKey="axis"
                      percent
                      height={190}
                      series={(['positive', 'neutral', 'negative'] as Sentiment[]).map((s) => ({ key: s, label: SENTIMENT_LABEL[s], color: SENTIMENT_COLORS[s] }))}
                    />
                  </div>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:col-span-2">
                    {monthly.map((m) => (
                      <li key={m.key} className="rounded-lg border border-line px-3 py-2">
                        <p className="text-xs font-semibold text-ink">{m.axis}</p>
                        <p className="mt-0.5 flex items-center justify-between gap-2 text-xs text-ink-2">
                          <span>{m.feedback ? `${formatPercent(m.positive / m.feedback)} positive` : 'No feedback'}</span>
                          <Rating value={m.avgRating} count={m.feedback || undefined} className="text-xs" />
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <EmptyState size="sm" tone="mentor" icon={Smile} title="No feedback yet" message="Mentees rate each conversation once it’s completed." />
              )}
            </Card>
            <Card className="xl:col-span-5">
              <CardHeader icon={MessageSquareQuote} iconTone="mentor" title="Latest mentee comments" subtitle="Anonymised — only the mentor and conversation are shown" />
              {comments.length ? (
                <ul className="flex flex-col gap-3">
                  {comments.map((c) => (
                    <li key={c.session.id} className="rounded-xl border border-line bg-canvas/60 px-3.5 py-3">
                      <div className="flex gap-2.5">
                        <Quote className="mt-0.5 size-4 shrink-0 text-mentor/60" aria-hidden />
                        <p className="text-[13px] leading-relaxed text-ink">{c.feedback.comment}</p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 pl-6.5 text-xs text-ink-2">
                        <Rating value={c.feedback.rating} full />
                        <Badge tone={c.feedback.sentiment === 'positive' ? 'success' : c.feedback.sentiment === 'negative' ? 'danger' : 'neutral'} size="sm">
                          {SENTIMENT_LABEL[c.feedback.sentiment]}
                        </Badge>
                        <span className="truncate">
                          {c.session.anchor ? `Conversation ${c.session.anchor}` : 'Touchpoint'} with {c.mentor?.name} · {timeAgo(c.feedback.at)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState size="sm" tone="mentor" icon={MessageSquareQuote} title="No comments yet" message="Comments appear here as mentees share feedback." />
              )}
            </Card>
          </div>

          {/* Rule 14 + deck metrics */}
          <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <MentorOfMonth ranks={motm} month={motmMonth} months={motmMonths} onMonth={setMotmPick} />
            </div>
            <Card className="lg:col-span-7">
              <CardHeader icon={Target} iconTone="mentor" title="Programme tracking" subtitle="The four measures from the programme framework, for this cohort" />
              <ul className="flex flex-col divide-y divide-line">
                {[
                  {
                    icon: Clock,
                    label: MENTORING_METRICS[0],
                    value: `${formatNumber(hoursThisMonth)} h`,
                    detail: `${formatMonth(monthKey(now))} · ${formatNumber(kpis.hoursInvested)} h since the cohort began`,
                  },
                  {
                    icon: Smile,
                    label: MENTORING_METRICS[1],
                    value: kpis.positiveShare != null ? formatPercent(kpis.positiveShare) : '—',
                    detail:
                      kpis.avgRating != null ? `positive · average rating ${kpis.avgRating.toFixed(1)} / 5 from ${formatNumber(kpis.ratingCount)} ratings` : 'No feedback yet',
                  },
                  {
                    icon: CircleCheck,
                    label: MENTORING_METRICS[2],
                    value: formatNumber(kpis.sessionsCompleted),
                    detail: `${kpis.sessionsThisMonth} this month · ${kpis.sessionsScheduled} scheduled ahead`,
                  },
                  {
                    icon: UsersRound,
                    label: MENTORING_METRICS[3],
                    value: motm[0]?.mentor?.name ?? '—',
                    detail: motm[0]
                      ? `${motm[0].sessions} sessions in ${formatMonth(motmMonth)}${motm[0].avgRating != null ? ` · rated ${motm[0].avgRating.toFixed(1)}` : ''}`
                      : `No sessions in ${formatMonth(motmMonth)}`,
                  },
                ].map((m, i) => (
                  <li key={i} className="flex items-center gap-3.5 py-3 first:pt-0 last:pb-0">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-mentor-soft text-mentor">
                      <m.icon className="size-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink">{m.label}</p>
                      <p className="truncate text-xs text-ink-2">{m.detail}</p>
                    </div>
                    <span className="max-w-[45%] shrink-0 truncate text-right text-lg font-bold text-ink tabular">{m.value}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 rounded-xl bg-mentor-soft/60 px-4 py-3">
                <p className="mb-2 text-[11px] font-semibold tracking-[0.06em] text-mentor uppercase">Framework vs this cohort</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  {framework.map((f) => (
                    <div key={f.label} className="min-w-0">
                      <dt className="truncate text-[11px] text-ink-2">{f.label}</dt>
                      <dd className="text-[13px] font-semibold text-ink tabular">
                        {f.actual} <span className="font-normal text-muted">/ {f.target}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* A43 */}
      <Card padding="none">
        <CardHeader
          divider
          icon={UsersRound}
          iconTone="mentor"
          title="Mentor / mentee progress"
          subtitle="Each pair against the anchor plan — Conversation 1 in month 1, 2 in month 3, 3 in month 6. Click a pair to open the application."
          actions={<SearchInput value={q} onChange={setQ} placeholder="Search mentor or mentee" size="sm" className="sm:w-60" />}
        />
        <div className="border-b border-line px-5 py-3">
          <Tabs<HealthTab>
            variant="pills"
            value={healthTab}
            onChange={setHealthTab}
            tabs={[
              { id: 'all', label: 'All pairs', count: healthCounts.all },
              { id: 'on_track', label: 'On track', count: healthCounts.on_track },
              { id: 'at_risk', label: 'At risk', count: healthCounts.at_risk },
              { id: 'behind', label: 'Behind', count: healthCounts.behind },
            ]}
          />
        </div>
        <DataTable
          columns={columns}
          rows={visiblePairs}
          rowKey={(p) => p.match.id}
          onRowClick={(p) => navigate(`/mentoring/applications/${p.match.applicationId}`)}
          initialSort={{ key: 'health', dir: 'asc' }}
          minWidth={900}
          emptyIcon={HeartHandshake}
          emptyTitle={pairs.length ? 'No pairs match' : started ? 'No active pairs for these filters' : 'No pairs yet'}
          emptyMessage={
            pairs.length
              ? 'Try another status tab or clear the search.'
              : started
                ? 'Try another function or mentor.'
                : 'Pairs appear here once final matches are confirmed and the cohort begins.'
          }
        />
      </Card>
    </>
  );
}

const pluralRows = (n: number) => `${formatNumber(n)} pair${n === 1 ? '' : 's'}`;
