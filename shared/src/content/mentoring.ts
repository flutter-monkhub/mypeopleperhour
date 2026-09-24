// PCBL Mentoring Programme content — sourced from "Final-Mentor-Mentee Programme".
// Placeholder sections in the deck (purposes, design principle, mentor role
// descriptions) are completed here in the programme's own language.

import type { AnchorConversation, MentorStyle } from '../types';

export const MENTORING_NAME = 'PCBL Mentoring Programme';
export const MENTORING_TAGLINE = 'Building Connections Beyond Functions';
export const MENTORING_PILLARS = ['Access', 'Ownership', 'Exposure'] as const;

export const MENTORING_FRAMEWORK = {
  mentors: 'Around 25',
  mentorsLabel: 'Senior-leader mentors',
  menteesPerMentor: '3–5',
  menteesPerMentorLabel: 'Mentees per mentor',
  durationMonths: 6,
  durationLabel: 'Months (duration)',
  conversations: '3–5',
  conversationsLabel: '1:1 conversations / mentee',
} as const;

export const PROGRAMME_LIMITS = {
  minMenteesPerMentor: 3,
  maxMenteesPerMentor: 5,
  minPreferredMentors: 2,
  maxPreferredMentors: 3,
  durationMonths: 6,
  minConversations: 3,
  maxConversations: 5,
  conversationMinutes: 60,
} as const;

export const MENTORING_PURPOSES = [
  {
    id: 'business',
    title: 'Business purpose',
    body: 'Break functional silos by connecting talent with senior leaders across the enterprise — so ideas, context and decisions travel faster across PCBL.',
  },
  {
    id: 'talent',
    title: 'Talent purpose',
    body: 'Accelerate the growth of high-potential employees through access to senior perspective, honest challenge and wider exposure.',
  },
  {
    id: 'design',
    title: 'Design principle',
    body: 'Self-initiated and mentee-owned. HR enables the platform — not the appointments. Light structure, real conversations.',
  },
] as const;

export const GUIDING_PRINCIPLES = [
  { id: 'access', title: 'Access', body: 'Direct access to senior leaders beyond your own function and reporting line.' },
  { id: 'ownership', title: 'Ownership', body: 'The mentee owns the relationship — initiates, schedules, prepares and follows through.' },
  { id: 'exposure', title: 'Exposure', body: 'Cross-functional perspective on how the enterprise really works.' },
] as const;

export const MENTEE_PRINCIPLE =
  'The mentee owns the relationship: initiates contact, schedules the meeting, prepares the agenda and follows through on actions. HR enables the platform — not the appointments.';

export const FINAL_MATCHING_RULE =
  'Corporate HR creates the shortlist; the mentor has the final say on the 3–5 mentees they will mentor. Mandatory cross-functional matches and avoid direct reporting relationships.';

/** Mentor Proposition — senior leaders become enterprise mentors. */
export const MENTOR_ROLES: { id: MentorStyle; title: string; body: string; icon: string }[] = [
  {
    id: 'sounding_board',
    title: 'Sounding board',
    body: 'A safe space to think out loud, test ideas and talk through dilemmas without judgement.',
    icon: 'ear',
  },
  {
    id: 'career_advisor',
    title: 'Career advisor',
    body: 'Share how careers really unfold — the choices, trade-offs and turning points behind your own.',
    icon: 'compass',
  },
  {
    id: 'advocate',
    title: 'Advocate',
    body: 'Speak up for your mentee’s potential and help make their work visible in the right rooms.',
    icon: 'megaphone',
  },
  {
    id: 'challenger',
    title: 'Challenger',
    body: 'Ask the hard questions. Stretch thinking, surface blind spots and raise the bar.',
    icon: 'flash',
  },
  {
    id: 'connector',
    title: 'Connector',
    body: 'Open doors to people, forums and experiences across the enterprise.',
    icon: 'git-network',
  },
  {
    id: 'guardrail',
    title: 'Guardrail',
    body: 'Offer perspective on risks, culture and judgement — help them avoid avoidable mistakes.',
    icon: 'shield-checkmark',
  },
];

