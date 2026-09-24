// Report centre (SPEC A46): report definitions + pure row builders shared by the preview table,
// the CSV export and the tests. Every builder takes the same ReportFilters; the page decides
// which filters a report exposes (`filters`) and always passes the admin's unit scope.
//
//   const table = buildReport(db, 'completion', { months, unitId, functionId });
//   downloadReport(table, reportFilename(REPORT_BY_ID.completion, filters));
//
// Privacy: no MyPeopleHour note content, no mentoring notes/insights, and survey exports are
// anonymised (respondent number + unit only; groups under MIN_GROUP suppressed).

import type { DemoDatabase, ID, MentoringSession, MonthKey, PulseCategory, Session, Survey } from '@shared/types';
import { MISSED_REASON_LABELS, MONTHLY_STATUS_LABELS } from '@shared/content/mph';
import { MATCH_STATUS_LABELS } from '@shared/content/mentoring';
import { isAwaitingUpdate } from '@shared/logic';
import { formatDate, formatMonth, formatTime, monthKey } from '@shared/utils/dates';
import {
  completionByUnit,
  completionSummary,
  matchesFilters,
  missedFlags,
  missedReasonSplit,
  monthlyTrend,
  pairMonthStatuses,
  programmeMonths,
  type CompletionGroup,
  type CompletionSummary,
} from './analytics';
import {
  MIN_GROUP,
  PULSE_CATEGORIES,
  categoryScores,
  formatAnswer,
  isBaselineSurvey,
  pulseSurveys,
  surveyEnps,
  surveyResponses,
  surveyStats,
  bandOf,
  disciplineImpact,
  pulseTrend,
} from './analytics-pulse';
import { downloadCsv, toCsv, type CsvValue } from './csv';
import { employeeMap, functionMap, unitMap } from './lookup';

export type ReportId = 'completion' | 'sessions' | 'missed' | 'discipline' | 'pulse' | 'survey' | 'mentoring' | 'pairs';
export type ReportGroup = 'mph' | 'surveys' | 'mentoring';
export type ReportFilterKey = 'period' | 'unit' | 'function' | 'survey' | 'cohort';

export interface ReportFilters {
  /** Months covered (ascending). Month-based reports only. */
  months: MonthKey[];
  unitId: ID | null;
  functionId: ID | null;
  surveyId?: ID | null;
  cohortId?: ID | null;
}

export interface ReportColumn {
  key: string;
  header: string;
  /** number columns are right-aligned in the preview; percent adds a % sign */
  kind?: 'text' | 'number' | 'percent';
}

export type ReportRow = Record<string, CsvValue>;

export interface ReportTable {
  columns: ReportColumn[];
  rows: ReportRow[];
  /** Why the table is empty or partially hidden (e.g. anonymity threshold) */
  notice?: string;
}

export interface ReportDef {
  id: ReportId;
  group: ReportGroup;
  title: string;
  description: string;
  /** Which filters apply (the page renders these) */
  filters: ReportFilterKey[];
  /** Short privacy / scope note shown under the preview */
  note?: string;
  build: (db: DemoDatabase, f: ReportFilters) => ReportTable;
  /** File name stem (date + .csv are added) */
  file: string;
}

// ───────────────────────── helpers ─────────────────────────

const pct = (ratio: number | null | undefined, digits = 1) => (ratio == null || Number.isNaN(ratio) ? null : Number((ratio * 100).toFixed(digits)));
const round = (n: number | null | undefined, digits = 2) => (n == null || Number.isNaN(n) ? null : Number(n.toFixed(digits)));

/** Session status incl. the "awaiting update" pseudo-status (rule 2). */
export function sessionStatusLabel(s: Session, now: Date = new Date()): string {
  if (isAwaitingUpdate(s, now)) return 'Awaiting update';
  return s.status.charAt(0).toUpperCase() + s.status.slice(1);
}

