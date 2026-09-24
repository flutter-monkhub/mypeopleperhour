// Survey & quarterly pulse analytics — pure functions over DemoDatabase (SPEC A27, A28).
//
// • Scale questions (emoji / rating / likert) are 1–5; "favourable" = 4 or 5.
// • eNPS = % promoters (9–10) − % detractors (0–6) of an NPS question.
// • Anonymity: any aggregate over fewer than MIN_GROUP respondents is suppressed (null + `suppressed`),
//   so a unit / function breakdown can never single a person out.
// • Filters apply to the respondent (response.unitId / response.functionId, i.e. at the time of answering).
// • Results are memoised per (db.responses, db.surveys, …) reference + arguments via memoOn.

import type { AnswerValue, DemoDatabase, ID, MonthKey, PulseCategory, QuestionType, Survey, SurveyQuestion, SurveyResponse } from '@shared/types';
import { monthKey } from '@shared/utils/dates';
import { pairMonthStatuses, programmeMonths } from './analytics';
import { employeeMap } from './lookup';
import { memoOn } from './memo';

/** Smallest group we report on for anonymous data. */
export const MIN_GROUP = 5;

/** The five pulse categories tracked quarter on quarter (Programme items are reported per question). */
export const PULSE_CATEGORIES: readonly PulseCategory[] = ['Engagement', 'Manager Support', 'Growth', 'Wellbeing', 'Recognition'];
export const ALL_CATEGORIES: readonly PulseCategory[] = [...PULSE_CATEGORIES, 'Programme'];

export const SCALE_TYPES: readonly QuestionType[] = ['emoji', 'rating', 'likert'];
export const isScaleType = (t: QuestionType): t is 'emoji' | 'rating' | 'likert' => SCALE_TYPES.includes(t);

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  emoji: 'Emoji scale',
  rating: 'Star rating',
  likert: 'Agreement scale',
  nps: 'NPS (0–10)',
  single_choice: 'Single choice',
  multi_choice: 'Multiple choice',
  yes_no: 'Yes / No',
  text: 'Free text',
};

export const SCALE_LABELS: Record<'emoji' | 'rating' | 'likert', readonly string[]> = {
  emoji: ['Very unhappy', 'Unhappy', 'Okay', 'Happy', 'Very happy'],
  rating: ['1 star', '2 stars', '3 stars', '4 stars', '5 stars'],
  likert: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'],
};
export const EMOJI_FACES = ['😞', '🙁', '😐', '🙂', '😄'] as const;

/** Diverging scale colours (negative red arm · grey neutral · positive blue arm) for 1–5 distributions & NPS. */
export const SCALE_COLORS = ['#C9372C', '#EE9A92', '#CBD2DD', '#8FA5F3', '#2F56E8'] as const;
export const NPS_COLORS = { detractors: '#C9372C', passives: '#CBD2DD', promoters: '#2F56E8' } as const;

export interface ResponseFilters {
  unitId?: ID | null;
  functionId?: ID | null;
}

const fKey = (f: ResponseFilters = {}) => `${f.unitId ?? ''}|${f.functionId ?? ''}`;
const matches = (r: SurveyResponse, f: ResponseFilters) => (!f.unitId || r.unitId === f.unitId) && (!f.functionId || r.functionId === f.functionId);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

// ───────────────────────── responses & audience ─────────────────────────

/** Responses grouped by survey id (cached per responses array). */
function responsesBySurvey(responses: SurveyResponse[]): Map<ID, SurveyResponse[]> {
  return memoOn([responses], 'bySurvey', () => {
    const m = new Map<ID, SurveyResponse[]>();
    for (const r of responses) {
      const list = m.get(r.surveyId);
      if (list) list.push(r);
      else m.set(r.surveyId, [r]);
    }
    return m;
  });
}

/** Responses of a survey (submitted only unless `status` says otherwise), filtered. */
export function surveyResponses(db: Pick<DemoDatabase, 'responses'>, surveyId: ID, f: ResponseFilters = {}, status: 'submitted' | 'draft' | 'all' = 'submitted'): SurveyResponse[] {
  return memoOn([db.responses], `sr|${surveyId}|${fKey(f)}|${status}`, () =>
    (responsesBySurvey(db.responses).get(surveyId) ?? []).filter((r) => (status === 'all' || r.status === status) && matches(r, f)),
  );
}

