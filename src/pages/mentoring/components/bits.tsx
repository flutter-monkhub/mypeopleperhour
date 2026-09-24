// Small presentational pieces used across the mentoring pages.

import type { ReactNode } from 'react';
import { ArrowRight, Eye, Star } from 'lucide-react';
import type { AnchorConversation, MentorStyle } from '@shared/types';
import { MENTORING_NAME, MENTOR_ROLES } from '@shared/content/mentoring';
import { cn } from '@/lib/cn';
import { ANCHORS, PAIR_HEALTH_META, SCORE_MAX, anchorGuide, type AnchorState, type PairHealth } from '@/lib/analytics-mentoring';
import { Badge } from '@/components/ui';

/** PageHeader eyebrow in the mentoring accent. */
export function MentoringEyebrow({ children = MENTORING_NAME }: { children?: ReactNode }) {
  return <span className="text-mentor">{children}</span>;
}

/** "View only" chip for roles without mentoring.edit (leadership). */
export function ViewOnlyBadge() {
  return (
    <Badge tone="outline" icon={Eye} title="Your role can view mentoring data but not change it">
      View only
    </Badge>
  );
}

const ANCHOR_STATE_LABEL: Record<AnchorState, string> = { completed: 'completed', scheduled: 'scheduled', none: 'not yet scheduled' };

/** Conversation 1 · 2 · 3 progress dots (+ additional touchpoints). */
export function AnchorDots({
  anchors,
  extra = 0,
  size = 'md',
  className,
}: {
  anchors: Record<AnchorConversation, AnchorState>;
  extra?: number;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const dot = size === 'sm' ? 'size-5 text-[10px]' : 'size-6 text-[11px]';
  return (
    <span className={cn('inline-flex items-center', className)} aria-label={ANCHORS.map((a) => `Conversation ${a} ${ANCHOR_STATE_LABEL[anchors[a]]}`).join(', ')}>
      {ANCHORS.map((a, i) => {
        const st = anchors[a];
        return (
          <span key={a} className="inline-flex items-center">
            {i > 0 && <span className={cn('h-px w-2', anchors[a] === 'completed' ? 'bg-mentor/60' : 'bg-line-strong')} aria-hidden />}
            <span
              title={`Conversation ${a} · ${anchorGuide(a).title} — ${ANCHOR_STATE_LABEL[st]}`}
              className={cn(
                'grid shrink-0 place-items-center rounded-full font-semibold tabular',
                dot,
                st === 'completed' && 'bg-mentor text-white',
                st === 'scheduled' && 'border-[1.5px] border-dashed border-mentor bg-mentor-soft text-mentor',
                st === 'none' && 'border border-line-strong bg-white text-muted',
              )}
            >
              {a}
            </span>
          </span>
        );
      })}
      {extra > 0 && (
        <span
          className="ml-1.5 rounded-full bg-mentor-soft px-1.5 py-px text-[11px] font-semibold text-mentor tabular"
          title={`${extra} additional touchpoint${extra > 1 ? 's' : ''}`}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

/** ★ 4.6 (compact) — or five stars when `full`. */
export function Rating({ value, count, full, className }: { value: number | null | undefined; count?: number; full?: boolean; className?: string }) {
  if (value == null) return <span className={cn('text-muted', className)}>—</span>;
  if (full)
    return (
      <span className={cn('inline-flex items-center gap-0.5', className)} aria-label={`${value} out of 5`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={cn('size-3.5', i <= Math.round(value) ? 'fill-[#F5A524] text-[#F5A524]' : 'fill-[#E5E9F2] text-[#E5E9F2]')} />
        ))}
      </span>
    );
  return (
    <span
      className={cn('inline-flex items-center gap-1 tabular', className)}
      title={count != null ? `${value.toFixed(1)} from ${count} rating${count === 1 ? '' : 's'}` : undefined}
    >
      <Star className="size-3.5 fill-[#F5A524] text-[#F5A524]" aria-hidden />
      <span className="font-semibold text-ink">{value.toFixed(1)}</span>
      {count != null && <span className="text-xs text-muted">({count})</span>}
    </span>
  );
}

const ROLE = new Map(MENTOR_ROLES.map((r) => [r.id, r]));
export const styleTitle = (s: MentorStyle) => ROLE.get(s)?.title ?? s;

/** Mentor proposition roles as soft chips. */
export function StyleChips({ styles, max, size = 'sm' }: { styles: MentorStyle[]; max?: number; size?: 'sm' | 'md' }) {
  const shown = max ? styles.slice(0, max) : styles;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {shown.map((s) => (
        <Badge key={s} tone="mentor" size={size} title={ROLE.get(s)?.body}>
          {styleTitle(s)}
        </Badge>
      ))}
      {max && styles.length > max && (
        <Badge tone="outline" size={size}>
          +{styles.length - max}
        </Badge>
      )}
    </span>
  );
}

/** Mentee function → mentor function (cross-functional exposure at a glance). */
export function FunctionPair({ from, to, className }: { from: string; to: string; className?: string }) {
  return (
    <span className={cn('flex min-w-0 flex-col text-xs leading-5', className)}>
      <span className="truncate text-ink">{from}</span>
      <span className="inline-flex min-w-0 items-center gap-1 text-ink-2">
        <ArrowRight className="size-3 shrink-0 text-mentor" aria-hidden />
        <span className="truncate">{to}</span>
      </span>
    </span>
  );
}

export function PairHealthBadge({ health, note, size }: { health: PairHealth; note?: string; size?: 'sm' | 'md' }) {
  const m = PAIR_HEALTH_META[health];
  return (
    <Badge tone={m.tone} dot size={size} title={note}>
      {m.label}
    </Badge>
  );
}

/** Soft section label used inside cards ("Preferred mentors", "Rule checks"). */
export function SectionLabel({ children, aside, className }: { children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-2 flex items-center justify-between gap-2', className)}>
      <p className="text-[11px] font-semibold tracking-[0.06em] text-ink-2 uppercase">{children}</p>
      {aside}
    </div>
  );
}

/** Application score (clarity + reflection + fit, max 15) with a mini bar. */
export function ScorePill({ score, className }: { score: number | null; className?: string }) {
  if (score == null) return <span className={cn('text-xs text-muted', className)}>Not scored</span>;
  const tone = score >= 12 ? 'text-success' : score >= 9 ? 'text-ink' : 'text-warning';
  return (
    <span className={cn('inline-flex items-center gap-2', className)} title={`${score} of ${SCORE_MAX} on clarity, reflection and fit`}>
      <span className={cn('font-semibold tabular', tone)}>
        {score}
        <span className="font-normal text-muted">/{SCORE_MAX}</span>
      </span>
      <span className="h-1.5 w-12 overflow-hidden rounded-full bg-[#EDF0F6]">
        <span className="block h-full rounded-full bg-mentor" style={{ width: `${(score / SCORE_MAX) * 100}%` }} />
      </span>
    </span>
  );
}
