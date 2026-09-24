// Applications — Admin row A31 (list) with A32 hints (preferred mentors + rule conflicts).
// Status tabs with counts (?status=), cohort selector (default: cohort being staffed), search.

import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarClock, ChevronRight, FileText, Inbox, ShieldAlert, Shuffle, Star, TriangleAlert } from 'lucide-react';
import type { ApplicationStatus, MenteeApplication } from '@shared/types';
import { APPLICATION_STATUS_LABELS } from '@shared/content/mentoring';
import { PageHeader } from '@/components/layout';
import { Avatar, Card, DataTable, FilterSelect, KpiCard, LinkButton, PersonCell, SearchInput, StatusBadge, Tabs, type Column, type TabItem } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate, formatNumber, timeAgo } from '@/lib/format';
import { employeeMap, functionName, unitName } from '@/lib/lookup';
import { useCan } from '@/lib/rbac';
import { APPLICATION_TABS, hasStructuralRuleIssue, openMatchFor, scoreTotal } from '@/lib/analytics-mentoring';
import { useDb } from '@/store/db';
import { MentoringEyebrow, ScorePill, ViewOnlyBadge } from './components/bits';
import { CohortPicker, useCohortParam } from './components/cohort';

type TabId = 'all' | ApplicationStatus;

interface Row {
  app: MenteeApplication;
  name: string;
  designation: string;
  functionId: string;
  unitId: string;
  score: number | null;
  conflict: boolean;
  matchStatus?: string;
}

