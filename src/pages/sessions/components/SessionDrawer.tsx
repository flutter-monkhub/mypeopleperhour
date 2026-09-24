import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Ban,
  BellRing,
  CalendarCheck2,
  CalendarClock,
  CalendarPlus,
  CalendarX,
  CircleCheck,
  ExternalLink,
  Lock,
  MapPin,
  NotebookPen,
  RefreshCw,
  ShieldCheck,
  Star,
  TriangleAlert,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type { DemoDatabase, Employee, MissedReason, MonthKey, Session, SessionEvent } from '@shared/types';
import { MISSED_REASON_LABELS } from '@shared/content/mph';
import { formatDateLong, formatDateTime, formatMonth, formatTimeRange, monthKey, timeAgo } from '@shared/utils/dates';
import { Badge, Button, DescriptionList, Drawer, PersonCell, StatusBadge, Textarea, confirm, toast } from '@/components/ui';
import { programmeMonths } from '@/lib/analytics';
import { employeeTimeline, notedSessionIds, sessionDisplayStatus } from '@/lib/analytics-outcomes';
import { cn } from '@/lib/cn';
import { employeeMap, unitName } from '@/lib/lookup';
import { useCan } from '@/lib/rbac';
import {
  AUDIT_NOTE_MIN,
  cancelSessionByAdmin,
  lastSchedulingReminder,
  markSessionCompletedByAdmin,
  markSessionMissedByAdmin,
  sendSchedulingReminder,
  sendSessionReminder,
} from '@/store/actions';
import { useDb } from '@/store/db';
import { MonthStrip } from './MonthStrip';
import { MODE_LABELS } from './sessionRows';

export type DrawerTarget = { kind: 'session'; id: string } | { kind: 'pair'; employeeId: string; month: MonthKey };

const EVENT_META: Record<SessionEvent['type'], { label: string; icon: LucideIcon; tone: string }> = {
  created: { label: 'Scheduled', icon: CalendarPlus, tone: 'bg-info-soft text-info' },
  calendar_synced: { label: 'Outlook invite & Teams meeting created', icon: CalendarCheck2, tone: 'bg-neutral-soft text-neutral' },
  calendar_failed: { label: 'Calendar sync failed', icon: TriangleAlert, tone: 'bg-warning-soft text-warning' },
  rescheduled: { label: 'Rescheduled', icon: RefreshCw, tone: 'bg-warning-soft text-warning' },
  completed: { label: 'Marked completed', icon: CircleCheck, tone: 'bg-success-soft text-success' },
  missed: { label: 'Marked missed', icon: CalendarX, tone: 'bg-danger-soft text-danger' },
  cancelled: { label: 'Cancelled', icon: Ban, tone: 'bg-neutral-soft text-neutral' },
  reminder_sent: { label: 'Reminder sent', icon: BellRing, tone: 'bg-primary-soft text-primary' },
};

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn('size-3.5', i < value ? 'fill-[#F5B400] text-[#F5B400]' : 'text-line-strong')} />
      ))}
      <span className="ml-1.5 text-[13px] font-semibold text-ink">{value}/5</span>
    </span>
  );
}