/** People a survey is addressed to (active employees in the audience units; mentoring → active mentees), filtered. */
export function surveyAudience(db: Pick<DemoDatabase, 'employees' | 'matches'>, survey: Pick<Survey, 'id' | 'kind' | 'audienceUnitIds'>, f: ResponseFilters = {}): ID[] {
  return memoOn([db.employees, db.matches], `aud|${survey.kind}|${survey.audienceUnitIds.join(',')}|${fKey(f)}`, () => {
    const units = new Set(survey.audienceUnitIds);
    const mentees = survey.kind === 'mentoring' ? new Set(db.matches.filter((m) => m.status === 'active').map((m) => m.menteeId)) : null;
    return db.employees
      .filter(
        (e) =>
          e.status === 'active' &&
          (units.size === 0 || units.has(e.unitId)) &&
          (!f.unitId || e.unitId === f.unitId) &&
          (!f.functionId || e.functionId === f.functionId) &&
          (!mentees || mentees.has(e.id)),
      )
      .map((e) => e.id);
  });
}

export interface SurveyStats {
  submitted: number;
  /** started but not submitted */
  drafts: number;
  audience: number;
  /** submitted / audience (null when nobody is in the audience) */
  responseRate: number | null;
  /** mean minutes from start to submit */
  avgMinutes: number | null;
  lastSubmittedAt: string | null;
}

export function surveyStats(db: DemoDatabase, survey: Survey, f: ResponseFilters = {}): SurveyStats {
  return memoOn([db.responses, db.employees, db.matches, db.surveys], `stats|${survey.id}|${fKey(f)}`, () => {
    const all = surveyResponses(db, survey.id, f, 'all');
    const submitted = all.filter((r) => r.status === 'submitted');
    const audience = surveyAudience(db, survey, f).length;
    const mins = submitted.filter((r) => r.submittedAt).map((r) => (new Date(r.submittedAt!).getTime() - new Date(r.startedAt).getTime()) / 60000).filter((m) => m > 0 && m < 240);
    const last = submitted.reduce<string | null>((m, r) => (r.submittedAt && (!m || r.submittedAt > m) ? r.submittedAt : m), null);
    return {
      submitted: submitted.length,
      drafts: all.length - submitted.length,
      audience,
      responseRate: audience ? Math.min(1, submitted.length / audience) : null,
      avgMinutes: mean(mins),
      lastSubmittedAt: last,
    };
  });
}

// ───────────────────────── per-question aggregates ─────────────────────────

const answered = (v: AnswerValue | undefined) => v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0);

export type QuestionAggregate =
  | { kind: 'scale'; type: 'emoji' | 'rating' | 'likert'; n: number; skipped: number; counts: number[]; avg: number | null; favourable: number | null; unfavourable: number | null }
  | { kind: 'nps'; n: number; skipped: number; counts: number[]; promoters: number; passives: number; detractors: number; score: number | null }
  | { kind: 'choice'; multi: boolean; n: number; skipped: number; options: { label: string; count: number; share: number }[]; avgSelections: number | null }
  | { kind: 'yes_no'; n: number; skipped: number; yes: number; no: number; yesShare: number | null }
  | { kind: 'text'; n: number; skipped: number; answers: { responseId: ID; text: string; unitId: ID; functionId: ID; at: string | undefined }[] };

export interface NpsSummary {
  n: number;
  promoters: number;
  passives: number;
  detractors: number;
  /** −100 … +100 */
  score: number | null;
}

export function npsOf(values: number[]): NpsSummary {
  const n = values.length;
  const promoters = values.filter((v) => v >= 9).length;
  const detractors = values.filter((v) => v <= 6).length;
  return { n, promoters, detractors, passives: n - promoters - detractors, score: n ? Math.round(((promoters - detractors) / n) * 100) : null };
}

