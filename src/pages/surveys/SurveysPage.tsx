// Surveys — /surveys (SPEC A23, A26). Cards or table of every survey with status, audience,
// response rate and lifecycle actions. A unit-scoped HR admin sees response figures for their unit.

import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  CalendarClock,
  CircleX,
  ClipboardList,
  Copy,
  FilePen,
  LayoutGrid,
  ListChecks,
  Lock,
  MoreHorizontal,
  Plus,
  Radio,
  Send,
  Trash2,
  Undo2,
  Users,
  Rows3,
  Eye,
  SearchX,
  Inbox,
} from 'lucide-react';
import type { Survey, SurveyKind, SurveyStatus } from '@shared/types';
import { fiscalQuarter } from '@shared/utils/dates';
import { pulseSurveys, surveyStats, type SurveyStats } from '@/lib/analytics-pulse';
import { cn } from '@/lib/cn';
import { formatDate, formatNumber, formatPercent, pluralize, timeAgo } from '@/lib/format';
import { useCan } from '@/lib/rbac';
import { useScope } from '@/lib/scope';
import { surveyIssues } from '@/store/actions';
import { useDb } from '@/store/db';
import { PageHeader } from '@/components/layout';
import {
  Badge,
  Button,
  Callout,
  Card,
  DataTable,
  DropdownMenu,
  EmptyState,
  FilterBar,
  FilterSelect,
  KpiCard,
  LinkButton,
  ProgressBar,
  SearchInput,
  StatusBadge,
  Tabs,
  type Column,
  type MenuItem,
} from '@/components/ui';
import { AnonymityBadge, KIND_META, KindBadge, audienceLabel, dueLabel } from './components/meta';
import { useSurveyLifecycle } from './components/useSurveyLifecycle';

type StatusFilter = 'all' | SurveyStatus;
interface Row {
  survey: Survey;
  stats: SurveyStats;
}

const STATUS_ORDER: Record<SurveyStatus, number> = { published: 0, draft: 1, closed: 2 };