function Timeline({ db, events, managerId }: { db: DemoDatabase; events: SessionEvent[]; managerId: string }) {
  const emp = employeeMap(db);
  const admins = new Set(db.adminUsers.map((a) => a.employeeId));
  const sorted = [...events].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <ol className="relative flex flex-col gap-4 pl-1">
      {sorted.map((e, i) => {
        const m = EVENT_META[e.type];
        const who = e.by === 'system' ? 'System' : (emp.get(e.by)?.name ?? e.by);
        const hr = e.by !== managerId && admins.has(e.by);
        return (
          <li key={`${e.at}-${i}`} className="relative flex gap-3">
            {i < sorted.length - 1 && <span className="absolute top-8 bottom-[-16px] left-[13px] w-px bg-line" aria-hidden />}
            <span className={cn('relative z-[1] grid size-7 shrink-0 place-items-center rounded-full ring-4 ring-white', m.tone)}>
              <m.icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px] font-medium text-ink">
                {m.label}
                {hr && (
                  <Badge tone="warning" size="sm" className="ml-2 align-middle">
                    HR
                  </Badge>
                )}
              </p>
              <p className="text-xs text-ink-2">
                {who} · {formatDateTime(e.at)}
              </p>
              {e.note && e.type !== 'calendar_synced' && <p className="mt-1 rounded-lg bg-canvas px-2.5 py-1.5 text-xs leading-relaxed text-ink-2">{e.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[13px] font-semibold tracking-wide text-ink-2 uppercase">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function People({ employee, manager, canLink }: { employee: Employee; manager?: Employee; canLink: boolean }) {
  const cell = (e: Employee | undefined, role: string) =>
    e ? (
      <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-line p-3">
        <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">{role}</span>
        {canLink ? (
          <Link to={`/employees/${e.id}`} className="min-w-0 rounded-md hover:bg-canvas">
            <PersonCell name={e.name} secondary={`${e.code} · ${e.designation}`} />
          </Link>
        ) : (
          <PersonCell name={e.name} secondary={`${e.code} · ${e.designation}`} />
        )}
      </div>
    ) : null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {cell(employee, 'Team member')}
      {cell(manager, 'Manager')}
    </div>
  );
}

type ActionMode = null | 'missed' | 'completed' | 'cancel';

function AdminActions({ session, onDone }: { session: Session; onDone?: () => void }) {
  const [mode, setMode] = useState<ActionMode>(null);
  const [reason, setReason] = useState<MissedReason | ''>('');
  const [remark, setRemark] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const started = new Date(session.start) <= new Date();
  const reset = () => {
    setMode(null);
    setReason('');
    setRemark('');
    setNote('');
    setError(null);
  };

  const remind = () => {
    const r = sendSessionReminder(session.id);
    if (!r.ok) return toast.error('Could not send reminder', r.error);
    toast.success('Reminder sent', 'The manager gets an in-app notification.');
  };

  const submit = async () => {
    setError(null);
    if (mode === 'missed') {
      if (!reason) return setError('Choose a reason — business or personal emergency');
      const r = markSessionMissedByAdmin(session.id, reason, remark, note);
      if (!r.ok) return setError(r.error);
      toast.success('Session marked missed', `${MISSED_REASON_LABELS[reason]} · recorded in the status history`);
    } else if (mode === 'completed') {
      const r = markSessionCompletedByAdmin(session.id, note);
      if (!r.ok) return setError(r.error);
      toast.success('Session marked completed', 'Recorded on behalf of the manager.');
    } else if (mode === 'cancel') {
      if (note.trim().length < AUDIT_NOTE_MIN) return setError('Add a reason for cancelling');
      const ok = await confirm({ title: 'Cancel this session?', message: 'Both people are notified and the pair goes back to “To be scheduled” unless they re-book.', confirmLabel: 'Cancel session', cancelLabel: 'Keep it', tone: 'danger' });
      if (!ok) return;
      const r = cancelSessionByAdmin(session.id, note);
      if (!r.ok) return setError(r.error);
      toast.success('Session cancelled', 'The manager has been asked to book a new time.');
    }
    reset();
    onDone?.();
  };

  if (!mode)
    return (
      <div className="flex flex-col gap-3">
        <p className="flex items-start gap-2 text-xs text-ink-2">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-warning" />
          Managers own their sessions. Update on their behalf only when they have asked you to — every change is logged in the history with your name.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" icon={BellRing} onClick={remind}>
            Send reminder
          </Button>
          <Button variant="secondary" size="sm" icon={CircleCheck} onClick={() => setMode('completed')} disabled={!started} title={started ? undefined : 'Available once the session has started'}>
            Mark completed
          </Button>
          <Button variant="secondary" size="sm" icon={CalendarX} onClick={() => setMode('missed')}>
            Mark missed
          </Button>
          <Button variant="secondary" size="sm" icon={Ban} onClick={() => setMode('cancel')}>
            Cancel session
          </Button>
        </div>
      </div>
    );

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-canvas/50 p-4">
      <p className="text-sm font-semibold text-ink">{mode === 'missed' ? 'Mark as missed' : mode === 'completed' ? 'Mark as completed on behalf of the manager' : 'Cancel session'}</p>
      {mode === 'missed' && (
        <>
          <div role="radiogroup" aria-label="Reason" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(Object.keys(MISSED_REASON_LABELS) as MissedReason[]).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                onClick={() => setReason(r)}
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-left text-[13px] font-medium transition-colors',
                  reason === r ? 'border-primary bg-primary-soft text-primary' : 'border-line-strong bg-white text-ink hover:border-[#c3cbdc]',
                )}
              >
                {MISSED_REASON_LABELS[r]}
              </button>
            ))}
          </div>
          <Textarea label="Remark (optional)" hint="Visible in missed-reason analytics" rows={2} maxLength={200} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="e.g. Plant shutdown drill" />
        </>
      )}
      <Textarea
        label={mode === 'cancel' ? 'Reason for cancelling' : 'Audit note'}
        required
        rows={2}
        maxLength={200}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={mode === 'cancel' ? 'e.g. Employee on extended leave' : 'e.g. Manager confirmed by email on 24 Sep'}
        hint={mode === 'cancel' ? 'Shared with both people' : 'Why HR is updating this — saved in the status history'}
      />
      {error && (
        <p className="text-[13px] font-medium text-danger" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={reset}>
          Back
        </Button>
        <Button size="sm" variant={mode === 'cancel' || mode === 'missed' ? 'danger' : 'primary'} onClick={() => void submit()}>
          {mode === 'missed' ? 'Mark missed' : mode === 'completed' ? 'Mark completed' : 'Cancel session'}
        </Button>
      </div>
    </div>
  );
}

