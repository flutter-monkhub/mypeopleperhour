// MyPeopleHour session administration (SessionsPage, MissedReasonsPage, SessionArchivePage).
//
// HR can nudge managers and — with `sessions.edit` — update a session on the manager's behalf.
// Every change appends a history event stamped with the admin's employee id and an audit note, and
// the manager gets an in-app notification (the mobile app's inbox reads `db.notifications`).
// Pure data operations: no React, no toasts.

import type { AppNotification, ID, MissedReason, MonthKey, NotificationKind, Session, SessionEvent } from '@shared/types';
import { MISSED_REASON_LABELS } from '@shared/content/mph';
import { formatDayShort, formatMonth, formatTime } from '@shared/utils/dates';
import { uid } from '@shared/utils/random';
import { currentActorId } from '../auth';
import { getDb, insert, setDb } from '../db';

export type SessionActionResult = { ok: true } | { ok: false; error: string };
const fail = (error: string): SessionActionResult => ({ ok: false, error });

/** Minimum length of the audit note HR writes when acting on a manager's behalf. */
export const AUDIT_NOTE_MIN = 5;

const nowIso = () => new Date().toISOString();
const ev = (type: SessionEvent['type'], note?: string): SessionEvent => ({ at: nowIso(), type, by: currentActorId(), ...(note ? { note } : {}) });

function notification(recipientId: ID, kind: NotificationKind, title: string, body: string, link: string): AppNotification {
  return { id: uid('NT'), recipientId, kind, title, body, link, createdAt: nowIso(), read: false };
}

const nameOf = (id: ID) => getDb().employees.find((e) => e.id === id)?.name ?? id;
const when = (s: Session) => `${formatDayShort(s.start)} at ${formatTime(s.start)}`;

/** Apply a change to one session + add notifications, atomically. */
function commit(id: ID, change: (s: Session) => Session, notes: AppNotification[]) {
  setDb((db) => ({
    sessions: db.sessions.map((s) => (s.id === id ? change(s) : s)),
    ...(notes.length ? { notifications: [...notes, ...db.notifications] } : {}),
  }));
}

function scheduledSession(id: ID): Session | SessionActionResult {
  const s = getDb().sessions.find((x) => x.id === id);
  if (!s) return fail('Session not found');
  if (s.status !== 'scheduled') return fail(`This session is already ${s.status}`);
  return s;
}
const isSession = (x: Session | SessionActionResult): x is Session => 'managerId' in x;

// ───────────────────────── reminders ─────────────────────────

/** Remind the manager about a scheduled (or awaiting-update) session. */
export function sendSessionReminder(id: ID): SessionActionResult {
  const s = scheduledSession(id);
  if (!isSession(s)) return s;
  const past = new Date(s.end) < new Date();
  const emp = nameOf(s.employeeId);
  const n = past
    ? notification(s.managerId, 'session_reminder', 'Please update your MyPeopleHour', `Your conversation with ${emp} on ${when(s)} is awaiting an update. Mark it completed or missed.`, `/session/${s.id}`)
    : notification(s.managerId, 'session_reminder', 'Your MyPeopleHour is coming up', `${when(s)} with ${emp}. Your calendar is blocked — come prepared with observations.`, `/session/${s.id}`);
  commit(id, (x) => ({ ...x, history: [...x.history, ev('reminder_sent', past ? 'HR asked the manager to update the status' : 'HR sent a reminder to the manager')] }), [n]);
  return { ok: true };
}

/** Nudge a manager to book the hour with a report who is still "to be scheduled". */
export function sendSchedulingReminder(managerId: ID, employeeId: ID, month: MonthKey): SessionActionResult {
  const db = getDb();
  if (!db.employees.some((e) => e.id === managerId) || !db.employees.some((e) => e.id === employeeId)) return fail('Employee not found');
  insert(
    'notifications',
    notification(
      managerId,
      'session_reminder',
      'Time to book your MyPeopleHour',
      `Your ${formatMonth(month)} conversation with ${nameOf(employeeId)} isn’t scheduled yet. One hour, every month, every person.`,
      `/schedule?employeeId=${employeeId}`,
    ),
    { prepend: true },
  );
  return { ok: true };
}

