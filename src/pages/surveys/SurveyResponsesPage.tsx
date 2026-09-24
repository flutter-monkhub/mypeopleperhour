// Survey responses — /surveys/:id/responses (SPEC A27).
// Header stats, unit/function filters (unit follows the top bar and is locked for a scoped HR admin),
// per-question aggregates and individual responses. Anonymous surveys never show names: respondents
// are numbered in submission order and shown with their unit only; groups under 5 are suppressed.

import { useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { BarChart3, CheckCheck, Clock3, Download, Eye, FilePen, FileQuestion, Lock, PencilLine, Send, ShieldCheck, Timer, Users } from 'lucide-react';
import type { ID, Survey, SurveyResponse } from '@shared/types';
import { MIN_GROUP, aggregateQuestion, formatAnswer, surveyResponses, surveyStats } from '@/lib/analytics-pulse';
import { csvFilename, downloadCsv, type CsvColumn } from '@/lib/csv';
import { formatDate, formatDateTime, formatDecimal, formatNumber, formatPercent, pluralize, timeAgo } from '@/lib/format';
import { employeeMap, functionName, unitName } from '@/lib/lookup';
import { useCan } from '@/lib/rbac';
import { respondentOrder } from '@/lib/reports';
import { useScope } from '@/lib/scope';
import { useDb } from '@/store/db';
import { useUiStore } from '@/store/ui';
import { PageHeader } from '@/components/layout';
import {
  Badge,
  Button,
  Callout,
  Card,
  DataTable,
  DescriptionList,
  Drawer,
  EmptyState,
  FilterBar,
  FilterSelect,
  KpiCard,
  LinkButton,
  PersonCell,
  ProgressRing,
  SearchInput,
  StatusBadge,
  Tabs,
  toast,
  type Column,
} from '@/components/ui';
import { AnonymityBadge, KindBadge, audienceLabel, dueLabel } from './components/meta';
import { QuestionResult } from './components/QuestionResult';
import { useSurveyLifecycle } from './components/useSurveyLifecycle';

type TabId = 'summary' | 'individual';

export default function SurveyResponsesPage() {
  const { id } = useParams();
  const db = useDb();
  const survey = db.surveys.find((s) => s.id === id);
  if (!survey)
    return (
      <>
        <PageHeader backTo="/surveys" backLabel="All surveys" title="Survey not found" />
        <Card>
          <EmptyState icon={FileQuestion} title="This survey doesn’t exist" message="The link may be incomplete, or the draft was deleted." action={<LinkButton to="/surveys" variant="secondary">Back to surveys</LinkButton>} />
        </Card>
      </>
    );
  return <Responses survey={survey} />;
}

interface Numbered {
  r: SurveyResponse;
  n: number;
}

function Responses({ survey }: { survey: Survey }) {
  const db = useDb();
  const canEdit = useCan('surveys.edit');
  const lifecycle = useSurveyLifecycle();
  const { unitId, locked, unit } = useScope();
  const setUnitId = useUiStore((s) => s.setUnitId);
  const [params, setParams] = useSearchParams();
  const [functionId, setFunctionId] = useState('');
  const tab: TabId = params.get('tab') === 'individual' ? 'individual' : 'summary';
  const filters = useMemo(() => ({ unitId, functionId: functionId || null }), [unitId, functionId]);

  const stats = surveyStats(db, survey, filters);
  const submitted = surveyResponses(db, survey.id, filters);
  const all = surveyResponses(db, survey.id, filters, 'all');
  const tooFew = survey.anonymous && submitted.length > 0 && submitted.length < MIN_GROUP;
  const aggregates = useMemo(() => (tooFew ? [] : survey.questions.map((q) => aggregateQuestion(q, submitted))), [survey.questions, submitted, tooFew]);

  // Respondent numbers follow submission order across the whole survey (stable under filters)
  const numbered: Numbered[] = useMemo(() => {
    const order = respondentOrder(surveyResponses(db, survey.id, {}, 'all'));
    const num = new Map(order.map((r, i) => [r.id, i + 1]));
    return respondentOrder(all).map((r) => ({ r, n: num.get(r.id) ?? 0 }));
  }, [db, survey.id, all]);

  const exportCsv = () => {
    const emp = employeeMap(db);
    const qCols: CsvColumn<Numbered>[] = survey.questions.map((q, i) => ({ header: `Q${i + 1}. ${q.text}`, value: (x) => formatAnswer(q, x.r.answers[q.id]) }));
    const rows = numbered.filter((x) => x.r.status === 'submitted');
    if (survey.anonymous && rows.length < MIN_GROUP) return toast.error('Too few responses to export', `Anonymous results need at least ${MIN_GROUP} responses for this selection.`);
    const idCols: CsvColumn<Numbered>[] = survey.anonymous
      ? [
          { header: 'Respondent', value: (x) => `Respondent #${x.n}` },
          { header: 'Unit', value: (x) => unitName(db, x.r.unitId) },
        ]
      : [
          { header: 'Employee code', value: (x) => emp.get(x.r.employeeId)?.code ?? x.r.employeeId },
          { header: 'Employee', value: (x) => emp.get(x.r.employeeId)?.name ?? '' },
          { header: 'Unit', value: (x) => unitName(db, x.r.unitId) },
          { header: 'Function', value: (x) => functionName(db, x.r.functionId) },
        ];
    downloadCsv(csvFilename(`survey-${survey.period}-${survey.title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')), rows, [
      ...idCols,
      { header: 'Submitted on', value: (x) => (x.r.submittedAt ? formatDate(x.r.submittedAt) : '') },
      ...qCols,
    ]);
    toast.success('CSV downloaded', `${pluralize(rows.length, 'response')}${survey.anonymous ? ' · anonymised' : ''}`);
  };

  const header = (
    <PageHeader
      backTo="/surveys"
      backLabel="All surveys"
      eyebrow={`Responses · ${survey.period}`}
      title={survey.title || 'Untitled survey'}
      meta={
        <>
          <StatusBadge status={survey.status} kind="survey" />
          <KindBadge kind={survey.kind} />
          <AnonymityBadge anonymous={survey.anonymous} />
          <span className="text-xs text-ink-2">
            {audienceLabel(db, survey)} · {dueLabel(survey)}
          </span>
        </>
      }
      actions={
        <>
          {survey.kind === 'pulse' && survey.status !== 'draft' && (
            <LinkButton to="/surveys/pulse" variant="ghost" icon={BarChart3}>
              Pulse analysis
            </LinkButton>
          )}
          <LinkButton to={`/surveys/${survey.id}`} variant="secondary" icon={canEdit && survey.status !== 'closed' ? FilePen : Eye}>
            {canEdit && survey.status !== 'closed' ? 'Edit survey' : 'View survey'}
          </LinkButton>
          {survey.status !== 'draft' && (
            <Button icon={Download} onClick={exportCsv} disabled={stats.submitted === 0}>
              Export CSV
            </Button>
          )}
        </>
      }
    />
  );

  if (survey.status === 'draft')
    return (
      <>
        {header}
        <Card>
          <EmptyState
            size="lg"
            icon={PencilLine}
            title="Not published yet — no responses to show"
            message={`This draft has ${pluralize(survey.questions.length, 'question')}. Once it is published, employees are notified in the app and results appear here as they come in.`}
            action={
              <>
                <LinkButton to={`/surveys/${survey.id}`} variant="secondary" icon={canEdit ? FilePen : Eye}>
                  {canEdit ? 'Continue editing' : 'Preview survey'}
                </LinkButton>
                {canEdit && (
                  <Button icon={Send} onClick={() => void lifecycle.publish(survey)}>
                    Publish
                  </Button>
                )}
              </>
            }
          />
        </Card>
      </>
    );

  const fnOptions = db.functions.map((f) => ({ value: f.id, label: f.name }));
  const rate = stats.responseRate;

  return (
    <>
      {header}

      <FilterBar
        activeCount={(functionId ? 1 : 0) + (!locked && unitId ? 1 : 0)}
        onReset={() => {
          setFunctionId('');
          if (!locked) setUnitId(null);
        }}
        actions={
          survey.anonymous ? (
            <span className="hidden items-center gap-1.5 text-xs text-ink-2 md:inline-flex">
              <ShieldCheck className="size-4 text-success" /> Groups under {MIN_GROUP} are hidden
            </span>
          ) : undefined
        }
      >
        <FilterSelect
          label="Unit"
          value={unitId ?? ''}
          allLabel={locked ? (null as unknown as string) : 'All units'}
          disabled={locked}
          options={db.units.filter((u) => !locked || u.id === unitId).map((u) => ({ value: u.id, label: u.name }))}
          onChange={(v) => setUnitId(v || null)}
        />
        <FilterSelect label="Function" value={functionId} allLabel="All functions" options={fnOptions} onChange={setFunctionId} />
        {locked && unit && (
          <Badge tone="warning" icon={Lock}>
            Scoped to {unit.name}
          </Badge>
        )}
      </FilterBar>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Responses" value={formatNumber(stats.submitted)} icon={CheckCheck} tone="success" hint={`of ${pluralize(stats.audience, 'person', 'people')} invited`} />
        <KpiCard
          label="Response rate"
          value={rate == null ? '—' : formatPercent(rate)}
          icon={Users}
          tone="primary"
          hint={survey.status === 'published' ? `Live · closes ${dueLabel(survey).split(' · ')[1]}` : 'Final result'}
          aside={
            rate != null ? (
              <ProgressRing value={rate * 100} size={56} stroke={7}>
                <span />
              </ProgressRing>
            ) : undefined
          }
        />
        <KpiCard label="Avg completion time" value={stats.avgMinutes == null ? '—' : `${formatDecimal(stats.avgMinutes)} min`} icon={Timer} tone="info" hint={stats.lastSubmittedAt ? `Last response ${timeAgo(stats.lastSubmittedAt)}` : 'No submissions yet'} />
        <KpiCard
          label="Submitted vs in progress"
          value={
            <span>
              {formatNumber(stats.submitted)} <span className="text-base font-semibold text-muted">/ {formatNumber(stats.drafts)}</span>
            </span>
          }
          icon={Clock3}
          tone="warning"
          hint={stats.drafts ? `${pluralize(stats.drafts, 'draft')} started but not submitted` : 'No unfinished drafts'}
        />
      </div>

      <Tabs<TabId>
        className="mt-8 mb-5"
        value={tab}
        onChange={(t) => setParams(t === 'summary' ? {} : { tab: t }, { replace: true })}
        tabs={[
          { id: 'summary', label: 'Summary by question', icon: BarChart3 },
          { id: 'individual', label: 'Individual responses', icon: Users, count: all.length },
        ]}
      />

      {stats.submitted === 0 && tab === 'summary' ? (
        <Card>
          <EmptyState
            icon={Send}
            title={all.length ? 'Responses are in progress' : 'No responses yet'}
            message={
              all.length
                ? `${pluralize(all.length, 'person has', 'people have')} started but nobody has submitted for this selection yet.`
                : survey.status === 'published'
                  ? `Published ${survey.publishedAt ? timeAgo(survey.publishedAt) : ''} — employees have been notified. Results appear here as soon as someone submits.`
                  : 'Nobody responded to this survey for the current selection.'
            }
          />
        </Card>
      ) : tooFew && tab === 'summary' ? (
        <Card>
          <EmptyState
            icon={ShieldCheck}
            tone="neutral"
            title="Not enough responses to show results"
            message={`This selection has ${pluralize(submitted.length, 'response')}. Anonymous results are only shown for groups of ${MIN_GROUP} or more so nobody can be identified. Widen the unit or function filter.`}
          />
        </Card>
      ) : tab === 'summary' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {survey.questions.map((q, i) => (
            <QuestionResult key={q.id} db={db} q={q} index={i} agg={aggregates[i]} anonymous={survey.anonymous} respondentOf={survey.anonymous ? undefined : (rid) => submitted.find((r) => r.id === rid)?.employeeId} />
          ))}
        </div>
      ) : (
        <Individual survey={survey} rows={numbered} tooFew={survey.anonymous && submitted.length < MIN_GROUP} />
      )}
    </>
  );
}

function Individual({ survey, rows, tooFew }: { survey: Survey; rows: Numbered[]; tooFew: boolean }) {
  const db = useDb();
  const emp = employeeMap(db);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'all' | 'submitted' | 'draft'>('all');
  const [open, setOpen] = useState<ID | null>(null);
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((x) => {
      if (status !== 'all' && x.r.status !== status) return false;
      if (!s) return true;
      if (survey.anonymous) return `respondent #${x.n}`.includes(s) || String(x.n) === s || unitName(db, x.r.unitId).toLowerCase().includes(s);
      const e = emp.get(x.r.employeeId);
      return !!e && (e.name.toLowerCase().includes(s) || e.code.toLowerCase().includes(s));
    });
  }, [rows, status, q, survey.anonymous, db, emp]);
  const answeredOf = (r: SurveyResponse) => survey.questions.filter((qq) => r.answers[qq.id] !== undefined && r.answers[qq.id] !== '').length;
  const current = rows.find((x) => x.r.id === open);

  if (tooFew)
    return (
      <Card>
        <EmptyState icon={ShieldCheck} tone="neutral" title="Hidden to protect anonymity" message={`Individual anonymous responses are only listed when the selection has at least ${MIN_GROUP} submitted responses.`} />
      </Card>
    );

  const columns: Column<Numbered>[] = [
    survey.anonymous
      ? {
          key: 'who',
          header: 'Respondent',
          sortValue: (x) => x.n,
          cell: (x) => (
            <span className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-full bg-neutral-soft text-ink-2">
                <Lock className="size-3.5" />
              </span>
              <span className="font-medium text-ink">Respondent #{x.n}</span>
            </span>
          ),
        }
      : {
          key: 'who',
          header: 'Employee',
          sortValue: (x) => emp.get(x.r.employeeId)?.name,
          cell: (x) => {
            const e = emp.get(x.r.employeeId);
            return <PersonCell name={e?.name ?? x.r.employeeId} secondary={e ? `${e.code} · ${e.designation}` : undefined} />;
          },
        },
    { key: 'unit', header: 'Unit', sortValue: (x) => unitName(db, x.r.unitId), cell: (x) => <span className="text-ink-2">{unitName(db, x.r.unitId)}</span> },
    ...(!survey.anonymous ? [{ key: 'fn', header: 'Function', hideBelow: 'xl' as const, sortValue: (x: Numbered) => functionName(db, x.r.functionId), cell: (x: Numbered) => <span className="text-ink-2">{functionName(db, x.r.functionId)}</span> }] : []),
    {
      key: 'status',
      header: 'Status',
      width: 130,
      sortValue: (x) => x.r.status,
      cell: (x) =>
        x.r.status === 'submitted' ? (
          <Badge tone="success" dot>
            Submitted
          </Badge>
        ) : (
          <Badge tone="warning" dot>
            In progress
          </Badge>
        ),
    },
    { key: 'at', header: 'Submitted', width: survey.anonymous ? 140 : 190, hideBelow: 'md', sortValue: (x) => x.r.submittedAt ?? '', cell: (x) => <span className="text-ink-2 tabular">{x.r.submittedAt ? (survey.anonymous ? formatDate(x.r.submittedAt) : formatDateTime(x.r.submittedAt)) : '—'}</span> },
    {
      key: 'time',
      header: 'Time taken',
      align: 'right',
      width: 110,
      hideBelow: 'lg',
      sortValue: (x) => (x.r.submittedAt ? new Date(x.r.submittedAt).getTime() - new Date(x.r.startedAt).getTime() : null),
      cell: (x) => <span className="text-ink-2 tabular">{x.r.submittedAt ? `${formatDecimal((new Date(x.r.submittedAt).getTime() - new Date(x.r.startedAt).getTime()) / 60000)} min` : '—'}</span>,
    },
    { key: 'answered', header: 'Answered', align: 'right', width: 110, sortValue: (x) => answeredOf(x.r), cell: (x) => <span className="text-ink tabular">{answeredOf(x.r)} / {survey.questions.length}</span> },
  ];

  const e = current && !survey.anonymous ? emp.get(current.r.employeeId) : undefined;
  return (
    <>
      <Card padding="none">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
          <Tabs<'all' | 'submitted' | 'draft'>
            variant="pills"
            value={status}
            onChange={setStatus}
            tabs={[
              { id: 'all', label: 'All', count: rows.length },
              { id: 'submitted', label: 'Submitted', count: rows.filter((x) => x.r.status === 'submitted').length },
              { id: 'draft', label: 'In progress', count: rows.filter((x) => x.r.status === 'draft').length },
            ]}
            className="flex-none"
          />
          <SearchInput value={q} onChange={setQ} size="sm" placeholder={survey.anonymous ? 'Respondent # or unit' : 'Name or employee code'} className="ml-auto" />
        </div>
        {survey.anonymous && (
          <p className="flex items-center gap-2 border-b border-line bg-[#FAFBFE] px-5 py-2.5 text-xs text-ink-2">
            <ShieldCheck className="size-4 text-success" /> Anonymous survey — respondents are numbered in the order they responded and shown with their unit only. Names are never shown.
          </p>
        )}
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(x) => x.r.id}
          onRowClick={(x) => setOpen(x.r.id)}
          pageSize={25}
          dense
          minWidth={640}
          initialSort={{ key: 'at', dir: 'desc' }}
          emptyTitle="No responses match"
          emptyMessage="Try another status or search."
        />
      </Card>

      <Drawer
        open={!!current}
        onClose={() => setOpen(null)}
        width="lg"
        title={current ? (survey.anonymous ? `Respondent #${current.n}` : (e?.name ?? current.r.employeeId)) : ''}
        subtitle={current ? `${unitName(db, current.r.unitId)}${!survey.anonymous ? ` · ${functionName(db, current.r.functionId)}` : ''}` : undefined}
        header={
          current && (
            <div className="flex flex-wrap items-center gap-2">
              {current.r.status === 'submitted' ? (
                <Badge tone="success" dot>
                  Submitted {current.r.submittedAt ? (survey.anonymous ? formatDate(current.r.submittedAt) : formatDateTime(current.r.submittedAt)) : ''}
                </Badge>
              ) : (
                <Badge tone="warning" dot>
                  In progress · started {timeAgo(current.r.startedAt)}
                </Badge>
              )}
              <AnonymityBadge anonymous={survey.anonymous} size="sm" />
            </div>
          )
        }
      >
        {current && (
          <DescriptionList
            columns={1}
            items={survey.questions.map((qq, i) => ({
              label: `Q${i + 1}. ${qq.text}`,
              value: formatAnswer(qq, current.r.answers[qq.id]) || <span className="text-muted italic">{current.r.status === 'draft' ? 'Not answered yet' : 'Skipped'}</span>,
            }))}
          />
        )}
      </Drawer>
      {survey.anonymous && <Callout tone="neutral" icon={ShieldCheck} className="mt-4">Exports of anonymous surveys contain respondent numbers and units only.</Callout>}
    </>
  );
}
