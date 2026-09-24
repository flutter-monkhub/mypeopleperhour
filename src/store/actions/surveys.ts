// Survey administration (SurveysPage, SurveyBuilderPage, SurveyResponsesPage) — SPEC A23–A27.
//
// Lifecycle: draft ⇄ published → closed.
//   • publish   — validated (title, ≥1 question, choice options, future due date); notifies the audience.
//   • unpublish — back to draft, only while nobody has started answering (any response, draft or submitted).
//   • close     — stops accepting responses; results stay available.
//   • questions are locked once a survey has responses — only description and due date may change.
//
// Plain data functions (no React, no toasts). Pages validate with `surveyIssues()` and show feedback.

import type { AppNotification, ID, QuestionType, Survey, SurveyKind, SurveyQuestion } from '@shared/types';
import { addDays, fiscalQuarter } from '@shared/utils/dates';
import { uid } from '@shared/utils/random';
import { currentActorId } from '../auth';
import { getDb, insert, patch, remove } from '../db';

// ───────────────────────── questions (pure helpers for the builder) ─────────────────────────

export const SURVEY_CHOICE_TYPES: readonly QuestionType[] = ['single_choice', 'multi_choice'];
export const isChoiceQuestion = (t: QuestionType) => SURVEY_CHOICE_TYPES.includes(t);

/** A fresh question of the given type with sensible defaults. */
export function newSurveyQuestion(type: QuestionType): SurveyQuestion {
  const q: SurveyQuestion = { id: uid('Q'), type, text: '', required: true };
  if (type === 'single_choice') q.options = ['Option 1', 'Option 2', 'Option 3'];
  if (type === 'multi_choice') q.options = ['Option 1', 'Option 2', 'Option 3', 'Option 4'];
  if (type === 'text') q.required = false;
  return q;
}

/** Change a question's type, keeping text/help/category and converting options where it makes sense. */
export function changeSurveyQuestionType(q: SurveyQuestion, type: QuestionType): SurveyQuestion {
  if (q.type === type) return q;
  const next: SurveyQuestion = { ...q, type };
  if (isChoiceQuestion(type)) {
    next.options = q.options?.length ? [...q.options] : newSurveyQuestion(type).options;
  } else {
    delete next.options;
  }
  if (type !== 'multi_choice') delete next.maxSelections;
  return next;
}

/** Copy of a question with a new id (options copied). */
export const duplicateSurveyQuestion = (q: SurveyQuestion): SurveyQuestion => ({ ...q, id: uid('Q'), options: q.options ? [...q.options] : undefined });

