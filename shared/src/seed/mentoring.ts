// Mentoring seed: two cohorts.
//  • Cohort 1 — active, ~3 months into the 6-month programme (matches, conversations, feedback)
//  • Cohort 2 — applications open now (submitted / under review / shortlisted / proposals to mentors)

import type {
  ActionItem,
  AnchorConversation,
  Employee,
  MenteeApplication,
  MentorMatch,
  MentorProfile,
  MentorStyle,
  MentoringCohort,
  MentoringSession,
  Sentiment,
} from '../types';
import { addDays, addMonthsToKey, monthKey, monthKeyToDate, startOfDay } from '../utils/dates';
import { chance, createRng, int, pick, sample, shuffle, weighted, type Rng } from '../utils/random';
import { DEMO } from './org';

const MENTOR_CODES = [
  'E00003', 'E00005', 'E00006', 'E00007', 'E00010', 'E00011', 'E00012', 'E00013', 'E00014', 'E00015', 'E00016', 'E00017',
  'E00018', 'E00020', 'E00021', 'E00022', 'E00023', 'E00024', 'E00025', 'E00026', 'E00027', 'E00028', 'E00029', 'E00030',
];

const EXPERTISE: Record<string, string[]> = {
  'F-MFG': ['Plant operations', 'Lean & Six Sigma', 'Safety leadership', 'Leading large teams', 'Capex projects'],
  'F-COM': ['Key account management', 'Negotiation', 'Global markets', 'Customer insight', 'Pricing strategy'],
  'F-FIN': ['Business finance', 'Capital allocation', 'Governance', 'Commercial acumen'],
  'F-HR': ['People leadership', 'Change management', 'Coaching', 'Organisation design'],
  'F-DIG': ['Digital transformation', 'Data-driven decisions', 'Technology strategy', 'Agile ways of working'],
  'F-RND': ['Innovation', 'Product development', 'Scientific leadership', 'IP & patents'],
  'F-SCM': ['Supply chain strategy', 'Vendor partnerships', 'Operational planning', 'Risk management'],
  'F-EXE': ['Enterprise leadership', 'Strategy'],
};

const BIO: Record<string, string> = {
  'F-MFG': 'Has led plants and turnarounds across the network. Believes the best leaders spend time on the shop floor.',
  'F-COM': 'Built customer relationships across domestic and global markets. Enjoys helping people think commercially.',
  'F-FIN': 'Brings a CFO’s lens to business decisions. Passionate about building commercial acumen outside finance.',
  'F-HR': 'Two decades in people leadership and change. Loves helping people navigate career crossroads.',
  'F-DIG': 'Leads digital and data transformation. Mentors on navigating ambiguity and influencing without authority.',
  'F-RND': 'Scientist-turned-leader who bridges the lab and the market. Enjoys stretching how people think about problems.',
  'F-SCM': 'Runs complex supply networks. Mentors on systems thinking, planning and cross-functional collaboration.',
  'F-EXE': 'Enterprise leader with a broad view across functions.',
};

