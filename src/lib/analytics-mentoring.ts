// PCBL Mentoring analytics — pure, memoised functions over DemoDatabase.
// SPEC §3 rules 11 (capacity), 14 (mentor of the month), 15 (hours invested) · Admin rows A30–A45.
//
//   cohortTimeline(cohort)                → month x of 6, today marker, month strip
//   pairProgress(db, filters)             → every active pair with anchors 1/2/3, actions, rating, health
//   mentoringKpis / monthlyMentoring / sentimentSplit / latestComments / mentorOfTheMonth / anchorProgress
//   mentorLoad(db, mentorId, cohortId)    → capacity meter (active · accepted · proposed · free)
//   preferredMentorChecks(db, app)        → validateMatch per preferred mentor (A32)
//
// Filters: { cohortId, functionId (mentee's function), mentorId }. Mentoring is not unit-scoped
// (hr_admin has no mentoring access), so there is no unit filter here.
// Results are cached per collection reference + arguments + today's date via memoOn.

import type {
  AnchorConversation,
  ApplicationStatus,
  DemoDatabase,
  Employee,
  ID,
  MenteeApplication,
  MentorMatch,
  MentorProfile,
  MentoringCohort,
  MentoringFeedback,
  MentoringSession,
  MonthKey,
  Sentiment,
} from '@shared/types';
import { ANCHOR_CONVERSATIONS, PROGRAMME_LIMITS } from '@shared/content/mentoring';
import { validateMatch, type RuleResult } from '@shared/logic';
import { formatMonth, formatMonthShort, monthKey, monthRange, addMonthsToKey } from '@shared/utils/dates';
import { employeeMap, mentorMap } from './lookup';
import { memoOn } from './memo';

export interface MentoringFilters {
  cohortId?: ID | null;
  /** Mentee's function */
  functionId?: ID | null;
  mentorId?: ID | null;
}

const fKey = (f: MentoringFilters = {}) => `${f.cohortId ?? ''}|${f.functionId ?? ''}|${f.mentorId ?? ''}`;
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export const ANCHORS: readonly AnchorConversation[] = [1, 2, 3];
export const anchorGuide = (a: AnchorConversation) => ANCHOR_CONVERSATIONS.find((g) => g.anchor === a)!;
export const MINUTES_PER_SESSION = PROGRAMME_LIMITS.conversationMinutes;

// ───────────────────────── cohorts ─────────────────────────

/** Default cohort for a page: the running cohort for programme views, the one being staffed for matching views. */
export function defaultCohortId(cohorts: MentoringCohort[], purpose: 'programme' | 'matching'): ID | null {
  const find = (...s: MentoringCohort['status'][]) => cohorts.find((c) => s.includes(c.status));
  const c =
    purpose === 'programme'
      ? (find('active') ?? find('matching', 'applications_open') ?? cohorts[cohorts.length - 1])
      : (find('applications_open', 'matching') ?? find('upcoming') ?? find('active') ?? cohorts[cohorts.length - 1]);
  return c?.id ?? null;
}

export interface CohortMonth {
  /** 1–6 */
  index: number;
  key: MonthKey;
  label: string;
  short: string;
  state: 'past' | 'current' | 'future';
}

export interface CohortTimeline {
  cohort: MentoringCohort;
  months: CohortMonth[];
  /** 0 = not started, 1–6 = month x of 6, 7 = ended */
  monthIndex: number;
  started: boolean;
  ended: boolean;
  /** Position of "today" along the six months, 0–1 (clamped, by elapsed time) */
  todayPct: number;
  /** Position of "today" on a strip of six equal month columns, 0–1 (clamped) */
  todayPos: number;
  daysToStart: number;
  daysLeft: number;
  /** Last day of the programme (end of day) */
  endsAt: Date;
}

