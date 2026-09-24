// 1–5 segmented score for one scored matching criterion (Clarity of purpose, Career reflection, Mentor fit).

import type { ApplicationScores } from '@shared/types';
import { MATCHING_CRITERIA } from '@shared/content/mentoring';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui';

export const SCORE_LABELS = ['', 'Weak', 'Limited', 'Adequate', 'Strong', 'Excellent'] as const;
export const SCORED_CRITERIA = MATCHING_CRITERIA.filter((c) => c.kind === 'score') as unknown as {
  id: keyof ApplicationScores;
  criterion: string;
  weightage: string;
  rule: string;
}[];

export interface ScoreInputProps {
  id: keyof ApplicationScores;
  value: number | null;
  onChange?: (v: number) => void;
  readOnly?: boolean;
  compact?: boolean;
}

export function ScoreInput({ id, value, onChange, readOnly, compact }: ScoreInputProps) {
  const c = SCORED_CRITERIA.find((x) => x.id === id)!;
  return (
    <div>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold text-ink">
            {c.criterion}
            <Badge tone="mentor" size="sm">
              {c.weightage}
            </Badge>
          </p>
          {!compact && <p className="mt-0.5 text-xs text-ink-2">{c.rule}</p>}
        </div>
        <span className={cn('shrink-0 text-xs font-medium tabular', value ? 'text-mentor' : 'text-muted')}>{value ? `${value} · ${SCORE_LABELS[value]}` : 'Not scored'}</span>
      </div>
      <div role="radiogroup" aria-label={c.criterion} className="grid grid-cols-5 gap-1 rounded-lg bg-neutral-soft p-1">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${n} — ${SCORE_LABELS[n]}`}
              title={SCORE_LABELS[n]}
              disabled={readOnly}
              onClick={() => onChange?.(n)}
              className={cn(
                'h-7 rounded-md text-[13px] font-semibold tabular transition-colors disabled:cursor-default',
                on ? 'bg-mentor text-white shadow-[0_1px_2px_rgba(126,55,148,.35)]' : value != null && n < value ? 'bg-mentor-soft text-mentor' : 'text-ink-2',
                !readOnly && !on && 'hover:bg-white hover:text-ink',
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
