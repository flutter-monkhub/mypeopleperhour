// Employee detail (SPEC §6.2 A13, A15, A16): profile, reporting line, direct reports, MyPeopleHour
// month-by-month history (never note content), pulse participation (never answers) and mentoring.
// Edit profile / change manager need `employees.edit`; hr_admin only sees people in their unit.

import { useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  HeartHandshake,
  Lock,
  Mail,
  MessagesSquare,
  NotebookPen,
  Pencil,
  Phone,
  Star,
  UserRoundCog,
  UserRoundX,
  Users,
} from 'lucide-react';
import type { DemoDatabase, Employee, MonthKey } from '@shared/types';
import { MENTOR_ROLES } from '@shared/content/mentoring';
import { formatDate, formatDayShort, formatMonth, formatTime } from '@shared/utils/dates';
import { PageHeader } from '@/components/layout';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  DescriptionList,
  EmptyState,
  LinkButton,
  PersonCell,
  ProgressBar,
  SkeletonCard,
  StatusBadge,
  type Column,
} from '@/components/ui';
import { programmeMonths } from '@/lib/analytics';
import { employeeMonthStatus, employeeTimeline, notedSessionIds, pulseSurveys, sessionDisplayStatus } from '@/lib/analytics-outcomes';
import { cn } from '@/lib/cn';
import { formatDecimal, pluralize } from '@/lib/format';
import { employeeMap, functionName, reportsByManager, unitName } from '@/lib/lookup';
import { Can, useCan } from '@/lib/rbac';
import { useInScope, useMonth } from '@/lib/scope';
import { managementChain } from '@shared/logic';
import { useDb } from '@/store/db';
import { useWarmup } from '@/pages/dashboard/components/useWarmup';
import { MonthStrip } from '@/pages/sessions/components/MonthStrip';
import { SessionDrawer, type DrawerTarget } from '@/pages/sessions/components/SessionDrawer';
import { MODE_LABELS } from '@/pages/sessions/components/sessionRows';
import { ChangeManagerModal } from './components/ChangeManagerModal';
import { EditEmployeeDrawer } from './components/EditEmployeeDrawer';
import { LEVEL_LABELS } from './components/employeeRows';

const tenure = (iso: string) => {
  const months = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / (30.44 * 86400000)));
  const y = Math.floor(months / 12);
  const m = months % 12;
  return y ? `${y} yr${y > 1 ? 's' : ''}${m ? ` ${m} mo` : ''}` : `${m} mo`;
};

function PersonLink({ e, canLink, children, className }: { e: Employee; canLink: boolean; children: ReactNode; className?: string }) {
  return canLink ? (
    <Link to={`/employees/${e.id}`} className={cn('rounded-lg hover:bg-canvas', className)}>
      {children}
    </Link>
  ) : (
    <div className={className}>{children}</div>
  );
}

// ───────────────────────── reporting line ─────────────────────────

