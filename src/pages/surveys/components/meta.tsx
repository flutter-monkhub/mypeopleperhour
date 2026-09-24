// Display metadata for surveys: kinds, question types (icon + copy), audience/due labels, small badges.

import {
  Activity,
  AlignLeft,
  CircleDot,
  ClipboardList,
  Eye,
  Gauge,
  HeartHandshake,
  ListChecks,
  Lock,
  Smile,
  Star,
  ThumbsUp,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react';
import type { DemoDatabase, QuestionType, Survey, SurveyKind } from '@shared/types';
import { QUESTION_TYPE_LABELS } from '@/lib/analytics-pulse';
import { formatDate, relativeDay } from '@/lib/format';
import { unitMap } from '@/lib/lookup';
import { Badge, type BadgeTone } from '@/components/ui';

export const KIND_META: Record<SurveyKind, { label: string; tone: BadgeTone; icon: LucideIcon; description: string }> = {
  pulse: { label: 'Pulse', tone: 'primary', icon: Activity, description: 'Quarterly pulse — tracked quarter on quarter in Pulse analysis' },
  mentoring: { label: 'Mentoring', tone: 'mentor', icon: HeartHandshake, description: 'Sent to active mentees of the mentoring programme' },
  adhoc: { label: 'Ad hoc', tone: 'neutral', icon: ClipboardList, description: 'One-off survey for a topic or event' },
};

export const TYPE_META: Record<QuestionType, { label: string; icon: LucideIcon; description: string }> = {
  emoji: { label: QUESTION_TYPE_LABELS.emoji, icon: Smile, description: 'Five faces, very unhappy → very happy' },
  rating: { label: QUESTION_TYPE_LABELS.rating, icon: Star, description: 'One to five stars' },
  likert: { label: QUESTION_TYPE_LABELS.likert, icon: SlidersHorizontal, description: 'Strongly disagree → strongly agree' },
  nps: { label: QUESTION_TYPE_LABELS.nps, icon: Gauge, description: 'How likely to recommend, 0–10' },
  single_choice: { label: QUESTION_TYPE_LABELS.single_choice, icon: CircleDot, description: 'Pick one option' },
  multi_choice: { label: QUESTION_TYPE_LABELS.multi_choice, icon: ListChecks, description: 'Pick several, with an optional limit' },
  yes_no: { label: QUESTION_TYPE_LABELS.yes_no, icon: ThumbsUp, description: 'A simple yes or no' },
  text: { label: QUESTION_TYPE_LABELS.text, icon: AlignLeft, description: 'Open comment, up to 500 characters' },
};

export const QUESTION_TYPES: readonly QuestionType[] = ['emoji', 'rating', 'likert', 'nps', 'single_choice', 'multi_choice', 'yes_no', 'text'];

/** "All units" · "Durgapur, Palej" · "Active mentees · all units" */
export function audienceLabel(db: Pick<DemoDatabase, 'units'>, s: Pick<Survey, 'audienceUnitIds' | 'kind'>, short = false): string {
  const units = unitMap(db);
  const where = s.audienceUnitIds.length
    ? s.audienceUnitIds.length > 2 && short
      ? `${s.audienceUnitIds.length} units`
      : s.audienceUnitIds.map((id) => units.get(id)?.shortName ?? id).join(', ')
    : 'All units';
  if (s.kind !== 'mentoring') return where;
  return s.audienceUnitIds.length ? `Active mentees · ${where}` : 'Active mentees';
}

/** "Due 30 Sep 2026 · in 6 days" / "Closed 30 Jun 2026" / "Due 30 Sep 2026 · overdue" */
export function dueLabel(s: Pick<Survey, 'status' | 'dueDate' | 'closedAt'>, now = new Date()): string {
  if (s.status === 'closed') return `Closed ${formatDate(s.closedAt ?? s.dueDate)}`;
  const past = new Date(s.dueDate) < now;
  return `Due ${formatDate(s.dueDate)} · ${past ? 'past due' : relativeDay(s.dueDate, now)}`;
}

export function KindBadge({ kind, size }: { kind: SurveyKind; size?: 'sm' | 'md' }) {
  const m = KIND_META[kind];
  return (
    <Badge tone={m.tone} icon={m.icon} size={size}>
      {m.label}
    </Badge>
  );
}

export function AnonymityBadge({ anonymous, size }: { anonymous: boolean; size?: 'sm' | 'md' }) {
  return anonymous ? (
    <Badge tone="outline" icon={Lock} size={size} title="Responses are reported only in aggregate — names are never shown">
      Anonymous
    </Badge>
  ) : (
    <Badge tone="outline" icon={Eye} size={size} title="Admins can see who responded">
      Named
    </Badge>
  );
}

/** yyyy-mm-dd (local) for <input type="date"> */
export const toDateInput = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
