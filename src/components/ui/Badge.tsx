import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'mentor' | 'navy' | 'outline';

export const BADGE_TONES: Record<BadgeTone, { pill: string; dot: string }> = {
  neutral: { pill: 'bg-neutral-soft text-neutral', dot: 'bg-neutral' },
  primary: { pill: 'bg-primary-soft text-primary', dot: 'bg-primary' },
  info: { pill: 'bg-info-soft text-info', dot: 'bg-info' },
  success: { pill: 'bg-success-soft text-success', dot: 'bg-success' },
  warning: { pill: 'bg-warning-soft text-warning', dot: 'bg-warning' },
  danger: { pill: 'bg-danger-soft text-danger', dot: 'bg-danger' },
  mentor: { pill: 'bg-mentor-soft text-mentor', dot: 'bg-mentor' },
  navy: { pill: 'bg-navy text-white', dot: 'bg-white' },
  outline: { pill: 'bg-white text-ink-2 ring-1 ring-inset ring-line-strong', dot: 'bg-muted' },
};

export interface BadgeProps {
  tone?: BadgeTone;
  /** Leading coloured dot (status pills) */
  dot?: boolean;
  icon?: LucideIcon;
  size?: 'sm' | 'md';
  className?: string;
  title?: string;
  children: ReactNode;
}

/** Soft coloured pill. */
export function Badge({ tone = 'neutral', dot, icon: Icon, size = 'md', className, title, children }: BadgeProps) {
  const t = BADGE_TONES[tone];
  return (
    <span
      title={title}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'h-5 px-2 text-[11px]' : 'h-6 px-2.5 text-xs',
        t.pill,
        className,
      )}
    >
      {dot && <span className={cn('size-1.5 shrink-0 rounded-full', t.dot)} aria-hidden />}
      {Icon && <Icon className="size-3.5 shrink-0" strokeWidth={2.2} aria-hidden />}
      <span className="truncate">{children}</span>
    </span>
  );
}

/** Small numeric counter (nav items, tabs). */
export function CountBadge({ count, tone = 'neutral', className }: { count: number; tone?: BadgeTone; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular', BADGE_TONES[tone].pill, className)}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
