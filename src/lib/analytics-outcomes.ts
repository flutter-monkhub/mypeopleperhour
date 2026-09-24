// Quality & outcome metrics (SPEC §1 "Tracking — three levels") plus session-level helpers used by
// the leadership dashboard, sessions, missed reasons, archive and employee pages.
//
// Everything here is pure and memoised with `memoOn` on the collections it reads, so it is cheap to
// call from render. Filters follow lib/analytics: { unitId, functionId, department, managerId } on the
// *employee* side of the pair.
//
// Privacy rules baked in:
//   • Notes are private (rule 8) — we only ever count notes linked to sessions, never read their text.
//   • Pulse surveys are anonymous — only aggregates, and any group with fewer than MIN_GROUP
//     responses is suppressed (`suppressed: true`, values null).

import type { DemoDatabase, Employee, ID, MissedReason, MonthKey, MonthlyStatus, Session, Survey } from '@shared/types';
import { isAwaitingUpdate, monthlySession, monthlyStatus } from '@shared/logic';
import { fiscalQuarter, formatMonth, monthKey, monthKeyToDate, monthRange } from '@shared/utils/dates';
import { isPairEligible, matchesFilters, pairMonthStatuses, sessionIndex, type AnalyticsFilters } from './analytics';
import { employeeMap } from './lookup';
import { memoOn } from './memo';

const fk = (f: AnalyticsFilters = {}) => `${f.unitId ?? ''}|${f.functionId ?? ''}|${f.department ?? ''}|${f.managerId ?? ''}`;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Smallest group we report pulse aggregates for (anonymity). */
export const MIN_GROUP = 5;
/** Completion target used by the dashboard (deck: "non-negotiable discipline"). */
export const COMPLETION_TARGET = 0.9;
/** A pair is "on time" when its hour was booked by this day of the month (or earlier). */
export const ON_TIME_DAY = 7;

// ───────────────────────── sessions ─────────────────────────

/** Ids of sessions that have at least one manager note linked (content is never read). */
export function notedSessionIds(db: Pick<DemoDatabase, 'notes'>): Set<ID> {
  return memoOn([db.notes], 'notedSessionIds', () => {
    const s = new Set<ID>();
    for (const n of db.notes) if (n.sessionId) s.add(n.sessionId);
    return s;
  });
}

/** Every session of `month` whose employee passes the filters (all statuses, incl. cancelled). */
export function monthSessions(db: DemoDatabase, month: MonthKey, filters: AnalyticsFilters = {}): Session[] {
  return memoOn([db.sessions, db.employees], `monthSessions|${month}|${fk(filters)}`, () => {
    const emp = employeeMap(db);
    return db.sessions.filter((s) => {
      if (s.month !== month) return false;
      const e = emp.get(s.employeeId);
      return !!e && matchesFilters(e, filters);
    });
  });
}

/** Display status of a session: scheduled sessions whose end has passed read "Awaiting update" (rule 2). */
export type SessionDisplayStatus = Session['status'] | 'awaiting_update';
export const sessionDisplayStatus = (s: Session, now: Date = new Date()): SessionDisplayStatus => (isAwaitingUpdate(s, now) ? 'awaiting_update' : s.status);

/** Earliest booking time of a list of sessions (first `created` event, else createdAt). */
function firstBookedAt(list: Session[]): Date | null {
  let min: string | null = null;
  for (const s of list) {
    const at = s.history.find((h) => h.type === 'created')?.at ?? s.createdAt;
    if (!min || at < min) min = at;
  }
  return min ? new Date(min) : null;
}

/** Was the pair's hour for `month` booked by the ON_TIME_DAY of the month? */
export function bookedOnTime(list: Session[], month: MonthKey): boolean {
  const at = firstBookedAt(list);
  if (!at) return false;
  const d = monthKeyToDate(month);
  const cutoff = new Date(d.getFullYear(), d.getMonth(), ON_TIME_DAY, 23, 59, 59);
  return at <= cutoff;
}

// ───────────────────────── level 1 + 2: discipline & quality ─────────────────────────

export interface QualityMetrics {
  /** Pairs across the months */
  pairs: number;
  /** Pairs whose hour was booked by the ON_TIME_DAY */
  onTime: number;
  onTimeRate: number;
  completedSessions: number;
  /** Completed sessions with an employee rating */
  rated: number;
  /** Average employee conversation score (1–5) */
  avgRating: number | null;
  /** Completed sessions with at least one linked note */
  withNotes: number;
  notesRate: number;
  /** Ratings 1…5 → count */
  ratingDistribution: [number, number, number, number, number];
}