/** Move the item at `from` by `delta` (−1 up, +1 down). Returns a new array (unchanged when out of range). */
export function reorderSurveyItem<T>(list: readonly T[], from: number, delta: number): T[] {
  const to = from + delta;
  if (from < 0 || from >= list.length || to < 0 || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// ───────────────────────── validation ─────────────────────────

export interface SurveyIssue {
  /** 'title' | 'questions' | 'dueDate' | 'audience' | question id */
  field: string;
  message: string;
}

export type SurveyFields = Pick<Survey, 'title' | 'description' | 'kind' | 'period' | 'dueDate' | 'audienceUnitIds' | 'anonymous' | 'questions'>;

/** Problems that block publishing (empty = ready). `now` is injectable for tests. */
export function surveyIssues(s: SurveyFields, opts: { now?: Date; specificAudience?: boolean } = {}): SurveyIssue[] {
  const now = opts.now ?? new Date();
  const out: SurveyIssue[] = [];
  if (!s.title.trim()) out.push({ field: 'title', message: 'Give the survey a title' });
  if (opts.specificAudience && s.audienceUnitIds.length === 0) out.push({ field: 'audience', message: 'Choose at least one unit for the audience' });
  if (!s.dueDate || Number.isNaN(new Date(s.dueDate).getTime())) out.push({ field: 'dueDate', message: 'Set a due date' });
  else if (new Date(s.dueDate).getTime() <= now.getTime()) out.push({ field: 'dueDate', message: 'The due date must be in the future' });
  if (s.questions.length === 0) out.push({ field: 'questions', message: 'Add at least one question' });
  s.questions.forEach((q, i) => {
    const n = `Question ${i + 1}`;
    if (!q.text.trim()) out.push({ field: q.id, message: `${n} needs question text` });
    if (isChoiceQuestion(q.type)) {
      const opts2 = (q.options ?? []).map((o) => o.trim()).filter(Boolean);
      if (opts2.length < 2) out.push({ field: q.id, message: `${n} needs at least two options` });
      else if (new Set(opts2.map((o) => o.toLowerCase())).size !== opts2.length) out.push({ field: q.id, message: `${n} has duplicate options` });
      if ((q.options ?? []).some((o) => !o.trim())) out.push({ field: q.id, message: `${n} has an empty option` });
      if (q.type === 'multi_choice' && q.maxSelections != null && q.maxSelections > opts2.length)
        out.push({ field: q.id, message: `${n} allows more selections than it has options` });
    }
  });
  return out;
}

// ───────────────────────── queries ─────────────────────────

/** All responses (draft + submitted) of a survey. */
export const surveyResponseCount = (surveyId: ID) => getDb().responses.filter((r) => r.surveyId === surveyId).length;

/** Questions are locked once anyone has started answering. */
export const surveyQuestionsLocked = (surveyId: ID) => surveyResponseCount(surveyId) > 0;

/** Default period label for new surveys: the current Indian FY quarter, e.g. "Q2 FY27". */
export const currentSurveyPeriod = (now: Date = new Date()) => fiscalQuarter(now).label;

/** End of the given local day as ISO (due dates are inclusive of the whole day). */
export function surveyDueIso(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59).toISOString();
}

// ───────────────────────── mutations ─────────────────────────

export type SurveyInput = Partial<SurveyFields>;

/** Create a draft survey. Missing fields get defaults (current quarter, due in 14 days, everyone, anonymous). */
export function createSurvey(input: SurveyInput = {}): Survey {
  const now = new Date();
  const survey: Survey = {
    id: uid('SV'),
    title: input.title?.trim() ?? '',
    description: input.description?.trim() ?? '',
    kind: input.kind ?? 'adhoc',
    period: input.period?.trim() || currentSurveyPeriod(now),
    status: 'draft',
    audienceUnitIds: input.audienceUnitIds ?? [],
    anonymous: input.anonymous ?? true,
    createdBy: currentActorId(),
    createdAt: now.toISOString(),
    dueDate: input.dueDate ?? surveyDueIso(addDays(now, 14)),
    questions: input.questions ?? [],
  };
  insert('surveys', survey, { prepend: true });
  return survey;
}

/**
 * Update survey fields. When the survey already has responses only `description` and `dueDate`
 * are applied (questions, title, audience… are locked) — returns the list of ignored fields.
 */
export function updateSurvey(id: ID, change: SurveyInput): { ignored: string[] } {
  const locked = surveyQuestionsLocked(id);
  const survey = getDb().surveys.find((s) => s.id === id);
  if (!survey) throw new Error(`Unknown survey ${id}`);
  if (survey.status === 'closed') throw new Error('Closed surveys cannot be edited');
  const allowed = locked ? (['description', 'dueDate'] as const) : null;
  const ignored: string[] = [];
  const next: Partial<Survey> = {};
  for (const [k, v] of Object.entries(change) as [keyof SurveyFields, unknown][]) {
    if (allowed && !(allowed as readonly string[]).includes(k)) {
      if (JSON.stringify(v) !== JSON.stringify(survey[k])) ignored.push(k);
      continue;
    }
    (next as Record<string, unknown>)[k] = typeof v === 'string' && k !== 'dueDate' ? v.trim() : v;
  }
  patch('surveys', id, next);
  return { ignored };
}

/** Employees a survey is sent to (active; audience units; mentoring surveys → active mentees). */
export function surveyAudienceIds(survey: Pick<Survey, 'kind' | 'audienceUnitIds'>): ID[] {
  const db = getDb();
  const units = new Set(survey.audienceUnitIds);
  let people = db.employees.filter((e) => e.status === 'active' && (units.size === 0 || units.has(e.unitId)));
  if (survey.kind === 'mentoring') {
    const mentees = new Set(db.matches.filter((m) => m.status === 'active').map((m) => m.menteeId));
    people = people.filter((e) => mentees.has(e.id));
  }
  return people.map((e) => e.id);
}

/**
 * Publish a draft (validated). Sends an in-app notification to everyone in the audience who hasn't
 * been told about this survey yet. Returns the number of people notified.
 */
export function publishSurvey(id: ID): { notified: number } {
  const db = getDb();
  const survey = db.surveys.find((s) => s.id === id);
  if (!survey) throw new Error(`Unknown survey ${id}`);
  if (survey.status !== 'draft') throw new Error('Only drafts can be published');
  const issues = surveyIssues(survey);
  if (issues.length) throw new Error(issues[0].message);
  const now = new Date().toISOString();
  patch('surveys', id, (s) => {
    const next: Survey = { ...s, status: 'published', publishedAt: now };
    delete next.closedAt;
    return next;
  });

  const link = `/surveys/${id}`;
  const told = new Set(db.notifications.filter((n) => n.kind === 'survey_published' && n.link === link).map((n) => n.recipientId));
  const due = new Date(survey.dueDate);
  const dueLabel = due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const notes: AppNotification[] = surveyAudienceIds(survey)
    .filter((eid) => !told.has(eid))
    .map((recipientId) => ({
      id: uid('NT'),
      recipientId,
      kind: 'survey_published',
      title: `${survey.title} is live`,
      body: `${survey.anonymous ? 'Your responses are confidential. ' : ''}Please respond by ${dueLabel}.`,
      createdAt: now,
      read: false,
      link,
    }));
  if (notes.length) insert('notifications', notes, { prepend: true });
  return { notified: notes.length };
}

/** Back to draft — only while nobody has responded (otherwise close it). */
export function unpublishSurvey(id: ID): void {
  const survey = getDb().surveys.find((s) => s.id === id);
  if (!survey) throw new Error(`Unknown survey ${id}`);
  if (survey.status !== 'published') throw new Error('Only live surveys can be unpublished');
  if (surveyQuestionsLocked(id)) throw new Error('This survey already has responses — close it instead');
  patch('surveys', id, (s) => {
    const next: Survey = { ...s, status: 'draft' };
    delete next.publishedAt;
    return next;
  });
}

/** Stop accepting responses. In-progress drafts are kept but never counted as submitted. */
export function closeSurvey(id: ID): void {
  const survey = getDb().surveys.find((s) => s.id === id);
  if (!survey) throw new Error(`Unknown survey ${id}`);
  if (survey.status !== 'published') throw new Error('Only live surveys can be closed');
  patch('surveys', id, { status: 'closed', closedAt: new Date().toISOString() });
}

/** Copy any survey into a new draft (new question ids, current quarter, due in 14 days). */
export function duplicateSurvey(id: ID): Survey {
  const src = getDb().surveys.find((s) => s.id === id);
  if (!src) throw new Error(`Unknown survey ${id}`);
  const base = src.title.replace(/\s*\(copy( \d+)?\)$/, '');
  const taken = new Set(getDb().surveys.map((s) => s.title));
  let title = `${base} (copy)`;
  for (let n = 2; taken.has(title); n++) title = `${base} (copy ${n})`;
  return createSurvey({
    title,
    description: src.description,
    kind: src.kind,
    period: currentSurveyPeriod(),
    audienceUnitIds: [...src.audienceUnitIds],
    anonymous: src.anonymous,
    questions: src.questions.map(duplicateSurveyQuestion),
  });
}

/** Delete a draft (and any stray responses). Published/closed surveys are kept for the record. */
export function deleteSurvey(id: ID): void {
  const survey = getDb().surveys.find((s) => s.id === id);
  if (!survey) return;
  if (survey.status !== 'draft') throw new Error('Only drafts can be deleted');
  remove('responses', (r) => r.surveyId === id);
  remove('surveys', id);
}

/** Replace the question list of an editable survey. */
export function setSurveyQuestions(id: ID, questions: SurveyQuestion[]): void {
  if (surveyQuestionsLocked(id)) throw new Error('Questions are locked once responses exist');
  patch('surveys', id, { questions });
}

export const SURVEY_KINDS: readonly SurveyKind[] = ['pulse', 'mentoring', 'adhoc'];
