// Domain model shared by the mobile app and the admin panel.
// Plain TypeScript only (no enums / runtime deps) so both Metro and Vite can consume it.

export type ID = string;
/** ISO-8601 timestamp, e.g. 2026-09-24T10:30:00.000Z */
export type ISODate = string;
/** Calendar month key, e.g. 2026-09 */
export type MonthKey = string;

// ───────────────────────── Organisation ─────────────────────────

export interface Unit {
  id: ID;
  name: string;
  shortName: string;
  location: string;
}

export interface FunctionArea {
  id: ID;
  name: string;
  departments: string[];
}

export type Gender = 'female' | 'male';
export type EmployeeLevel = 'executive' | 'senior_leader' | 'manager' | 'staff';
export type EmployeeStatus = 'active' | 'on_leave' | 'inactive';

export interface Employee {
  id: ID; // same as employee code, e.g. E00123
  code: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  gender: Gender;
  designation: string;
  department: string;
  /** Functional area — used for cross-functional mentoring validation */
  functionId: ID;
  grade: string; // G1 … G10
  level: EmployeeLevel;
  unitId: ID;
  location: string;
  managerId: ID | null;
  dateOfJoining: ISODate;
  status: EmployeeStatus;
}

// ───────────────────────── MyPeopleHour sessions ─────────────────────────

export type SessionStatus = 'scheduled' | 'completed' | 'missed' | 'cancelled';
/** Status of a manager ↔ report pair for a given month */
export type MonthlyStatus = 'completed' | 'scheduled' | 'missed' | 'to_be_scheduled';
export type MissedReason = 'business_emergency' | 'personal_emergency';
export type SessionMode = 'in_person' | 'teams';

export type SessionEventType =
  | 'created'
  | 'rescheduled'
  | 'completed'
  | 'missed'
  | 'cancelled'
  | 'calendar_synced'
  | 'calendar_failed'
  | 'reminder_sent';

export interface SessionEvent {
  at: ISODate;
  type: SessionEventType;
  by: ID; // employee id, or 'system'
  note?: string;
}

export interface Session {
  id: ID;
  managerId: ID;
  employeeId: ID;
  month: MonthKey;
  status: SessionStatus;
  start: ISODate;
  end: ISODate;
  mode: SessionMode;
  venue?: string;
  teamsLink?: string;
  outlookEventId?: string;
  calendarSynced: boolean;
  agenda?: string;
  missedReason?: MissedReason;
  missedRemark?: string;
  cancelReason?: string;
  completedAt?: ISODate;
  /** Employee's post-session conversation quality score (1–5) */
  employeeRating?: number;
  /** Optional comment left with the rating ("what made it valuable?") — visible to the manager only */
  employeeFeedback?: string;
  history: SessionEvent[];
  createdAt: ISODate;
}

// ───────────────────────── Quick-capture notes ─────────────────────────

export type NoteKind = 'prep' | 'session' | 'general';
export type NoteTag =
  | 'observation'
  | 'strength'
  | 'development'
  | 'career'
  | 'wellbeing'
  | 'support'
  | 'recognition';

export type ActionOwner = 'manager' | 'employee' | 'mentor' | 'mentee';

export interface ActionItem {
  id: ID;
  text: string;
  owner: ActionOwner;
  dueDate?: ISODate;
  done: boolean;
  doneAt?: ISODate;
}

export interface Note {
  id: ID;
  authorId: ID; // manager
  employeeId: ID; // the direct report the note is about
  sessionId?: ID;
  month: MonthKey;
  kind: NoteKind;
  title: string;
  body: string;
  tags: NoteTag[];
  actions: ActionItem[];
  createdAt: ISODate;
  updatedAt: ISODate;
  archived: boolean;
}

// ───────────────────────── Surveys ─────────────────────────

export type QuestionType =
  | 'emoji' // 5-point mood scale
  | 'rating' // 1–5 stars
  | 'likert' // strongly disagree … strongly agree
  | 'nps' // 0–10
  | 'single_choice'
  | 'multi_choice'
  | 'yes_no'
  | 'text';

export type PulseCategory = 'Engagement' | 'Manager Support' | 'Growth' | 'Wellbeing' | 'Recognition' | 'Programme';

export interface SurveyQuestion {
  id: ID;
  type: QuestionType;
  text: string;
  helpText?: string;
  required: boolean;
  options?: string[];
  category?: PulseCategory;
  /** For multi_choice: max selections (optional) */
  maxSelections?: number;
}

export type SurveyStatus = 'draft' | 'published' | 'closed';
export type SurveyKind = 'pulse' | 'mentoring' | 'adhoc';

export interface Survey {
  id: ID;
  title: string;
  description: string;
  kind: SurveyKind;
  /** e.g. Q2 FY27 */
  period: string;
  status: SurveyStatus;
  /** empty list = everyone */
  audienceUnitIds: ID[];
  anonymous: boolean;
  createdBy: ID;
  createdAt: ISODate;
  publishedAt?: ISODate;
  closedAt?: ISODate;
  dueDate: ISODate;
  questions: SurveyQuestion[];
}

export type AnswerValue = number | string | string[] | boolean;

export interface SurveyResponse {
  id: ID;
  surveyId: ID;
  employeeId: ID;
  unitId: ID;
  functionId: ID;
  status: 'draft' | 'submitted';
  answers: Record<ID, AnswerValue>;
  startedAt: ISODate;
  submittedAt?: ISODate;
}

export interface MoodCheck {
  id: ID;
  employeeId: ID;
  month: MonthKey;
  /** 1 = very unhappy … 5 = very happy */
  mood: number;
  at: ISODate;
}

// ───────────────────────── Mentoring ─────────────────────────