export function qualityMetrics(db: DemoDatabase, months: readonly MonthKey[], filters: AnalyticsFilters = {}): QualityMetrics {
  return memoOn([db.sessions, db.employees, db.notes], `quality|${months.join(',')}|${fk(filters)}`, () => {
    const idx = sessionIndex(db.sessions);
    const noted = notedSessionIds(db);
    const out: QualityMetrics = { pairs: 0, onTime: 0, onTimeRate: 0, completedSessions: 0, rated: 0, avgRating: null, withNotes: 0, notesRate: 0, ratingDistribution: [0, 0, 0, 0, 0] };
    const ratings: number[] = [];
    for (const m of months) {
      for (const p of pairMonthStatuses(db, m, filters)) {
        out.pairs++;
        const list = (idx.get(`${p.employeeId}|${m}`) ?? []).filter((s) => s.status !== 'cancelled');
        if (bookedOnTime(list, m)) out.onTime++;
        for (const s of list) {
          if (s.status !== 'completed') continue;
          out.completedSessions++;
          if (noted.has(s.id)) out.withNotes++;
          if (s.employeeRating) {
            ratings.push(s.employeeRating);
            out.ratingDistribution[Math.min(5, Math.max(1, Math.round(s.employeeRating))) - 1]++;
          }
        }
      }
    }
    out.rated = ratings.length;
    out.avgRating = avg(ratings);
    out.onTimeRate = out.pairs ? out.onTime / out.pairs : 0;
    out.notesRate = out.completedSessions ? out.withNotes / out.completedSessions : 0;
    return out;
  });
}

// ───────────────────────── level 3: pulse outcomes ─────────────────────────

const SCALE_TYPES = new Set(['emoji', 'likert', 'rating']);
export const HEARD_QUESTION = 'pq-heard';
export const ENPS_QUESTION = 'pq-enps';
export const FOLLOWUP_QUESTION = 'pq-followup';

export interface PulseQuarter {
  survey: Survey;
  /** "Q2 FY27" */
  period: string;
  /** Survey ran before the first MyPeopleHour month */
  baseline: boolean;
  /** Survey still open */
  live: boolean;
  invited: number;
  responses: number;
  participation: number;
  /** Fewer than MIN_GROUP responses — values withheld */
  suppressed: boolean;
  /** Average of all 1–5 scale items (emoji, likert, rating) */
  score: number | null;
  /** "I feel heard by my manager" average (1–5) */
  heard: number | null;
  /** Share answering "yes" to follow-through on agreed actions (0–1) */
  followThrough: number | null;
  /** eNPS −100 … +100 */
  enps: number | null;
  promoters: number;
  passives: number;
  detractors: number;
}

/** Pulse surveys (published or closed), oldest first. */
export function pulseSurveys(db: Pick<DemoDatabase, 'surveys'>): Survey[] {
  return memoOn([db.surveys], 'pulseSurveys', () =>
    db.surveys.filter((s) => s.kind === 'pulse' && s.status !== 'draft').sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? '')),
  );
}

/** Numeric average of the scale answers in one response, or null. */
function responseScore(survey: Survey, answers: Record<string, unknown>): number | null {
  const vals: number[] = [];
  for (const q of survey.questions) {
    if (!SCALE_TYPES.has(q.type)) continue;
    const v = answers[q.id];
    if (typeof v === 'number') vals.push(v);
  }
  return avg(vals);
}

function responsePasses(db: DemoDatabase, r: { employeeId: ID; unitId: ID; functionId: ID }, f: AnalyticsFilters): boolean {
  if (f.unitId && r.unitId !== f.unitId) return false;
  if (f.functionId && r.functionId !== f.functionId) return false;
  if (f.department || f.managerId) {
    const e = employeeMap(db).get(r.employeeId);
    if (!e) return false;
    if (f.department && e.department !== f.department) return false;
    if (f.managerId && e.managerId !== f.managerId) return false;
  }
  return true;
}