/** Last reminder HR sent for a pair/month (from notifications), if any. */
export function lastSchedulingReminder(managerId: ID, employeeId: ID): string | undefined {
  return getDb().notifications.find((n) => n.recipientId === managerId && n.kind === 'session_reminder' && n.link === `/schedule?employeeId=${employeeId}`)?.createdAt;
}

// ───────────────────────── status on behalf of the manager ─────────────────────────

const checkAudit = (note: string) => (note.trim().length >= AUDIT_NOTE_MIN ? null : fail('Add a short audit note explaining the update'));

/** Mark a scheduled session missed (rule 3: reason required, remark optional). */
export function markSessionMissedByAdmin(id: ID, reason: MissedReason, remark: string, auditNote: string): SessionActionResult {
  const s = scheduledSession(id);
  if (!isSession(s)) return s;
  if (!MISSED_REASON_LABELS[reason]) return fail('Choose a reason');
  const bad = checkAudit(auditNote);
  if (bad) return bad;
  const r = remark.trim();
  const note = `${MISSED_REASON_LABELS[reason]}${r ? ` — ${r}` : ''} · Updated by HR on behalf of the manager: ${auditNote.trim()}`;
  commit(
    id,
    (x) => {
      const next: Session = { ...x, status: 'missed', missedReason: reason, history: [...x.history, ev('missed', note)] };
      if (r) next.missedRemark = r;
      else delete next.missedRemark;
      return next;
    },
    [notification(s.managerId, 'session_missed', 'HR updated your MyPeopleHour', `Your conversation with ${nameOf(s.employeeId)} (${when(s)}) was marked missed — ${MISSED_REASON_LABELS[reason]}. You can reschedule within the month.`, `/session/${s.id}`)],
  );
  return { ok: true };
}

/** Mark a scheduled session completed on the manager's behalf (only once it has started). */
export function markSessionCompletedByAdmin(id: ID, auditNote: string): SessionActionResult {
  const s = scheduledSession(id);
  if (!isSession(s)) return s;
  if (new Date(s.start) > new Date()) return fail('A session can only be marked completed once it has started');
  const bad = checkAudit(auditNote);
  if (bad) return bad;
  commit(
    id,
    (x) => ({ ...x, status: 'completed', completedAt: nowIso(), history: [...x.history, ev('completed', `Marked completed by HR on behalf of the manager: ${auditNote.trim()}`)] }),
    [notification(s.managerId, 'session_completed', 'HR updated your MyPeopleHour', `Your conversation with ${nameOf(s.employeeId)} (${when(s)}) was marked completed. Capture light notes while it’s fresh.`, `/session/${s.id}`)],
  );
  return { ok: true };
}

/** Cancel a scheduled session (reason required). Both people are notified. */
export function cancelSessionByAdmin(id: ID, reason: string): SessionActionResult {
  const s = scheduledSession(id);
  if (!isSession(s)) return s;
  const r = reason.trim();
  if (r.length < AUDIT_NOTE_MIN) return fail('Add a reason for cancelling');
  const body = `The ${when(s)} MyPeopleHour between ${nameOf(s.managerId)} and ${nameOf(s.employeeId)} was cancelled by HR — ${r}.`;
  commit(id, (x) => ({ ...x, status: 'cancelled', cancelReason: r, history: [...x.history, ev('cancelled', `Cancelled by HR: ${r}`)] }), [
    notification(s.managerId, 'session_cancelled', 'MyPeopleHour cancelled', `${body} Please book a new time this month.`, `/schedule?employeeId=${s.employeeId}`),
    notification(s.employeeId, 'session_cancelled', 'MyPeopleHour cancelled', body, `/session/${s.id}`),
  ]);
  return { ok: true };
}