export default function ApplicationsPage() {
  const db = useDb();
  const navigate = useNavigate();
  const canEdit = useCan('mentoring.edit');
  const [params, setParams] = useSearchParams();
  const { cohortId, cohort, cohorts, setCohortId } = useCohortParam('matching');
  const [q, setQ] = useState('');
  const [fn, setFn] = useState('');
  const [now] = useState(() => Date.now());
  const requested = params.get('status') as TabId | null;
  const tab: TabId = requested && (requested === 'all' || APPLICATION_TABS.includes(requested as ApplicationStatus)) ? requested : 'all';

  const rows = useMemo<Row[]>(() => {
    const emp = employeeMap(db);
    return db.applications
      .filter((a) => a.cohortId === cohortId && a.status !== 'draft')
      .map((a) => {
        const e = emp.get(a.employeeId);
        const m = a.status === 'shortlisted' ? openMatchFor(db, a.id) : undefined;
        return {
          app: a,
          name: e?.name ?? a.employeeId,
          designation: e?.designation ?? '',
          functionId: e?.functionId ?? '',
          unitId: e?.unitId ?? '',
          score: scoreTotal(a),
          conflict: hasStructuralRuleIssue(db, a),
          matchStatus: m?.status,
        };
      });
  }, [db, cohortId]);

  const counts = useMemo(() => {
    const c = Object.fromEntries(APPLICATION_TABS.map((s) => [s, 0])) as Record<ApplicationStatus, number>;
    for (const r of rows) c[r.app.status]++;
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => (tab === 'all' || r.app.status === tab) && (!fn || r.functionId === fn) && (!s || `${r.name} ${r.designation}`.toLowerCase().includes(s)));
  }, [rows, tab, q, fn]);

  const tabs: TabItem<TabId>[] = [
    { id: 'all', label: 'All', count: rows.length },
    ...APPLICATION_TABS.map((s) => ({ id: s, label: APPLICATION_STATUS_LABELS[s], count: counts[s] })),
  ];
  const conflicts = rows.filter((r) => r.conflict && (r.app.status === 'submitted' || r.app.status === 'under_review')).length;
  const unscored = rows.filter((r) => r.score == null && (r.app.status === 'submitted' || r.app.status === 'under_review')).length;
  const closes = cohort ? new Date(cohort.applicationClose) : null;
  const daysToClose = closes ? Math.ceil((closes.getTime() - now) / 86400000) : 0;
  const emp = employeeMap(db);

  const columns: Column<Row>[] = [
    { key: 'name', header: 'Applicant', sortValue: (r) => r.name, cell: (r) => <PersonCell name={r.name} secondary={r.designation} /> },
    {
      key: 'function',
      header: 'Function · unit',
      hideBelow: 'lg',
      sortValue: (r) => functionName(db, r.functionId),
      cell: (r) => (
        <span className="flex flex-col text-xs leading-5 whitespace-nowrap">
          <span className="text-ink">{functionName(db, r.functionId)}</span>
          <span className="text-ink-2">{unitName(db, r.unitId, true)}</span>
        </span>
      ),
    },
    {
      key: 'mentors',
      header: 'Preferred mentors',
      cell: (r) => {
        const first = emp.get(r.app.preferredMentorIds[0]);
        return (
          <span className="flex items-center gap-2.5">
            <span className="flex gap-0.5">
              {r.app.preferredMentorIds.map((id) => (
                <Avatar key={id} name={emp.get(id)?.name ?? id} size="xs" />
              ))}
            </span>
            <span className="min-w-0 truncate text-xs text-ink-2">
              <span className="font-medium text-ink">{first?.name}</span>
              {r.app.preferredMentorIds.length > 1 && ` +${r.app.preferredMentorIds.length - 1}`}
            </span>
            {r.conflict && (
              <span title="A preferred mentor is in the same function or the applicant’s reporting line" className="shrink-0 text-danger">
                <TriangleAlert className="size-4" aria-label="Rule conflict" />
              </span>
            )}
          </span>
        );
      },
    },
    { key: 'score', header: 'Score', sortValue: (r) => r.score ?? -1, cell: (r) => <ScorePill score={r.score} /> },
    {
      key: 'submitted',
      header: 'Submitted',
      hideBelow: 'md',
      sortValue: (r) => r.app.submittedAt,
      cell: (r) => (
        <span className="flex flex-col text-xs leading-5 whitespace-nowrap">
          <span className="text-ink">{r.app.submittedAt ? formatDate(r.app.submittedAt) : '—'}</span>
          <span className="text-ink-2">{r.app.submittedAt ? timeAgo(r.app.submittedAt) : ''}</span>
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r) => APPLICATION_TABS.indexOf(r.app.status),
      cell: (r) => (
        <span className="flex flex-col items-start gap-1">
          <StatusBadge status={r.app.status} kind="application" size="sm" />
          {r.matchStatus && (
            <span className={cn('text-[11px] font-medium', r.matchStatus === 'accepted' ? 'text-info' : 'text-warning')}>
              {r.matchStatus === 'accepted' ? 'Mentor accepted' : 'Awaiting mentor'}
            </span>
          )}
        </span>
      ),
    },
    { key: 'go', header: '', width: 40, cell: () => <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" /> },
  ];

  return (
    <>
      <PageHeader
        eyebrow={<MentoringEyebrow />}
        title="Applications"
        subtitle="Self-initiated, one-page mentee applications. Review and score them on the matching criteria, then shortlist to a mentor."
        meta={!canEdit ? <ViewOnlyBadge /> : undefined}
        actions={
          <>
            <CohortPicker cohorts={cohorts} value={cohortId} onChange={setCohortId} />
            {canEdit && (
              <LinkButton to={`/mentoring/matching?cohort=${cohortId}`} variant="mentor" icon={Shuffle}>
                Matching workspace
              </LinkButton>
            )}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Applications received" value={formatNumber(rows.length)} icon={FileText} tone="mentor" hint={`${counts.withdrawn} withdrawn`} />
        <KpiCard
          label="Need review"
          value={formatNumber(counts.submitted + counts.under_review)}
          icon={Inbox}
          tone="warning"
          hint={`${counts.submitted} new · ${unscored} not scored`}
          onClick={() => setParams((p) => (p.set('status', 'submitted'), p), { replace: true })}
        />
        <KpiCard
          label="Preferred-mentor conflicts"
          value={formatNumber(conflicts)}
          icon={ShieldAlert}
          tone={conflicts ? 'danger' : 'success'}
          hint={conflicts ? 'Same function or reporting line' : 'All preferences are valid'}
        />
        <KpiCard
          label={cohort?.status === 'applications_open' ? 'Applications close' : 'Applications closed'}
          value={closes ? formatDate(closes).replace(/ \d{4}$/, '') : '—'}
          icon={CalendarClock}
          tone="info"
          hint={
            closes
              ? daysToClose > 0
                ? `${daysToClose} days left · cohort starts ${formatDate(cohort!.startDate)}`
                : `Cohort ${cohort?.status === 'active' ? 'running' : 'starts'} ${formatDate(cohort!.startDate)}`
              : undefined
          }
        />
      </div>

      <Card padding="none">
        <div className="px-5 pt-3">
          <Tabs<TabId> tabs={tabs} value={tab} onChange={(id) => setParams((p) => (id === 'all' ? p.delete('status') : p.set('status', id), p), { replace: true })} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3">
          <p className="flex flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <Star className="size-3.5 text-mentor" /> Score = clarity + reflection + fit (1–5 each)
            </span>
            <span className="inline-flex items-center gap-1.5">
              <TriangleAlert className="size-3.5 text-danger" /> A preferred mentor breaks a hard rule
            </span>
          </p>
          <FilterSelect label="Function" value={fn} onChange={setFn} options={db.functions.map((f) => ({ value: f.id, label: f.name }))} allLabel="All" />
          <SearchInput value={q} onChange={setQ} placeholder="Search applicants" size="sm" className="sm:w-56" />
        </div>
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(r) => r.app.id}
          onRowClick={(r) => navigate(`/mentoring/applications/${r.app.id}`)}
          initialSort={{ key: 'submitted', dir: 'desc' }}
          pageSize={15}
          pageSizeOptions={[15, 30, 60]}
          minWidth={820}
          emptyIcon={FileText}
          emptyTitle={rows.length ? 'No applications here' : 'No applications yet'}
          emptyMessage={rows.length ? 'Nothing matches this status and search.' : `${cohort?.name ?? 'This cohort'} hasn’t received any applications.`}
        />
      </Card>
    </>
  );
}