function ReportingLine({ db, employee, month }: { db: DemoDatabase; employee: Employee; month: MonthKey }) {
  const inScope = useInScope();
  const emp = employeeMap(db);
  const chain = managementChain(db.employees, employee.id)
    .map((id) => emp.get(id))
    .filter((e): e is Employee => !!e)
    .reverse();
  const reports = (reportsByManager(db).get(employee.id) ?? []).slice().sort((a, b) => a.name.localeCompare(b.name));
  const team = reports.map((r) => employeeMonthStatus(db, r, month));
  const done = team.filter((s) => s === 'completed').length;
  const eligible = team.filter((s) => s !== 'not_eligible').length;

  return (
    <Card padding="none">
      <CardHeader divider icon={Users} title="Reporting line" subtitle={chain.length ? `${pluralize(chain.length, 'level')} up to the MD` : 'Top of the organisation'} />
      <ol className="px-5 py-4">
        {chain.map((m, i) => (
          <li key={m.id} className="relative pb-3 pl-6">
            <span className="absolute top-2 left-[5px] h-full w-px bg-line" aria-hidden />
            <span className="absolute top-1.5 left-0 size-[11px] rounded-full border-2 border-line-strong bg-white" aria-hidden />
            <PersonLink e={m} canLink={inScope(m.id)} className="-mx-2 flex items-center gap-2 px-2 py-0.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{m.name}</span>
                <span className="block truncate text-xs text-ink-2">
                  {m.designation}
                  {i === chain.length - 1 ? ' · direct manager' : ''}
                </span>
              </span>
              {!inScope(m.id) && <Lock className="size-3 shrink-0 text-muted" aria-label="Outside your unit" />}
            </PersonLink>
          </li>
        ))}
        <li className="relative pl-6">
          <span className="absolute top-1.5 left-0 size-[11px] rounded-full bg-primary ring-4 ring-primary-soft" aria-hidden />
          <p className="text-[13px] font-semibold text-primary">{employee.name}</p>
          <p className="text-xs text-ink-2">{employee.designation}</p>
        </li>
      </ol>
      {reports.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 pt-4 pb-2">
            <p className="text-[13px] font-semibold text-ink">
              Direct reports <span className="font-normal text-ink-2">({reports.length})</span>
            </p>
            {eligible > 0 && (
              <span className="text-xs text-ink-2">
                {done} of {eligible} completed · {formatMonth(month).slice(0, 3)}
              </span>
            )}
          </div>
          {eligible > 0 && <ProgressBar value={done} max={eligible} size="xs" tone="success" className="px-5 pb-2" />}
          <ul className="scrollbar-thin max-h-[440px] divide-y divide-line overflow-y-auto">
            {reports.map((r, i) => (
              <li key={r.id}>
                <PersonLink e={r} canLink={inScope(r.id)} className="flex items-center gap-3 rounded-none px-5 py-2">
                  <PersonCell name={r.name} secondary={r.designation} className="flex-1" />
                  {team[i] === 'not_eligible' ? <span className="text-xs text-muted">{r.status === 'on_leave' ? 'On leave' : '—'}</span> : <StatusBadge status={team[i] as Exclude<typeof team[number], 'not_eligible'>} size="sm" />}
                </PersonLink>
              </li>
            ))}
          </ul>
          <div className="border-t border-line px-5 py-3">
            <Link to={`/sessions?manager=${employee.id}`} className="text-[13px] font-medium text-primary hover:text-primary-dark">
              Team’s sessions this month →
            </Link>
          </div>
        </>
      )}
    </Card>
  );
}

// ───────────────────────── MyPeopleHour history ─────────────────────────