const WHY = [
  'I admire how {m} has built a cross-functional career and I want to understand how those choices were made.',
  '{m} has deep experience in an area I know little about, and I want to broaden my view of the business.',
  'I have heard {m} speak at the leadership town hall — the clarity of thinking really stood out to me.',
  'I want a mentor who will challenge me, and {m} is known for asking the hard questions.',
  '{m} leads large teams across sites; I want to learn how to lead people who do not report to me.',
];
const GOALS = [
  'Clarity on whether to deepen my specialism or move towards a broader general-management path.',
  'Understand how decisions are made at the leadership level and how to influence them.',
  'Build confidence presenting to senior stakeholders.',
  'Get exposure to plant operations and how my work affects them.',
  'Develop a 2–3 year career plan with concrete experiences to build.',
  'Learn how to lead a cross-functional project successfully.',
];
const ASPIRATIONS = [
  'I see myself leading a team within the next three years.',
  'I want to move into a role that combines analytics and business strategy.',
  'I aspire to lead a plant function one day.',
  'I want to grow into a key account leadership role with global customers.',
  'I would like to build expertise that makes me the go-to person for innovation projects.',
];
const CHALLENGES = [
  'I sometimes struggle to prioritise when multiple stakeholders need things at once.',
  'I have limited visibility of other functions and how they work.',
  'I am not always confident sharing my views in senior forums.',
  'Moving from individual contributor to leading others feels like a big leap.',
  'I find it hard to get honest feedback on my development areas.',
];
const EXPECTATIONS = [
  'Honest feedback and someone to test ideas with.',
  'Introductions to people outside my function.',
  'Perspective on career choices and trade-offs.',
  'Challenge — I want to be stretched, not reassured.',
  'A safe space to think out loud about difficult situations.',
];
const AGENDAS: Record<string, string[]> = {
  '1': ['Introductions, my aspirations and what success looks like in six months', 'Agree how we work together and what I want from the relationship'],
  '2': ['Patterns I keep running into when leading cross-functional work', 'Capability gaps — what should I build next?'],
  '3': ['What I have learned, what I will do differently'],
  x: ['Follow-up on my stakeholder map', 'Quick check-in before my project review'],
};
const INSIGHTS = [
  'Career moves are rarely linear — look for experiences, not titles.',
  'Influence comes from understanding what the other function is measured on.',
  'Prepare the decision, not just the data.',
  'Ask for feedback on one specific behaviour at a time.',
  'Spend time where the value is created — on the shop floor and with customers.',
];
const MENTEE_ACTIONS = [
  'Shadow a shift at the Durgapur plant',
  'Map my key stakeholders and their priorities',
  'Present the project update at the next leadership review',
  'Read “The Goal” by Eliyahu Goldratt',
  'Set up coffee chats with two leaders in Commercial',
  'Draft my 2-year development plan',
  'Ask my manager for feedback on meeting facilitation',
];
const FEEDBACK_COMMENTS: Record<Sentiment, string[]> = {
  positive: [
    'Incredibly generous with time and very practical advice.',
    'Challenged my thinking in a way nobody has before.',
    'Felt like a genuine conversation, not a lecture.',
    'Came away with three concrete things to try.',
  ],
  neutral: ['Useful conversation, would like more specific examples next time.', 'Good start — we ran out of time.'],
  negative: ['Conversation felt rushed; rescheduled twice.', 'Hard to connect the advice to my role.'],
};
const DECLINE_REASONS = [
  'At capacity with plant commissioning this quarter — happy to be considered next cohort.',
  'The stated need is better served by a mentor with commercial experience.',
];

const MENTORING_VENUES = ['Mentor’s cabin', 'Leadership lounge – Level 5', 'Café Corner', 'Conference Room B'];

const ANCHOR_TITLES: Record<AnchorConversation, string> = { 1: 'Discover & Align', 2: 'Challenge & Develop', 3: 'Reflect & Accelerate' };

export interface MentoringSeed {
  cohorts: MentoringCohort[];
  mentors: MentorProfile[];
  applications: MenteeApplication[];
  matches: MentorMatch[];
  mentoringSessions: MentoringSession[];
}

/** Returns true when `a` sits anywhere in `b`'s management chain (or vice versa). */
export const inReportingLine = (a: string, b: string, byId: Map<string, Employee>): boolean => {
  const chain = (id: string) => {
    const out = new Set<string>();
    let cur = byId.get(id)?.managerId;
    while (cur) {
      out.add(cur);
      cur = byId.get(cur)?.managerId ?? null;
    }
    return out;
  };
  return chain(a).has(b) || chain(b).has(a);
};