/** Aggregate one question over a set of responses. */
export function aggregateQuestion(q: SurveyQuestion, responses: readonly SurveyResponse[]): QuestionAggregate {
  const vals = responses.map((r) => r.answers[q.id]).filter(answered) as AnswerValue[];
  const n = vals.length;
  const skipped = responses.length - n;
  if (isScaleType(q.type)) {
    const nums = vals.map(Number).filter((v) => v >= 1 && v <= 5);
    const counts = [1, 2, 3, 4, 5].map((k) => nums.filter((v) => Math.round(v) === k).length);
    return {
      kind: 'scale',
      type: q.type,
      n,
      skipped,
      counts,
      avg: mean(nums),
      favourable: nums.length ? (counts[3] + counts[4]) / nums.length : null,
      unfavourable: nums.length ? (counts[0] + counts[1]) / nums.length : null,
    };
  }
  if (q.type === 'nps') {
    const nums = vals.map(Number).filter((v) => v >= 0 && v <= 10);
    const s = npsOf(nums);
    return { kind: 'nps', n, skipped, counts: Array.from({ length: 11 }, (_, k) => nums.filter((v) => v === k).length), promoters: s.promoters, passives: s.passives, detractors: s.detractors, score: s.score };
  }
  if (q.type === 'single_choice' || q.type === 'multi_choice') {
    const multi = q.type === 'multi_choice';
    const counts = new Map<string, number>((q.options ?? []).map((o) => [o, 0]));
    let selections = 0;
    for (const v of vals) {
      const picks = Array.isArray(v) ? v : [String(v)];
      selections += picks.length;
      for (const p of picks) counts.set(p, (counts.get(p) ?? 0) + 1);
    }
    return {
      kind: 'choice',
      multi,
      n,
      skipped,
      options: [...counts.entries()].map(([label, count]) => ({ label, count, share: n ? count / n : 0 })),
      avgSelections: multi && n ? selections / n : null,
    };
  }
  if (q.type === 'yes_no') {
    const yes = vals.filter((v) => v === true || v === 'yes' || v === 'Yes').length;
    return { kind: 'yes_no', n, skipped, yes, no: n - yes, yesShare: n ? yes / n : null };
  }
  const answers = responses
    .filter((r) => answered(r.answers[q.id]))
    .map((r) => ({ responseId: r.id, text: String(r.answers[q.id]), unitId: r.unitId, functionId: r.functionId, at: r.submittedAt ?? r.startedAt }))
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  return { kind: 'text', n, skipped, answers };
}

/** Human-readable answer (tables, drawers, CSV). */
export function formatAnswer(q: SurveyQuestion, v: AnswerValue | undefined): string {
  if (!answered(v)) return '';
  if (isScaleType(q.type)) {
    const k = Number(v);
    return q.type === 'rating' ? `${k}/5` : `${k} – ${SCALE_LABELS[q.type][k - 1] ?? ''}`;
  }
  if (q.type === 'yes_no') return v === true || v === 'yes' || v === 'Yes' ? 'Yes' : 'No';
  if (Array.isArray(v)) return v.join('; ');
  return String(v);
}

// ───────────────────────── quarterly pulse ─────────────────────────

/** Published/closed pulse surveys, oldest quarter first. */
export function pulseSurveys(db: Pick<DemoDatabase, 'surveys'>): Survey[] {
  return memoOn([db.surveys], 'pulseSurveys', () =>
    db.surveys.filter((s) => s.kind === 'pulse' && s.status !== 'draft').sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
  );
}

/** First MyPeopleHour month (the launch). */
export const launchMonth = (db: Pick<DemoDatabase, 'sessions'>): MonthKey | null => programmeMonths(db)[0] ?? null;

/** A pulse that closed before MyPeopleHour launched is the baseline. */
export const isBaselineSurvey = (db: Pick<DemoDatabase, 'sessions'>, s: Pick<Survey, 'dueDate'>) => {
  const launch = launchMonth(db);
  return !!launch && monthKey(s.dueDate) < launch;
};

