import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDelta } from '@/lib/format';
import { Skeleton } from './Skeleton';

export type KpiTone = 'primary' | 'success' | 'warning' | 'danger' | 'mentor' | 'neutral' | 'info';

const TONES: Record<KpiTone, string> = {
  primary: 'bg-primary-soft text-primary',
  info: 'bg-info-soft text-info',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  mentor: 'bg-mentor-soft text-mentor',
  neutral: 'bg-neutral-soft text-neutral',
};

export interface KpiDelta {
  /** Signed change, e.g. +4 (points) or -2 (sessions) */
  value: number;
  /** Suffix after the number: " pts", "%", "" */
  suffix?: string;
  /** Comparison caption: "vs Aug" */
  label?: string;
  /** Which direction is good (colours the chip). Default 'up'. */
  goodWhen?: 'up' | 'down' | 'neutral';
  digits?: number;
}

export interface KpiCardProps {
  label: ReactNode;
  value: ReactNode;
  icon?: LucideIcon;
  tone?: KpiTone;
  /** Colour the value with the tone (e.g. red "1 missed") */
  toneValue?: boolean;
  delta?: KpiDelta;
  /** Small caption under the value ("6 of 9 pairs") */
  hint?: ReactNode;
  /** Makes the whole card a link, with a "View details →" footer if `linkLabel` */
  to?: string;
  linkLabel?: string;
  onClick?: () => void;
  loading?: boolean;
  /** Extra content on the right (sparkline, ring) */
  aside?: ReactNode;
  className?: string;
}

export function DeltaChip({ value, suffix = '', label, goodWhen = 'up', digits = 0 }: KpiDelta) {
  const flat = Math.abs(value) < 10 ** -(digits + 1) || Number(Math.abs(value).toFixed(digits)) === 0;
  const good = goodWhen === 'neutral' ? null : goodWhen === 'up' ? value > 0 : value < 0;
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular',
          flat || good === null ? 'bg-neutral-soft text-neutral' : good ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
        )}
      >
        <Icon className="size-3" strokeWidth={2.5} />
        {formatDelta(value, suffix, digits)}
      </span>
      {label && <span className="text-ink-2">{label}</span>}
    </span>
  );
}

/** KPI tile: tone icon, label, big value, optional delta chip / hint / link. */
export function KpiCard({ label, value, icon: Icon, tone = 'primary', toneValue, delta, hint, to, linkLabel, onClick, loading, aside, className }: KpiCardProps) {
  const body = (
    <>
      <div className="flex items-start gap-3">
        {Icon && (
          <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', TONES[tone])}>
            <Icon className="size-5" strokeWidth={2} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-ink-2">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-20" />
          ) : (
            <p className={cn('mt-1 text-[26px] leading-8 font-bold tracking-tight tabular', toneValue ? TONES[tone].split(' ')[1] : 'text-ink')}>{value}</p>
          )}
          {!loading && (delta || hint) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-2">
              {delta && <DeltaChip {...delta} />}
              {hint && <span>{hint}</span>}
            </div>
          )}
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {to && linkLabel && (
        <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-primary">
          {linkLabel} <ArrowRight className="size-3.5" />
        </span>
      )}
    </>
  );
  const cls = cn(
    'block rounded-card border border-line bg-surface p-5 text-left shadow-card',
    (to || onClick) && 'transition-[box-shadow,border-color] duration-150 hover:border-line-strong hover:shadow-pop',
    className,
  );
  if (to)
    return (
      <Link to={to} className={cls}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cn(cls, 'w-full')}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}
