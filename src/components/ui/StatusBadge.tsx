import type { ApplicationStatus, CohortStatus, MatchStatus, MonthlyStatus, SessionStatus, SurveyStatus } from '@shared/types';
import { MONTHLY_STATUS_LABELS } from '@shared/content/mph';
import { APPLICATION_STATUS_LABELS, MATCH_STATUS_LABELS } from '@shared/content/mentoring';
import { Badge, type BadgeTone } from './Badge';

export type StatusKind = 'monthly' | 'session' | 'survey' | 'application' | 'match' | 'cohort' | 'employee';

/** Extra pseudo-status: scheduled session whose end has passed (rule 2) */
export type AwaitingUpdate = 'awaiting_update';

export type AnyStatus =
  | MonthlyStatus
  | SessionStatus
  | SurveyStatus
  | ApplicationStatus
  | MatchStatus
  | CohortStatus
  | AwaitingUpdate
  | 'active'
  | 'on_leave'
  | 'inactive';

type Def = { label: string; tone: BadgeTone };

const MONTHLY: Record<MonthlyStatus, Def> = {
  completed: { label: MONTHLY_STATUS_LABELS.completed, tone: 'success' },
  scheduled: { label: MONTHLY_STATUS_LABELS.scheduled, tone: 'info' },
  missed: { label: MONTHLY_STATUS_LABELS.missed, tone: 'danger' },
  to_be_scheduled: { label: MONTHLY_STATUS_LABELS.to_be_scheduled, tone: 'warning' },
};

const SESSION: Record<SessionStatus | AwaitingUpdate, Def> = {
  scheduled: { label: 'Scheduled', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  missed: { label: 'Missed', tone: 'danger' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  awaiting_update: { label: 'Awaiting update', tone: 'warning' },
};

const SURVEY: Record<SurveyStatus, Def> = {
  draft: { label: 'Draft', tone: 'neutral' },
  published: { label: 'Live', tone: 'success' },
  closed: { label: 'Closed', tone: 'outline' },
};

const APPLICATION: Record<ApplicationStatus, Def> = {
  draft: { label: APPLICATION_STATUS_LABELS.draft, tone: 'neutral' },
  submitted: { label: APPLICATION_STATUS_LABELS.submitted, tone: 'info' },
  under_review: { label: APPLICATION_STATUS_LABELS.under_review, tone: 'warning' },
  shortlisted: { label: APPLICATION_STATUS_LABELS.shortlisted, tone: 'mentor' },
  matched: { label: APPLICATION_STATUS_LABELS.matched, tone: 'success' },
  not_matched: { label: APPLICATION_STATUS_LABELS.not_matched, tone: 'danger' },
  withdrawn: { label: APPLICATION_STATUS_LABELS.withdrawn, tone: 'neutral' },
};

const MATCH: Record<MatchStatus, Def> = {
  proposed: { label: MATCH_STATUS_LABELS.proposed, tone: 'warning' },
  accepted: { label: MATCH_STATUS_LABELS.accepted, tone: 'info' },
  declined: { label: MATCH_STATUS_LABELS.declined, tone: 'danger' },
  active: { label: MATCH_STATUS_LABELS.active, tone: 'success' },
  completed: { label: MATCH_STATUS_LABELS.completed, tone: 'mentor' },
  withdrawn: { label: MATCH_STATUS_LABELS.withdrawn, tone: 'neutral' },
};

const COHORT: Record<CohortStatus, Def> = {
  upcoming: { label: 'Upcoming', tone: 'neutral' },
  applications_open: { label: 'Applications open', tone: 'info' },
  matching: { label: 'Matching', tone: 'warning' },
  active: { label: 'Active', tone: 'success' },
  completed: { label: 'Completed', tone: 'mentor' },
};

const EMPLOYEE: Record<'active' | 'on_leave' | 'inactive', Def> = {
  active: { label: 'Active', tone: 'success' },
  on_leave: { label: 'On leave', tone: 'warning' },
  inactive: { label: 'Inactive', tone: 'neutral' },
};

const BY_KIND: Record<StatusKind, Record<string, Def>> = {
  monthly: MONTHLY,
  session: SESSION,
  survey: SURVEY,
  application: APPLICATION,
  match: MATCH,
  cohort: COHORT,
  employee: EMPLOYEE,
};

// Guessing order when `kind` is omitted (first hit wins)
const GUESS: Record<string, Def>[] = [MONTHLY, SESSION, APPLICATION, MATCH, SURVEY, COHORT, EMPLOYEE];

export function statusDef(status: string, kind?: StatusKind): Def {
  const table = kind ? BY_KIND[kind] : undefined;
  return table?.[status] ?? GUESS.find((t) => t[status])?.[status] ?? { label: status.replace(/_/g, ' '), tone: 'neutral' };
}

export interface StatusBadgeProps {
  status: AnyStatus;
  /** Disambiguates shared values (e.g. match `completed` vs session `completed`, survey vs application `draft`) */
  kind?: StatusKind;
  /** Override the label (e.g. employee-facing "Upcoming") */
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Status pill with dot + soft colour for every status union in the domain. */
export function StatusBadge({ status, kind, label, size, className }: StatusBadgeProps) {
  const d = statusDef(status, kind);
  return (
    <Badge tone={d.tone} dot size={size} className={className}>
      {label ?? d.label}
    </Badge>
  );
}

/** Hex colours for charts — same semantics as the pills. */
export const MONTHLY_STATUS_COLORS: Record<MonthlyStatus, string> = {
  completed: '#16A34A',
  scheduled: '#2F56E8',
  to_be_scheduled: '#E9A23B',
  missed: '#DC2626',
};
