// Match history — Admin row A38: every match record across cohorts (proposals, mentor decisions,
// final matches, withdrawals) with dates, decline reasons, filters, an expandable timeline per
// match and CSV export. `?q=` pre-fills the search (linked from the application page).

import { Fragment, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, ChevronRight, Download, GitPullRequestArrow, History, Timer, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { MatchStatus, MentorMatch } from '@shared/types';
import { MATCH_STATUS_LABELS } from '@shared/content/mentoring';
import { validateMatch } from '@shared/logic';
import { PageHeader } from '@/components/layout';
import { Avatar, Button, Card, EmptyState, FilterBar, FilterSelect, KpiCard, Pagination, SearchInput, StatusBadge, toast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { csvFilename, downloadCsv } from '@/lib/csv';
import { formatDate, formatDecimal, formatNumber, formatPercent } from '@/lib/format';
import { employeeMap, functionName } from '@/lib/lookup';
import { useCan } from '@/lib/rbac';
import { useDb } from '@/store/db';
import { RuleChecks } from './components/RuleChecks';
import { StatusTimeline } from './components/StatusTimeline';
import { MentoringEyebrow, SectionLabel, ViewOnlyBadge } from './components/bits';
import { useCohortParam } from './components/cohort';
import { matchTimeline } from './components/timeline';

const STATUSES: MatchStatus[] = ['proposed', 'accepted', 'declined', 'active', 'completed', 'withdrawn'];
const PAGE_SIZES = [15, 30, 60];

const dateCell = (iso?: string) => (iso ? <span className="whitespace-nowrap text-ink-2">{formatDate(iso)}</span> : <span className="text-muted">—</span>);

export default function MatchHistoryPage() {
  const db = useDb();
  const canEdit = useCan('mentoring.edit');
  const [params] = useSearchParams();
  const { cohortId, cohorts, setCohortId } = useCohortParam('programme', { allowAll: true });
  const [q, setQ] = useState(params.get('q') ?? '');
  const [status, setStatus] = useState('');
  const [mentor, setMentor] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const emp = employeeMap(db);

  const all = useMemo(
    () => [...db.matches].sort((a, b) => (b.history[b.history.length - 1]?.at ?? b.proposedAt).localeCompare(a.history[a.history.length - 1]?.at ?? a.proposedAt)),
    [db.matches],
  );
  const inCohort = useMemo(() => all.filter((m) => !cohortId || m.cohortId === cohortId), [all, cohortId]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return inCohort.filter(
      (m) =>
        (!status || m.status === status) && (!mentor || m.mentorId === mentor) && (!s || `${emp.get(m.mentorId)?.name} ${emp.get(m.menteeId)?.name}`.toLowerCase().includes(s)),
    );
  }, [inCohort, status, mentor, q, emp]);

  // KPIs on the cohort scope
  const responded = inCohort.filter((m) => m.respondedAt);
  const acceptedN = responded.filter((m) => m.status !== 'declined' && m.history.some((h) => h.status === 'accepted')).length;
  const declinedN = inCohort.filter((m) => m.status === 'declined').length;
  const avgDays = responded.length
    ? responded.reduce((s, m) => s + (new Date(m.respondedAt!).getTime() - new Date(m.proposedAt).getTime()) / 86400000, 0) / responded.length
    : null;
  const mentorOptions = useMemo(
    () => [...new Set(inCohort.map((m) => m.mentorId))].map((id) => ({ value: id, label: emp.get(id)?.name ?? id })).sort((a, b) => a.label.localeCompare(b.label)),
    [inCohort, emp],
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = rows.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const filterCount = [cohortId, status, mentor].filter(Boolean).length;
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const resetPage =
    <T,>(fn: (v: T) => void) =>
    (v: T) => (fn(v), setPage(0));

  const exportCsv = () => {
    if (!rows.length) return toast.info('Nothing to export', 'No match records for these filters.');
    downloadCsv(csvFilename('mentoring-match-history'), rows, [
      { header: 'Match ID', value: (m) => m.id },
      { header: 'Cohort', value: (m) => db.cohorts.find((c) => c.id === m.cohortId)?.name ?? m.cohortId },
      { header: 'Mentee', value: (m) => emp.get(m.menteeId)?.name ?? m.menteeId },
      { header: 'Mentee function', value: (m) => functionName(db, emp.get(m.menteeId)?.functionId) },
      { header: 'Mentor', value: (m) => emp.get(m.mentorId)?.name ?? m.mentorId },
      { header: 'Mentor function', value: (m) => functionName(db, emp.get(m.mentorId)?.functionId) },
      { header: 'Status', value: (m) => MATCH_STATUS_LABELS[m.status] },
      { header: 'Proposed', value: (m) => formatDate(m.proposedAt) },
      { header: 'Proposed by', value: (m) => emp.get(m.proposedBy)?.name ?? m.proposedBy },
      { header: 'Mentor responded', value: (m) => (m.respondedAt ? formatDate(m.respondedAt) : '') },
      { header: 'Activated', value: (m) => (m.activatedAt ? formatDate(m.activatedAt) : '') },
      { header: 'Decline reason', value: (m) => m.declineReason ?? '' },
      { header: 'Timeline', value: (m) => m.history.map((h) => `${formatDate(h.at)} ${h.status}${h.note ? ` (${h.note})` : ''}`).join(' → ') },
    ]);
    toast.success('Export ready', `${formatNumber(rows.length)} match records downloaded as CSV.`);
  };

  const th = 'sticky top-0 z-[1] border-b border-line bg-[#F8FAFD] px-4 py-3 text-left text-xs font-semibold whitespace-nowrap text-ink-2';
  const td = 'border-b border-line px-4 py-3 align-middle';

  return (
    <>
      <PageHeader
        eyebrow={<MentoringEyebrow />}
        title="Match history"
        subtitle="Every proposal and mentor decision across cohorts — who was proposed, how the mentor answered, and when the pair went live."
        meta={!canEdit ? <ViewOnlyBadge /> : undefined}
        actions={
          <Button variant="secondary" icon={Download} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Proposals made"
          value={formatNumber(inCohort.length)}
          icon={GitPullRequestArrow}
          tone="mentor"
          hint={`${inCohort.filter((m) => m.status === 'proposed').length} awaiting a reply`}
        />
        <KpiCard
          label="Mentor acceptance rate"
          value={responded.length ? formatPercent(acceptedN / responded.length) : '—'}
          icon={ThumbsUp}
          tone="success"
          hint={`${acceptedN} of ${responded.length} answered`}
        />
        <KpiCard label="Declined by mentors" value={formatNumber(declinedN)} icon={ThumbsDown} tone="danger" hint="The mentor has the final say" />
        <KpiCard
          label="Average response time"
          value={avgDays != null ? `${formatDecimal(avgDays)} days` : '—'}
          icon={Timer}
          tone="info"
          hint="From proposal to the mentor’s answer"
        />
      </div>

      <FilterBar className="mb-4" activeCount={filterCount} onReset={() => (setCohortId(''), setStatus(''), setMentor(''), setPage(0))}>
        <SearchInput value={q} onChange={resetPage(setQ)} placeholder="Search mentor or mentee" size="sm" className="sm:w-60" />
        <FilterSelect label="Cohort" value={cohortId} onChange={resetPage(setCohortId)} options={cohorts.map((c) => ({ value: c.id, label: c.name }))} allLabel="All cohorts" />
        <FilterSelect label="Status" value={status} onChange={resetPage(setStatus)} options={STATUSES.map((s) => ({ value: s, label: MATCH_STATUS_LABELS[s] }))} allLabel="All" />
        <FilterSelect label="Mentor" value={mentor} onChange={resetPage(setMentor)} options={mentorOptions} allLabel="All mentors" />
      </FilterBar>

      <Card padding="none">
        {rows.length === 0 ? (
          <EmptyState
            tone="mentor"
            icon={History}
            title={all.length ? 'No match records match' : 'No proposals yet'}
            message={all.length ? 'Try another cohort, status or mentor.' : 'Proposals appear here as soon as HR shortlists an applicant to a mentor.'}
          />
        ) : (
          <>
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[960px] border-separate border-spacing-0 text-[13px]">
                <thead>
                  <tr>
                    <th className={cn(th, 'w-10')} aria-label="Expand" />
                    <th className={th}>Mentee</th>
                    <th className={th}>Mentor</th>
                    <th className={cn(th, 'hidden xl:table-cell')}>Cohort</th>
                    <th className={th}>Status</th>
                    <th className={th}>Proposed</th>
                    <th className={th}>Responded</th>
                    <th className={th}>Activated</th>
                    <th className={cn(th, 'hidden 2xl:table-cell')}>Decline reason</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((m) => {
                    const isOpen = open.has(m.id);
                    const mentee = emp.get(m.menteeId);
                    const mentorE = emp.get(m.mentorId);
                    return (
                      <Fragment key={m.id}>
                        <tr
                          className={cn('cursor-pointer transition-colors hover:bg-[#F8FAFE]', isOpen && 'bg-mentor-soft/30')}
                          onClick={() => toggle(m.id)}
                          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle(m.id))}
                          tabIndex={0}
                          aria-expanded={isOpen}
                        >
                          <td className={cn(td, 'pr-0')}>{isOpen ? <ChevronDown className="size-4 text-mentor" /> : <ChevronRight className="size-4 text-muted" />}</td>
                          <td className={td}>
                            <span className="flex items-center gap-2.5">
                              <Avatar name={mentee?.name ?? m.menteeId} size="sm" />
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-ink">{mentee?.name}</span>
                                <span className="block truncate text-xs text-ink-2">{functionName(db, mentee?.functionId)}</span>
                              </span>
                            </span>
                          </td>
                          <td className={td}>
                            <span className="block truncate font-medium text-ink">{mentorE?.name}</span>
                            <span className="block truncate text-xs text-ink-2">{functionName(db, mentorE?.functionId)}</span>
                          </td>
                          <td className={cn(td, 'hidden text-xs whitespace-nowrap text-ink-2 xl:table-cell')}>{db.cohorts.find((c) => c.id === m.cohortId)?.name}</td>
                          <td className={td}>
                            <StatusBadge status={m.status} kind="match" size="sm" />
                          </td>
                          <td className={td}>{dateCell(m.proposedAt)}</td>
                          <td className={td}>{dateCell(m.respondedAt)}</td>
                          <td className={td}>{dateCell(m.activatedAt)}</td>
                          <td className={cn(td, 'hidden max-w-64 2xl:table-cell')}>
                            {m.declineReason ? <span className="line-clamp-2 text-xs text-ink-2">{m.declineReason}</span> : <span className="text-muted">—</span>}
                          </td>
                        </tr>
                        {isOpen && <ExpandedRow m={m} />}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={safePage}
              pageCount={pageCount}
              total={rows.length}
              pageSize={pageSize}
              onPage={setPage}
              pageSizeOptions={PAGE_SIZES}
              onPageSize={(n) => (setPageSize(n), setPage(0))}
            />
          </>
        )}
      </Card>
    </>
  );
}

function ExpandedRow({ m }: { m: MentorMatch }) {
  const db = useDb();
  const emp = employeeMap(db);
  const app = db.applications.find((a) => a.id === m.applicationId);
  const rules = validateMatch(db, m.mentorId, m.menteeId, m.cohortId);
  const rank = app ? app.preferredMentorIds.indexOf(m.mentorId) + 1 : 0;
  return (
    <tr className="bg-mentor-soft/20">
      <td colSpan={9} className="border-b border-line px-4 py-4">
        <div className="grid grid-cols-1 gap-6 pl-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <div>
            <SectionLabel>Timeline</SectionLabel>
            <StatusTimeline items={matchTimeline(db, m)} dense />
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-line bg-white p-3.5 text-[13px]">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                <div>
                  <dt className="text-xs text-ink-2">Mentee’s preference</dt>
                  <dd className="font-medium text-ink">{rank > 0 ? `#${rank} choice` : 'Not in their list'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-2">Proposed by</dt>
                  <dd className="font-medium text-ink">{emp.get(m.proposedBy)?.name ?? m.proposedBy}</dd>
                </div>
                {m.declineReason && (
                  <div className="col-span-2">
                    <dt className="text-xs text-ink-2">Decline reason</dt>
                    <dd className="text-ink">“{m.declineReason}”</dd>
                  </div>
                )}
              </dl>
              {app && (
                <Link to={`/mentoring/applications/${app.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Open application <ArrowUpRight className="size-3.5" />
                </Link>
              )}
            </div>
            <div>
              <SectionLabel>Rules re-checked today</SectionLabel>
              <RuleChecks rules={rules} compact />
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