/** Month x of 6, today marker and the month strip of a cohort. */
export function cohortTimeline(cohort: MentoringCohort, now: Date = new Date()): CohortTimeline {
  const start = new Date(cohort.startDate);
  const endDay = new Date(cohort.endDate);
  const endsAt = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59, 59);
  const first = monthKey(start);
  const keys = monthRange(first, addMonthsToKey(first, PROGRAMME_LIMITS.durationMonths - 1));
  const cur = monthKey(now);
  const started = now >= start;
  const ended = now > endsAt;
  const idx = keys.indexOf(cur);
  const monthIndex = !started ? 0 : ended ? 7 : idx >= 0 ? idx + 1 : cur < first ? 0 : 7;
  const span = endsAt.getTime() - start.getTime();
  const todayPct = Math.max(0, Math.min(1, (now.getTime() - start.getTime()) / span));
  const day = 86400000;
  const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const within = (now.getDate() - 1 + now.getHours() / 24) / dim;
  const todayPos = !started ? 0 : ended ? 1 : Math.max(0, Math.min(1, (monthIndex - 1 + within) / keys.length));
  return {
    cohort,
    months: keys.map((key, i) => ({
      index: i + 1,
      key,
      label: formatMonth(key),
      short: formatMonthShort(key),
      state: key < cur ? 'past' : key === cur ? 'current' : 'future',
    })),
    monthIndex,
    started,
    ended,
    todayPct,
    todayPos,
    daysToStart: Math.max(0, Math.ceil((start.getTime() - now.getTime()) / day)),
    daysLeft: Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / day)),
    endsAt,
  };
}

/** Month key of an anchor's due month within a cohort (e.g. anchor 2 → month 3). */
export const anchorDueKey = (t: CohortTimeline, a: AnchorConversation): MonthKey => t.months[anchorGuide(a).suggestedMonth - 1]?.key ?? t.months[t.months.length - 1].key;

// ───────────────────────── indexes ─────────────────────────

/** Mentoring sessions (excluding cancelled) by matchId, sorted by start. */
export function sessionsByMatch(db: Pick<DemoDatabase, 'mentoringSessions'>): Map<ID, MentoringSession[]> {
  return memoOn([db.mentoringSessions], 'msByMatch', () => {
    const m = new Map<ID, MentoringSession[]>();
    for (const s of db.mentoringSessions) {
      if (s.status === 'cancelled') continue;
      const list = m.get(s.matchId);
      if (list) list.push(s);
      else m.set(s.matchId, [s]);
    }
    for (const list of m.values()) list.sort((a, b) => a.start.localeCompare(b.start));
    return m;
  });
}

/** Matches by applicationId (oldest first). */
export function matchesByApplication(db: Pick<DemoDatabase, 'matches'>): Map<ID, MentorMatch[]> {
  return memoOn([db.matches], 'matchesByApp', () => {
    const m = new Map<ID, MentorMatch[]>();
    for (const x of db.matches) {
      const list = m.get(x.applicationId);
      if (list) list.push(x);
      else m.set(x.applicationId, [x]);
    }
    for (const list of m.values()) list.sort((a, b) => a.proposedAt.localeCompare(b.proposedAt));
    return m;
  });
}

const OPEN_MATCH: MentorMatch['status'][] = ['proposed', 'accepted', 'active'];

/** The application's current proposal/match (proposed, accepted or active), if any. */
export const openMatchFor = (db: Pick<DemoDatabase, 'matches'>, applicationId: ID): MentorMatch | undefined =>
  (matchesByApplication(db).get(applicationId) ?? []).filter((m) => OPEN_MATCH.includes(m.status)).pop();

/** The match that best describes the mentee now: open one, else a completed one, else the latest. */
export const currentMatchFor = (db: Pick<DemoDatabase, 'matches'>, applicationId: ID): MentorMatch | undefined => {
  const list = matchesByApplication(db).get(applicationId) ?? [];
  return list.filter((m) => OPEN_MATCH.includes(m.status)).pop() ?? list.filter((m) => m.status === 'completed').pop() ?? list[list.length - 1];
};

// ───────────────────────── capacity ─────────────────────────

/** Rule 11: capacity = min(profile.capacity, 5). */
export const mentorCapacity = (p: MentorProfile | undefined) => Math.min(p?.capacity ?? PROGRAMME_LIMITS.maxMenteesPerMentor, PROGRAMME_LIMITS.maxMenteesPerMentor);

export interface MentorLoad {
  capacity: number;
  active: number;
  accepted: number;
  proposed: number;
  /** proposed + accepted + active (rule 11 occupying matches) */
  occupied: number;
  free: number;
  atCapacity: boolean;
  /** Occupying matches, newest first */
  matches: MentorMatch[];
}

