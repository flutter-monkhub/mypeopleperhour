// Rebase a seed generated on day A so it reads naturally on day B.
//
// Rule set (mirrored exactly by the Flutter app in lib/data/rebase.dart):
//   1. delta = (startOfDay(today) − startOfDay(generatedAt)) rounded to whole weeks, so weekdays stay weekdays.
//   2. Every ISO timestamp in the database is shifted by `delta` days.
//   3. Session / note / mood `month` keys are recomputed from their shifted dates.
//   4. MPH sessions that are 'completed' or 'missed' but now start in the future revert to 'scheduled'.
//      (Scheduled sessions that land in the past stay 'scheduled' → the app shows them as "Awaiting update".)
//   5. Mentoring conversations 'completed' in the future revert to 'scheduled' (feedback/actions cleared).
//   6. Pulse survey period/title are recomputed from the shifted due date.
//   7. Notifications in the future are dropped.

import type { DemoDatabase } from './types';
import { fiscalQuarter, monthKey, startOfDay } from './utils/dates';

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

const shiftDeep = (value: unknown, ms: number): unknown => {
  if (typeof value === 'string') return ISO_RE.test(value) ? new Date(new Date(value).getTime() + ms).toISOString() : value;
  if (Array.isArray(value)) return value.map((v) => shiftDeep(v, ms));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = shiftDeep(v, ms);
    return out;
  }
  return value;
};

export function rebaseDatabase(db: DemoDatabase, now: Date = new Date()): DemoDatabase {
  const days = Math.round((startOfDay(now).getTime() - startOfDay(new Date(db.generatedAt)).getTime()) / 86400000);
  const weeks = Math.round(days / 7);
  if (weeks === 0) return db;
  const ms = weeks * 7 * 86400000;
  const out = shiftDeep(db, ms) as DemoDatabase;

  for (const s of out.sessions) {
    s.month = monthKey(s.start);
    if ((s.status === 'completed' || s.status === 'missed') && new Date(s.start) > now) {
      s.status = 'scheduled';
      delete s.completedAt;
      delete s.missedReason;
      delete s.missedRemark;
      delete s.employeeRating;
      delete s.employeeFeedback;
      s.history = s.history.filter((h) => h.type !== 'completed' && h.type !== 'missed' && new Date(h.at) <= now);
    }
  }
  const sessionMonth = new Map(out.sessions.map((s) => [s.id, s.month]));
  for (const n of out.notes) n.month = (n.sessionId && sessionMonth.get(n.sessionId)) || monthKey(n.createdAt);
  for (const m of out.moodChecks) m.month = monthKey(m.at);

  for (const ms2 of out.mentoringSessions) {
    if (ms2.status === 'completed' && new Date(ms2.start) > now) {
      ms2.status = 'scheduled';
      delete ms2.feedback;
      delete ms2.notes;
      delete ms2.keyInsights;
      ms2.actions = [];
    }
  }
  for (const s of out.surveys) {
    if (s.kind !== 'pulse') continue;
    const q = fiscalQuarter(new Date(new Date(s.dueDate).getTime() - 86400000));
    s.period = q.label;
    s.title = `Quarterly Pulse · ${q.label}`;
  }
  out.notifications = out.notifications.filter((n) => new Date(n.createdAt) <= now);
  return out;
}