export interface CategoryScore {
  /** 1–5 */
  avg: number;
  /** share of favourable answers (4–5) */
  favourable: number;
  answers: number;
}

export interface PulsePoint {
  survey: Survey;
  period: string;
  baseline: boolean;
  live: boolean;
  respondents: number;
  audience: number;
  responseRate: number | null;
  /** fewer than MIN_GROUP respondents → scores hidden */
  suppressed: boolean;
  categories: Partial<Record<PulseCategory, CategoryScore>>;
  /** mean of the five category averages */
  index: number | null;
  enps: NpsSummary | null;
}

/** Category scores over a set of responses (answer-level mean of scale questions). */
export function categoryScores(survey: Survey, responses: readonly SurveyResponse[]): Partial<Record<PulseCategory, CategoryScore>> {
  const out: Partial<Record<PulseCategory, CategoryScore>> = {};
  for (const cat of ALL_CATEGORIES) {
    const qs = survey.questions.filter((q) => q.category === cat && isScaleType(q.type));
    if (!qs.length) continue;
    const vals: number[] = [];
    for (const r of responses) for (const q of qs) if (answered(r.answers[q.id])) vals.push(Number(r.answers[q.id]));
    if (!vals.length) continue;
    out[cat] = { avg: mean(vals)!, favourable: vals.filter((v) => v >= 4).length / vals.length, answers: vals.length };
  }
  return out;
}

const indexOf = (cats: Partial<Record<PulseCategory, CategoryScore>>) => mean(PULSE_CATEGORIES.map((c) => cats[c]?.avg).filter((v): v is number => v != null));

/** eNPS of a survey's first NPS question. */
export function surveyEnps(survey: Survey, responses: readonly SurveyResponse[]): NpsSummary | null {
  const q = survey.questions.find((x) => x.type === 'nps');
  if (!q) return null;
  return npsOf(responses.map((r) => r.answers[q.id]).filter(answered).map(Number));
}

/** One point per pulse survey (oldest first): categories, index, eNPS, response rate. */
export function pulseTrend(db: DemoDatabase, f: ResponseFilters = {}): PulsePoint[] {
  return memoOn([db.surveys, db.responses, db.employees, db.matches, db.sessions], `pulseTrend|${fKey(f)}`, () =>
    pulseSurveys(db).map((s) => {
      const rs = surveyResponses(db, s.id, f);
      const stats = surveyStats(db, s, f);
      const suppressed = rs.length < MIN_GROUP;
      const categories = suppressed ? {} : categoryScores(s, rs);
      return {
        survey: s,
        period: s.period,
        baseline: isBaselineSurvey(db, s),
        live: s.status === 'published',
        respondents: rs.length,
        audience: stats.audience,
        responseRate: stats.responseRate,
        suppressed,
        categories,
        index: suppressed ? null : indexOf(categories),
        enps: suppressed ? null : surveyEnps(s, rs),
      };
    }),
  );
}

export interface GroupScores {
  key: ID;
  label: string;
  shortLabel: string;
  respondents: number;
  suppressed: boolean;
  categories: Partial<Record<PulseCategory, CategoryScore>>;
  index: number | null;
  enps: number | null;
}

/** Category scores of one survey broken down by unit or function (heatmap rows). */
export function groupCategoryScores(db: DemoDatabase, surveyId: ID, by: 'unit' | 'function', f: ResponseFilters = {}): GroupScores[] {
  return memoOn([db.surveys, db.responses, db.units, db.functions], `groupScores|${surveyId}|${by}|${fKey(f)}`, () => {
    const survey = db.surveys.find((s) => s.id === surveyId);
    if (!survey) return [];
    const rs = surveyResponses(db, surveyId, f);
    const groups =
      by === 'unit' ? db.units.map((u) => ({ key: u.id, label: u.name, shortLabel: u.shortName })) : db.functions.map((x) => ({ key: x.id, label: x.name, shortLabel: x.name }));
    return groups
      .map((g) => {
        const mine = rs.filter((r) => (by === 'unit' ? r.unitId : r.functionId) === g.key);
        const suppressed = mine.length < MIN_GROUP;
        const categories = suppressed ? {} : categoryScores(survey, mine);
        return { ...g, respondents: mine.length, suppressed, categories, index: suppressed ? null : indexOf(categories), enps: suppressed ? null : (surveyEnps(survey, mine)?.score ?? null) };
      })
      .filter((g) => g.respondents > 0);
  });
}

