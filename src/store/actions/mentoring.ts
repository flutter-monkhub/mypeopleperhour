// Mentoring administration (mentors, applications, matching, final match, history).
// SPEC §3 rules 10–12 · Admin rows A29–A38.
//
// Pure data operations — no React, no toasts. Pages call these and show feedback; every function
// throws an Error with a human-readable message when a rule blocks the change.
// Multi-collection changes go through one `setDb` call so applications / matches / notifications
// always move together. Every status transition appends to `history` with `currentActorId()`.

import type {
  AppNotification,
  ApplicationScores,
  ApplicationStatus,
  DemoDatabase,
  ID,
  MenteeApplication,
  MentorMatch,
  MentorProfile,
  MentorStyle,
  NotificationKind,
} from '@shared/types';
import { PROGRAMME_LIMITS } from '@shared/content/mentoring';
import { validateMatch } from '@shared/logic';
import { uid } from '@shared/utils/random';
import { currentActorId } from '../auth';
import { getDb, patch, setDb } from '../db';

const now = () => new Date().toISOString();
const nameOf = (db: DemoDatabase, id: ID) => db.employees.find((e) => e.id === id)?.name ?? id;
const firstName = (db: DemoDatabase, id: ID) => db.employees.find((e) => e.id === id)?.firstName ?? nameOf(db, id);
const cohortName = (db: DemoDatabase, id: ID) => db.cohorts.find((c) => c.id === id)?.name ?? 'the programme';

/** Senior employees (grade G7 and above) can be mentors. */
export const MIN_MENTOR_GRADE = 7;
export const gradeNumber = (grade: string) => Number(grade.replace(/\D/g, '')) || 0;

function notification(recipientId: ID, kind: NotificationKind, title: string, body: string, link: string): AppNotification {
  return { id: uid('NT'), recipientId, kind, title, body, createdAt: now(), read: false, link };
}

function requireApp(db: DemoDatabase, id: ID): MenteeApplication {
  const app = db.applications.find((a) => a.id === id);
  if (!app) throw new Error('Application not found');
  return app;
}

function requireMatch(db: DemoDatabase, id: ID): MentorMatch {
  const m = db.matches.find((x) => x.id === id);
  if (!m) throw new Error('Match record not found');
  return m;
}

const withStatus = (app: MenteeApplication, status: ApplicationStatus, note?: string, at = now()): MenteeApplication => ({
  ...app,
  status,
  updatedAt: at,
  history: [...app.history, { at, status, by: currentActorId(), ...(note ? { note } : {}) }],
});

const matchWithStatus = (m: MentorMatch, status: MentorMatch['status'], extra: Partial<MentorMatch> = {}, note?: string, at = now()): MentorMatch => ({
  ...m,
  ...extra,
  status,
  history: [...m.history, { at, status, by: currentActorId(), ...(note ? { note } : {}) }],
});

const replace = <T>(list: T[], next: T, same: (x: T) => boolean) => list.map((x) => (same(x) ? next : x));

// ───────────────────────── mentors (A29) ─────────────────────────

export interface MentorInput {
  capacity: number;
  expertise: string[];
  styles: MentorStyle[];
  bio: string;
}

function checkMentorInput(input: Partial<MentorInput>) {
  if (input.capacity != null && (input.capacity < PROGRAMME_LIMITS.minMenteesPerMentor || input.capacity > PROGRAMME_LIMITS.maxMenteesPerMentor))
    throw new Error(`Capacity must be between ${PROGRAMME_LIMITS.minMenteesPerMentor} and ${PROGRAMME_LIMITS.maxMenteesPerMentor} mentees`);
  if (input.expertise && !input.expertise.length) throw new Error('Add at least one area of expertise');
  if (input.styles && !input.styles.length) throw new Error('Choose at least one mentoring style');
}

/** Largest number of occupying matches (proposed/accepted/active) the mentor holds in any cohort that is still running. */
export function mentorPeakLoad(db: DemoDatabase, mentorId: ID): { count: number; cohortId: ID | null } {
  let best = { count: 0, cohortId: null as ID | null };
  for (const c of db.cohorts) {
    if (c.status === 'completed') continue;
    const n = db.matches.filter((m) => m.mentorId === mentorId && m.cohortId === c.id && (m.status === 'proposed' || m.status === 'accepted' || m.status === 'active')).length;
    if (n > best.count) best = { count: n, cohortId: c.id };
  }
  return best;
}

