// Mentees — Admin row A30: every applicant / mentee across cohorts with their status (application
// status, or the match status once matched), mentor, function, conversation progress and last
// activity. Filters: cohort, status, function, unit. Row → application detail.

import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, HeartHandshake, Hourglass, UsersRound, UserX } from 'lucide-react';
import type { ApplicationStatus, MatchStatus, MenteeApplication, MentorMatch } from '@shared/types';
import { APPLICATION_STATUS_LABELS, MATCH_STATUS_LABELS } from '@shared/content/mentoring';
import { PageHeader } from '@/components/layout';
import { Button, Card, DataTable, FilterBar, FilterSelect, KpiCard, PersonCell, SearchInput, StatusBadge, toast, type Column } from '@/components/ui';
import { csvFilename, downloadCsv } from '@/lib/csv';
import { formatDate, formatNumber, timeAgo } from '@/lib/format';
import { employeeMap, functionName, unitName } from '@/lib/lookup';
import { useCan } from '@/lib/rbac';
import { ANCHORS, cohortTimeline, currentMatchFor, lastActivityAt, progressOfMatch, type PairProgress } from '@/lib/analytics-mentoring';
import { useDb } from '@/store/db';
import { AnchorDots, MentoringEyebrow, PairHealthBadge, ViewOnlyBadge } from './components/bits';
import { useCohortParam } from './components/cohort';

/** Stage shown in the list: the match status once matched, otherwise the application status. */
type Stage = ApplicationStatus | 'active' | 'completed';

interface Row {
  app: MenteeApplication;
  name: string;
  designation: string;
  functionId: string;
  unitId: string;
  cohortName: string;
  stage: Stage;
  match?: MentorMatch;
  mentorName?: string;
  progress?: PairProgress;
  lastActivity: string;
}

const STAGE_OPTIONS: { value: Stage; label: string }[] = [
  { value: 'active', label: 'Active mentee' },
  { value: 'completed', label: 'Programme completed' },
  { value: 'submitted', label: APPLICATION_STATUS_LABELS.submitted },
  { value: 'under_review', label: APPLICATION_STATUS_LABELS.under_review },
  { value: 'shortlisted', label: APPLICATION_STATUS_LABELS.shortlisted },
  { value: 'not_matched', label: APPLICATION_STATUS_LABELS.not_matched },
  { value: 'withdrawn', label: APPLICATION_STATUS_LABELS.withdrawn },
];
const STAGE_ORDER: Stage[] = ['active', 'shortlisted', 'under_review', 'submitted', 'completed', 'matched', 'not_matched', 'withdrawn', 'draft'];

function StageBadge({ row }: { row: Row }) {
  if (row.stage === 'active' || row.stage === 'completed') return <StatusBadge status={row.stage} kind="match" size="sm" />;
  return <StatusBadge status={row.stage} kind="application" size="sm" />;
}

