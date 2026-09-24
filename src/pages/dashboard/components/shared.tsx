// Small building blocks shared by the dashboard, sessions and employee pages.

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { formatPercent } from '@/lib/format';
import { COMPLETION_TARGET } from '@/lib/analytics-outcomes';

/** Tone for a completion rate: on target / healthy / needs attention. */
export const rateTone = (rate: number, total = 1): 'success' | 'primary' | 'warning' | 'neutral' =>
  !total ? 'neutral' : rate >= COMPLETION_TARGET ? 'success' : rate >= 0.7 ? 'primary' : 'warning';

const BAR = { success: 'bg-success', primary: 'bg-primary', warning: 'bg-warning', neutral: 'bg-neutral' } as const;

/** Completion % with a slim inline bar (tables). */
export function RateCell({ rate, total, compact, className }: { rate: number; total: number; compact?: boolean; className?: string }) {
  const tone = rateTone(rate, total);
  return (
    <span className={cn('flex items-center gap-2.5', compact ? 'min-w-20' : 'min-w-28', className)}>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#EDF0F6]" aria-hidden>
        <span className={cn('block h-full rounded-full', BAR[tone])} style={{ width: `${Math.round(rate * 100)}%` }} />
      </span>
      <span className="w-10 text-right font-semibold text-ink tabular">{total ? formatPercent(rate) : '—'}</span>
    </span>
  );
}

/** Tiny labelled number used inside cards ("Pairs 248"). */
export function MiniStat({ label, value, hint, className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="truncate text-xs font-medium text-ink-2">{label}</p>
      <p className="mt-0.5 text-lg leading-7 font-bold text-ink">{value}</p>
      {hint && <p className="truncate text-xs text-ink-2">{hint}</p>}
    </div>
  );
}

/** Section title between card rows. */
export function SectionTitle({ title, subtitle, actions, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('mt-8 mb-4 flex flex-wrap items-end justify-between gap-3', className)}>
      <div>
        <h2 className="text-lg leading-7 font-bold text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

/** Query string that carries the dashboard's local filters to other pages. */
export function carryQuery(params: Record<string, string | null | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : '';
}