/** Occupancy of every mentor in a cohort. */
export function cohortLoads(db: Pick<DemoDatabase, 'matches' | 'mentors'>, cohortId: ID): Map<ID, MentorLoad> {
  return memoOn([db.matches, db.mentors], `loads|${cohortId}`, () => {
    const out = new Map<ID, MentorLoad>();
    for (const p of db.mentors) {
      const cap = mentorCapacity(p);
      out.set(p.employeeId, { capacity: cap, active: 0, accepted: 0, proposed: 0, occupied: 0, free: cap, atCapacity: false, matches: [] });
    }
    for (const m of db.matches) {
      if (m.cohortId !== cohortId || !OPEN_MATCH.includes(m.status)) continue;
      const l = out.get(m.mentorId);
      if (!l) continue;
      l[m.status as 'proposed' | 'accepted' | 'active']++;
      l.occupied++;
      l.matches.push(m);
    }
    for (const l of out.values()) {
      l.free = Math.max(0, l.capacity - l.occupied);
      l.atCapacity = l.occupied >= l.capacity;
      l.matches.sort((a, b) => b.proposedAt.localeCompare(a.proposedAt));
    }
    return out;
  });
}

const EMPTY_LOAD: MentorLoad = {
  capacity: PROGRAMME_LIMITS.maxMenteesPerMentor,
  active: 0,
  accepted: 0,
  proposed: 0,
  occupied: 0,
  free: PROGRAMME_LIMITS.maxMenteesPerMentor,
  atCapacity: false,
  matches: [],
};
export const mentorLoad = (db: Pick<DemoDatabase, 'matches' | 'mentors'>, mentorId: ID, cohortId: ID): MentorLoad => cohortLoads(db, cohortId).get(mentorId) ?? EMPTY_LOAD;

// ───────────────────────── ratings ─────────────────────────

export interface RatingSummary {
  avg: number | null;
  count: number;
  sessions: number;
}

/** Average mentee rating + completed sessions per mentor, across all cohorts. */
export function mentorRatings(db: Pick<DemoDatabase, 'mentoringSessions'>): Map<ID, RatingSummary> {
  return memoOn([db.mentoringSessions], 'mentorRatings', () => {
    const acc = new Map<ID, { sum: number; count: number; sessions: number }>();
    for (const s of db.mentoringSessions) {
      if (s.status !== 'completed') continue;
      const a = acc.get(s.mentorId) ?? { sum: 0, count: 0, sessions: 0 };
      a.sessions++;
      if (s.feedback) {
        a.sum += s.feedback.rating;
        a.count++;
      }
      acc.set(s.mentorId, a);
    }
    return new Map([...acc].map(([k, a]) => [k, { avg: a.count ? a.sum / a.count : null, count: a.count, sessions: a.sessions }]));
  });
}

// ───────────────────────── pairs ─────────────────────────

export type AnchorState = 'completed' | 'scheduled' | 'none';
export type PairHealth = 'on_track' | 'at_risk' | 'behind';

export const PAIR_HEALTH_META: Record<PairHealth, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  on_track: { label: 'On track', tone: 'success' },
  at_risk: { label: 'At risk', tone: 'warning' },
  behind: { label: 'Behind', tone: 'danger' },
};

export interface PairProgress {
  match: MentorMatch;
  mentor: Employee | undefined;
  mentee: Employee | undefined;
  anchors: Record<AnchorConversation, AnchorState>;
  anchorsCompleted: number;
  extraCompleted: number;
  completed: number;
  scheduled: number;
  sessions: MentoringSession[];
  lastConversation?: MentoringSession;
  nextScheduled?: MentoringSession;
  openActions: number;
  overdueActions: number;
  avgRating: number | null;
  ratingCount: number;
  health: PairHealth;
  healthNote: string;
}