/** One aggregate per pulse survey (quarter), oldest first. */
export function pulseTrend(db: DemoDatabase, filters: AnalyticsFilters = {}, launchMonth?: MonthKey): PulseQuarter[] {
  return memoOn([db.surveys, db.responses, db.employees], `pulseTrend|${fk(filters)}|${launchMonth ?? ''}`, () => {
    const surveys = pulseSurveys(db);
    return surveys.map((sv) => {
      const due = new Date(sv.dueDate);
      const scores: number[] = [];
      const heard: number[] = [];
      const follow: boolean[] = [];
      let promoters = 0;
      let passives = 0;
      let detractors = 0;
      let responses = 0;
      for (const r of db.responses) {
        if (r.surveyId !== sv.id || r.status !== 'submitted' || !responsePasses(db, r, filters)) continue;
        responses++;
        const s = responseScore(sv, r.answers);
        if (s != null) scores.push(s);
        const h = r.answers[HEARD_QUESTION];
        if (typeof h === 'number') heard.push(h);
        const fu = r.answers[FOLLOWUP_QUESTION];
        if (typeof fu === 'boolean') follow.push(fu);
        const n = r.answers[ENPS_QUESTION];
        if (typeof n === 'number') {
          if (n >= 9) promoters++;
          else if (n >= 7) passives++;
          else detractors++;
        }
      }
      const invited = db.employees.filter(
        (e) =>
          e.status !== 'inactive' &&
          new Date(e.dateOfJoining) <= due &&
          (!sv.audienceUnitIds.length || sv.audienceUnitIds.includes(e.unitId)) &&
          matchesFilters(e, filters),
      ).length;
      const suppressed = responses < MIN_GROUP;
      const npsN = promoters + passives + detractors;
      return {
        survey: sv,
        period: sv.period,
        baseline: !!launchMonth && monthKey(sv.dueDate) < launchMonth,
        live: sv.status === 'published',
        invited,
        responses,
        participation: invited ? Math.min(1, responses / invited) : 0,
        suppressed,
        score: suppressed ? null : avg(scores),
        heard: suppressed ? null : avg(heard),
        followThrough: suppressed || !follow.length ? null : follow.filter(Boolean).length / follow.length,
        enps: suppressed || !npsN ? null : ((promoters - detractors) / npsN) * 100,
        promoters: suppressed ? 0 : promoters,
        passives: suppressed ? 0 : passives,
        detractors: suppressed ? 0 : detractors,
      };
    });
  });
}

// ───────────────────────── correlation: discipline ↔ pulse ─────────────────────────

export type CompletionBand = 'high' | 'mid' | 'low';
export const BAND_LABELS: Record<CompletionBand, string> = { high: '≥ 90% completion', mid: '70–89%', low: '< 70% completion' };

export interface CorrelationBand {
  band: CompletionBand;
  label: string;
  teams: number;
  responses: number;
  suppressed: boolean;
  score: number | null;
  heard: number | null;
}

export interface CompletionPulseCorrelation {
  survey: Survey;
  /** Months whose completion was used (closed months of the survey's quarter) */
  months: MonthKey[];
  bands: CorrelationBand[];
  /** Highest vs lowest reportable completion band (null when fewer than two are reportable) */
  compare: { top: CorrelationBand; bottom: CorrelationBand } | null;
  /** compare.top.score − compare.bottom.score */
  gap: number | null;
}

/** Quarter months (fiscal) of a survey, limited to programme months that have closed (or ≤ current if none closed). */
export function surveyQuarterMonths(survey: Survey, programme: readonly MonthKey[], now: Date = new Date()): MonthKey[] {
  const q = fiscalQuarter(survey.dueDate);
  const all = monthRange(monthKey(q.start), monthKey(q.end)).filter((m) => programme.includes(m));
  const current = monthKey(now);
  const closed = all.filter((m) => m < current);
  return closed.length ? closed : all.filter((m) => m <= current);
}

/**
 * Pulse score of respondents grouped by their manager's team completion rate over the survey quarter.
 * Team completion is the manager's whole team (unfiltered); filters apply to the respondents.
 */
export function completionPulseCorrelation(
  db: DemoDatabase,
  survey: Survey,
  programme: readonly MonthKey[],
  filters: AnalyticsFilters = {},
  now: Date = new Date(),
): CompletionPulseCorrelation | null {
  const months = surveyQuarterMonths(survey, programme, now);
  if (!months.length) return null;
  return memoOn([db.sessions, db.employees, db.responses], `corr|${survey.id}|${months.join(',')}|${fk(filters)}`, () => {
    // team completion per manager over the months
    const team = new Map<ID, { total: number; completed: number }>();
    for (const m of months) {
      for (const p of pairMonthStatuses(db, m)) {
        const t = team.get(p.managerId) ?? { total: 0, completed: 0 };
        t.total++;
        if (p.status === 'completed') t.completed++;
        team.set(p.managerId, t);
      }
    }
    const bandOf = (rate: number): CompletionBand => (rate >= 0.9 ? 'high' : rate >= 0.7 ? 'mid' : 'low');
    const acc: Record<CompletionBand, { teams: Set<ID>; scores: number[]; heard: number[] }> = {
      high: { teams: new Set(), scores: [], heard: [] },
      mid: { teams: new Set(), scores: [], heard: [] },
      low: { teams: new Set(), scores: [], heard: [] },
    };
    const emp = employeeMap(db);
    for (const r of db.responses) {
      if (r.surveyId !== survey.id || r.status !== 'submitted' || !responsePasses(db, r, filters)) continue;
      const mgr = emp.get(r.employeeId)?.managerId;
      const t = mgr ? team.get(mgr) : undefined;
      if (!mgr || !t?.total) continue;
      const b = acc[bandOf(t.completed / t.total)];
      b.teams.add(mgr);
      const s = responseScore(survey, r.answers);
      if (s != null) b.scores.push(s);
      const h = r.answers[HEARD_QUESTION];
      if (typeof h === 'number') b.heard.push(h);
    }
    const bands: CorrelationBand[] = (['high', 'mid', 'low'] as const).map((band) => {
      const a = acc[band];
      const suppressed = a.scores.length < MIN_GROUP;
      return { band, label: BAND_LABELS[band], teams: a.teams.size, responses: a.scores.length, suppressed, score: suppressed ? null : avg(a.scores), heard: suppressed ? null : avg(a.heard) };
    });
    const reportable = bands.filter((b) => b.score != null);
    const compare = reportable.length >= 2 ? { top: reportable[0], bottom: reportable[reportable.length - 1] } : null;
    const gap = compare ? (compare.top.score as number) - (compare.bottom.score as number) : null;
    return { survey, months, bands, compare, gap };
  });
}