// ───────────────────────── question-level trend ─────────────────────────

export interface QuestionTrendCell {
  /** numeric metric (scale avg, eNPS, % yes) or null */
  value: number | null;
  /** formatted for display */
  display: string;
}

export interface QuestionTrendRow {
  id: ID;
  text: string;
  type: QuestionType;
  category?: PulseCategory;
  /** 'avg' 1–5 · 'enps' −100…100 · 'pct' 0–100 · 'top' most chosen option · 'count' comments */
  metric: 'avg' | 'enps' | 'pct' | 'top' | 'count';
  cells: QuestionTrendCell[];
  /** latest − previous (numeric metrics only) */
  delta: number | null;
}

const metricFor = (t: QuestionType): QuestionTrendRow['metric'] =>
  isScaleType(t) ? 'avg' : t === 'nps' ? 'enps' : t === 'yes_no' ? 'pct' : t === 'text' ? 'count' : 'top';

function cellOf(q: SurveyQuestion, rs: readonly SurveyResponse[]): QuestionTrendCell {
  const a = aggregateQuestion(q, rs);
  switch (a.kind) {
    case 'scale':
      return { value: a.avg, display: a.avg == null ? '—' : a.avg.toFixed(2) };
    case 'nps':
      return { value: a.score, display: a.score == null ? '—' : `${a.score > 0 ? '+' : ''}${a.score}` };
    case 'yes_no':
      return { value: a.yesShare == null ? null : a.yesShare * 100, display: a.yesShare == null ? '—' : `${Math.round(a.yesShare * 100)}% yes` };
    case 'choice': {
      const top = [...a.options].sort((x, y) => y.count - x.count)[0];
      return { value: null, display: top && a.n ? `${top.label} · ${Math.round(top.share * 100)}%` : '—' };
    }
    case 'text':
      return { value: a.n, display: a.n ? `${a.n} comments` : '—' };
  }
}

/** Every question across the given surveys (by question id), with its metric per survey. */
export function questionTrend(db: DemoDatabase, surveys: readonly Survey[], f: ResponseFilters = {}): QuestionTrendRow[] {
  return memoOn([db.surveys, db.responses], `qTrend|${surveys.map((s) => s.id).join(',')}|${fKey(f)}`, () => {
    const order: SurveyQuestion[] = [];
    const seen = new Set<ID>();
    for (const s of [...surveys].reverse())
      for (const q of s.questions) {
        if (seen.has(q.id)) continue;
        seen.add(q.id);
        order.push(q);
      }
    return order.map((q) => {
      const metric = metricFor(q.type);
      const cells = surveys.map((s): QuestionTrendCell => {
        const sq = s.questions.find((x) => x.id === q.id);
        if (!sq || sq.type !== q.type) return { value: null, display: '—' };
        const rs = surveyResponses(db, s.id, f);
        if (rs.length < MIN_GROUP) return { value: null, display: `n < ${MIN_GROUP}` };
        return cellOf(sq, rs);
      });
      const nums = cells.map((c) => c.value);
      const last = nums[nums.length - 1];
      const prev = nums[nums.length - 2];
      const numeric = metric === 'avg' || metric === 'enps' || metric === 'pct';
      return { id: q.id, text: q.text, type: q.type, category: q.category, metric, cells, delta: numeric && last != null && prev != null ? last - prev : null };
    });
  });
}

// ───────────────────────── MyPeopleHour impact (discipline ↔ pulse) ─────────────────────────

