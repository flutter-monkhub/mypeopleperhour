import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'mentor' | 'neutral';

const BAR: Record<Tone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  mentor: 'bg-mentor',
  neutral: 'bg-neutral',
};
const STROKE: Record<Tone, string> = {
  primary: '#2F56E8',
  success: '#16A34A',
  warning: '#E07B00',
  danger: '#DC2626',
  mentor: '#7E3794',
  neutral: '#64748B',
};

export interface ProgressBarProps {
  /** 0 – max (default max 100) */
  value: number;
  max?: number;
  tone?: Tone;
  size?: 'xs' | 'sm' | 'md';
  /** Label above the bar (left) */
  label?: ReactNode;
  /** Show the percentage (right of the label) */
  showValue?: boolean;
  /** Custom value text instead of the percentage, e.g. "3 of 5" */
  valueLabel?: ReactNode;
  className?: string;
}

export function ProgressBar({ value, max = 100, tone = 'primary', size = 'sm', label, showValue, valueLabel, className }: ProgressBarProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={cn('w-full', className)}>
      {(label || showValue || valueLabel) && (
        <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
          <span className="text-ink-2">{label}</span>
          <span className="font-semibold text-ink tabular">{valueLabel ?? `${Math.round(pct)}%`}</span>
        </div>
      )}
      <div
        className={cn('w-full overflow-hidden rounded-full bg-[#EDF0F6]', size === 'xs' ? 'h-1' : size === 'sm' ? 'h-1.5' : 'h-2.5')}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn('h-full rounded-full transition-[width] duration-500', BAR[tone])} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export interface ProgressRingProps {
  /** 0 – 100 */
  value: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
  /** Center content (defaults to the rounded percentage) */
  children?: ReactNode;
  className?: string;
}

/** Donut-style completion ring (like the reference "Completion overview"). */
export function ProgressRing({ value, size = 120, stroke = 12, tone = 'primary', children, className }: ProgressRingProps) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('relative inline-grid shrink-0 place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EDF0F6" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={STROKE[tone]}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children ?? <span className="text-xl font-bold text-ink tabular">{Math.round(pct)}%</span>}</div>
    </div>
  );
}