function scopedSessions(db: DemoDatabase, f: ReportFilters): Session[] {
  const months = new Set(f.months);
  const emp = employeeMap(db);
  return db.sessions
    .filter((s) => {
      if (!months.has(s.month)) return false;
      const e = emp.get(s.employeeId);
      return !!e && matchesFilters(e, { unitId: f.unitId, functionId: f.functionId });
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

// ───────────────────────── 1 · completion by unit & month ─────────────────────────

function buildCompletion(db: DemoDatabase, f: ReportFilters): ReportTable {
  const rows: ReportRow[] = [];
  const filters = { unitId: f.unitId, functionId: f.functionId };
  for (const m of f.months) {
    for (const g of completionByUnit(db, m, filters))
      rows.push({ month: formatMonth(m), unit: g.label, pairs: g.total, completed: g.completed, scheduled: g.scheduled, tbs: g.toBeScheduled, missed: g.missed, rate: pct(g.completionRate) });
    if (!f.unitId) {
      const t = completionSummary(db, m, filters);
      rows.push({ month: formatMonth(m), unit: 'All units', pairs: t.total, completed: t.completed, scheduled: t.scheduled, tbs: t.toBeScheduled, missed: t.missed, rate: pct(t.completionRate) });
    }
  }
  return {
    columns: [
      { key: 'month', header: 'Month' },
      { key: 'unit', header: 'Unit' },
      { key: 'pairs', header: 'Pairs', kind: 'number' },
      { key: 'completed', header: MONTHLY_STATUS_LABELS.completed, kind: 'number' },
      { key: 'scheduled', header: MONTHLY_STATUS_LABELS.scheduled, kind: 'number' },
      { key: 'tbs', header: MONTHLY_STATUS_LABELS.to_be_scheduled, kind: 'number' },
      { key: 'missed', header: MONTHLY_STATUS_LABELS.missed, kind: 'number' },
      { key: 'rate', header: 'Completion %', kind: 'percent' },
    ],
    rows,
  };
}

// ───────────────────────── 2 · session register ─────────────────────────

function buildSessions(db: DemoDatabase, f: ReportFilters): ReportTable {
  const emp = employeeMap(db);
  const units = unitMap(db);
  const fns = functionMap(db);
  const withNotes = new Set(db.notes.filter((n) => n.sessionId).map((n) => n.sessionId));
  const now = new Date();
  const rows = scopedSessions(db, f).map((s) => {
    const e = emp.get(s.employeeId);
    const m = emp.get(s.managerId);
    return {
      id: s.id,
      month: formatMonth(s.month),
      date: formatDate(s.start),
      time: formatTime(s.start),
      manager: m?.name ?? s.managerId,
      managerCode: m?.code ?? s.managerId,
      employee: e?.name ?? s.employeeId,
      employeeCode: e?.code ?? s.employeeId,
      unit: units.get(e?.unitId ?? '')?.name ?? '',
      function: fns.get(e?.functionId ?? '')?.name ?? '',
      department: e?.department ?? '',
      mode: s.mode === 'teams' ? 'Teams' : 'In person',
      status: sessionStatusLabel(s, now),
      reason: s.missedReason ? MISSED_REASON_LABELS[s.missedReason] : s.cancelReason ? `Cancelled: ${s.cancelReason}` : '',
      remark: s.missedRemark ?? '',
      calendar: s.calendarSynced,
      notes: withNotes.has(s.id),
      rating: s.employeeRating ?? null,
    };
  });
  return {
    columns: [
      { key: 'id', header: 'Session ID' },
      { key: 'month', header: 'Month' },
      { key: 'date', header: 'Date' },
      { key: 'time', header: 'Time' },
      { key: 'manager', header: 'Manager' },
      { key: 'managerCode', header: 'Manager code' },
      { key: 'employee', header: 'Employee' },
      { key: 'employeeCode', header: 'Employee code' },
      { key: 'unit', header: 'Unit' },
      { key: 'function', header: 'Function' },
      { key: 'department', header: 'Department' },
      { key: 'mode', header: 'Mode' },
      { key: 'status', header: 'Status' },
      { key: 'reason', header: 'Missed / cancel reason' },
      { key: 'remark', header: 'Remark' },
      { key: 'calendar', header: 'Calendar synced' },
      { key: 'notes', header: 'Notes captured' },
      { key: 'rating', header: 'Employee rating (1–5)', kind: 'number' },
    ],
    rows,
  };
}

// ───────────────────────── 3 · missed sessions & reasons ─────────────────────────

function buildMissed(db: DemoDatabase, f: ReportFilters): ReportTable {
  const emp = employeeMap(db);
  const units = unitMap(db);
  const fns = functionMap(db);
  const all = scopedSessions(db, f);
  const rows = all
    .filter((s) => s.status === 'missed')
    .map((s) => {
      const e = emp.get(s.employeeId);
      const rebooked = all.some((o) => o.id !== s.id && o.employeeId === s.employeeId && o.month === s.month && (o.status === 'completed' || o.status === 'scheduled') && o.createdAt >= s.createdAt);
      return {
        month: formatMonth(s.month),
        date: formatDate(s.start),
        manager: emp.get(s.managerId)?.name ?? s.managerId,
        employee: e?.name ?? s.employeeId,
        unit: units.get(e?.unitId ?? '')?.name ?? '',
        function: fns.get(e?.functionId ?? '')?.name ?? '',
        reason: s.missedReason ? MISSED_REASON_LABELS[s.missedReason] : 'Not specified',
        remark: s.missedRemark ?? '',
        rebooked,
      };
    });
  return {
    columns: [
      { key: 'month', header: 'Month' },
      { key: 'date', header: 'Date' },
      { key: 'manager', header: 'Manager' },
      { key: 'employee', header: 'Employee' },
      { key: 'unit', header: 'Unit' },
      { key: 'function', header: 'Function' },
      { key: 'reason', header: 'Reason' },
      { key: 'remark', header: 'Remark' },
      { key: 'rebooked', header: 'Rebooked in month' },
    ],
    rows,
  };
}

// ───────────────────────── 4 · manager discipline ─────────────────────────

function buildDiscipline(db: DemoDatabase, f: ReportFilters): ReportTable {
  const emp = employeeMap(db);
  const units = unitMap(db);
  const fns = functionMap(db);
  const acc = new Map<ID, { reports: Set<ID>; total: number; completed: number; scheduled: number; missed: number; tbs: number; missedSessions: number }>();
  for (const m of f.months)
    for (const p of pairMonthStatuses(db, m, { unitId: f.unitId, functionId: f.functionId })) {
      const b = acc.get(p.managerId) ?? { reports: new Set(), total: 0, completed: 0, scheduled: 0, missed: 0, tbs: 0, missedSessions: 0 };
      b.reports.add(p.employeeId);
      b.total++;
      if (p.status === 'completed') b.completed++;
      else if (p.status === 'scheduled') b.scheduled++;
      else if (p.status === 'missed') b.missed++;
      else b.tbs++;
      acc.set(p.managerId, b);
    }
  for (const s of scopedSessions(db, f)) if (s.status === 'missed' && acc.has(s.managerId)) acc.get(s.managerId)!.missedSessions++;
  const rows = [...acc.entries()]
    .map(([id, b]) => {
      const m = emp.get(id);
      const rate = b.total ? b.completed / b.total : 0;
      const band = bandOf(rate);
      return {
        manager: m?.name ?? id,
        code: m?.code ?? id,
        designation: m?.designation ?? '',
        unit: units.get(m?.unitId ?? '')?.name ?? '',
        function: fns.get(m?.functionId ?? '')?.name ?? '',
        reports: b.reports.size,
        pairMonths: b.total,
        completed: b.completed,
        scheduled: b.scheduled,
        tbs: b.tbs,
        missed: b.missedSessions,
        rate: pct(rate),
        band: band === 'high' ? 'High (≥ 90%)' : band === 'low' ? 'Low (< 70%)' : 'Medium',
      };
    })
    .sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0) || b.missed - a.missed || String(a.manager).localeCompare(String(b.manager)));
  return {
    columns: [
      { key: 'manager', header: 'Manager' },
      { key: 'code', header: 'Code' },
      { key: 'designation', header: 'Designation' },
      { key: 'unit', header: 'Unit' },
      { key: 'function', header: 'Function' },
      { key: 'reports', header: 'Direct reports', kind: 'number' },
      { key: 'pairMonths', header: 'Pair-months', kind: 'number' },
      { key: 'completed', header: 'Completed', kind: 'number' },
      { key: 'scheduled', header: 'Scheduled', kind: 'number' },
      { key: 'tbs', header: 'To be scheduled', kind: 'number' },
      { key: 'missed', header: 'Missed sessions', kind: 'number' },
      { key: 'rate', header: 'Completion %', kind: 'percent' },
      { key: 'band', header: 'Discipline' },
    ],
    rows,
  };
}

// ───────────────────────── 5 · pulse results by quarter & category ─────────────────────────

function buildPulse(db: DemoDatabase, f: ReportFilters): ReportTable {
  const rows: ReportRow[] = [];
  const filters = { unitId: f.unitId, functionId: f.functionId };
  let hidden = 0;
  for (const s of pulseSurveys(db)) {
    const rs = surveyResponses(db, s.id, filters);
    const stats = surveyStats(db, s, filters);
    const quarter = `${s.period}${isBaselineSurvey(db, s) ? ' (baseline)' : ''}${s.status === 'published' ? ' (live)' : ''}`;
    const base = { quarter, respondents: rs.length, rate: pct(stats.responseRate) };
    if (rs.length < MIN_GROUP) {
      hidden++;
      rows.push({ ...base, category: 'All', avg: null, favourable: null, enps: null });
      continue;
    }
    const cats = categoryScores(s, rs);
    for (const c of [...PULSE_CATEGORIES, 'Programme' as PulseCategory]) {
      const sc = cats[c];
      if (sc) rows.push({ ...base, category: c, avg: round(sc.avg), favourable: pct(sc.favourable), enps: null });
    }
    rows.push({ ...base, category: 'eNPS', avg: null, favourable: null, enps: surveyEnps(s, rs)?.score ?? null });
  }
  return {
    columns: [
      { key: 'quarter', header: 'Quarter' },
      { key: 'category', header: 'Category' },
      { key: 'avg', header: 'Average (1–5)', kind: 'number' },
      { key: 'favourable', header: 'Favourable %', kind: 'percent' },
      { key: 'enps', header: 'eNPS', kind: 'number' },
      { key: 'respondents', header: 'Respondents', kind: 'number' },
      { key: 'rate', header: 'Response rate %', kind: 'percent' },
    ],
    rows,
    notice: hidden ? `${hidden} quarter${hidden > 1 ? 's have' : ' has'} fewer than ${MIN_GROUP} responses for this selection — scores are hidden to protect anonymity.` : undefined,
  };
}

// ───────────────────────── 6 · survey response export (anonymised) ─────────────────────────

/** Respondent numbers follow submission order, never employee ids (so they can't be traced back). */
export function respondentOrder<T extends { id: ID; submittedAt?: string; startedAt: string }>(responses: readonly T[]): T[] {
  return [...responses].sort((a, b) => (a.submittedAt ?? a.startedAt).localeCompare(b.submittedAt ?? b.startedAt) || a.startedAt.localeCompare(b.startedAt));
}

function buildSurvey(db: DemoDatabase, f: ReportFilters): ReportTable {
  const survey = db.surveys.find((s) => s.id === f.surveyId) ?? defaultReportSurvey(db);
  if (!survey) return { columns: [{ key: 'n', header: 'Respondent' }], rows: [], notice: 'No published surveys yet.' };
  const units = unitMap(db);
  const rs = respondentOrder(surveyResponses(db, survey.id, { unitId: f.unitId, functionId: f.functionId }));
  // Same numbering as the responses page: submission order across the whole survey
  const num = new Map(respondentOrder(surveyResponses(db, survey.id, {}, 'all')).map((r, i) => [r.id, i + 1]));
  const qCols: ReportColumn[] = survey.questions.map((q, i) => ({ key: q.id, header: `Q${i + 1}. ${q.text}` }));
  if (rs.length < MIN_GROUP)
    return {
      columns: [{ key: 'n', header: 'Respondent' }, { key: 'unit', header: 'Unit' }, { key: 'date', header: 'Submitted on' }, ...qCols],
      rows: [],
      notice: rs.length ? `Only ${rs.length} response${rs.length > 1 ? 's' : ''} for this selection — at least ${MIN_GROUP} are needed before answers can be exported anonymously.` : 'No submitted responses for this selection yet.',
    };
  const rows = rs.map((r) => {
    const row: ReportRow = { n: `Respondent #${num.get(r.id) ?? '?'}`, unit: units.get(r.unitId)?.name ?? '', date: r.submittedAt ? formatDate(r.submittedAt) : '' };
    for (const q of survey.questions) row[q.id] = formatAnswer(q, r.answers[q.id]);
    return row;
  });
  return { columns: [{ key: 'n', header: 'Respondent' }, { key: 'unit', header: 'Unit' }, { key: 'date', header: 'Submitted on' }, ...qCols], rows };
}

/** Surveys that can be exported (published or closed), newest first. */
export const exportableSurveys = (db: Pick<DemoDatabase, 'surveys'>): Survey[] =>
  db.surveys.filter((s) => s.status !== 'draft').sort((a, b) => (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt));
export const defaultReportSurvey = (db: Pick<DemoDatabase, 'surveys'>): Survey | undefined => exportableSurveys(db)[0];

// ───────────────────────── 7 · mentoring summary per mentor ─────────────────────────

function menteeInScope(db: DemoDatabase, f: ReportFilters) {
  const emp = employeeMap(db);
  return (menteeId: ID) => {
    const e = emp.get(menteeId);
    return !!e && matchesFilters(e, { unitId: f.unitId, functionId: f.functionId });
  };
}

function buildMentoring(db: DemoDatabase, f: ReportFilters): ReportTable {
  const emp = employeeMap(db);
  const fns = functionMap(db);
  const units = unitMap(db);
  const inScope = menteeInScope(db, f);
  const months = new Set(f.months);
  const cohortOf = new Map(db.matches.map((m) => [m.id, m.cohortId]));
  const inCohort = (matchId: ID) => !f.cohortId || cohortOf.get(matchId) === f.cohortId;
  const acc = new Map<ID, { mentees: Set<ID>; done: MentoringSession[]; scheduled: number }>();
  for (const m of db.matches) {
    if ((m.status !== 'active' && m.status !== 'completed') || !inScope(m.menteeId) || (f.cohortId && m.cohortId !== f.cohortId)) continue;
    const b = acc.get(m.mentorId) ?? { mentees: new Set(), done: [], scheduled: 0 };
    b.mentees.add(m.menteeId);
    acc.set(m.mentorId, b);
  }
  for (const s of db.mentoringSessions) {
    if (!inScope(s.menteeId) || !inCohort(s.matchId) || !months.has(monthKey(s.start))) continue;
    const b = acc.get(s.mentorId) ?? { mentees: new Set(), done: [], scheduled: 0 };
    if (s.status === 'completed') b.done.push(s);
    else if (s.status === 'scheduled') b.scheduled++;
    acc.set(s.mentorId, b);
  }
  const rows = [...acc.entries()]
    .map(([id, b]) => {
      const m = emp.get(id);
      const fb = b.done.map((s) => s.feedback).filter((x): x is NonNullable<MentoringSession['feedback']> => !!x);
      const avg = fb.length ? fb.reduce((a, x) => a + x.rating, 0) / fb.length : null;
      const pos = fb.filter((x) => x.sentiment === 'positive').length;
      return {
        mentor: m?.name ?? id,
        designation: m?.designation ?? '',
        function: fns.get(m?.functionId ?? '')?.name ?? '',
        unit: units.get(m?.unitId ?? '')?.name ?? '',
        mentees: b.mentees.size,
        completed: b.done.length,
        scheduled: b.scheduled,
        // SPEC rule 15: hours invested = completed sessions × 60 min
        hours: b.done.length,
        rating: round(avg, 1),
        positive: pos,
        neutral: fb.filter((x) => x.sentiment === 'neutral').length,
        negative: fb.filter((x) => x.sentiment === 'negative').length,
        positiveShare: fb.length ? pct(pos / fb.length, 0) : null,
      };
    })
    .sort((a, b) => b.completed - a.completed || (b.rating ?? 0) - (a.rating ?? 0) || String(a.mentor).localeCompare(String(b.mentor)));
  return {
    columns: [
      { key: 'mentor', header: 'Mentor' },
      { key: 'designation', header: 'Designation' },
      { key: 'function', header: 'Function' },
      { key: 'unit', header: 'Unit' },
      { key: 'mentees', header: 'Mentees', kind: 'number' },
      { key: 'completed', header: 'Sessions completed', kind: 'number' },
      { key: 'scheduled', header: 'Scheduled', kind: 'number' },
      { key: 'hours', header: 'Hours invested', kind: 'number' },
      { key: 'rating', header: 'Avg rating (1–5)', kind: 'number' },
      { key: 'positive', header: 'Positive', kind: 'number' },
      { key: 'neutral', header: 'Neutral', kind: 'number' },
      { key: 'negative', header: 'Negative', kind: 'number' },
      { key: 'positiveShare', header: 'Positive %', kind: 'percent' },
    ],
    rows,
  };
}

// ───────────────────────── 8 · mentoring pairs & progress ─────────────────────────

function buildPairs(db: DemoDatabase, f: ReportFilters): ReportTable {
  const emp = employeeMap(db);
  const fns = functionMap(db);
  const units = unitMap(db);
  const inScope = menteeInScope(db, f);
  const cohorts = new Map(db.cohorts.map((c) => [c.id, c.name]));
  const byMatch = new Map<ID, MentoringSession[]>();
  for (const s of db.mentoringSessions) byMatch.set(s.matchId, [...(byMatch.get(s.matchId) ?? []), s]);
  const now = new Date().toISOString();
  const rows = db.matches
    .filter((m) => ['accepted', 'active', 'completed'].includes(m.status) && inScope(m.menteeId) && (!f.cohortId || m.cohortId === f.cohortId))
    .map((m) => {
      const ss = (byMatch.get(m.id) ?? []).filter((s) => s.status !== 'cancelled');
      const done = ss.filter((s) => s.status === 'completed');
      const anchors = new Set(done.map((s) => s.anchor).filter((a) => a != null));
      const actions = ss.flatMap((s) => s.actions);
      const last = done.map((s) => s.start).sort().pop();
      const next = ss.filter((s) => s.status === 'scheduled' && s.start >= now).map((s) => s.start).sort()[0];
      const ratings = done.map((s) => s.feedback?.rating).filter((r): r is number => r != null);
      const mentee = emp.get(m.menteeId);
      const mentor = emp.get(m.mentorId);
      return {
        cohort: cohorts.get(m.cohortId) ?? m.cohortId,
        mentor: mentor?.name ?? m.mentorId,
        mentorFunction: fns.get(mentor?.functionId ?? '')?.name ?? '',
        mentee: mentee?.name ?? m.menteeId,
        menteeFunction: fns.get(mentee?.functionId ?? '')?.name ?? '',
        menteeUnit: units.get(mentee?.unitId ?? '')?.name ?? '',
        status: MATCH_STATUS_LABELS[m.status],
        since: m.activatedAt ? formatDate(m.activatedAt) : '',
        a1: anchors.has(1),
        a2: anchors.has(2),
        a3: anchors.has(3),
        completed: done.length,
        extra: done.filter((s) => s.anchor == null).length,
        last: last ? formatDate(last) : '',
        next: next ? formatDate(next) : '',
        actionsOpen: actions.filter((a) => !a.done).length,
        actionsDone: actions.filter((a) => a.done).length,
        rating: ratings.length ? round(ratings.reduce((a, b) => a + b, 0) / ratings.length, 1) : null,
      };
    })
    .sort((a, b) => String(a.cohort).localeCompare(String(b.cohort)) || String(a.mentor).localeCompare(String(b.mentor)) || String(a.mentee).localeCompare(String(b.mentee)));
  return {
    columns: [
      { key: 'cohort', header: 'Cohort' },
      { key: 'mentor', header: 'Mentor' },
      { key: 'mentorFunction', header: 'Mentor function' },
      { key: 'mentee', header: 'Mentee' },
      { key: 'menteeFunction', header: 'Mentee function' },
      { key: 'menteeUnit', header: 'Mentee unit' },
      { key: 'status', header: 'Status' },
      { key: 'since', header: 'Active since' },
      { key: 'a1', header: 'Conversation 1' },
      { key: 'a2', header: 'Conversation 2' },
      { key: 'a3', header: 'Conversation 3' },
      { key: 'completed', header: 'Conversations completed', kind: 'number' },
      { key: 'extra', header: 'Additional touchpoints', kind: 'number' },
      { key: 'last', header: 'Last conversation' },
      { key: 'next', header: 'Next scheduled' },
      { key: 'actionsOpen', header: 'Open actions', kind: 'number' },
      { key: 'actionsDone', header: 'Actions done', kind: 'number' },
      { key: 'rating', header: 'Avg rating (1–5)', kind: 'number' },
    ],
    rows,
  };
}

// ───────────────────────── registry ─────────────────────────

export const REPORTS: readonly ReportDef[] = [
  {
    id: 'completion',
    group: 'mph',
    title: 'Completion by unit & month',
    description: 'Pairs, status mix and completion rate for every unit, month by month — with an all-units total.',
    filters: ['period', 'unit', 'function'],
    build: buildCompletion,
    file: 'mph-completion-by-unit',
  },
  {
    id: 'sessions',
    group: 'mph',
    title: 'Session register',
    description: 'Every MyPeopleHour session with manager, employee, mode, status and reasons.',
    filters: ['period', 'unit', 'function'],
    note: 'Notes stay private to managers — the register only shows whether notes were captured.',
    build: buildSessions,
    file: 'mph-session-register',
  },
  {
    id: 'missed',
    group: 'mph',
    title: 'Missed sessions & reasons',
    description: 'Missed conversations with the emergency type, remark and whether they were rebooked within the month.',
    filters: ['period', 'unit', 'function'],
    build: buildMissed,
    file: 'mph-missed-sessions',
  },
  {
    id: 'discipline',
    group: 'mph',
    title: 'Manager discipline',
    description: 'Completion % and missed sessions per manager across the period, lowest discipline first.',
    filters: ['period', 'unit', 'function'],
    note: 'Unit and function filters apply to the direct reports.',
    build: buildDiscipline,
    file: 'mph-manager-discipline',
  },
  {
    id: 'pulse',
    group: 'surveys',
    title: 'Pulse results by quarter',
    description: 'Category averages, favourable %, eNPS and response rate for every quarterly pulse. Aggregated and anonymised.',
    filters: ['unit', 'function'],
    note: `Groups with fewer than ${MIN_GROUP} respondents are never reported.`,
    build: buildPulse,
    file: 'pulse-results-by-quarter',
  },
  {
    id: 'survey',
    group: 'surveys',
    title: 'Survey response export',
    description: 'Every submitted answer for one survey, one row per respondent — numbered, never named.',
    filters: ['survey', 'unit', 'function'],
    note: `Anonymised: respondent number and unit only. Needs at least ${MIN_GROUP} responses.`,
    build: buildSurvey,
    file: 'survey-responses',
  },
  {
    id: 'mentoring',
    group: 'mentoring',
    title: 'Mentoring summary by mentor',
    description: 'Sessions completed, hours invested, average rating and sentiment from mentee feedback, per mentor.',
    filters: ['period', 'cohort', 'unit', 'function'],
    note: 'Unit and function filters apply to the mentees. Conversation notes stay confidential.',
    build: buildMentoring,
    file: 'mentoring-summary',
  },
  {
    id: 'pairs',
    group: 'mentoring',
    title: 'Mentoring pairs & progress',
    description: 'Every mentor–mentee pair with anchor conversations done, touchpoints, actions and next session.',
    filters: ['cohort', 'unit', 'function'],
    note: 'Unit and function filters apply to the mentees.',
    build: buildPairs,
    file: 'mentoring-pairs-progress',
  },
];

export const REPORT_BY_ID = Object.fromEntries(REPORTS.map((r) => [r.id, r])) as Record<ReportId, ReportDef>;

export const REPORT_GROUPS: Record<ReportGroup, string> = { mph: 'MyPeopleHour', surveys: 'Surveys & pulse', mentoring: 'Mentoring' };

export const buildReport = (db: DemoDatabase, id: ReportId, f: ReportFilters): ReportTable => REPORT_BY_ID[id].build(db, f);

/** CSV text (no BOM) — used by tests and the download. */
export const reportCsv = (t: ReportTable): string =>
  toCsv(
    t.rows,
    t.columns.map((c) => ({ header: c.header, value: (r: ReportRow) => r[c.key] })),
  );

export function downloadReport(t: ReportTable, filename: string): void {
  downloadCsv(
    filename,
    t.rows,
    t.columns.map((c) => ({ header: c.header, value: (r: ReportRow) => r[c.key] })),
  );
}

/** "mph-completion-by-unit-durgapur-apr-sep-2026" style stem (date is added by csvFilename). */
export function reportFileStem(db: Pick<DemoDatabase, 'units'>, def: ReportDef, f: ReportFilters): string {
  const parts = [def.file];
  if (f.unitId) parts.push(unitMap(db).get(f.unitId)?.shortName ?? f.unitId);
  if (def.filters.includes('period') && f.months.length) {
    const a = f.months[0];
    const b = f.months[f.months.length - 1];
    parts.push(a === b ? a : `${a}_to_${b}`);
  }
  return parts.join('-').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

// ───────────────────────── executive summary (print view) ─────────────────────────

export interface ExecutiveSummary {
  month: MonthKey;
  months: MonthKey[];
  mph: {
    summary: CompletionSummary;
    prev: CompletionSummary | null;
    trend: { month: MonthKey; label: string; rate: number; completed: number; total: number }[];
    byUnit: CompletionGroup[];
    reasons: { business: number; personal: number; total: number };
    flaggedPairs: number;
    repeatManagers: number;
    avgRating: number | null;
    ratedSessions: number;
  };
  pulse: {
    period: string;
    prevPeriod: string | null;
    live: boolean;
    index: number | null;
    prevIndex: number | null;
    enps: number | null;
    prevEnps: number | null;
    responseRate: number | null;
    respondents: number;
    categories: { category: PulseCategory; avg: number | null; prev: number | null }[];
    indexGap: number | null;
  } | null;
  mentoring: {
    activePairs: number;
    completedInMonth: number;
    completedTotal: number;
    hoursInMonth: number;
    feedback: number;
    positiveShare: number | null;
    avgRating: number | null;
    mentorOfMonth: { name: string; sessions: number; rating: number | null } | null;
  };
}

/** Everything the one-page executive summary shows, for one month and unit scope (mentoring: mentee's unit). */
export function executiveSummary(db: DemoDatabase, month: MonthKey, unitId: ID | null): ExecutiveSummary {
  const f = { unitId };
  const all = programmeMonths(db);
  const months = all.filter((m) => m <= month).slice(-6);
  const prevMonth = all[all.indexOf(month) - 1];
  const reasons = missedReasonSplit(db, [month], f);
  const flags = missedFlags(db, month, f);
  const emp = employeeMap(db);
  const rated = db.sessions.filter((s) => {
    const e = emp.get(s.employeeId);
    return s.month === month && s.status === 'completed' && s.employeeRating != null && !!e && matchesFilters(e, f);
  });

  // pulse — latest quarter with enough responses, compared with the previous one
  const trend = pulseTrend(db, f).filter((p) => !p.suppressed);
  const cur = trend[trend.length - 1];
  const prv = trend[trend.length - 2];
  const impact = cur ? disciplineImpact(db, cur.survey.id, f) : null;

  // mentoring (scoped by the mentee's unit)
  const inScope = (menteeId: ID) => !unitId || emp.get(menteeId)?.unitId === unitId;
  const done = db.mentoringSessions.filter((s) => s.status === 'completed' && inScope(s.menteeId));
  const doneInMonth = done.filter((s) => monthKey(s.start) === month);
  const fb = done.map((s) => s.feedback).filter((x): x is NonNullable<MentoringSession['feedback']> => !!x);
  const byMentor = new Map<ID, MentoringSession[]>();
  for (const s of doneInMonth) byMentor.set(s.mentorId, [...(byMentor.get(s.mentorId) ?? []), s]);
  const avgOf = (ss: MentoringSession[]) => {
    const r = ss.map((s) => s.feedback?.rating).filter((x): x is number => x != null);
    return r.length ? r.reduce((a, b) => a + b, 0) / r.length : null;
  };
  // SPEC rule 14: most completed sessions in the month, tie-break by average mentee rating
  const best = [...byMentor.entries()].sort((a, b) => b[1].length - a[1].length || (avgOf(b[1]) ?? 0) - (avgOf(a[1]) ?? 0))[0];

  return {
    month,
    months,
    mph: {
      summary: completionSummary(db, month, f),
      prev: prevMonth ? completionSummary(db, prevMonth, f) : null,
      trend: monthlyTrend(db, months, f).map((t) => ({ month: t.month, label: t.label, rate: t.completionRate, completed: t.completed, total: t.total })),
      byUnit: completionByUnit(db, month, f),
      reasons: { business: reasons.business_emergency, personal: reasons.personal_emergency, total: reasons.total },
      flaggedPairs: flags.pairs.length,
      repeatManagers: flags.managers.length,
      avgRating: rated.length ? rated.reduce((a, s) => a + (s.employeeRating ?? 0), 0) / rated.length : null,
      ratedSessions: rated.length,
    },
    pulse: cur
      ? {
          period: cur.period,
          prevPeriod: prv?.period ?? null,
          live: cur.live,
          index: cur.index,
          prevIndex: prv?.index ?? null,
          enps: cur.enps?.score ?? null,
          prevEnps: prv?.enps?.score ?? null,
          responseRate: cur.responseRate,
          respondents: cur.respondents,
          categories: PULSE_CATEGORIES.map((c) => ({ category: c, avg: cur.categories[c]?.avg ?? null, prev: prv?.categories[c]?.avg ?? null })),
          indexGap: impact?.indexGap ?? null,
        }
      : null,
    mentoring: {
      activePairs: db.matches.filter((m) => m.status === 'active' && inScope(m.menteeId)).length,
      completedInMonth: doneInMonth.length,
      completedTotal: done.length,
      hoursInMonth: doneInMonth.length,
      feedback: fb.length,
      positiveShare: fb.length ? fb.filter((x) => x.sentiment === 'positive').length / fb.length : null,
      avgRating: fb.length ? fb.reduce((a, x) => a + x.rating, 0) / fb.length : null,
      mentorOfMonth: best ? { name: emp.get(best[0])?.name ?? best[0], sessions: best[1].length, rating: avgOf(best[1]) } : null,
    },
  };
}