/** Progress of one pair against the anchor plan of its cohort. */
export function progressOfMatch(db: Pick<DemoDatabase, 'mentoringSessions' | 'employees'>, match: MentorMatch, t: CohortTimeline | null, now: Date = new Date()): PairProgress {
  const emp = employeeMap(db);
  const sessions = sessionsByMatch(db).get(match.id) ?? [];
  const anchors: Record<AnchorConversation, AnchorState> = { 1: 'none', 2: 'none', 3: 'none' };
  let extra = 0;
  let completed = 0;
  let scheduled = 0;
  let open = 0;
  let overdue = 0;
  let sum = 0;
  let count = 0;
  let last: MentoringSession | undefined;
  let next: MentoringSession | undefined;
  for (const s of sessions) {
    if (s.status === 'completed') {
      completed++;
      if (s.anchor) anchors[s.anchor] = 'completed';
      else extra++;
      if (!last || s.start > last.start) last = s;
      if (s.feedback) {
        sum += s.feedback.rating;
        count++;
      }
      for (const a of s.actions) {
        if (a.done) continue;
        open++;
        if (a.dueDate && new Date(a.dueDate) < now) overdue++;
      }
    } else if (s.status === 'scheduled') {
      scheduled++;
      if (s.anchor && anchors[s.anchor] === 'none') anchors[s.anchor] = 'scheduled';
      if (new Date(s.start) >= now && (!next || s.start < next.start)) next = s;
    }
  }
  let health: PairHealth = 'on_track';
  let healthNote = 'All anchor conversations on plan';
  if (t && t.started) {
    for (const a of ANCHORS) {
      const due = anchorGuide(a).suggestedMonth;
      if (anchors[a] === 'completed') continue;
      if (t.monthIndex > due) {
        health = 'behind';
        healthNote = `Conversation ${a} was due in ${t.months[due - 1]?.label ?? `month ${due}`}${anchors[a] === 'scheduled' ? ' — now scheduled' : ''}`;
        break;
      }
      if (t.monthIndex === due && anchors[a] === 'none' && health === 'on_track') {
        health = 'at_risk';
        healthNote = `Conversation ${a} is due this month and not scheduled yet`;
      }
    }
  } else if (t && !t.started) {
    healthNote = 'Programme has not started yet';
  }
  const anchorsCompleted = ANCHORS.filter((a) => anchors[a] === 'completed').length;
  return {
    match,
    mentor: emp.get(match.mentorId),
    mentee: emp.get(match.menteeId),
    anchors,
    anchorsCompleted,
    extraCompleted: extra,
    completed,
    scheduled,
    sessions,
    lastConversation: last,
    nextScheduled: next,
    openActions: open,
    overdueActions: overdue,
    avgRating: count ? sum / count : null,
    ratingCount: count,
    health,
    healthNote,
  };
}

/** Matches of a cohort that are (or were) a live pair, after filters. */
export function cohortPairs(db: DemoDatabase, filters: MentoringFilters): MentorMatch[] {
  return memoOn([db.matches, db.employees], `pairs|${fKey(filters)}`, () => {
    const emp = employeeMap(db);
    return db.matches.filter(
      (m) =>
        (m.status === 'active' || m.status === 'completed') &&
        (!filters.cohortId || m.cohortId === filters.cohortId) &&
        (!filters.mentorId || m.mentorId === filters.mentorId) &&
        (!filters.functionId || emp.get(m.menteeId)?.functionId === filters.functionId),
    );
  });
}

/** A43 — every pair in the cohort with conversations, actions, rating and on-track status. */
export function pairProgress(db: DemoDatabase, filters: MentoringFilters, now: Date = new Date()): PairProgress[] {
  return memoOn([db.matches, db.mentoringSessions, db.employees, db.cohorts], `pp|${fKey(filters)}|${dayKey(now)}`, () => {
    const cohorts = new Map(db.cohorts.map((c) => [c.id, cohortTimeline(c, now)]));
    return cohortPairs(db, filters).map((m) => progressOfMatch(db, m, cohorts.get(m.cohortId) ?? null, now));
  });
}

/** Completed / scheduled sessions of the filtered pairs. */
function pairSessions(db: DemoDatabase, filters: MentoringFilters): MentoringSession[] {
  return memoOn([db.matches, db.mentoringSessions, db.employees], `ps|${fKey(filters)}`, () => {
    const idx = sessionsByMatch(db);
    return cohortPairs(db, filters).flatMap((m) => idx.get(m.id) ?? []);
  });
}