export default function SurveysPage() {
  const db = useDb();
  const navigate = useNavigate();
  const canEdit = useCan('surveys.edit');
  const lifecycle = useSurveyLifecycle();
  const { locked, unitId, unit } = useScope();
  const scopeUnit = locked ? unitId : null;
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<SurveyKind | ''>('');
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const requested = params.get('status') as StatusFilter | null;
  const status: StatusFilter = requested && ['published', 'draft', 'closed'].includes(requested) ? requested : 'all';

  const rows: Row[] = useMemo(
    () =>
      db.surveys
        .map((s) => ({ survey: s, stats: surveyStats(db, s, { unitId: scopeUnit }) }))
        .sort((a, b) => STATUS_ORDER[a.survey.status] - STATUS_ORDER[b.survey.status] || b.survey.dueDate.localeCompare(a.survey.dueDate)),
    [db, scopeUnit],
  );
  const counts = useMemo(() => {
    const c = { all: rows.length, published: 0, draft: 0, closed: 0 };
    for (const r of rows) c[r.survey.status]++;
    return c;
  }, [rows]);
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) => (status === 'all' || r.survey.status === status) && (!kind || r.survey.kind === kind) && (!s || r.survey.title.toLowerCase().includes(s) || r.survey.period.toLowerCase().includes(s)),
    );
  }, [rows, status, kind, q]);

  // ── KPIs ──
  const kpi = useMemo(() => {
    const pulses = pulseSurveys(db);
    const current = [...pulses].reverse().find((p) => p.status === 'published') ?? pulses[pulses.length - 1];
    const prev = current ? pulses[pulses.indexOf(current) - 1] : undefined;
    const curStats = current ? surveyStats(db, current, { unitId: scopeUnit }) : null;
    const prevStats = prev ? surveyStats(db, prev, { unitId: scopeUnit }) : null;
    const quarter = fiscalQuarter(new Date());
    const thisQuarter = rows.filter((r) => r.survey.publishedAt && new Date(r.survey.publishedAt) >= quarter.start);
    const live = rows.filter((r) => r.survey.status === 'published');
    const nextDue = [...live].sort((a, b) => a.survey.dueDate.localeCompare(b.survey.dueDate))[0];
    const drafts = rows.filter((r) => r.survey.status === 'draft');
    return {
      current,
      curStats,
      prevRate: prevStats?.responseRate ?? null,
      prev,
      quarter,
      responses: thisQuarter.reduce((n, r) => n + r.stats.submitted, 0),
      inProgress: thisQuarter.reduce((n, r) => n + r.stats.drafts, 0),
      live,
      nextDue,
      drafts,
      ready: drafts.filter((r) => surveyIssues(r.survey).length === 0).length,
    };
  }, [db, rows, scopeUnit]);

  const menuFor = (s: Survey): MenuItem[] => {
    const items: MenuItem[] = [];
    if (s.status !== 'draft') items.push({ label: 'View responses', icon: BarChart3, to: `/surveys/${s.id}/responses` });
    items.push({ label: canEdit && s.status !== 'closed' ? 'Edit survey' : 'Open survey', icon: canEdit && s.status !== 'closed' ? FilePen : Eye, to: `/surveys/${s.id}` });
    if (!canEdit) return items;
    items.push({ label: 'Duplicate', icon: Copy, onClick: () => lifecycle.duplicate(s) });
    if (s.status === 'draft') items.push({ label: 'Publish…', icon: Send, onClick: () => void lifecycle.publish(s), divider: true });
    if (s.status === 'published') {
      items.push({ label: 'Unpublish', icon: Undo2, onClick: () => void lifecycle.unpublish(s), divider: true });
      items.push({ label: 'Close survey', icon: CircleX, tone: 'danger', onClick: () => void lifecycle.close(s) });
    }
    if (s.status === 'draft') items.push({ label: 'Delete draft', icon: Trash2, tone: 'danger', onClick: () => void lifecycle.remove(s) });
    return items;
  };

  const rowMenu = (s: Survey) => (
    // stop clicks inside the menu from reaching the table row (which navigates)
    <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      <DropdownMenu
        items={menuFor(s)}
        width="w-52"
        trigger={(p) => (
          <button {...p} type="button" aria-label={`Actions for ${s.title || 'untitled survey'}`} className="grid size-8 place-items-center rounded-lg text-ink-2 hover:bg-neutral-soft hover:text-ink">
            <MoreHorizontal className="size-4.5" />
          </button>
        )}
      />
    </div>
  );

  const columns: Column<Row>[] = [
    {
      key: 'title',
      header: 'Survey',
      sortValue: (r) => r.survey.title,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{r.survey.title || 'Untitled survey'}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-2">
            <KindBadge kind={r.survey.kind} size="sm" /> {r.survey.period} · {pluralize(r.survey.questions.length, 'question')}
          </p>
        </div>
      ),
    },
    { key: 'status', header: 'Status', width: 110, sortValue: (r) => STATUS_ORDER[r.survey.status], cell: (r) => <StatusBadge status={r.survey.status} kind="survey" /> },
    { key: 'audience', header: 'Audience', hideBelow: 'xl', sortValue: (r) => audienceLabel(db, r.survey), cell: (r) => <span className="text-ink-2">{audienceLabel(db, r.survey, true)}</span> },
    { key: 'anon', header: 'Privacy', hideBelow: 'lg', sortValue: (r) => r.survey.anonymous, cell: (r) => <AnonymityBadge anonymous={r.survey.anonymous} size="sm" /> },
    {
      key: 'responses',
      header: 'Responses',
      width: 190,
      sortValue: (r) => r.stats.responseRate ?? -1,
      cell: (r) =>
        r.survey.status === 'draft' ? (
          <span className="text-xs text-muted">Not published</span>
        ) : (
          <ProgressBar value={(r.stats.responseRate ?? 0) * 100} tone={r.survey.status === 'closed' ? 'neutral' : 'primary'} size="xs" label={`${formatNumber(r.stats.submitted)} of ${formatNumber(r.stats.audience)}`} showValue />
        ),
    },
    { key: 'due', header: 'Due', width: 130, hideBelow: 'md', sortValue: (r) => r.survey.dueDate, cell: (r) => <span className="text-ink-2 tabular">{formatDate(r.survey.status === 'closed' ? (r.survey.closedAt ?? r.survey.dueDate) : r.survey.dueDate)}</span> },
    { key: 'menu', header: '', width: 52, align: 'right', cell: (r) => rowMenu(r.survey) },
  ];

  const statusTabs = [
    { id: 'all' as const, label: 'All', count: counts.all },
    { id: 'published' as const, label: 'Live', count: counts.published },
    { id: 'draft' as const, label: 'Drafts', count: counts.draft },
    { id: 'closed' as const, label: 'Closed', count: counts.closed },
  ];
  const activeFilters = (kind ? 1 : 0) + (q.trim() ? 1 : 0) + (status !== 'all' ? 1 : 0);

  return (
    <>
      <PageHeader
        title="Surveys"
        subtitle="Quarterly pulse and programme surveys — build them, publish them and follow the responses."
        actions={
          <>
            <LinkButton to="/surveys/pulse" variant="secondary" icon={Activity}>
              Pulse analysis
            </LinkButton>
            {canEdit && (
              <LinkButton to="/surveys/new" icon={Plus}>
                New survey
              </LinkButton>
            )}
          </>
        }
      />

      {locked && unit && (
        <Callout tone="warning" icon={Lock} className="mb-6">
          Response figures are for <strong className="text-ink">{unit.name}</strong> only. Surveys are created centrally by the programme team.
        </Callout>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Live surveys"
          value={kpi.live.length}
          icon={Radio}
          tone="success"
          hint={kpi.nextDue ? `${kpi.nextDue.survey.title.replace(/^Quarterly Pulse · /, '')} closes ${dueLabel(kpi.nextDue.survey).split(' · ')[1]}` : 'Nothing live right now'}
        />
        <KpiCard
          label="Pulse response rate"
          value={kpi.curStats?.responseRate != null ? formatPercent(kpi.curStats.responseRate) : '—'}
          icon={Activity}
          tone="primary"
          hint={
            kpi.curStats ? (
              <>
                {kpi.current?.period}
                {kpi.current?.status === 'published' ? ' so far' : ''} · {formatNumber(kpi.curStats.submitted)} of {formatNumber(kpi.curStats.audience)}
                {kpi.prevRate != null && (
                  <span className="block text-muted">
                    {kpi.prev?.period} closed at {formatPercent(kpi.prevRate)}
                  </span>
                )}
              </>
            ) : undefined
          }
        />
        <KpiCard label={`Responses in ${kpi.quarter.label}`} value={formatNumber(kpi.responses)} icon={ListChecks} tone="info" hint={kpi.inProgress ? `+ ${formatNumber(kpi.inProgress)} still in progress` : 'Submitted responses this quarter'} />
        <KpiCard
          label="Drafts"
          value={kpi.drafts.length}
          icon={FilePen}
          tone="neutral"
          hint={kpi.drafts.length ? (canEdit && kpi.ready ? `${kpi.ready} ready to publish` : 'Being prepared by the programme team') : 'No drafts in progress'}
          onClick={kpi.drafts.length ? () => setParams({ status: 'draft' }, { replace: true }) : undefined}
        />
      </div>

      <FilterBar
        className="mt-6"
        hideLabel
        activeCount={activeFilters}
        onReset={() => {
          setQ('');
          setKind('');
          setParams({}, { replace: true });
        }}
        actions={
          <Tabs<'cards' | 'table'>
            variant="segmented"
            value={view}
            onChange={setView}
            tabs={[
              { id: 'cards', label: <span className="sr-only sm:not-sr-only">Cards</span>, icon: LayoutGrid },
              { id: 'table', label: <span className="sr-only sm:not-sr-only">Table</span>, icon: Rows3 },
            ]}
          />
        }
      >
        <Tabs<StatusFilter> variant="pills" value={status} onChange={(id) => setParams(id === 'all' ? {} : { status: id }, { replace: true })} tabs={statusTabs} className="min-w-0" />
        <FilterSelect label="Kind" value={kind} onChange={(v) => setKind(v as SurveyKind | '')} options={(Object.keys(KIND_META) as SurveyKind[]).map((k) => ({ value: k, label: KIND_META[k].label }))} />
        <SearchInput value={q} onChange={setQ} placeholder="Search surveys" size="sm" className="sm:w-56" />
      </FilterBar>

      <div className="mt-4">
        {rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={ClipboardList}
              title="No surveys yet"
              message="Create the first quarterly pulse to start hearing how people feel."
              action={canEdit ? <LinkButton to="/surveys/new" icon={Plus}>New survey</LinkButton> : undefined}
            />
          </Card>
        ) : visible.length === 0 ? (
          <Card>
            <EmptyState
              icon={SearchX}
              title="No surveys match"
              message="Try another status, kind or search."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ('');
                    setKind('');
                    setParams({}, { replace: true });
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          </Card>
        ) : view === 'table' ? (
          <Card padding="none">
            <DataTable columns={columns} rows={visible} rowKey={(r) => r.survey.id} onRowClick={(r) => navigate(r.survey.status === 'draft' ? `/surveys/${r.survey.id}` : `/surveys/${r.survey.id}/responses`)} pageSize={0} minWidth={760} emptyIcon={Inbox} />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {visible.map((r) => (
              <SurveyCard key={r.survey.id} row={r} canEdit={canEdit} menu={rowMenu(r.survey)} onPublish={() => void lifecycle.publish(r.survey)} audience={audienceLabel(db, r.survey)} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function SurveyCard({ row: { survey: s, stats }, canEdit, menu, onPublish, audience }: { row: Row; canEdit: boolean; menu: ReactNode; onPublish: () => void; audience: string }) {
  const draft = s.status === 'draft';
  const rate = stats.responseRate ?? 0;
  const pastDue = s.status === 'published' && new Date(s.dueDate) < new Date();
  return (
    <Card padding="none" className={cn('flex flex-col', s.status === 'published' && 'ring-1 ring-success/15')}>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            <StatusBadge status={s.status} kind="survey" />
            <KindBadge kind={s.kind} />
            <Badge tone="outline">{s.period}</Badge>
          </div>
          {menu}
        </div>
        <Link to={draft ? `/surveys/${s.id}` : `/surveys/${s.id}/responses`} className="group mt-3 block">
          <h3 className="text-base leading-6 font-semibold text-ink group-hover:text-primary">{s.title || 'Untitled survey'}</h3>
          {s.description && <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-ink-2">{s.description}</p>}
        </Link>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-4">
          <div className="min-w-0">
            <dt className="text-xs text-muted">Audience</dt>
            <dd className="mt-0.5 flex items-center gap-1 truncate text-ink" title={audience}>
              <Users className="size-3.5 shrink-0 text-ink-2" />
              <span className="truncate">{audience}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Privacy</dt>
            <dd className="mt-0.5 flex items-center gap-1 text-ink">
              {s.anonymous ? <Lock className="size-3.5 text-ink-2" /> : <Eye className="size-3.5 text-ink-2" />}
              {s.anonymous ? 'Anonymous' : 'Named'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Questions</dt>
            <dd className="mt-0.5 flex items-center gap-1 text-ink tabular">
              <ListChecks className="size-3.5 text-ink-2" />
              {s.questions.length}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs text-muted">{s.status === 'closed' ? 'Closed' : 'Due'}</dt>
            <dd className={cn('mt-0.5 flex items-center gap-1 truncate tabular', pastDue ? 'font-medium text-warning' : 'text-ink')}>
              <CalendarClock className="size-3.5 shrink-0 text-ink-2" />
              {formatDate(s.status === 'closed' ? (s.closedAt ?? s.dueDate) : s.dueDate)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-b-card border-t border-line bg-[#FAFBFE] px-5 py-3.5">
        {draft ? (
          <>
            <p className="min-w-0 flex-1 text-[13px] text-ink-2">Not published yet · created {timeAgo(s.createdAt)}</p>
            {canEdit ? (
              <>
                <LinkButton to={`/surveys/${s.id}`} variant="secondary" size="sm" icon={FilePen}>
                  Continue editing
                </LinkButton>
                <Button size="sm" icon={Send} onClick={onPublish}>
                  Publish
                </Button>
              </>
            ) : (
              <LinkButton to={`/surveys/${s.id}`} variant="secondary" size="sm" icon={Eye}>
                Preview
              </LinkButton>
            )}
          </>
        ) : (
          <>
            <div className="min-w-44 flex-1">
              <ProgressBar
                value={rate * 100}
                tone={s.status === 'closed' ? 'neutral' : 'primary'}
                label={
                  <span>
                    <span className="font-semibold text-ink tabular">{formatNumber(stats.submitted)}</span> of {formatNumber(stats.audience)} responded
                    {stats.drafts > 0 && s.status === 'published' ? <span className="text-muted"> · {stats.drafts} in progress</span> : null}
                  </span>
                }
                valueLabel={stats.responseRate == null ? '—' : formatPercent(rate)}
              />
            </div>
            <LinkButton to={`/surveys/${s.id}/responses`} variant="secondary" size="sm" icon={BarChart3}>
              Responses
            </LinkButton>
          </>
        )}
      </div>
    </Card>
  );
}
