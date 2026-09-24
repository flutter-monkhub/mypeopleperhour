import type { ReactNode } from 'react';
import { CircleAlert, Inbox, RotateCcw, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  message?: ReactNode;
  /** Button(s) */
  action?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Dashed outline box */
  bordered?: boolean;
  tone?: 'primary' | 'mentor' | 'neutral';
  className?: string;
}

const TONES = { primary: 'bg-primary-soft text-primary', mentor: 'bg-mentor-soft text-mentor', neutral: 'bg-neutral-soft text-neutral' } as const;

/** "Nothing here yet" block for tables, lists and placeholder pages. */
export function EmptyState({ icon: Icon = Inbox, title, message, action, size = 'md', bordered, tone = 'primary', className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        size === 'sm' ? 'gap-2 px-4 py-8' : size === 'lg' ? 'gap-3 px-6 py-20' : 'gap-3 px-6 py-12',
        bordered && 'rounded-card border border-dashed border-line-strong bg-white/60',
        className,
      )}
    >
      <span className={cn('relative grid place-items-center rounded-2xl', size === 'sm' ? 'size-10' : 'size-14', TONES[tone])}>
        <Icon className={size === 'sm' ? 'size-5' : 'size-6.5'} strokeWidth={1.8} />
      </span>
      <div className="max-w-md">
        <p className={cn('font-semibold text-ink', size === 'lg' ? 'text-lg' : 'text-[15px]')}>{title}</p>
        {message && <p className="mt-1 text-sm leading-relaxed text-ink-2">{message}</p>}
      </div>
      {action && <div className="mt-1 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Error block with optional retry. */
export function ErrorState({ title = 'Something went wrong', message = 'We couldn’t load this data. Please try again.', onRetry, className }: { title?: ReactNode; message?: ReactNode; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 px-6 py-12 text-center', className)} role="alert">
      <span className="grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger">
        <CircleAlert className="size-6.5" strokeWidth={1.8} />
      </span>
      <div className="max-w-md">
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        <p className="mt-1 text-sm text-ink-2">{message}</p>
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RotateCcw} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