/** Make a senior employee (G7+) a mentor. */
export function addMentor(employeeId: ID, input: MentorInput): MentorProfile {
  const db = getDb();
  const emp = db.employees.find((e) => e.id === employeeId);
  if (!emp) throw new Error('Employee not found');
  if (emp.status === 'inactive') throw new Error(`${emp.name} is inactive`);
  if (gradeNumber(emp.grade) < MIN_MENTOR_GRADE) throw new Error(`Mentors are senior leaders (G${MIN_MENTOR_GRADE}+). ${emp.name} is ${emp.grade}.`);
  if (db.mentors.some((m) => m.employeeId === employeeId)) throw new Error(`${emp.name} is already a mentor`);
  checkMentorInput(input);
  const profile: MentorProfile = {
    employeeId,
    capacity: input.capacity,
    expertise: [...new Set(input.expertise.map((x) => x.trim()).filter(Boolean))],
    styles: input.styles,
    bio: input.bio.trim(),
    active: true,
    joinedAt: now(),
  };
  setDb((d) => ({ mentors: [...d.mentors, profile] }));
  return profile;
}

/** Edit a mentor profile. Capacity is 3–5 and can't drop below the mentees already occupying slots. */
export function updateMentor(employeeId: ID, change: Partial<MentorInput> & { active?: boolean }): void {
  const db = getDb();
  const cur = db.mentors.find((m) => m.employeeId === employeeId);
  if (!cur) throw new Error('Mentor not found');
  checkMentorInput(change);
  if (change.capacity != null && change.capacity < cur.capacity) {
    const peak = mentorPeakLoad(db, employeeId);
    if (change.capacity < peak.count)
      throw new Error(
        `${nameOf(db, employeeId)} already has ${peak.count} mentees or proposals in ${cohortName(db, peak.cohortId ?? '')} — capacity can’t go below ${peak.count}.`,
      );
  }
  const next: MentorProfile = {
    ...cur,
    ...change,
    ...(change.expertise ? { expertise: [...new Set(change.expertise.map((x) => x.trim()).filter(Boolean))] } : {}),
    ...(change.bio != null ? { bio: change.bio.trim() } : {}),
  };
  patch('mentors', employeeId, next);
}

/** Activate / deactivate a mentor. Inactive mentors can't receive new proposals; running pairs continue. */
export function setMentorActive(employeeId: ID, active: boolean): void {
  if (!patch('mentors', employeeId, { active })) throw new Error('Mentor not found');
}

// ───────────────────────── applications (A31) ─────────────────────────

const ALLOWED: Partial<Record<ApplicationStatus, ApplicationStatus[]>> = {
  submitted: ['under_review', 'not_matched'],
  under_review: ['not_matched'],
  shortlisted: ['not_matched'],
  not_matched: ['under_review'],
};

/** Score an application on the three scored criteria (1–5). A submitted application moves to Under review. */
export function scoreApplication(applicationId: ID, scores: ApplicationScores, hrNotes?: string): MenteeApplication {
  const db = getDb();
  const app = requireApp(db, applicationId);
  for (const [k, v] of Object.entries(scores)) if (!Number.isInteger(v) || v < 1 || v > 5) throw new Error(`Score “${k}” must be 1–5`);
  let next: MenteeApplication = { ...app, scores, updatedAt: now(), ...(hrNotes != null ? { hrNotes: hrNotes.trim() || undefined } : {}) };
  if (app.status === 'submitted') next = withStatus(next, 'under_review', 'Review started — application scored');
  setDb((d) => ({ applications: replace(d.applications, next, (a) => a.id === app.id) }));
  return next;
}

/** Save HR notes only. */
export function saveHrNotes(applicationId: ID, hrNotes: string): void {
  patch('applications', applicationId, { hrNotes: hrNotes.trim() || undefined, updatedAt: now() });
}

/** Generic status change with transition checks (start review, reopen …). Use the dedicated actions for matching. */
export function setApplicationStatus(applicationId: ID, status: ApplicationStatus, note?: string): MenteeApplication {
  const db = getDb();
  const app = requireApp(db, applicationId);
  if (app.status === status) return app;
  if (!ALLOWED[app.status]?.includes(status)) throw new Error(`Can’t move an application from “${app.status.replace('_', ' ')}” to “${status.replace('_', ' ')}”`);
  if (status === 'not_matched') return markNotMatched(applicationId, note ?? 'Not matched');
  const next = withStatus(app, status, note);
  setDb((d) => ({ applications: replace(d.applications, next, (a) => a.id === app.id) }));
  return next;
}

