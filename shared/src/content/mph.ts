// MyPeopleHour programme content — sourced from "My People Hour – Plan & Design".
// Where the deck left placeholders (objective tabs, leading questions, measurement
// descriptors) the copy below fills them in, in the spirit of the programme.

export const MPH_TAGLINE = 'One hour. Every month. Every person.';
export const MPH_DEFINITION =
  'One hour, every month, between a manager & each direct report — No dashboard. No status updates. No firefighting. Just the person.';
export const MPH_PORTAL_PROMISE =
  'To protect discipline without creating bureaucracy, a lightweight digital backbone to schedule, track and know from every session.';

/** "Simple mechanics. Non-negotiable discipline." */
export const MPH_MECHANICS = [
  {
    id: 'one-hour',
    title: 'One hour per direct report',
    body: 'Every month, pre-scheduled, treated as non-negotiable. No rescheduling except genuine emergencies.',
  },
  {
    id: 'structured',
    title: 'Structured conversations, not form filling',
    body: 'A simple template guides the conversation. Managers come with observations. Team members come with what they need.',
  },
  {
    id: 'preparation',
    title: 'Manager owns preparation',
    body: 'Managers prepare observations before each session. It’s a thinking exercise, not a reporting exercise.',
  },
  {
    id: 'captured',
    title: 'Captured, not bureaucratized',
    body: 'Light notes captured after each session. No lengthy documentation.',
  },
] as const;

export interface MphObjective {
  id: string;
  number: number;
  title: string;
  summary: string;
  why: string;
  questions: string[];
  /** Icon name hint (Ionicons / Lucide friendly) */
  icon: string;
}

/** The five objective tabs of the help section, each with leading questions. */
export const MPH_OBJECTIVES: MphObjective[] = [
  {
    id: 'connect',
    number: 1,
    title: 'Know the person',
    summary: 'Build trust by understanding who they are beyond the role.',
    why: 'People open up to managers who are genuinely curious about them. Trust is the foundation every other conversation stands on.',
    icon: 'heart',
    questions: [
      'What has been the highlight of your month — at work or outside it?',
      'What is energising you right now, and what is draining you?',
      'Is there anything happening outside work that I should be aware of so I can support you?',
      'How do you prefer to receive feedback and recognition?',
    ],
  },
  {
    id: 'wellbeing',
    number: 2,
    title: 'Well-being & workload',
    summary: 'Check how they are really doing, and whether the load is sustainable.',
    why: 'Sustained performance depends on energy. Early signals of stress are far easier to address than burnout.',
    icon: 'leaf',
    questions: [
      'On a scale of 1–10, how sustainable does your workload feel right now?',
      'What is one thing we could stop, simplify or share to free up your time?',
      'Are you able to switch off after work? What gets in the way?',
      'What support would make the next month easier?',
    ],
  },
  {
    id: 'growth',
    number: 3,
    title: 'Growth & aspirations',
    summary: 'Explore where they want to go and how this role gets them there.',
    why: 'People stay where they grow. Connecting today’s work to tomorrow’s aspirations builds commitment.',
    icon: 'trending-up',
    questions: [
      'Where do you see yourself in two to three years? What excites you about that?',
      'Which skill, if you built it this year, would make the biggest difference?',
      'What kind of project or exposure would stretch you in a good way?',
      'Who in the organisation would you like to learn from?',
    ],
  },
  {
    id: 'support',
    number: 4,
    title: 'Support & obstacles',
    summary: 'Find out what is getting in their way and what they need from you.',
    why: 'Managers exist to remove friction. Team members often won’t raise blockers unless explicitly invited to.',
    icon: 'hand-left',
    questions: [
      'What is the biggest obstacle slowing you down at the moment?',
      'What do you need from me that you are not getting today?',
      'Is there a decision, resource or introduction I can help unlock?',
      'What would you do differently if you were in my role?',
    ],
  },
  {
    id: 'feedback',
    number: 5,
    title: 'Feedback & recognition',
    summary: 'Exchange honest, two-way feedback and recognise what went well.',
    why: 'Timely recognition reinforces the right behaviours; two-way feedback keeps the relationship honest.',
    icon: 'chatbubbles',
    questions: [
      'What are you most proud of from the last month?',
      'Here is something I noticed you did really well… how did you approach it?',
      'What is one thing I could do differently as your manager?',
      'What should we both commit to before our next conversation?',
    ],
  },
];