export function generateMentoring(employees: Employee[], now: Date): MentoringSeed {
  const rng = createRng(20260701);
  const today = startOfDay(now);
  const byId = new Map(employees.map((e) => [e.id, e]));

  // ── Cohorts ──
  const c1Start = monthKeyToDate(addMonthsToKey(monthKey(today), -2));
  const c1End = addDays(new Date(c1Start.getFullYear(), c1Start.getMonth() + 6, 1), -1);
  const c2Start = addDays(c1End, 1);
  const cohorts: MentoringCohort[] = [
    {
      id: 'C1',
      name: `Cohort 1 · ${c1Start.getFullYear()}`,
      applicationOpen: addDays(c1Start, -60).toISOString(),
      applicationClose: addDays(c1Start, -35).toISOString(),
      startDate: c1Start.toISOString(),
      endDate: c1End.toISOString(),
      status: 'active',
    },
    {
      id: 'C2',
      name: `Cohort 2 · ${c2Start.getFullYear()}`,
      applicationOpen: addDays(today, -12).toISOString(),
      applicationClose: new Date(addDays(today, 14).getTime() + 18 * 3600000).toISOString(),
      startDate: c2Start.toISOString(),
      endDate: addDays(new Date(c2Start.getFullYear(), c2Start.getMonth() + 6, 1), -1).toISOString(),
      status: 'applications_open',
    },
  ];

  // ── Mentors ──
  const mentors: MentorProfile[] = MENTOR_CODES.map((code) => {
    const e = byId.get(code)!;
    const styles = sample(rng, ['sounding_board', 'career_advisor', 'advocate', 'challenger', 'connector', 'guardrail'] as MentorStyle[], 3);
    return {
      employeeId: code,
      capacity: code === DEMO.mentor ? 5 : int(rng, 3, 5),
      expertise: sample(rng, EXPERTISE[e.functionId] ?? EXPERTISE['F-EXE'], 3),
      styles,
      bio: BIO[e.functionId] ?? BIO['F-EXE'],
      active: true,
      joinedAt: addDays(c1Start, -70).toISOString(),
    };
  });
  const anjali = mentors.find((m) => m.employeeId === DEMO.mentor)!;
  anjali.expertise = ['Plant operations', 'Lean & Six Sigma', 'Leading large teams'];
  anjali.styles = ['challenger', 'career_advisor', 'connector'];
  anjali.bio =
    'Over two decades across plant operations and manufacturing excellence. Passionate about helping young professionals see the enterprise end-to-end — from the shop floor to the boardroom.';

  const mentorSet = new Set(MENTOR_CODES);
  const eligible = (e: Employee) =>
    e.status === 'active' && !mentorSet.has(e.id) && ['G2', 'G3', 'G4', 'G5', 'G6'].includes(e.grade) && e.id !== DEMO.employee && e.id !== DEMO.manager && e.id !== DEMO.talentHead;

  const validMentorsFor = (menteeId: string) => {
    const me = byId.get(menteeId)!;
    return MENTOR_CODES.filter((m) => byId.get(m)!.functionId !== me.functionId && !inReportingLine(m, menteeId, byId));
  };

  const applications: MenteeApplication[] = [];
  const matches: MentorMatch[] = [];
  const mentoringSessions: MentoringSession[] = [];
  let appSeq = 1;
  let matchSeq = 1;
  let msSeq = 1;
  let actSeq = 1;

  const fill = (tpl: string, mentorId: string) => tpl.replace('{m}', byId.get(mentorId)!.name);

  const makeApplication = (cohort: MentoringCohort, menteeId: string, preferred: string[], submittedAt: Date): MenteeApplication => ({
    id: `APP${String(appSeq++).padStart(4, '0')}`,
    cohortId: cohort.id,
    employeeId: menteeId,
    preferredMentorIds: preferred,
    whyMentors: fill(pick(rng, WHY), preferred[0]),
    goals: pick(rng, GOALS),
    aspirations: pick(rng, ASPIRATIONS),
    challenges: pick(rng, CHALLENGES),
    expectations: pick(rng, EXPECTATIONS),
    status: 'submitted',
    createdAt: addDays(submittedAt, -int(rng, 0, 3)).toISOString(),
    submittedAt: submittedAt.toISOString(),
    updatedAt: submittedAt.toISOString(),
    history: [{ at: submittedAt.toISOString(), status: 'submitted', by: menteeId }],
  });

  const score = () => ({ clarity: int(rng, 3, 5), reflection: int(rng, 2, 5), fit: int(rng, 3, 5) });

  // ── Cohort 1: matched & active ──
  const c1 = cohorts[0];
  const pool = shuffle(rng, employees.filter(eligible).filter((e) => e.id !== DEMO.mentee));
  const load: Record<string, number> = Object.fromEntries(MENTOR_CODES.map((m) => [m, 0]));

  const c1Applicants: { menteeId: string; forcedMentor?: string }[] = [{ menteeId: DEMO.mentee, forcedMentor: DEMO.mentor }];
  // two more mentees for Anjali (from Commercial & Finance)
  const anjaliExtra = [
    pool.find((e) => e.functionId === 'F-COM' && e.grade === 'G3'),
    pool.find((e) => e.functionId === 'F-FIN' && e.grade === 'G4'),
  ].filter(Boolean) as Employee[];
  anjaliExtra.forEach((e) => c1Applicants.push({ menteeId: e.id, forcedMentor: DEMO.mentor }));
  const used = new Set(c1Applicants.map((a) => a.menteeId));
  for (const e of pool) {
    if (c1Applicants.length >= 84) break;
    if (used.has(e.id)) continue;
    used.add(e.id);
    c1Applicants.push({ menteeId: e.id });
  }

  const c1Open = new Date(c1.applicationOpen);
  const c1Close = new Date(c1.applicationClose);
  const c1StartDate = new Date(c1.startDate);

  for (const a of c1Applicants) {
    const valid = validMentorsFor(a.menteeId);
    let preferred = sample(rng, valid, int(rng, 2, 3));
    if (a.forcedMentor) preferred = [a.forcedMentor, ...preferred.filter((m) => m !== a.forcedMentor)].slice(0, 3);
    const submittedAt = new Date(c1Open.getTime() + rng() * (c1Close.getTime() - c1Open.getTime()));
    const app = makeApplication(c1, a.menteeId, preferred, submittedAt);
    app.scores = score();
    const reviewAt = addDays(c1Close, int(rng, 1, 5));
    app.history.push({ at: reviewAt.toISOString(), status: 'under_review', by: DEMO.talentHead });

    // Pick a mentor with capacity
    const mentorId = a.forcedMentor ?? preferred.find((m) => m !== DEMO.mentor && load[m] < mentors.find((x) => x.employeeId === m)!.capacity - 1);
    const rejected = !a.forcedMentor && (chance(rng, 0.07) || !mentorId);
    if (rejected || !mentorId) {
      const st = chance(rng, 0.7) ? 'not_matched' : 'withdrawn';
      app.status = st;
      app.hrNotes = st === 'not_matched' ? 'Purpose not yet clear enough — encouraged to reapply next cohort.' : undefined;
      app.history.push({ at: addDays(reviewAt, 6).toISOString(), status: st, by: st === 'withdrawn' ? a.menteeId : DEMO.talentHead });
      app.updatedAt = addDays(reviewAt, 6).toISOString();
      applications.push(app);
      continue;
    }
    load[mentorId]++;
    const shortAt = addDays(reviewAt, int(rng, 2, 6));
    app.history.push({ at: shortAt.toISOString(), status: 'shortlisted', by: DEMO.talentHead });

    // Occasionally a first proposal was declined before the final match (match history)
    if (!a.forcedMentor && chance(rng, 0.1)) {
      const other = preferred.find((m) => m !== mentorId) ?? pick(rng, valid);
      const reason = pick(rng, DECLINE_REASONS);
      matches.push({
        id: `MT${String(matchSeq++).padStart(4, '0')}`,
        cohortId: c1.id,
        mentorId: other,
        menteeId: a.menteeId,
        applicationId: app.id,
        status: 'declined',
        proposedAt: shortAt.toISOString(),
        proposedBy: DEMO.talentHead,
        respondedAt: addDays(shortAt, 2).toISOString(),
        declineReason: reason,
        history: [
          { at: shortAt.toISOString(), status: 'proposed', by: DEMO.talentHead },
          { at: addDays(shortAt, 2).toISOString(), status: 'declined', by: other, note: reason },
        ],
      });
    }
    const proposedAt = addDays(shortAt, 1);
    const acceptedAt = addDays(proposedAt, int(rng, 1, 4));
    const activatedAt = addDays(c1StartDate, -int(rng, 2, 7));
    const match: MentorMatch = {
      id: `MT${String(matchSeq++).padStart(4, '0')}`,
      cohortId: c1.id,
      mentorId,
      menteeId: a.menteeId,
      applicationId: app.id,
      status: 'active',
      proposedAt: proposedAt.toISOString(),
      proposedBy: DEMO.talentHead,
      respondedAt: acceptedAt.toISOString(),
      activatedAt: activatedAt.toISOString(),
      history: [
        { at: proposedAt.toISOString(), status: 'proposed', by: DEMO.talentHead },
        { at: acceptedAt.toISOString(), status: 'accepted', by: mentorId },
        { at: activatedAt.toISOString(), status: 'active', by: DEMO.talentHead, note: 'Final match confirmed & announced' },
      ],
    };
    matches.push(match);
    app.status = 'matched';
    app.history.push({ at: activatedAt.toISOString(), status: 'matched', by: DEMO.talentHead });
    app.updatedAt = activatedAt.toISOString();
    applications.push(app);

    mentoringSessions.push(...generateConversations(rng, match, c1StartDate, now, () => msSeq++, () => actSeq++));
  }

  // ── Cohort 2: applications open ──
  const c2 = cohorts[1];
  const c2Open = new Date(c2.applicationOpen);
  const c2Pool = shuffle(rng, employees.filter(eligible).filter((e) => !used.has(e.id)));
  const c2Count = 28;
  const anjaliProposed = [c2Pool.find((e) => e.functionId === 'F-COM'), c2Pool.find((e) => e.functionId === 'F-SCM')].filter(Boolean) as Employee[];
  const c2List = [...anjaliProposed, ...c2Pool.filter((e) => !anjaliProposed.includes(e)).slice(0, c2Count - anjaliProposed.length)];

  let otherShortlisted = 0;
  c2List.forEach((e, i) => {
    const valid = validMentorsFor(e.id).filter((m) => i < anjaliProposed.length || m !== DEMO.mentor);
    let preferred = sample(rng, valid, int(rng, 2, 3));
    if (i < anjaliProposed.length) preferred = [DEMO.mentor, ...preferred.filter((m) => m !== DEMO.mentor)].slice(0, 3);
    // Deliberate validation issues for the matching workspace
    if (i === 5) {
      const sameFn = MENTOR_CODES.find((m) => byId.get(m)!.functionId === e.functionId);
      if (sameFn) preferred = [sameFn, ...preferred].slice(0, 3);
    }
    if (i === 6) {
      let cur = e.managerId;
      let skip: string | undefined;
      while (cur) {
        if (mentorSet.has(cur)) {
          skip = cur;
          break;
        }
        cur = byId.get(cur)?.managerId ?? null;
      }
      if (skip) preferred = [skip, ...preferred.filter((m) => m !== skip)].slice(0, 3);
    }
    const submittedAt = new Date(c2Open.getTime() + rng() * (today.getTime() - c2Open.getTime()));
    const app = makeApplication(c2, e.id, preferred, submittedAt);

    let stage: 'submitted' | 'under_review' | 'shortlisted' | 'withdrawn' =
      i < anjaliProposed.length ? 'shortlisted' : weighted(rng, [['submitted', 0.38], ['under_review', 0.3], ['shortlisted', 0.28], ['withdrawn', 0.04]] as const);
    if (i === 5 || i === 6) stage = 'under_review';

    if (stage !== 'submitted') {
      const reviewAt = new Date(Math.min(addDays(submittedAt, int(rng, 1, 3)).getTime(), now.getTime() - 3600000));
      if (stage === 'withdrawn') {
        app.status = 'withdrawn';
        app.history.push({ at: reviewAt.toISOString(), status: 'withdrawn', by: e.id, note: 'Taking up a new role — will apply next time.' });
        app.updatedAt = reviewAt.toISOString();
      } else {
        app.status = 'under_review';
        app.scores = score();
        app.history.push({ at: reviewAt.toISOString(), status: 'under_review', by: DEMO.talentHead });
        app.updatedAt = reviewAt.toISOString();
      }
      if (stage === 'shortlisted') {
        const shortAt = new Date(Math.min(addDays(reviewAt, 1).getTime(), now.getTime() - 1800000));
        app.status = 'shortlisted';
        app.history.push({ at: shortAt.toISOString(), status: 'shortlisted', by: DEMO.talentHead });
        app.updatedAt = shortAt.toISOString();
        const mentorId = preferred[0];
        // Deterministic mix for the demo: 3 accepted (awaiting final match), 1 declined, rest pending
        const k = i >= anjaliProposed.length ? otherShortlisted++ : -1;
        const mentorResponds = k >= 0 && k < 4;
        const accepted = mentorResponds && k !== 2;
        const match: MentorMatch = {
          id: `MT${String(matchSeq++).padStart(4, '0')}`,
          cohortId: c2.id,
          mentorId,
          menteeId: e.id,
          applicationId: app.id,
          status: 'proposed',
          proposedAt: shortAt.toISOString(),
          proposedBy: DEMO.talentHead,
          history: [{ at: shortAt.toISOString(), status: 'proposed', by: DEMO.talentHead, note: 'HR shortlist' }],
        };
        if (mentorResponds) {
          const at = new Date(Math.min(addDays(shortAt, 1).getTime(), now.getTime() - 600000)).toISOString();
          match.respondedAt = at;
          match.status = accepted ? 'accepted' : 'declined';
          if (!accepted) {
            match.declineReason = pick(rng, DECLINE_REASONS);
            app.status = 'under_review';
            app.history.push({ at, status: 'under_review', by: DEMO.talentHead, note: 'Mentor declined — to be re-matched' });
          }
          match.history.push({ at, status: match.status, by: mentorId, note: match.declineReason });
        }
        matches.push(match);
      }
    }
    applications.push(app);
  });

  return { cohorts, mentors, applications, matches, mentoringSessions };
}