/** Close an application without a match. Any open proposal is withdrawn; the mentee is notified. */
export function markNotMatched(applicationId: ID, reason: string): MenteeApplication {
  const db = getDb();
  const app = requireApp(db, applicationId);
  if (!reason.trim()) throw new Error('Give a reason — it is kept in the application history');
  if (app.status === 'matched' || app.status === 'withdrawn') throw new Error('Matched or withdrawn applications can’t be marked as not matched');
  const at = now();
  const open = db.matches.filter((m) => m.applicationId === app.id && (m.status === 'proposed' || m.status === 'accepted'));
  const next = withStatus(app, 'not_matched', reason.trim(), at);
  const notes = [
    notification(
      app.employeeId,
      'mentoring_application',
      'Update on your mentoring application',
      `Thank you for applying to ${cohortName(db, app.cohortId)}. We couldn’t find the right match this time — HR will be in touch about next steps.`,
      '/mentoring/application',
    ),
    ...open.map((m) =>
      notification(
        m.mentorId,
        'mentoring_request',
        'Request withdrawn',
        `HR has withdrawn the request for ${nameOf(db, app.employeeId)}. No action needed.`,
        '/mentoring/requests',
      ),
    ),
  ];
  setDb((d) => ({
    applications: replace(d.applications, next, (a) => a.id === app.id),
    matches: d.matches.map((m) => (open.some((o) => o.id === m.id) ? matchWithStatus(m, 'withdrawn', {}, 'Application closed — not matched', at) : m)),
    notifications: [...notes, ...d.notifications],
  }));
  return next;
}

// ───────────────────────── matching (A33–A37) ─────────────────────────

/** Thrown when validateMatch (or mentor status) blocks a proposal / final match. `failed` lists each broken rule. */
export class MatchRuleError extends Error {
  readonly failed: string[];
  constructor(message: string, failed: string[]) {
    super(message);
    this.name = 'MatchRuleError';
    this.failed = failed;
  }
}

/** All the reasons a mentor can't be proposed for an application (empty = OK). */
export function proposalBlockers(db: DemoDatabase, app: MenteeApplication, mentorId: ID): string[] {
  const out: string[] = [];
  const profile = db.mentors.find((m) => m.employeeId === mentorId);
  if (!profile) out.push(`${nameOf(db, mentorId)} is not a mentor`);
  else if (!profile.active) out.push(`${nameOf(db, mentorId)} is inactive and can’t take new mentees`);
  if (mentorId === app.employeeId) out.push('A mentee can’t mentor themselves');
  for (const r of validateMatch(db, mentorId, app.employeeId, app.cohortId)) if (!r.ok) out.push(r.message);
  return out;
}

/**
 * HR shortlist → propose the application to a mentor (rule 12). Validates rules 10/11 with
 * `validateMatch`: cross-functional (Required), capacity and reporting line (Hard constraints).
 * Creates a `proposed` match, moves the application to Shortlisted and notifies the mentor.
 */
export function proposeMatch(applicationId: ID, mentorId: ID, note?: string): MentorMatch {
  const db = getDb();
  const app = requireApp(db, applicationId);
  if (app.status !== 'submitted' && app.status !== 'under_review')
    throw new Error(`Only submitted or under-review applications can be proposed (this one is ${app.status.replace('_', ' ')})`);
  if (db.matches.some((m) => m.applicationId === app.id && (m.status === 'proposed' || m.status === 'accepted' || m.status === 'active')))
    throw new Error('This application already has an open proposal — withdraw it first');
  const blockers = proposalBlockers(db, app, mentorId);
  if (blockers.length) throw new MatchRuleError(`Can’t propose ${nameOf(db, mentorId)}: ${blockers.join('; ')}.`, blockers);

  const at = now();
  const by = currentActorId();
  const match: MentorMatch = {
    id: uid('MT'),
    cohortId: app.cohortId,
    mentorId,
    menteeId: app.employeeId,
    applicationId: app.id,
    status: 'proposed',
    proposedAt: at,
    proposedBy: by,
    history: [{ at, status: 'proposed', by, note: note?.trim() || 'HR shortlist' }],
  };
  let next = app;
  if (next.status === 'submitted') next = withStatus(next, 'under_review', 'Review started', at);
  next = withStatus(next, 'shortlisted', `Proposed to ${nameOf(db, mentorId)}`, at);
  const menteeEmp = db.employees.find((e) => e.id === app.employeeId);
  const fn = db.functions.find((f) => f.id === menteeEmp?.functionId)?.name;
  const n = notification(
    mentorId,
    'mentoring_request',
    'New mentee request',
    `HR has shortlisted ${nameOf(db, app.employeeId)}${fn ? ` (${fn})` : ''} for you. Review their application and accept or decline.`,
    '/mentoring/requests',
  );
  setDb((d) => ({
    matches: [...d.matches, match],
    applications: replace(d.applications, next, (a) => a.id === app.id),
    notifications: [n, ...d.notifications],
  }));
  return match;
}

/** Re-match after a mentor declined: propose the same application to another mentor. */
export function rematch(applicationId: ID, mentorId: ID): MentorMatch {
  const db = getDb();
  const declined = db.matches.filter((m) => m.applicationId === applicationId && m.status === 'declined').pop();
  return proposeMatch(applicationId, mentorId, declined ? `Re-match after ${nameOf(db, declined.mentorId)} declined` : 'Re-match');
}

