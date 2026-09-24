// Core business rules shared by the admin panel (and mirrored in the Flutter app).

import type { DemoDatabase, Employee, MentorMatch, MonthlyStatus, Session } from './types';
import { PROGRAMME_LIMITS } from './content/mentoring';

/**
 * Monthly status of a manager ↔ report pair.
 * Priority: completed > scheduled > missed > to_be_scheduled (cancelled sessions are ignored).
 * A missed session that was re-booked therefore shows as scheduled.
 */
export function monthlyStatus(sessions: Session[], employeeId: string, month: string): MonthlyStatus {
  let hasScheduled = false;
  let hasMissed = false;
  for (const s of sessions) {
    if (s.employeeId !== employeeId || s.month !== month) continue;
    if (s.status === 'completed') return 'completed';
    if (s.status === 'scheduled') hasScheduled = true;
    if (s.status === 'missed') hasMissed = true;
  }
  if (hasScheduled) return 'scheduled';
  if (hasMissed) return 'missed';
  return 'to_be_scheduled';
}

/** The session that best represents the pair's month (same priority as monthlyStatus). */
export function monthlySession(sessions: Session[], employeeId: string, month: string): Session | undefined {
  const list = sessions.filter((s) => s.employeeId === employeeId && s.month === month && s.status !== 'cancelled');
  const rank = { completed: 0, scheduled: 1, missed: 2, cancelled: 3 } as const;
  return list.sort((a, b) => rank[a.status] - rank[b.status] || b.start.localeCompare(a.start))[0];
}

/** A scheduled session whose end time has passed and still needs the manager to mark it. */
export const isAwaitingUpdate = (s: Session, now: Date = new Date()) => s.status === 'scheduled' && new Date(s.end) < now;

export const directReports = (employees: Employee[], managerId: string) => employees.filter((e) => e.managerId === managerId && e.status !== 'inactive');

/** Management chain of an employee (manager, skip-level, … up to the MD). */
export const managementChain = (employees: Employee[], id: string): string[] => {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const out: string[] = [];
  let cur = byId.get(id)?.managerId ?? null;
  while (cur && !out.includes(cur)) {
    out.push(cur);
    cur = byId.get(cur)?.managerId ?? null;
  }
  return out;
};

// ───────────────────────── Mentoring matching rules ─────────────────────────

export type RuleResult = { id: 'cross_functional' | 'capacity' | 'reporting'; ok: boolean; message: string };

/** Matches that occupy a mentor's capacity within a cohort. */
export const occupyingMatches = (matches: MentorMatch[], mentorId: string, cohortId: string) =>
  matches.filter((m) => m.mentorId === mentorId && m.cohortId === cohortId && (m.status === 'proposed' || m.status === 'accepted' || m.status === 'active'));

export function validateMatch(db: Pick<DemoDatabase, 'employees' | 'mentors' | 'matches'>, mentorId: string, menteeId: string, cohortId: string): RuleResult[] {
  const byId = new Map(db.employees.map((e) => [e.id, e]));
  const mentor = byId.get(mentorId);
  const mentee = byId.get(menteeId);
  const profile = db.mentors.find((m) => m.employeeId === mentorId);
  const capacity = Math.min(profile?.capacity ?? PROGRAMME_LIMITS.maxMenteesPerMentor, PROGRAMME_LIMITS.maxMenteesPerMentor);
  const used = occupyingMatches(db.matches, mentorId, cohortId).filter((m) => m.menteeId !== menteeId).length;
  const sameFn = mentor && mentee && mentor.functionId === mentee.functionId;
  const chainA = managementChain(db.employees, menteeId);
  const chainB = managementChain(db.employees, mentorId);
  const reporting = chainA.includes(mentorId) || chainB.includes(menteeId);
  return [
    {
      id: 'cross_functional',
      ok: !sameFn,
      message: sameFn ? 'Mentor and mentee are in the same function' : 'Different functions — cross-functional exposure',
    },
    {
      id: 'capacity',
      ok: used < capacity,
      message: used < capacity ? `${used} of ${capacity} slots used — capacity available` : `Mentor is at capacity (${used}/${capacity})`,
    },
    {
      id: 'reporting',
      ok: !reporting,
      message: reporting ? 'Mentor is in the mentee’s reporting line' : 'No reporting relationship',
    },
  ];
}