function generateConversations(
  rng: Rng,
  match: MentorMatch,
  cohortStart: Date,
  now: Date,
  nextId: () => number,
  nextAct: () => number,
): MentoringSession[] {
  const out: MentoringSession[] = [];
  const today = startOfDay(now);
  const elapsed = Math.floor((today.getTime() - cohortStart.getTime()) / 86400000);
  const isDemo = match.menteeId === DEMO.mentee && match.mentorId === DEMO.mentor;

  const at = (dayOffsetFromStart: number, hour: number) => {
    let d = addDays(cohortStart, dayOffsetFromStart);
    while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, pick(rng, [0, 30]));
  };

  const make = (anchor: AnchorConversation | null, start: Date, status: MentoringSession['status']): MentoringSession => {
    const key = anchor ? String(anchor) : 'x';
    const s: MentoringSession = {
      id: `MS${String(nextId()).padStart(5, '0')}`,
      matchId: match.id,
      mentorId: match.mentorId,
      menteeId: match.menteeId,
      anchor,
      title: anchor ? `Conversation ${anchor} · ${ANCHOR_TITLES[anchor]}` : 'Additional touchpoint',
      start: start.toISOString(),
      end: new Date(start.getTime() + 60 * 60000).toISOString(),
      mode: chance(rng, 0.6) ? 'teams' : 'in_person',
      status,
      agenda: pick(rng, AGENDAS[key]),
      actions: [],
      outlookEventId: `AAMkAG${Math.floor(rng() * 1e12).toString(36)}${Math.floor(rng() * 1e12).toString(36)}`,
      calendarSynced: true,
      createdAt: addDays(start, -int(rng, 3, 10)).toISOString(),
    };
    if (s.mode === 'teams') s.teamsLink = `https://teams.microsoft.com/l/meetup-join/19%3ameeting_${Math.floor(rng() * 1e12).toString(36)}${Math.floor(rng() * 1e12).toString(36)}%40thread.v2/0`;
    else s.venue = pick(rng, MENTORING_VENUES);
    if (status === 'completed') {
      s.notes = 'Discussed my goals and the mentor shared examples from their own career. Agreed next steps below.';
      s.keyInsights = pick(rng, INSIGHTS);
      const n = int(rng, 1, 3);
      const done = start < addDays(today, -30);
      s.actions = sample(rng, MENTEE_ACTIONS, n).map(
        (text): ActionItem => ({
          id: `MA${String(nextAct()).padStart(5, '0')}`,
          text,
          owner: 'mentee',
          dueDate: addDays(start, 21).toISOString(),
          done: done ? chance(rng, 0.75) : chance(rng, 0.25),
        }),
      );
      s.actions.forEach((a) => {
        if (a.done) a.doneAt = addDays(start, int(rng, 5, 18)).toISOString();
      });
      if (chance(rng, 0.85)) {
        const rating = weighted(rng, [[5, 0.46], [4, 0.36], [3, 0.13], [2, 0.05]] as const);
        const sentiment: Sentiment = rating >= 4 ? 'positive' : rating === 3 ? 'neutral' : 'negative';
        s.feedback = { rating, sentiment, comment: chance(rng, 0.6) ? pick(rng, FEEDBACK_COMMENTS[sentiment]) : undefined, at: addDays(start, 1).toISOString() };
      }
    }
    return s;
  };

  if (isDemo) {
    const c1 = make(1, at(12, 17), 'completed');
    c1.agenda = 'Introductions, my aspirations and what success looks like in six months';
    c1.notes =
      'Anjali shared how she moved from process engineering into plant leadership. We agreed success = me leading one cross-functional analytics project with a plant by month six.';
    c1.keyInsights = 'Influence comes from understanding what the other function is measured on.';
    c1.actions = [
      { id: 'MA-D1', text: 'Shadow a shift at the Durgapur plant', owner: 'mentee', dueDate: at(40, 9).toISOString(), done: true, doneAt: at(33, 18).toISOString() },
      { id: 'MA-D2', text: 'Read “The Goal” by Eliyahu Goldratt', owner: 'mentee', dueDate: at(45, 9).toISOString(), done: true, doneAt: at(41, 18).toISOString() },
      { id: 'MA-D3', text: 'Map the demand-forecasting process end-to-end with plant planning', owner: 'mentee', dueDate: addDays(today, 4).toISOString(), done: false },
      { id: 'MA-D4', text: 'Introduce Aarav to the Durgapur planning head', owner: 'mentor', dueDate: at(30, 9).toISOString(), done: true, doneAt: at(20, 12).toISOString() },
    ];
    c1.feedback = { rating: 5, sentiment: 'positive', comment: 'Incredibly generous with time and very practical advice.', at: at(13, 10).toISOString() };
    out.push(c1);
    const extra = make(null, at(Math.min(38, elapsed - 5), 12), 'completed');
    extra.agenda = 'Debrief after the plant shift';
    extra.feedback = { rating: 4, sentiment: 'positive', at: extra.end };
    out.push(extra);
    const next = addDays(today, 6);
    const c2 = make(2, new Date(next.getFullYear(), next.getMonth(), next.getDate(), 17, 0), 'scheduled');
    while (new Date(c2.start).getDay() === 0 || new Date(c2.start).getDay() === 6) {
      const d = addDays(new Date(c2.start), 1);
      c2.start = d.toISOString();
      c2.end = new Date(d.getTime() + 3600000).toISOString();
    }
    c2.mode = 'teams';
    delete c2.venue;
    c2.teamsLink ??= 'https://teams.microsoft.com/l/meetup-join/19%3ameeting_mentoring_aarav_anjali%40thread.v2/0';
    c2.agenda = 'Patterns I keep running into when leading cross-functional work; what capability should I build next?';
    out.push(c2);
    return out;
  }

  // Conversation 1 — month 1
  if (chance(rng, 0.94) && elapsed > 10) out.push(make(1, at(int(rng, 7, Math.min(30, elapsed - 2)), int(rng, 10, 17)), 'completed'));
  else if (elapsed > 0) out.push(make(1, addDays(today, int(rng, 2, 10)), 'scheduled'));

  // Additional touchpoint
  if (out[0]?.status === 'completed' && chance(rng, 0.22) && elapsed > 40) out.push(make(null, at(int(rng, 35, elapsed - 3), int(rng, 10, 17)), 'completed'));

  // Conversation 2 — around month 3
  if (out[0]?.status === 'completed' && elapsed > 45) {
    const r = rng();
    if (r < 0.52) out.push(make(2, at(int(rng, 45, elapsed - 2), int(rng, 10, 17)), 'completed'));
    else if (r < 0.8) {
      const d = addDays(today, int(rng, 1, 20));
      out.push(make(2, new Date(d.getFullYear(), d.getMonth(), d.getDate(), int(rng, 10, 17), 0), 'scheduled'));
    }
  }
  // Keep scheduled sessions on weekdays
  out.forEach((s) => {
    let d = new Date(s.start);
    while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
    s.start = d.toISOString();
    s.end = new Date(d.getTime() + 3600000).toISOString();
  });
  return out;
}
