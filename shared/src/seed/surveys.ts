// Survey seed: quarterly pulse surveys (baseline before launch → current quarter),
// a draft mentoring check-in, and responses that correlate with manager discipline.

import type { AnswerValue, Employee, Survey, SurveyQuestion, SurveyResponse } from '../types';
import { addDays, fiscalQuarter, startOfDay } from '../utils/dates';
import { chance, createRng, int, pick, sample } from '../utils/random';
import { DEMO } from './org';

export const PULSE_QUESTIONS: SurveyQuestion[] = [
  { id: 'pq-mood', type: 'emoji', text: 'How are you feeling about your growth and support?', required: true, category: 'Wellbeing' },
  { id: 'pq-heard', type: 'likert', text: 'I feel heard and understood by my manager.', required: true, category: 'Manager Support' },
  { id: 'pq-meaningful', type: 'likert', text: 'My MyPeopleHour conversations this quarter were meaningful.', required: true, category: 'Manager Support' },
  { id: 'pq-growth', type: 'rating', text: 'How would you rate the support you receive for your career growth?', required: true, category: 'Growth' },
  { id: 'pq-clarity', type: 'likert', text: 'I am clear about what is expected of me.', required: true, category: 'Engagement' },
  { id: 'pq-recognition', type: 'likert', text: 'I receive recognition when I do good work.', required: true, category: 'Recognition' },
  {
    id: 'pq-feedback',
    type: 'single_choice',
    text: 'How often do you receive meaningful feedback?',
    required: true,
    options: ['Weekly', 'Monthly', 'Quarterly', 'Rarely'],
    category: 'Manager Support',
  },
  {
    id: 'pq-topics',
    type: 'multi_choice',
    text: 'Which topics would you like to discuss more in your MyPeopleHour?',
    helpText: 'Select up to three.',
    required: false,
    maxSelections: 3,
    options: ['Career growth', 'Skill development', 'Well-being', 'Workload', 'Recognition', 'Team dynamics'],
    category: 'Programme',
  },
  { id: 'pq-followup', type: 'yes_no', text: 'Were the actions agreed in your last conversation followed up?', required: true, category: 'Programme' },
  { id: 'pq-enps', type: 'nps', text: 'How likely are you to recommend PCBL as a great place to work?', required: true, category: 'Engagement' },
  { id: 'pq-comment', type: 'text', text: 'What one thing would make your conversations with your manager more valuable?', required: false, category: 'Programme' },
];

const MENTORING_QUESTIONS: SurveyQuestion[] = [
  { id: 'mq-value', type: 'rating', text: 'How valuable has your mentoring relationship been so far?', required: true, category: 'Programme' },
  { id: 'mq-anchor', type: 'single_choice', text: 'Which anchor conversation have you completed most recently?', required: true, options: ['Discover & Align', 'Challenge & Develop', 'Reflect & Accelerate'], category: 'Programme' },
  { id: 'mq-exposure', type: 'likert', text: 'The programme has given me exposure beyond my own function.', required: true, category: 'Growth' },
  { id: 'mq-ownership', type: 'yes_no', text: 'Have you scheduled and led every conversation yourself?', required: true, category: 'Programme' },
  { id: 'mq-improve', type: 'text', text: 'What would make the second half of the programme more valuable?', required: false, category: 'Programme' },
];