/** Withdraw a pending proposal (proposed or accepted, before the final match). The application returns to Under review. */
export function withdrawProposal(matchId: ID, reason?: string): MentorMatch {
  const db = getDb();
  const m = requireMatch(db, matchId);
  if (m.status !== 'proposed' && m.status !== 'accepted') throw new Error('Only pending proposals can be withdrawn');
  const app = requireApp(db, m.applicationId);
  const at = now();
  const note = reason?.trim() || 'Withdrawn by HR';
  const next = matchWithStatus(m, 'withdrawn', {}, note, at);
  const nextApp = app.status === 'shortlisted' ? withStatus(app, 'under_review', `Proposal to ${nameOf(db, m.mentorId)} withdrawn`, at) : app;
  const n = notification(
    m.mentorId,
    'mentoring_request',
    'Request withdrawn',
    `HR has withdrawn the request for ${nameOf(db, m.menteeId)}. No action needed.`,
    '/mentoring/requests',
  );
  setDb((d) => ({
    matches: replace(d.matches, next, (x) => x.id === m.id),
    applications: replace(d.applications, nextApp, (a) => a.id === app.id),
    notifications: [n, ...d.notifications],
  }));
  return next;
}

function confirmOne(db: DemoDatabase, m: MentorMatch, at: string): { match: MentorMatch; app: MenteeApplication; notes: AppNotification[] } {
  if (m.status !== 'accepted') throw new Error(`${nameOf(db, m.menteeId)} ↔ ${nameOf(db, m.mentorId)}: the mentor hasn’t accepted yet`);
  const failed = validateMatch(db, m.mentorId, m.menteeId, m.cohortId).filter((r) => !r.ok);
  if (failed.length)
    throw new MatchRuleError(
      `${nameOf(db, m.menteeId)} ↔ ${nameOf(db, m.mentorId)}: ${failed.map((r) => r.message).join('; ')}`,
      failed.map((r) => r.message),
    );
  const app = requireApp(db, m.applicationId);
  const cohort = cohortName(db, m.cohortId);
  const mentor = db.employees.find((e) => e.id === m.mentorId);
  const mentee = db.employees.find((e) => e.id === m.menteeId);
  return {
    match: matchWithStatus(m, 'active', { activatedAt: at }, 'Final match confirmed & announced', at),
    app: withStatus(app, 'matched', `Matched with ${nameOf(db, m.mentorId)}`, at),
    notes: [
      notification(
        m.menteeId,
        'mentoring_match',
        `You’re matched with ${mentor?.name ?? 'your mentor'}`,
        `${mentor?.name ?? 'Your mentor'}${mentor ? `, ${mentor.designation},` : ''} will mentor you in ${cohort}. You own the relationship — reach out to schedule Conversation 1 · Discover & Align.`,
        '/mentoring',
      ),
      notification(
        m.mentorId,
        'mentoring_match',
        `Final match confirmed: ${mentee?.name ?? 'your mentee'}`,
        `${firstName(db, m.menteeId)} is now your mentee in ${cohort}. They’ll reach out to schedule your first conversation.`,
        '/mentoring',
      ),
    ],
  };
}

/** A37 — final match: accepted → active, application → matched, both people notified. */
export function confirmMatch(matchId: ID): MentorMatch {
  return confirmMatches([matchId]).confirmed[0];
}

/**
 * Bulk final match. All-or-nothing per record: valid ones are confirmed in one atomic write,
 * the rest are returned in `failed` with the reason.
 */
export function confirmMatches(matchIds: ID[]): { confirmed: MentorMatch[]; failed: { id: ID; error: string }[] } {
  const db = getDb();
  const at = now();
  const confirmed: MentorMatch[] = [];
  const apps: MenteeApplication[] = [];
  const notes: AppNotification[] = [];
  const failed: { id: ID; error: string }[] = [];
  for (const id of matchIds) {
    try {
      const r = confirmOne(db, requireMatch(db, id), at);
      confirmed.push(r.match);
      apps.push(r.app);
      notes.push(...r.notes);
    } catch (e) {
      failed.push({ id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  if (matchIds.length === 1 && failed.length) throw new Error(failed[0].error);
  if (confirmed.length) {
    const byId = new Map(confirmed.map((m) => [m.id, m]));
    const appById = new Map(apps.map((a) => [a.id, a]));
    setDb((d) => ({
      matches: d.matches.map((m) => byId.get(m.id) ?? m),
      applications: d.applications.map((a) => appById.get(a.id) ?? a),
      notifications: [...notes, ...d.notifications],
    }));
  }
  return { confirmed, failed };
}