export default function MenteesPage() {
  const db = useDb();
  const navigate = useNavigate();
  const canEdit = useCan('mentoring.edit');
  const { cohortId, cohorts, setCohortId } = useCohortParam('programme', { allowAll: true });
  const [q, setQ] = useState('');
  const [stage, setStage] = useState('');
  const [fn, setFn] = useState('');
  const [unit, setUnit] = useState('');

  const rows = useMemo<Row[]>(() => {
    const emp = employeeMap(db);
    const now = new Date();
    const timelines = new Map(db.cohorts.map((c) => [c.id, cohortTimeline(c, now)]));
    return db.applications
      .filter((a) => a.status !== 'draft' && (!cohortId || a.cohortId === cohortId))
      .map((a) => {
        const e = emp.get(a.employeeId);
        const match = currentMatchFor(db, a.id);
        const live = match && (match.status === 'active' || match.status === 'completed') && a.status === 'matched';
        const openish = match && (match.status === 'proposed' || match.status === 'accepted' || live);
        return {
          app: a,
          name: e?.name ?? a.employeeId,
          designation: e?.designation ?? '',
          functionId: e?.functionId ?? '',
          unitId: e?.unitId ?? '',
          cohortName: db.cohorts.find((c) => c.id === a.cohortId)?.name ?? a.cohortId,
          stage: live ? (match.status as 'active' | 'completed') : a.status,
          match: openish ? match : undefined,
          mentorName: openish ? emp.get(match.mentorId)?.name : undefined,
          progress: live ? progressOfMatch(db, match, timelines.get(a.cohortId) ?? null, now) : undefined,
          lastActivity: lastActivityAt(db, a),
        };
      });
  }, [db, cohortId]);

  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!stage || r.stage === stage) &&
        (!fn || r.functionId === fn) &&
        (!unit || r.unitId === unit) &&
        (!s || `${r.name} ${r.designation} ${r.mentorName ?? ''}`.toLowerCase().includes(s)),
    );
  }, [rows, q, stage, fn, unit]);

  const count = (...s: Stage[]) => rows.filter((r) => s.includes(r.stage)).length;
  const filterCount = [stage, fn, unit, cohortId].filter(Boolean).length;

  const exportCsv = () => {
    if (!visible.length) return toast.info('Nothing to export', 'No mentees match these filters.');
    downloadCsv(csvFilename('mentoring-mentees'), visible, [
      { header: 'Employee code', value: (r) => r.app.employeeId },
      { header: 'Name', value: (r) => r.name },
      { header: 'Designation', value: (r) => r.designation },
      { header: 'Function', value: (r) => functionName(db, r.functionId) },
      { header: 'Unit', value: (r) => unitName(db, r.unitId) },
      { header: 'Cohort', value: (r) => r.cohortName },
      { header: 'Status', value: (r) => (r.stage === 'active' || r.stage === 'completed' ? MATCH_STATUS_LABELS[r.stage] : APPLICATION_STATUS_LABELS[r.stage]) },
      { header: 'Mentor', value: (r) => r.mentorName ?? '' },
      {
        header: 'Mentor response',
        value: (r) => (r.match && (r.match.status === 'proposed' || r.match.status === 'accepted') ? MATCH_STATUS_LABELS[r.match.status as MatchStatus] : ''),
      },
      ...ANCHORS.map((a) => ({ header: `Conversation ${a}`, value: (r: Row) => (r.progress ? r.progress.anchors[a] : '') })),
      { header: 'Conversations completed', value: (r) => r.progress?.completed ?? '' },
      { header: 'Open actions', value: (r) => r.progress?.openActions ?? '' },
      { header: 'Last activity', value: (r) => formatDate(r.lastActivity) },
    ]);
    toast.success('Export ready', `${formatNumber(visible.length)} mentees downloaded as CSV.`);
  };

  const columns: Column<Row>[] = [
    { key: 'name', header: 'Mentee', sortValue: (r) => r.name, cell: (r) => <PersonCell name={r.name} secondary={r.designation} /> },
    {
      key: 'function',
      header: 'Function · unit',
      hideBelow: 'xl',
      sortValue: (r) => functionName(db, r.functionId),
      cell: (r) => (
        <span className="flex flex-col text-xs leading-5 whitespace-nowrap">
          <span className="text-ink">{functionName(db, r.functionId)}</span>
          <span className="text-ink-2">{unitName(db, r.unitId, true)}</span>
        </span>
      ),
    },
    {
      key: 'stage',
      header: 'Status',
      sortValue: (r) => STAGE_ORDER.indexOf(r.stage),
      cell: (r) => (
        <span className="flex flex-col items-start gap-1">
          <StageBadge row={r} />
          {!cohortId && <span className="text-[11px] whitespace-nowrap text-ink-2">{r.cohortName}</span>}
        </span>
      ),
    },
    {
      key: 'mentor',
      header: 'Mentor',
      sortValue: (r) => r.mentorName ?? '',
      cell: (r) =>
        r.mentorName ? (
          <span className="flex min-w-0 flex-col leading-5">
            <span className="truncate text-[13px] font-medium text-ink">{r.mentorName}</span>
            {r.match && r.match.status !== 'active' && r.match.status !== 'completed' && (
              <span className={r.match.status === 'accepted' ? 'text-[11px] font-medium text-info' : 'text-[11px] font-medium text-warning'}>
                {r.match.status === 'accepted' ? 'Accepted · awaiting final match' : 'Proposed · awaiting reply'}
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'progress',
      header: 'Progress',
      sortValue: (r) => (r.progress ? r.progress.anchorsCompleted * 10 + r.progress.extraCompleted : -1),
      cell: (r) =>
        r.progress ? (
          <span className="flex items-center gap-2.5">
            <AnchorDots anchors={r.progress.anchors} extra={r.progress.extraCompleted} size="sm" />
            <PairHealthBadge health={r.progress.health} note={r.progress.healthNote} size="sm" />
          </span>
        ) : (
          <span className="text-xs text-muted">
            {r.stage === 'shortlisted' ? 'Matching in progress' : r.stage === 'submitted' || r.stage === 'under_review' ? 'In review' : '—'}
          </span>
        ),
    },
    {
      key: 'activity',
      header: 'Last activity',
      hideBelow: 'md',
      sortValue: (r) => r.lastActivity,
      cell: (r) => (
        <span className="text-xs whitespace-nowrap text-ink-2" title={formatDate(r.lastActivity)}>
          {timeAgo(r.lastActivity)}
        </span>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow={<MentoringEyebrow />}
        title="Mentees"
        subtitle="Everyone who has applied — where they are in the journey, who mentors them and how the anchor conversations are going."
        meta={!canEdit ? <ViewOnlyBadge /> : undefined}
        actions={
          <Button variant="secondary" icon={Download} onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Applicants"
          value={formatNumber(rows.length)}
          icon={UsersRound}
          tone="mentor"
          hint={cohortId ? cohorts.find((c) => c.id === cohortId)?.name : 'All cohorts'}
        />
        <KpiCard
          label="Active mentees"
          value={formatNumber(count('active'))}
          icon={HeartHandshake}
          tone="success"
          hint={`${count('completed')} completed the programme`}
          onClick={() => setStage('active')}
        />
        <KpiCard
          label="In the pipeline"
          value={formatNumber(count('submitted', 'under_review', 'shortlisted'))}
          icon={Hourglass}
          tone="warning"
          hint={`${count('submitted', 'under_review')} in review · ${count('shortlisted')} shortlisted`}
        />
        <KpiCard
          label="Not matched / withdrawn"
          value={formatNumber(count('not_matched', 'withdrawn'))}
          icon={UserX}
          tone="neutral"
          hint={`${count('not_matched')} not matched · ${count('withdrawn')} withdrawn`}
        />
      </div>

      <FilterBar className="mb-4" activeCount={filterCount} onReset={() => (setStage(''), setFn(''), setUnit(''), setCohortId(''))}>
        <SearchInput value={q} onChange={setQ} placeholder="Search mentee or mentor" size="sm" className="sm:w-60" />
        <FilterSelect label="Cohort" value={cohortId} onChange={setCohortId} options={cohorts.map((c) => ({ value: c.id, label: c.name }))} allLabel="All cohorts" />
        <FilterSelect label="Status" value={stage} onChange={setStage} options={STAGE_OPTIONS} allLabel="All" />
        <FilterSelect label="Function" value={fn} onChange={setFn} options={db.functions.map((f) => ({ value: f.id, label: f.name }))} allLabel="All" />
        <FilterSelect label="Unit" value={unit} onChange={setUnit} options={db.units.map((u) => ({ value: u.id, label: u.name }))} allLabel="All" />
      </FilterBar>

      <Card padding="none">
        <DataTable
          columns={columns}
          rows={visible}
          rowKey={(r) => r.app.id}
          onRowClick={(r) => navigate(`/mentoring/applications/${r.app.id}`)}
          initialSort={{ key: 'stage', dir: 'asc' }}
          pageSize={15}
          pageSizeOptions={[15, 30, 60]}
          minWidth={880}
          emptyIcon={UsersRound}
          emptyTitle={rows.length ? 'No mentees match' : 'No applicants yet'}
          emptyMessage={rows.length ? 'Try another status, function or unit.' : 'Applicants appear here as soon as they submit the one-page application.'}
        />
      </Card>
    </>
  );
}