export type CohortStatus = 'upcoming' | 'applications_open' | 'matching' | 'active' | 'completed';

export interface MentoringCohort {
  id: ID;
  name: string;
  applicationOpen: ISODate;
  applicationClose: ISODate;
  startDate: ISODate;
  endDate: ISODate; // 6 months after start
  status: CohortStatus;
}

export type MentorStyle = 'sounding_board' | 'career_advisor' | 'advocate' | 'challenger' | 'connector' | 'guardrail';

export interface MentorProfile {
  employeeId: ID;
  /** 3–5 mentees */
  capacity: number;
  expertise: string[];
  styles: MentorStyle[];
  bio: string;
  active: boolean;
  joinedAt: ISODate;
}

export type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'shortlisted'
  | 'matched'
  | 'not_matched'
  | 'withdrawn';

export interface ApplicationScores {
  /** Clarity of purpose (1–5) */
  clarity: number;
  /** Career reflection quality (1–5) */
  reflection: number;
  /** Mentor fit (1–5) */
  fit: number;
}

export interface StatusChange<S extends string = string> {
  at: ISODate;
  status: S;
  by: ID;
  note?: string;
}

export interface MenteeApplication {
  id: ID;
  cohortId: ID;
  employeeId: ID;
  /** 2–3 preferred mentors, in order of preference */
  preferredMentorIds: ID[];
  whyMentors: string;
  goals: string; // what do I want from the relationship
  aspirations: string;
  challenges: string;
  expectations: string; // what I expect from a mentor
  status: ApplicationStatus;
  createdAt: ISODate;
  submittedAt?: ISODate;
  updatedAt: ISODate;
  scores?: ApplicationScores;
  hrNotes?: string;
  history: StatusChange<ApplicationStatus>[];
}

export type MatchStatus = 'proposed' | 'accepted' | 'declined' | 'active' | 'completed' | 'withdrawn';

export interface MentorMatch {
  id: ID;
  cohortId: ID;
  mentorId: ID;
  menteeId: ID;
  applicationId: ID;
  status: MatchStatus;
  proposedAt: ISODate;
  proposedBy: ID;
  respondedAt?: ISODate;
  declineReason?: string;
  activatedAt?: ISODate;
  completedAt?: ISODate;
  history: StatusChange<MatchStatus>[];
}

export type AnchorConversation = 1 | 2 | 3;
export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface MentoringFeedback {
  rating: number; // 1–5
  sentiment: Sentiment;
  comment?: string;
  at: ISODate;
}

export interface MentoringSession {
  id: ID;
  matchId: ID;
  mentorId: ID;
  menteeId: ID;
  /** null = additional touchpoint agreed between mentor & mentee */
  anchor: AnchorConversation | null;
  title: string;
  start: ISODate;
  end: ISODate;
  mode: SessionMode;
  /** In-person location (Teams conversations use `teamsLink`) */
  venue?: string;
  teamsLink?: string;
  outlookEventId?: string;
  /** false when saved without the calendar after an Outlook/Teams failure */
  calendarSynced?: boolean;
  status: 'scheduled' | 'completed' | 'cancelled';
  agenda: string;
  notes?: string;
  keyInsights?: string;
  actions: ActionItem[];
  feedback?: MentoringFeedback;
  createdAt: ISODate;
}

// ───────────────────────── Notifications ─────────────────────────

export type NotificationKind =
  | 'session_scheduled'
  | 'session_reminder'
  | 'session_rescheduled'
  | 'session_cancelled'
  | 'session_completed'
  | 'session_missed'
  | 'survey_published'
  | 'survey_reminder'
  | 'mentoring_application'
  | 'mentoring_request'
  | 'mentoring_match'
  | 'mentoring_session'
  | 'mentoring_action'
  | 'system';

export interface AppNotification {
  id: ID;
  recipientId: ID;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: ISODate;
  read: boolean;
  /** Deep link path inside the mobile app, e.g. /session/S0001 */
  link: string;
}

// ───────────────────────── Admin ─────────────────────────

export type AdminRole = 'super_admin' | 'hr_admin' | 'leadership' | 'programme_admin';

export type AdminPermission =
  | 'dashboard.view'
  | 'employees.view'
  | 'employees.edit'
  | 'sessions.view'
  | 'sessions.edit'
  | 'surveys.view'
  | 'surveys.edit'
  | 'mentoring.view'
  | 'mentoring.edit'
  | 'reports.export'
  | 'settings.manage';

export interface AdminUser {
  id: ID;
  employeeId: ID;
  name: string;
  email: string;
  title: string;
  role: AdminRole;
  /** hr_admin can be scoped to a single unit; undefined = all units */
  unitScope?: ID;
  lastLoginAt?: ISODate;
  active: boolean;
}

// ───────────────────────── Integrations ─────────────────────────

export interface CalendarIntegration {
  provider: 'microsoft365';
  outlookConnected: boolean;
  teamsConnected: boolean;
  account: string;
  lastSyncAt?: ISODate;
  /** Demo switch to exercise the failure / retry path */
  simulateFailure: boolean;
}

// ───────────────────────── Database ─────────────────────────

export interface DemoDatabase {
  version: number;
  generatedAt: ISODate;
  units: Unit[];
  functions: FunctionArea[];
  grades: string[];
  locations: string[];
  employees: Employee[];
  sessions: Session[];
  notes: Note[];
  surveys: Survey[];
  responses: SurveyResponse[];
  moodChecks: MoodCheck[];
  cohorts: MentoringCohort[];
  mentors: MentorProfile[];
  applications: MenteeApplication[];
  matches: MentorMatch[];
  mentoringSessions: MentoringSession[];
  notifications: AppNotification[];
  adminUsers: AdminUser[];
}