/** One-page application — the five questions from the deck. */
export const APPLICATION_SECTIONS = [
  { id: 'profile', number: 1, title: 'Name / role / function', hint: 'Pre-filled from your employee profile.' },
  { id: 'mentors', number: 2, title: 'Select 2–3 preferred mentors', hint: 'Mentors must be from a different function and outside your reporting line.' },
  { id: 'why', number: 3, title: 'Why these mentor(s)?', hint: 'What draws you to their experience or perspective?' },
  { id: 'goals', number: 4, title: 'What do I want from the relationship?', hint: 'Be specific about what you want to learn or explore.' },
  {
    id: 'reflection',
    number: 5,
    title: 'Short career reflection',
    hint: 'Your aspirations, current challenges and what you expect from a mentor.',
  },
] as const;

export interface AnchorConversationGuide {
  anchor: AnchorConversation;
  title: string;
  themes: string[];
  questions: string[];
  mentorPrompts: string[];
  /** Suggested month of the six-month programme */
  suggestedMonth: number;
}

/** Three anchor conversations — Sample Conversation Guide for Mentors. */
export const ANCHOR_CONVERSATIONS: AnchorConversationGuide[] = [
  {
    anchor: 1,
    title: 'Discover & Align',
    themes: ['Aspirations', 'Context', 'Expectations', 'Success definition'],
    questions: ['What matters most to me?', 'What would make this relationship valuable?'],
    mentorPrompts: [
      'Share your own story briefly — including a setback.',
      'Agree how you will work together: cadence, channel, confidentiality.',
      'Define together what “success in six months” looks like.',
    ],
    suggestedMonth: 1,
  },
  {
    anchor: 2,
    title: 'Challenge & Develop',
    themes: ['Patterns', 'Capability gaps', 'Choices', 'Feedback'],
    questions: ['What am I not seeing?', 'What capability or experience should I build?'],
    mentorPrompts: [
      'Offer candid observations — patterns you notice in how they describe situations.',
      'Push on one choice they are avoiding.',
      'Suggest a stretch experience or introduction across functions.',
    ],
    suggestedMonth: 3,
  },
  {
    anchor: 3,
    title: 'Reflect & Accelerate',
    themes: ['Progress', 'Insights', 'Relationships'],
    questions: ['What have I learned?', 'What will I do differently?', 'Who else should I learn from?'],
    mentorPrompts: [
      'Revisit the success definition from Conversation 1.',
      'Help them articulate their two or three biggest insights.',
      'Connect them to people who can continue the journey.',
    ],
    suggestedMonth: 6,
  },
];

export const MEETING_DISCIPLINE = [
  '60 minutes each',
  'Mentee schedules the session',
  'Mentee owns follow-up',
  'Confidentiality respected',
] as const;

export const ADDITIONAL_TOUCHPOINT_NOTE =
  'Three anchor conversations; mentee can initiate additional touchpoints if mutually agreed.';

/** Matching framework — criterion, weightage, decision rule. */
export const MATCHING_CRITERIA = [
  { id: 'clarity', criterion: 'Clarity of purpose', weightage: 'High', rule: 'Is the employee clear about what they want to learn?', kind: 'score' },
  { id: 'reflection', criterion: 'Career reflection', weightage: 'High', rule: 'Does the application show ownership and thoughtfulness?', kind: 'score' },
  { id: 'fit', criterion: 'Mentor fit', weightage: 'High', rule: 'Can the mentor realistically add value to the stated need?', kind: 'score' },
  { id: 'cross_functional', criterion: 'Cross-functional exposure', weightage: 'Required', rule: 'Mentee and mentor should be from different functions.', kind: 'rule' },
  { id: 'capacity', criterion: 'Capacity', weightage: 'Hard constraint', rule: '3–5 mentees per mentor.', kind: 'rule' },
  { id: 'reporting', criterion: 'Reporting', weightage: 'Hard constraint', rule: 'Avoid direct reporting, evaluation or sensitive conflicts.', kind: 'rule' },
] as const;

/** Tracking dashboard metrics listed in the deck. */
export const MENTORING_METRICS = [
  'Monthly hours invested in mentoring',
  'Sentiment based on mentee feedback',
  'No. of sessions completed',
  'Mentor of the month (maximum sessions conducted & mentee feedback)',
] as const;

export const APPLICATION_STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  shortlisted: 'Shortlisted',
  matched: 'Matched',
  not_matched: 'Not matched',
  withdrawn: 'Withdrawn',
} as const;

export const MATCH_STATUS_LABELS = {
  proposed: 'Awaiting mentor',
  accepted: 'Accepted by mentor',
  declined: 'Declined',
  active: 'Active',
  completed: 'Completed',
  withdrawn: 'Withdrawn',
} as const;
