import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export type CalloutTone = 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'mentor';

const TONES: Record<CalloutTone, { box: string; icon: string; Icon: LucideIcon }> = {
  info: { box: 'border-primary/20 bg-primary-soft/70', icon: 'text-primary', Icon: Info },
  success: { box: 'border-success/20 bg-success-soft/80', icon: 'text-success', Icon: CircleCheck },
  warning: { box: 'border-warning/25 bg-warning-soft', icon: 'text-warning', Icon: TriangleAlert },
  danger: { box: 'border-danger/20 bg-danger-soft/80', icon: 'text-danger', Icon: CircleAlert },
  neutral: { box: 'border-line bg-neutral-soft/70', icon: 'text-neutral', Icon: Info },
  mentor: { box: 'border-mentor/20 bg-mentor-soft/80', icon: 'text-mentor', Icon: Info },
};

export interface CalloutProps {
  tone?: CalloutTone;
  /** Defaults to the tone's icon */
  icon?: LucideIcon;
  title?: ReactNode;
  children?: ReactNode;
  /** Right-aligned button(s) */
  action?: ReactNode;
  className?: string;
}

/** Inline notice / banner (read-only state, locked content, scope or privacy notes). */
export function Callout({ tone = 'info', icon, title, children, action, className }: CalloutProps) {
  const t = TONES[tone];
  const Icon = icon ?? t.Icon;
  return (
    <div className={cn('flex flex-col gap-3 rounded-card border px-4 py-3 sm:flex-row sm:items-center', t.box, className)} role={tone === 'danger' ? 'alert' : 'note'}>
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <Icon className={cn('mt-0.5 size-4.5 shrink-0', t.icon)} strokeWidth={2} />
        <div className="min-w-0 text-[13px] leading-5 text-ink-2">
          {title && <p className="font-semibold text-ink">{title}</p>}
          {children && <div className={cn(title && 'mt-0.5')}>{children}</div>}
        </div>
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2 pl-7.5 sm:pl-0">{action}</div>}
    </div>
  );
}