// ───────────────────────── missed sessions ─────────────────────────

export interface MissedRecord {
  session: Session;
  employee: Employee;
  manager: Employee | undefined;
  reason: MissedReason | 'unspecified';
  /** The pair still completed / re-booked the hour that month */
  recovered: boolean;
  /** When it was marked missed (history), else the session start */
  markedAt: string;
}

/** Missed sessions over the months (employee filters apply), newest first. */
export function missedRecords(db: DemoDatabase, months: readonly MonthKey[], filters: AnalyticsFilters = {}): MissedRecord[] {
  return memoOn([db.sessions, db.employees], `missedRecords|${months.join(',')}|${fk(filters)}`, () => {
    const set = new Set(months);
    const emp = employeeMap(db);
    const idx = sessionIndex(db.sessions);
    const out: MissedRecord[] = [];
    for (const s of db.sessions) {
      if (s.status !== 'missed' || !set.has(s.month)) continue;
      const e = emp.get(s.employeeId);
      if (!e || !matchesFilters(e, filters)) continue;
      const st = monthlyStatus(idx.get(`${s.employeeId}|${s.month}`) ?? [], s.employeeId, s.month);
      out.push({
        session: s,
        employee: e,
        manager: emp.get(s.managerId),
        reason: s.missedReason ?? 'unspecified',
        recovered: st === 'completed' || st === 'scheduled',
        markedAt: s.history.find((h) => h.type === 'missed')?.at ?? s.start,
      });
    }
    return out.sort((a, b) => b.session.start.localeCompare(a.session.start));
  });
}

// ───────────────────────── per-employee ─────────────────────────

export type EmployeeMonthStatus = MonthlyStatus | 'not_eligible';

export interface EmployeeMonth {
  month: MonthKey;
  status: EmployeeMonthStatus;
  session?: Session;
  awaitingUpdate: boolean;
}

/** MyPeopleHour status of one employee (as the report in a pair) for each month. */
export function employeeTimeline(db: DemoDatabase, employee: Employee, months: readonly MonthKey[], now: Date = new Date()): EmployeeMonth[] {
  const idx = sessionIndex(db.sessions);
  return months.map((m) => {
    const list = idx.get(`${employee.id}|${m}`) ?? [];
    // Same eligibility as the dashboard; months with real sessions always show their status
    if (!isPairEligible(employee, m) && !list.length) return { month: m, status: 'not_eligible', awaitingUpdate: false };
    const status = monthlyStatus(list, employee.id, m);
    const session = list.length ? monthlySession(list, employee.id, m) : undefined;
    return { month: m, status, session, awaitingUpdate: !!session && isAwaitingUpdate(session, now) };
  });
}

/** This month's status of any employee (not_eligible when not part of a pair). */
export function employeeMonthStatus(db: DemoDatabase, e: Employee, month: MonthKey): EmployeeMonthStatus {
  if (!isPairEligible(e, month)) return 'not_eligible';
  return monthlyStatus(sessionIndex(db.sessions).get(`${e.id}|${month}`) ?? [], e.id, month);
}

// ───────────────────────── labels ─────────────────────────

/** "Jul – Sep 2026" / "Sep 2026" */
export function monthSpanLabel(months: readonly MonthKey[]): string {
  if (!months.length) return '';
  if (months.length === 1) return formatMonth(months[0]);
  const a = formatMonth(months[0]);
  const b = formatMonth(months[months.length - 1]);
  const [am, ay] = a.split(' ');
  const [bm, by] = b.split(' ');
  return ay === by ? `${am} – ${bm} ${by}` : `${a} – ${b}`;
}