// ───────────────────────── KPIs & trends ─────────────────────────

export interface MentoringKpis {
  activePairs: number;
  sessionsCompleted: number;
  sessionsScheduled: number;
  sessionsThisMonth: number;
  sessionsLastMonth: number;
  /** Rule 15: completed × 60 min, in hours */
  hoursInvested: number;
  avgRating: number | null;
  ratingCount: number;
  /** positive / all feedback, 0–1 */
  positiveShare: number | null;
  feedbackCount: number;
  openActions: number;
  overdueActions: number;
}

export function mentoringKpis(db: DemoDatabase, filters: MentoringFilters, now: Date = new Date()): MentoringKpis {
  return memoOn([db.matches, db.mentoringSessions, db.employees], `kpi|${fKey(filters)}|${dayKey(now)}`, () => {
    const pairs = cohortPairs(db, filters);
    const sessions = pairSessions(db, filters);
    const cur = monthKey(now);
    const prev = addMonthsToKey(cur, -1);
    let completed = 0;
    let scheduled = 0;
    let thisMonth = 0;
    let lastMonth = 0;
    let sum = 0;
    let count = 0;
    let positive = 0;
    let open = 0;
    let overdue = 0;
    for (const s of sessions) {
      if (s.status === 'scheduled') scheduled++;
      if (s.status !== 'completed') continue;
      completed++;
      const k = monthKey(s.start);
      if (k === cur) thisMonth++;
      if (k === prev) lastMonth++;
      if (s.feedback) {
        sum += s.feedback.rating;
        count++;
        if (s.feedback.sentiment === 'positive') positive++;
      }
      for (const a of s.actions) {
        if (a.done) continue;
        open++;
        if (a.dueDate && new Date(a.dueDate) < now) overdue++;
      }
    }
    return {
      activePairs: pairs.filter((m) => m.status === 'active').length,
      sessionsCompleted: completed,
      sessionsScheduled: scheduled,
      sessionsThisMonth: thisMonth,
      sessionsLastMonth: lastMonth,
      hoursInvested: (completed * MINUTES_PER_SESSION) / 60,
      avgRating: count ? sum / count : null,
      ratingCount: count,
      positiveShare: count ? positive / count : null,
      feedbackCount: count,
      openActions: open,
      overdueActions: overdue,
    };
  });
}

/** A type alias (not an interface) so rows can be passed straight to the chart wrappers (Datum). */
export type MentoringMonth = {
  key: MonthKey;
  label: string;
  short: string;
  /** "M1 · Jul" */
  axis: string;
  completed: number;
  hours: number;
  a1: number;
  a2: number;
  a3: number;
  extra: number;
  scheduled: number;
  positive: number;
  neutral: number;
  negative: number;
  feedback: number;
  avgRating: number | null;
};

/** A40/A41/A42 — per cohort month (up to the current month): sessions, hours, anchors, sentiment. */
export function monthlyMentoring(db: DemoDatabase, filters: MentoringFilters, now: Date = new Date()): MentoringMonth[] {
  return memoOn([db.matches, db.mentoringSessions, db.employees, db.cohorts], `monthly|${fKey(filters)}|${dayKey(now)}`, () => {
    const cohort = db.cohorts.find((c) => c.id === filters.cohortId);
    if (!cohort) return [];
    const t = cohortTimeline(cohort, now);
    if (!t.started) return [];
    const cur = monthKey(now);
    const months = t.months.filter((m) => m.key <= cur);
    const rows = new Map<MonthKey, MentoringMonth & { sum: number }>(
      months.map((m) => [
        m.key,
        {
          key: m.key,
          label: m.label,
          short: m.short,
          axis: `M${m.index} · ${m.short}`,
          completed: 0,
          hours: 0,
          a1: 0,
          a2: 0,
          a3: 0,
          extra: 0,
          scheduled: 0,
          positive: 0,
          neutral: 0,
          negative: 0,
          feedback: 0,
          avgRating: null,
          sum: 0,
        },
      ]),
    );
    for (const s of pairSessions(db, filters)) {
      const r = rows.get(monthKey(s.start));
      if (!r) continue;
      if (s.status === 'scheduled') {
        r.scheduled++;
        continue;
      }
      if (s.status !== 'completed') continue;
      r.completed++;
      if (s.anchor === 1) r.a1++;
      else if (s.anchor === 2) r.a2++;
      else if (s.anchor === 3) r.a3++;
      else r.extra++;
      if (s.feedback) {
        r.feedback++;
        r[s.feedback.sentiment]++;
        r.sum += s.feedback.rating;
      }
    }
    return [...rows.values()].map(({ sum, ...r }) => ({ ...r, hours: (r.completed * MINUTES_PER_SESSION) / 60, avgRating: r.feedback ? sum / r.feedback : null }));
  });
}