function SessionBody({ db, session, readOnly }: { db: DemoDatabase; session: Session; readOnly?: boolean }) {
  const canEdit = useCan('sessions.edit');
  const canLink = useCan('employees.view');
  const emp = employeeMap(db);
  const employee = emp.get(session.employeeId) as Employee;
  const manager = emp.get(session.managerId);
  const noted = notedSessionIds(db).has(session.id);
  const status = sessionDisplayStatus(session);
  return (
    <div className="flex flex-col gap-6">
      {status === 'awaiting_update' && (
        <div className="flex items-start gap-2.5 rounded-xl bg-warning-soft px-4 py-3 text-[13px] text-[#9A5200]">
          <CalendarClock className="mt-0.5 size-4 shrink-0" />
          This session has ended but the manager hasn’t marked it completed or missed yet.
        </div>
      )}
      <Section title="People">
        <People employee={employee} manager={manager} canLink={canLink} />
      </Section>
      <Section title="Details">
        <DescriptionList
          items={[
            { label: 'Date', value: formatDateLong(session.start) },
            { label: 'Time (IST)', value: formatTimeRange(session.start, session.end) },
            {
              label: 'Mode',
              value: (
                <span className="inline-flex items-center gap-1.5">
                  {session.mode === 'teams' ? <Video className="size-3.5 text-primary" /> : <MapPin className="size-3.5 text-ink-2" />}
                  {MODE_LABELS[session.mode]}
                  {session.venue ? ` · ${session.venue}` : ''}
                </span>
              ),
            },
            {
              label: 'Calendar',
              value: session.calendarSynced ? (
                <span className="inline-flex items-center gap-1.5 text-success">
                  <CalendarCheck2 className="size-3.5" /> Outlook synced
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-warning">
                  <TriangleAlert className="size-3.5" /> Not synced
                </span>
              ),
            },
            ...(session.teamsLink
              ? [
                  {
                    label: 'Teams meeting',
                    value: (
                      <a href={session.teamsLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        Join link <ExternalLink className="size-3" />
                      </a>
                    ),
                  },
                ]
              : []),
            ...(session.outlookEventId ? [{ label: 'Outlook event', value: <span className="font-mono text-xs text-ink-2">{session.outlookEventId}</span> }] : []),
            { label: 'Unit', value: unitName(db, employee?.unitId) },
            { label: 'Month', value: formatMonth(session.month) },
            ...(session.agenda ? [{ label: 'Agenda', value: session.agenda, wide: true }] : []),
            ...(session.missedReason
              ? [{ label: 'Missed reason', value: <Badge tone="danger">{MISSED_REASON_LABELS[session.missedReason]}</Badge> }, { label: 'Remark', value: session.missedRemark ?? '—' }]
              : []),
            ...(session.cancelReason ? [{ label: 'Cancel reason', value: session.cancelReason, wide: true }] : []),
            ...(session.status === 'completed'
              ? [
                  { label: 'Employee rating', value: session.employeeRating ? <Stars value={session.employeeRating} /> : <span className="text-ink-2">Not rated yet</span> },
                  {
                    label: 'Manager notes',
                    value: noted ? (
                      <span className="inline-flex items-center gap-1.5 text-success">
                        <NotebookPen className="size-3.5" /> Notes captured ✓
                      </span>
                    ) : (
                      <span className="text-ink-2">No notes captured</span>
                    ),
                  },
                ]
              : []),
          ]}
        />
        {session.status === 'completed' && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
            <Lock className="size-3" /> Notes are private to the manager — admins only see whether they were captured.
          </p>
        )}
      </Section>
      <Section title="Status history" aside={<span className="text-xs text-muted">{session.history.length} events</span>}>
        <Timeline db={db} events={session.history} managerId={session.managerId} />
      </Section>
      {!readOnly && canEdit && session.status === 'scheduled' && (
        <Section title="Admin actions">
          <AdminActions session={session} />
        </Section>
      )}
    </div>
  );
}