const COMMENTS = [
  'More focus on career paths across plants would help.',
  'Would love my manager to share more about how decisions are made.',
  'Consistency — when it happens every month it really works.',
  'Shorter, more frequent check-ins on top of the monthly hour.',
  'Following up on the actions we agree would make a big difference.',
  'Having the conversation away from my desk helps me open up.',
  'Please protect the slot — it got moved twice this quarter.',
  'I would like to discuss learning budgets more openly.',
  'It already feels much more personal than before. Thank you.',
  'Clearer visibility of growth opportunities in other functions.',
];

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function generateSurveys(employees: Employee[], discipline: Record<string, number>, now: Date): { surveys: Survey[]; responses: SurveyResponse[] } {
  const rng = createRng(20260710);
  const today = startOfDay(now);
  const cq = fiscalQuarter(today);
  const pq = fiscalQuarter(addDays(cq.start, -1));
  const quarters = [fiscalQuarter(addDays(pq.start, -1)), pq, cq];

  const surveys: Survey[] = quarters.map((q, i) => {
    const isCurrent = i === quarters.length - 1;
    const publishedAt = isCurrent ? new Date(Math.max(addDays(q.start, 3).getTime(), addDays(today, -9).getTime())) : addDays(q.end, -21);
    const s: Survey = {
      id: `SV-PULSE-${q.label.replace(/\s/g, '')}`,
      title: `Quarterly Pulse · ${q.label}`,
      description:
        i === 0
          ? 'Baseline pulse before MyPeopleHour launched. Your responses are confidential and reported only in aggregate.'
          : 'A quick check on how you are feeling and how supported you are. Takes about 3 minutes. Responses are confidential.',
      kind: 'pulse',
      period: q.label,
      status: isCurrent ? 'published' : 'closed',
      audienceUnitIds: [],
      anonymous: true,
      createdBy: DEMO.talentHead,
      createdAt: addDays(publishedAt, -5).toISOString(),
      publishedAt: publishedAt.toISOString(),
      dueDate: q.end.toISOString(),
      questions: PULSE_QUESTIONS.filter((qq) => i > 0 || (qq.id !== 'pq-meaningful' && qq.id !== 'pq-followup')),
    };
    if (!isCurrent) s.closedAt = q.end.toISOString();
    return s;
  });

  surveys.push({
    id: 'SV-MENTOR-MID',
    title: 'Mentoring Mid-Programme Check-in',
    description: 'For mentees in the current cohort — how is the relationship going so far?',
    kind: 'mentoring',
    period: cq.label,
    status: 'draft',
    audienceUnitIds: [],
    anonymous: false,
    createdBy: DEMO.talentHead,
    createdAt: addDays(today, -2).toISOString(),
    dueDate: addDays(today, 21).toISOString(),
    questions: MENTORING_QUESTIONS,
  });

  const responses: SurveyResponse[] = [];
  let seq = 1;
  const staff = employees.filter((e) => e.managerId && e.status === 'active');

  surveys.forEach((survey, qi) => {
    if (survey.kind !== 'pulse') return;
    const isCurrent = survey.status === 'published';
    const rate = isCurrent ? 0.56 : qi === 0 ? 0.71 : 0.78;
    const uplift = qi * 0.22;
    for (const e of staff) {
      // Demo personas who should still see the current pulse as pending
      if (isCurrent && (e.id === DEMO.employee || e.id === DEMO.manager || e.id === DEMO.mentee)) continue;
      const forceSubmit = !isCurrent && (e.id === DEMO.employee || e.id === DEMO.manager || e.id === DEMO.mentee);
      if (!forceSubmit && !chance(rng, rate)) continue;
      const d = discipline[e.managerId!] ?? 0.75;
      const base = 2.5 + (d - 0.4) * 3 + uplift; // ≈ 2.5 … 4.9
      const lik = () => clamp(Math.round(base + (rng() - 0.5) * 1.8), 1, 5);
      const answers: Record<string, AnswerValue> = {};
      for (const q of survey.questions) {
        switch (q.type) {
          case 'emoji':
          case 'likert':
          case 'rating':
            answers[q.id] = lik();
            break;
          case 'nps':
            answers[q.id] = clamp(Math.round(4.5 + (base - 2.5) * 2 + (rng() - 0.5) * 3.5), 0, 10);
            break;
          case 'single_choice': {
            const idx = clamp(Math.round(3.6 - (base - 2.5) * 1.1 + (rng() - 0.5) * 1.6), 0, 3);
            answers[q.id] = q.options![idx];
            break;
          }
          case 'multi_choice':
            answers[q.id] = sample(rng, q.options!, int(rng, 1, 3));
            break;
          case 'yes_no':
            answers[q.id] = rng() < 0.35 + (d - 0.4) * 0.9;
            break;
          case 'text':
            if (chance(rng, 0.28)) answers[q.id] = pick(rng, COMMENTS);
            break;
        }
      }
      const published = new Date(survey.publishedAt!);
      const due = new Date(survey.dueDate);
      const latest = Math.min(due.getTime(), now.getTime() - 3600000);
      const submitted = new Date(published.getTime() + rng() * Math.max(3600000, latest - published.getTime()));
      const draft = isCurrent && chance(rng, 0.06);
      responses.push({
        id: `R${String(seq++).padStart(5, '0')}`,
        surveyId: survey.id,
        employeeId: e.id,
        unitId: e.unitId,
        functionId: e.functionId,
        status: draft ? 'draft' : 'submitted',
        answers,
        startedAt: new Date(submitted.getTime() - int(rng, 2, 9) * 60000).toISOString(),
        submittedAt: draft ? undefined : submitted.toISOString(),
      });
    }
  });

  return { surveys, responses };
}