export function sentimentSplit(db: DemoDatabase, filters: MentoringFilters): Record<Sentiment, number> {
  return memoOn([db.matches, db.mentoringSessions, db.employees], `sent|${fKey(filters)}`, () => {
    const out: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
    for (const s of pairSessions(db, filters)) if (s.status === 'completed' && s.feedback) out[s.feedback.sentiment]++;
    return out;
  });
}

export interface FeedbackComment {
  session: MentoringSession;
  feedback: MentoringFeedback & { comment: string };
  mentor: Employee | undefined;
}

/** Latest mentee comments (A42). Mentee identity is not exposed — feedback is confidential. */
export function latestComments(db: DemoDatabase, filters: MentoringFilters, limit = 5): FeedbackComment[] {
  return memoOn([db.matches, db.mentoringSessions, db.employees], `comments|${fKey(filters)}|${limit}`, () => {
    const emp = employeeMap(db);
    return pairSessions(db, filters)
      .filter((s): s is MentoringSession & { feedback: MentoringFeedback & { comment: string } } => s.status === 'completed' && !!s.feedback?.comment)
      .sort((a, b) => b.feedback.at.localeCompare(a.feedback.at))
      .slice(0, limit)
      .map((s) => ({ session: s, feedback: s.feedback, mentor: emp.get(s.mentorId) }));
  });
}

export interface MentorMonthRank {
  mentorId: ID;
  mentor: Employee | undefined;
  sessions: number;
  avgRating: number | null;
  ratings: number;
  mentees: number;
}

/** Rule 14 — most completed sessions in the month, tie-break by average mentee rating (mentor filter ignored). */
export function mentorOfTheMonth(db: DemoDatabase, filters: MentoringFilters, month: MonthKey): MentorMonthRank[] {
  const f = { ...filters, mentorId: null };
  return memoOn([db.matches, db.mentoringSessions, db.employees], `motm|${fKey(f)}|${month}`, () => {
    const emp = employeeMap(db);
    const acc = new Map<ID, { sessions: number; sum: number; ratings: number; mentees: Set<ID> }>();
    for (const s of pairSessions(db, f)) {
      if (s.status !== 'completed' || monthKey(s.start) !== month) continue;
      const a = acc.get(s.mentorId) ?? { sessions: 0, sum: 0, ratings: 0, mentees: new Set<ID>() };
      a.sessions++;
      a.mentees.add(s.menteeId);
      if (s.feedback) {
        a.sum += s.feedback.rating;
        a.ratings++;
      }
      acc.set(s.mentorId, a);
    }
    return [...acc]
      .map(([mentorId, a]) => ({
        mentorId,
        mentor: emp.get(mentorId),
        sessions: a.sessions,
        avgRating: a.ratings ? a.sum / a.ratings : null,
        ratings: a.ratings,
        mentees: a.mentees.size,
      }))
      .sort((a, b) => b.sessions - a.sessions || (b.avgRating ?? 0) - (a.avgRating ?? 0) || (a.mentor?.name ?? '').localeCompare(b.mentor?.name ?? ''));
  });
}

export interface AnchorProgress {
  anchor: AnchorConversation;
  title: string;
  /** Month index of the programme (1, 3, 6) */
  dueMonth: number;
  dueKey: MonthKey;
  dueLabel: string;
  completed: number;
  scheduled: number;
  total: number;
  /** 0–1 */
  completedShare: number;
  scheduledShare: number;
  /** Share of pairs that should have completed it by now: 1 once the due month is reached, else 0 */
  expectedShare: number;
  state: 'upcoming' | 'due' | 'overdue_window' | 'closed';
}