/** Structured reflection prompts the manager uses to prepare (Conversation template). */
export const MPH_PREPARATION_PROMPTS = [
  'What have I observed about this person’s work and energy since our last conversation?',
  'What is one specific strength I want to recognise — with an example?',
  'Is there a development area I want to explore with curiosity, not judgement?',
  'What did we agree last time, and has it been followed through (by both of us)?',
  'What do I want this person to walk away feeling?',
];

export const MPH_DOS = [
  'Block the hour in advance and protect it — treat it as non-negotiable.',
  'Come prepared with specific observations, not generic comments.',
  'Listen more than you speak — aim for 70% them, 30% you.',
  'Ask open questions and follow up with “tell me more”.',
  'Put devices away and choose a quiet, distraction-free space.',
  'Close with one or two clear, shared commitments.',
  'Capture light notes right after the session.',
];

export const MPH_DONTS = [
  'Don’t turn it into a project status update or task review.',
  'Don’t reschedule for routine work — only genuine emergencies.',
  'Don’t fill the silence — give people time to think.',
  'Don’t use the hour for performance ratings or appraisal outcomes.',
  'Don’t make promises you cannot keep.',
  'Don’t share what was discussed without consent.',
];

/** "Remember" notes for effective conversations. */
export const MPH_REMEMBER = [
  { title: 'It’s their hour', body: 'The agenda belongs to the team member. Your job is to make space, not fill it.' },
  { title: 'Consistency beats intensity', body: 'Twelve good conversations a year build more trust than one great appraisal.' },
  { title: 'Confidentiality builds trust', body: 'What is shared in the hour stays in the hour unless there is a safety concern.' },
  { title: 'Follow-through is the proof', body: 'Nothing erodes trust faster than agreed actions that quietly disappear.' },
  { title: 'Curiosity over judgement', body: 'Ask “what happened?” before “why did you…?”. Assume positive intent.' },
];

/** What the team member can bring to the hour (employee-facing guide). */
export const MPH_EMPLOYEE_PREP = [
  'One thing that went well this month — and one that didn’t.',
  'Anything blocking you that your manager could help with.',
  'A question about your growth, role or the business.',
  'Feedback for your manager — what’s helping, what isn’t.',
];

/** Tracking — Three Levels of Measurement (descriptors completed). */
export const MPH_MEASUREMENT_LEVELS = [
  {
    id: 'completion',
    title: 'Completion Discipline',
    question: 'Are the conversations happening?',
    descriptors: [
      '% of manager–report pairs completing the monthly hour',
      'Scheduled vs completed sessions, by unit and department',
      'Missed sessions and their reasons (business / personal emergency)',
      'Pairs still “to be scheduled” as the month closes',
    ],
  },
  {
    id: 'quality',
    title: 'Quality of Conversations',
    question: 'Are they meaningful?',
    descriptors: [
      'Average conversation score rated by team members (1–5)',
      '“I feel heard by my manager” pulse item',
      'Share of sessions with notes and agreed actions captured',
      'Follow-through on actions agreed in the previous hour',
    ],
  },
  {
    id: 'outcome',
    title: 'Outcome Indicator',
    question: 'Are they making a difference?',
    descriptors: [
      'Quarterly pulse trend — engagement, growth and manager support',
      'Employee Net Promoter Score (eNPS)',
      'Correlation of completion discipline with pulse scores',
      'Regretted attrition and internal movement over time',
    ],
  },
] as const;

export const MISSED_REASON_LABELS = {
  business_emergency: 'Business Emergency',
  personal_emergency: 'Personal Emergency',
} as const;

export const MONTHLY_STATUS_LABELS = {
  completed: 'Completed',
  scheduled: 'Scheduled',
  missed: 'Missed',
  to_be_scheduled: 'To be scheduled',
} as const;

/** Employee-facing label set: “to be scheduled” reads as “Upcoming” from the employee side */
export const EMPLOYEE_STATUS_LABELS = {
  completed: 'Completed',
  scheduled: 'Scheduled',
  missed: 'Missed',
  to_be_scheduled: 'Upcoming',
} as const;