export type DisciplineBand = 'high' | 'medium' | 'low';
export const DISCIPLINE_BANDS: readonly DisciplineBand[] = ['low', 'medium', 'high'];
export const DISCIPLINE_META: Record<DisciplineBand, { label: string; short: string; color: string }> = {
  high: { label: 'High discipline (≥ 90%)', short: 'High ≥ 90%', color: '#1E3FC4' },
  medium: { label: 'Medium (70–89%)', short: 'Medium', color: '#5577EC' },
  low: { label: 'Low discipline (< 70%)', short: 'Low < 70%', color: '#8FA5F3' },
};
export const bandOf = (rate: number): DisciplineBand => (rate >= 0.9 ? 'high' : rate < 0.7 ? 'low' : 'medium');

export interface ManagerDiscipline {
  managerId: ID;
  /** pair-months */
  total: number;
  completed: number;
  missed: number;
  rate: number;
  band: DisciplineBand;
}

/** Completion discipline per manager over the given months (completed pair-months / pair-months). */
export function managerDiscipline(db: DemoDatabase, months: readonly MonthKey[]): Map<ID, ManagerDiscipline> {
  return memoOn([db.sessions, db.employees], `mgrDiscipline|${months.join(',')}`, () => {
    const acc = new Map<ID, { total: number; completed: number; missed: number }>();
    for (const m of months)
      for (const p of pairMonthStatuses(db, m)) {
        const b = acc.get(p.managerId) ?? { total: 0, completed: 0, missed: 0 };
        b.total++;
        if (p.status === 'completed') b.completed++;
        if (p.status === 'missed') b.missed++;
        acc.set(p.managerId, b);
      }
    const out = new Map<ID, ManagerDiscipline>();
    for (const [managerId, b] of acc) out.set(managerId, { managerId, ...b, rate: b.total ? b.completed / b.total : 0, band: bandOf(b.total ? b.completed / b.total : 0) });
    return out;
  });
}

/** Closed MyPeopleHour months from launch up to the survey's quarter end (the current month is still in progress). */
export function disciplineWindow(db: DemoDatabase, survey: Pick<Survey, 'dueDate'>, now: Date = new Date()): MonthKey[] {
  const current = monthKey(now);
  const end = monthKey(survey.dueDate);
  return programmeMonths(db, now).filter((m) => m <= end && m < current);
}

export interface ImpactGroup {
  band: DisciplineBand;
  respondents: number;
  managers: number;
  suppressed: boolean;
  categories: Partial<Record<PulseCategory, CategoryScore>>;
  index: number | null;
  enps: number | null;
}

export interface DisciplineImpact {
  months: MonthKey[];
  groups: Record<DisciplineBand, ImpactGroup>;
  /** high − low pulse index (null when either is suppressed) */
  indexGap: number | null;
  enpsGap: number | null;
}

/** Pulse scores of respondents grouped by their manager's completion discipline. Null for a baseline / pre-launch pulse. */
export function disciplineImpact(db: DemoDatabase, surveyId: ID, f: ResponseFilters = {}, now: Date = new Date()): DisciplineImpact | null {
  return memoOn([db.surveys, db.responses, db.sessions, db.employees], `impact|${surveyId}|${fKey(f)}|${monthKey(now)}`, () => {
    const survey = db.surveys.find((s) => s.id === surveyId);
    if (!survey) return null;
    const months = disciplineWindow(db, survey, now);
    if (!months.length) return null;
    const disc = managerDiscipline(db, months);
    const emp = employeeMap(db);
    const buckets: Record<DisciplineBand, { rs: SurveyResponse[]; mgrs: Set<ID> }> = {
      high: { rs: [], mgrs: new Set() },
      medium: { rs: [], mgrs: new Set() },
      low: { rs: [], mgrs: new Set() },
    };
    for (const r of surveyResponses(db, surveyId, f)) {
      const mid = emp.get(r.employeeId)?.managerId;
      const d = mid ? disc.get(mid) : undefined;
      if (!d) continue;
      buckets[d.band].rs.push(r);
      buckets[d.band].mgrs.add(d.managerId);
    }
    const groups = {} as Record<DisciplineBand, ImpactGroup>;
    for (const band of DISCIPLINE_BANDS) {
      const { rs, mgrs } = buckets[band];
      const suppressed = rs.length < MIN_GROUP;
      const categories = suppressed ? {} : categoryScores(survey, rs);
      groups[band] = { band, respondents: rs.length, managers: mgrs.size, suppressed, categories, index: suppressed ? null : indexOf(categories), enps: suppressed ? null : (surveyEnps(survey, rs)?.score ?? null) };
    }
    const hi = groups.high;
    const lo = groups.low;
    return {
      months,
      groups,
      indexGap: hi.index != null && lo.index != null ? hi.index - lo.index : null,
      enpsGap: hi.enps != null && lo.enps != null ? hi.enps - lo.enps : null,
    };
  });
}