/** A44 — share of pairs that completed each anchor vs where the programme expects them to be. */
export function anchorProgress(db: DemoDatabase, filters: MentoringFilters, now: Date = new Date()): AnchorProgress[] {
  const cohort = db.cohorts.find((c) => c.id === filters.cohortId);
  if (!cohort) return [];
  const t = cohortTimeline(cohort, now);
  const pairs = pairProgress(db, filters, now);
  const total = pairs.length;
  return ANCHORS.map((a) => {
    const g = anchorGuide(a);
    const completed = pairs.filter((p) => p.anchors[a] === 'completed').length;
    const scheduled = pairs.filter((p) => p.anchors[a] === 'scheduled').length;
    const dueKey = anchorDueKey(t, a);
    const state: AnchorProgress['state'] = t.monthIndex < g.suggestedMonth ? 'upcoming' : t.monthIndex === g.suggestedMonth ? 'due' : t.ended ? 'closed' : 'overdue_window';
    return {
      anchor: a,
      title: g.title,
      dueMonth: g.suggestedMonth,
      dueKey,
      dueLabel: formatMonth(dueKey),
      completed,
      scheduled,
      total,
      completedShare: total ? completed / total : 0,
      scheduledShare: total ? scheduled / total : 0,
      expectedShare: t.monthIndex >= g.suggestedMonth ? 1 : 0,
      state,
    };
  });
}

// ───────────────────────── applications ─────────────────────────

export const SCORE_MAX = 15;
export const scoreTotal = (a: Pick<MenteeApplication, 'scores'>): number | null => (a.scores ? a.scores.clarity + a.scores.reflection + a.scores.fit : null);

export interface PreferredMentorCheck {
  mentorId: ID;
  rank: number;
  mentor: Employee | undefined;
  profile: MentorProfile | undefined;
  rules: RuleResult[];
  /** all three rules pass and the mentor is active */
  ok: boolean;
  load: MentorLoad;
}

/** A32 — rule validation for each preferred mentor, in order of preference. */
export function preferredMentorChecks(db: DemoDatabase, app: MenteeApplication): PreferredMentorCheck[] {
  return memoOn([db.matches, db.mentors, db.employees, db.applications], `pref|${app.id}`, () => {
    const emp = employeeMap(db);
    const prof = mentorMap(db);
    return app.preferredMentorIds.map((mentorId, i) => {
      const rules = validateMatch(db, mentorId, app.employeeId, app.cohortId);
      const profile = prof.get(mentorId);
      return {
        mentorId,
        rank: i + 1,
        mentor: emp.get(mentorId),
        profile,
        rules,
        ok: rules.every((r) => r.ok) && !!profile?.active,
        load: mentorLoad(db, mentorId, app.cohortId),
      };
    });
  });
}

/** True when a preferred mentor breaks a hard rule (same function / reporting line) — independent of capacity. */
export function hasStructuralRuleIssue(db: DemoDatabase, app: MenteeApplication): boolean {
  return preferredMentorChecks(db, app).some((c) => c.rules.some((r) => r.id !== 'capacity' && !r.ok));
}

/** The most recent moment anything happened to an application (history, match, conversation). */
export function lastActivityAt(db: DemoDatabase, app: MenteeApplication): string {
  let last = app.updatedAt;
  for (const h of app.history) if (h.at > last) last = h.at;
  for (const m of matchesByApplication(db).get(app.id) ?? []) {
    for (const h of m.history) if (h.at > last) last = h.at;
    for (const s of sessionsByMatch(db).get(m.id) ?? []) {
      const at = s.status === 'completed' ? (s.feedback?.at ?? s.end) : s.createdAt;
      if (at > last && at <= new Date().toISOString()) last = at;
    }
  }
  return last;
}

/** Application statuses shown as tabs (drafts are never visible to admins). */
export const APPLICATION_TABS: readonly ApplicationStatus[] = ['submitted', 'under_review', 'shortlisted', 'matched', 'not_matched', 'withdrawn'];

/** Applications that still need HR action in the matching workspace. */
export const needsAction = (a: MenteeApplication) => a.status === 'submitted' || a.status === 'under_review';