function PairBody({ db, employeeId, month, readOnly }: { db: DemoDatabase; employeeId: string; month: MonthKey; readOnly?: boolean }) {
  const canEdit = useCan('sessions.edit');
  const canLink = useCan('employees.view');
  const emp = employeeMap(db);
  const employee = emp.get(employeeId);
  if (!employee) return null;
  const manager = employee.managerId ? emp.get(employee.managerId) : undefined;
  const months = programmeMonths(db).filter((m) => m <= month).slice(-6);
  const timeline = employeeTimeline(db, employee, months);
  const last = manager ? lastSchedulingReminder(manager.id, employee.id) : undefined;
  const current = timeline.find((t) => t.month === month)?.status;
  const remind = () => {
    if (!manager) return;
    const r = sendSchedulingReminder(manager.id, employee.id, month);
    if (!r.ok) return toast.error('Could not send reminder', r.error);
    toast.success('Reminder sent', `${manager.name} was asked to book the hour with ${employee.name}.`);
  };
  return (
    <div className="flex flex-col gap-6">
      {current === 'to_be_scheduled' && (
        <div className="flex items-start gap-2.5 rounded-xl bg-warning-soft px-4 py-3 text-[13px] text-[#9A5200]">
          <CalendarClock className="mt-0.5 size-4 shrink-0" />
          {month < monthKey(new Date())
            ? `No MyPeopleHour was booked in ${formatMonth(month)} — the month has closed.`
            : `No MyPeopleHour is booked for ${formatMonth(month)} yet. The manager owns scheduling — HR can send a nudge.`}
        </div>
      )}
      <Section title="People">
        <People employee={employee} manager={manager} canLink={canLink} />
      </Section>
      <Section title="Recent months">
        <MonthStrip items={timeline} highlight={month} />
      </Section>
      {!readOnly && canEdit && manager && current === 'to_be_scheduled' && month >= monthKey(new Date()) && (
        <Section title="Admin actions">
          <div className="flex flex-col gap-2">
            <Button variant="secondary" icon={BellRing} onClick={remind} className="self-start">
              Send scheduling reminder to {manager.firstName}
            </Button>
            <p className="text-xs text-ink-2">{last ? `Last reminder sent ${timeAgo(last)}.` : 'No reminder sent yet.'}</p>
          </div>
        </Section>
      )}
    </div>
  );
}

/** Right-side sheet for one session (or a pair that is still to be scheduled). Reads the record live from the store. */
export function SessionDrawer({ target, onClose, readOnly }: { target: DrawerTarget | null; onClose: () => void; readOnly?: boolean }) {
  const db = useDb();
  const session = target?.kind === 'session' ? db.sessions.find((s) => s.id === target.id) : undefined;
  const emp = employeeMap(db);
  const employee = target ? emp.get(target.kind === 'session' ? (session?.employeeId ?? '') : target.employeeId) : undefined;
  const manager = session ? emp.get(session.managerId) : employee?.managerId ? emp.get(employee.managerId) : undefined;
  const status = session ? sessionDisplayStatus(session) : 'to_be_scheduled';
  return (
    <Drawer
      open={!!target && !!employee}
      onClose={onClose}
      width="lg"
      title={employee ? `${employee.name} ↔ ${manager?.name ?? '—'}` : ''}
      subtitle={session ? `${formatDateLong(session.start)} · ${formatTimeRange(session.start, session.end)}` : target?.kind === 'pair' ? `MyPeopleHour · ${formatMonth(target.month)}` : undefined}
      header={
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} kind="session" label={status === 'to_be_scheduled' ? 'To be scheduled' : undefined} />
          {session && (
            <Badge tone="outline" icon={session.mode === 'teams' ? Video : MapPin}>
              {MODE_LABELS[session.mode]}
            </Badge>
          )}
          {session && <span className="font-mono text-xs text-muted">{session.id}</span>}
          {readOnly && (
            <Badge tone="neutral" icon={Lock}>
              Read-only
            </Badge>
          )}
        </div>
      }
    >
      {session ? <SessionBody db={db} session={session} readOnly={readOnly} /> : target?.kind === 'pair' ? <PairBody db={db} employeeId={target.employeeId} month={target.month} readOnly={readOnly} /> : null}
    </Drawer>
  );
}