// ───────────────────────── comments & themes ─────────────────────────

export interface SurveyComment {
  id: string;
  text: string;
  unitId: ID;
  functionId: ID;
  at: string | undefined;
  surveyId: ID;
  period: string;
  question: string;
}

/** Free-text answers of the given surveys (newest first). */
export function surveyComments(db: DemoDatabase, surveys: readonly Survey[], f: ResponseFilters = {}): SurveyComment[] {
  return memoOn([db.surveys, db.responses], `comments|${surveys.map((s) => s.id).join(',')}|${fKey(f)}`, () => {
    const out: SurveyComment[] = [];
    for (const s of surveys) {
      const rs = surveyResponses(db, s.id, f);
      if (rs.length < MIN_GROUP) continue;
      for (const q of s.questions.filter((x) => x.type === 'text'))
        for (const r of rs) {
          const v = r.answers[q.id];
          if (typeof v === 'string' && v.trim()) out.push({ id: `${r.id}-${q.id}`, text: v.trim(), unitId: r.unitId, functionId: r.functionId, at: r.submittedAt, surveyId: s.id, period: s.period, question: q.text });
        }
    }
    return out.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  });
}

/** Keyword themes, checked in order — each comment counts once, under its first matching theme. */
export const COMMENT_THEMES: readonly { id: string; label: string; pattern: RegExp }[] = [
  { id: 'protect', label: 'Protect the hour & keep it consistent', pattern: /consisten|protect|moved|reschedul|cancel|every month|slot/i },
  { id: 'followup', label: 'Follow through on agreed actions', pattern: /follow|action|agree/i },
  { id: 'career', label: 'Career paths & growth opportunities', pattern: /career|growth|opportunit|promotion|path/i },
  { id: 'transparency', label: 'Context & transparency', pattern: /decision|transparen|communicat|context|share more|how .* made/i },
  { id: 'learning', label: 'Learning & development', pattern: /learn|budget|skill|training|course/i },
  { id: 'cadence', label: 'More frequent check-ins', pattern: /frequent|check-in|shorter|weekly|often/i },
  { id: 'setting', label: 'Setting & openness', pattern: /desk|open up|away from|quiet|space|private/i },
  { id: 'positive', label: 'Appreciation — it’s working', pattern: /thank|really works|personal|great|helpful|love/i },
];

export interface CommentTheme {
  id: string;
  label: string;
  count: number;
  share: number;
  examples: string[];
}

export function commentThemes(comments: readonly Pick<SurveyComment, 'text'>[]): CommentTheme[] {
  const acc = new Map<string, { count: number; examples: string[] }>();
  for (const c of comments) {
    const theme = COMMENT_THEMES.find((t) => t.pattern.test(c.text));
    const id = theme?.id ?? 'other';
    const b = acc.get(id) ?? { count: 0, examples: [] };
    b.count++;
    if (b.examples.length < 3 && !b.examples.includes(c.text)) b.examples.push(c.text);
    acc.set(id, b);
  }
  const total = comments.length;
  return [...COMMENT_THEMES, { id: 'other', label: 'Other', pattern: /$^/ }]
    .filter((t) => acc.has(t.id))
    .map((t) => ({ id: t.id, label: t.label, count: acc.get(t.id)!.count, share: total ? acc.get(t.id)!.count / total : 0, examples: acc.get(t.id)!.examples }))
    .sort((a, b) => (a.id === 'other' ? 1 : b.id === 'other' ? -1 : b.count - a.count));
}