function MphHistory({ db, employee, month }: { db: DemoDatabase; employee: Employee; month: MonthKey }) {
  const [target, setTarget] = useState<DrawerTarget | null>(null);
  const months = programmeMonths(db);
  const timeline = employeeTimeline(db, employee, months);
  const emp = employeeMap(db);
  const noted = notedSessionIds(db);
  const sessions = useMemo(() => db.sessions.filter((s) => s.employeeId === employee.id), [db.sessions, employee.id]);
  const eligibleMonths = timeline.filter((t) => t.status !== 'not_eligible');
  const completed = eligibleMonths.filter((t) => t.status === 'completed').length;
  const ratings = sessions.filter((s) => s.status === 'completed' && s.employeeRating).map((s) => s.employeeRating as number);
  const avgRating = ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null;
  const withNotes = sessions.filter((s) => s.status === 'completed' && noted.has(s.id)).length;
  const current = timeline.find((t) => t.month === month);

  const columns: Column<(typeof sessions)[number]>[] = [
    {
      key: 'date',
      header: 'Session',
      sortValue: (s) => s.start,
      cell: (s) => (
        <span className="block leading-tight whitespace-nowrap">
          <span className="block font-medium text-ink">{formatDate(s.start)}</span>
          <span className="block text-xs text-ink-2">
            {formatDayShort(s.start).slice(0, 3)} · {formatTime(s.start)} · {MODE_LABELS[s.mode]}
          </span>
        </span>
      ),
    },
    { key: 'manager', header: 'With', hideBelow: 'md', sortValue: (s) => emp.get(s.managerId)?.name ?? '', cell: (s) => <span className="whitespace-nowrap">{emp.get(s.managerId)?.name ?? '—'}</span> },
    { key: 'status', header: 'Status', sortValue: (s) => s.status, cell: (s) => <StatusBadge status={sessionDisplayStatus(s)} kind="session" size="sm" /> },
    {
      key: 'rating',
      header: 'Rating',
      align: 'right',
      sortValue: (s) => s.employeeRating ?? null,
      cell: (s) =>
        s.employeeRating ? (
          <span className="inline-flex items-center gap-1 font-semibold tabular">
            <Star className="size-3.5 fill-[#F5B400] text-[#F5B400]" />
            {s.employeeRating}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      key: 'notes',
      header: 'Notes',
      hideBelow: 'md',
      sortValue: (s) => noted.has(s.id),
      cell: (s) =>
        s.status !== 'completed' ? (
          <span className="text-muted">—</span>
        ) : noted.has(s.id) ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-success" title="The manager captured notes — content stays private">
            <NotebookPen className="size-3.5" /> Captured ✓
          </span>
        ) : (
          <span className="text-xs text-muted">None</span>
        ),
    },
  ];

  return (
    <Card padding="none">
      <CardHeader
        divider
        icon={MessagesSquare}
        title="MyPeopleHour"
        subtitle="Month by month, as a team member"
        actions={current && current.status !== 'not_eligible' ? <StatusBadge status={current.awaitingUpdate ? 'awaiting_update' : current.status} /> : undefined}
      />
      <div className="px-5 pt-4 pb-5">
        {timeline.length ? <MonthStrip items={timeline} highlight={month} /> : <p className="text-sm text-ink-2">The programme hasn’t started yet.</p>}
        <div className="mt-4 grid grid-cols-3 gap-4 rounded-xl bg-canvas px-4 py-3">
          <div>
            <p className="text-xs text-ink-2">Hours completed</p>
            <p className="text-lg leading-7 font-bold text-ink">
              {completed} <span className="text-sm font-medium text-ink-2">of {pluralize(eligibleMonths.length, 'month')}</span>
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-2">Their conversation score</p>
            <p className="text-lg leading-7 font-bold text-ink">{avgRating != null ? `${formatDecimal(avgRating)} / 5` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-ink-2">Notes captured</p>
            <p className="text-lg leading-7 font-bold text-ink">
              {withNotes} <span className="text-sm font-medium text-ink-2">sessions</span>
            </p>
          </div>
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={sessions}
        rowKey={(s) => s.id}
        initialSort={{ key: 'date', dir: 'desc' }}
        pageSize={6}
        pageSizeOptions={[6, 12, 24]}
        dense
        onRowClick={(s) => setTarget({ kind: 'session', id: s.id })}
        emptyTitle="No sessions yet"
        emptyMessage="Sessions appear here once their manager books the monthly hour."
        emptyIcon={CalendarDays}
      />
      <p className="flex items-center gap-1.5 border-t border-line px-5 py-3 text-xs text-muted">
        <Lock className="size-3" /> Notes are private to the manager — admins only see whether they were captured.
      </p>
      <SessionDrawer target={target} onClose={() => setTarget(null)} />
    </Card>
  );
}

// ───────────────────────── pulse participation ─────────────────────────

function PulseParticipation({ db, employee }: { db: DemoDatabase; employee: Employee }) {
  const surveys = pulseSurveys(db);
  const rows = surveys.map((sv) => {
    const invited = (!sv.audienceUnitIds.length || sv.audienceUnitIds.includes(employee.unitId)) && new Date(employee.dateOfJoining) <= new Date(sv.dueDate);
    const r = db.responses.find((x) => x.surveyId === sv.id && x.employeeId === employee.id);
    return { sv, invited, response: r };
  });
  return (
    <Card padding="none">
      <CardHeader divider icon={ClipboardCheck} iconTone="success" title="Pulse participation" subtitle="Quarterly pulse surveys" />
      {rows.length ? (
        <ul className="divide-y divide-line">
          {rows.map(({ sv, invited, response }) => (
            <li key={sv.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">{sv.period}</p>
                <p className="truncate text-xs text-ink-2">
                  {sv.status === 'published' ? `Open · due ${formatDate(sv.dueDate)}` : `Closed ${sv.closedAt ? formatDate(sv.closedAt) : ''}`}
                </p>
              </div>
              {!invited ? (
                <span className="text-xs text-muted">Not invited</span>
              ) : response?.status === 'submitted' ? (
                <Badge tone="success" dot size="sm">
                  Submitted {response.submittedAt ? formatDate(response.submittedAt).replace(/ \d{4}$/, '') : ''}
                </Badge>
              ) : response?.status === 'draft' ? (
                <Badge tone="warning" dot size="sm">
                  Draft started
                </Badge>
              ) : (
                <Badge tone={sv.status === 'published' ? 'neutral' : 'outline'} size="sm">
                  {sv.status === 'published' ? 'Not yet' : 'Didn’t respond'}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState size="sm" icon={ClipboardCheck} title="No pulse surveys yet" />
      )}
      <p className="flex items-center gap-1.5 border-t border-line px-5 py-3 text-xs text-muted">
        <Lock className="size-3" /> Pulse surveys are anonymous — only participation is shown, never answers.
      </p>
    </Card>
  );
}

// ───────────────────────── mentoring ─────────────────────────

function Mentoring({ db, employee }: { db: DemoDatabase; employee: Employee }) {
  const canView = useCan('mentoring.view');
  const emp = employeeMap(db);
  const profile = db.mentors.find((m) => m.employeeId === employee.id);
  const asMentor = db.matches.filter((m) => m.mentorId === employee.id && ['proposed', 'accepted', 'active'].includes(m.status));
  const apps = db.applications.filter((a) => a.employeeId === employee.id && a.status !== 'draft').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const asMentee = db.matches.filter((m) => m.menteeId === employee.id && m.status !== 'declined');
  const cohort = (id: string) => db.cohorts.find((c) => c.id === id)?.name ?? id;
  const convDone = (matchId: string) => db.mentoringSessions.filter((s) => s.matchId === matchId && s.status === 'completed').length;
  const styleLabel = (id: string) => MENTOR_ROLES.find((r) => r.id === id)?.title ?? id;

  const empty = !profile && !apps.length && !asMentee.length;
  return (
    <Card padding="none">
      <CardHeader divider icon={HeartHandshake} iconTone="mentor" title="PCBL Mentoring" subtitle={profile ? 'Mentor' : apps.length || asMentee.length ? 'Mentee' : 'Not taking part yet'} />
      {empty ? (
        <EmptyState size="sm" tone="mentor" icon={GraduationCap} title="Not in the programme" message="No mentor profile or mentee application." />
      ) : (
        <div className="flex flex-col gap-4 px-5 py-4">
          {profile && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] font-semibold text-ink">Mentor profile</p>
                <Badge tone={profile.active ? 'mentor' : 'neutral'} size="sm">
                  {profile.active ? 'Active mentor' : 'Paused'}
                </Badge>
              </div>
              {db.cohorts
                .filter((c) => c.status !== 'completed' && (c.status !== 'upcoming' || asMentor.some((m) => m.cohortId === c.id)))
                .map((c) => {
                  const used = asMentor.filter((m) => m.cohortId === c.id).length;
                  const cap = Math.min(profile.capacity, 5);
                  return <ProgressBar key={c.id} value={used} max={cap} tone="mentor" label={`${c.name} · slots`} valueLabel={`${used} of ${cap}`} />;
                })}
              {profile.expertise.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {profile.expertise.map((x) => (
                    <Badge key={x} tone="outline" size="sm">
                      {x}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-ink-2">Styles: {profile.styles.map(styleLabel).join(' · ')}</p>
              {asMentor.length > 0 && (
                <ul className="divide-y divide-line rounded-xl border border-line">
                  {asMentor.map((m) => {
                    const mentee = emp.get(m.menteeId);
                    return (
                      <li key={m.id} className="flex items-center gap-3 px-3 py-2">
                        <PersonCell name={mentee?.name ?? m.menteeId} secondary={`${cohort(m.cohortId)} · ${convDone(m.id)} of 3 conversations`} className="flex-1" />
                        <StatusBadge status={m.status} kind="match" size="sm" />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
          {(apps.length > 0 || asMentee.length > 0) && (
            <div className="flex flex-col gap-3">
              {profile && <div className="border-t border-line" />}
              {apps.map((a) => (
                <div key={a.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold text-ink">{cohort(a.cohortId)} application</p>
                    <StatusBadge status={a.status} kind="application" size="sm" />
                  </div>
                  <p className="mt-1 text-xs text-ink-2">Preferred mentors: {a.preferredMentorIds.map((id) => emp.get(id)?.name ?? id).join(', ')}</p>
                  {canView && (
                    <Link to={`/mentoring/applications/${a.id}`} className="mt-2 inline-block text-xs font-medium text-mentor hover:underline">
                      Open application →
                    </Link>
                  )}
                </div>
              ))}
              {asMentee.map((m) => {
                const mentor = emp.get(m.mentorId);
                return (
                  <div key={m.id} className="flex items-center gap-3 rounded-xl bg-mentor-soft/50 p-3">
                    <Avatar name={mentor?.name ?? m.mentorId} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-semibold text-ink">Mentor: {mentor?.name ?? m.mentorId}</p>
                      <p className="truncate text-xs text-ink-2">
                        {cohort(m.cohortId)} · {convDone(m.id)} of 3 anchor conversations
                      </p>
                    </div>
                    <StatusBadge status={m.status} kind="match" size="sm" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

// ───────────────────────── page ─────────────────────────

export default function EmployeeDetailPage() {
  const { id = '' } = useParams();
  const db = useDb();
  const location = useLocation();
  const inScope = useInScope();
  const { month } = useMonth();
  const ready = useWarmup('employee-detail', 250);
  const [editing, setEditing] = useState(false);
  const [changing, setChanging] = useState(false);
  const canEdit = useCan('employees.edit');
  const backTo = (location.state as { from?: string } | null)?.from ?? '/employees';

  const employee = employeeMap(db).get(id);
  if (!employee || !inScope(id)) {
    return (
      <>
        <PageHeader title="Employee" backTo={backTo} backLabel="Employees" />
        <Card padding="none">
          <EmptyState
            size="lg"
            icon={employee ? Lock : UserRoundX}
            title={employee ? 'Outside your unit' : 'Employee not found'}
            message={employee ? 'Your access is limited to your own unit, so this profile isn’t available.' : `There is no employee with code “${id}”.`}
            action={
              <LinkButton to="/employees" variant="secondary">
                Back to employees
              </LinkButton>
            }
          />
        </Card>
      </>
    );
  }

  const emp = employeeMap(db);
  const manager = employee.managerId ? emp.get(employee.managerId) : undefined;
  const reports = reportsByManager(db).get(employee.id)?.length ?? 0;
  const isMentor = db.mentors.some((m) => m.employeeId === employee.id);
  const isMentee = db.applications.some((a) => a.employeeId === employee.id && a.status !== 'draft') || db.matches.some((m) => m.menteeId === employee.id);

  return (
    <>
      <PageHeader
        backTo={backTo}
        backLabel="Employees"
        eyebrow={employee.code}
        title={employee.name}
        subtitle={`${employee.designation} · ${employee.department} · ${unitName(db, employee.unitId)}`}
        meta={
          <>
            <StatusBadge status={employee.status} kind="employee" />
            <Badge tone="outline">{LEVEL_LABELS[employee.level]}</Badge>
            {reports > 0 && (
              <Badge tone="primary" icon={Users}>
                {pluralize(reports, 'direct report')}
              </Badge>
            )}
            {isMentor && <Badge tone="mentor">Mentor</Badge>}
            {isMentee && <Badge tone="mentor">Mentee</Badge>}
          </>
        }
        actions={
          <Can perm="employees.edit">
            <Button variant="secondary" icon={UserRoundCog} onClick={() => setChanging(true)} disabled={!employee.managerId} title={employee.managerId ? undefined : 'The MD sits at the top of the organisation'}>
              Change manager
            </Button>
            <Button icon={Pencil} onClick={() => setEditing(true)}>
              Edit profile
            </Button>
          </Can>
        }
      />

      {!ready ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-6">
            <SkeletonCard lines={5} />
            <SkeletonCard lines={8} />
          </div>
          <div className="flex flex-col gap-6">
            <SkeletonCard lines={6} />
            <SkeletonCard lines={3} />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-6">
            <Card padding="none" className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-4 border-b border-line bg-linear-to-r from-primary-soft to-white px-6 py-5">
                <Avatar name={employee.name} size="lg" ring className="shadow-card" />
                <div className="min-w-0 flex-1">
                  <p className="text-lg leading-7 font-bold text-ink">{employee.name}</p>
                  <p className="text-sm text-ink-2">{employee.designation}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={`mailto:${employee.email}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink-2 hover:text-primary">
                    <Mail className="size-3.5" /> {employee.email}
                  </a>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs text-ink-2">
                    <Phone className="size-3.5" /> {employee.phone}
                  </span>
                </div>
              </div>
              <div className="px-6 py-5">
                <DescriptionList
                  columns={3}
                  items={[
                    { label: 'Employee code', value: employee.code },
                    { label: 'Designation', value: employee.designation },
                    { label: 'Grade', value: `${employee.grade} · ${LEVEL_LABELS[employee.level]}` },
                    { label: 'Department', value: employee.department },
                    { label: 'Function', value: functionName(db, employee.functionId) },
                    { label: 'Unit', value: unitName(db, employee.unitId) },
                    { label: 'Location', value: employee.location },
                    {
                      label: 'Reports to',
                      value: manager ? (
                        inScope(manager.id) ? (
                          <Link to={`/employees/${manager.id}`} className="text-primary hover:underline">
                            {manager.name}
                          </Link>
                        ) : (
                          manager.name
                        )
                      ) : (
                        <span className="text-ink-2">No manager (top of the organisation)</span>
                      ),
                    },
                    { label: 'Date of joining', value: `${formatDate(employee.dateOfJoining)} · ${tenure(employee.dateOfJoining)}` },
                  ]}
                />
              </div>
            </Card>
            <MphHistory db={db} employee={employee} month={month} />
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            {manager || reports ? (
              <ReportingLine db={db} employee={employee} month={month} />
            ) : null}
            <PulseParticipation db={db} employee={employee} />
            <Mentoring db={db} employee={employee} />

          </div>
        </div>
      )}

      {canEdit && (
        <>
          <EditEmployeeDrawer key={`${employee.id}-${editing}`} employee={employee} open={editing} onClose={() => setEditing(false)} />
          <ChangeManagerModal key={`m-${employee.id}-${changing}`} employee={employee} open={changing} onClose={() => setChanging(false)} />
        </>
      )}
    </>
  );
}
