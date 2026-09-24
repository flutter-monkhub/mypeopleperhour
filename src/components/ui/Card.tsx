import type { ComponentProps, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

const PADDING = { none: '', sm: 'p-4', md: 'p-5', lg: 'p-6' } as const;

export interface CardProps extends ComponentProps<'div'> {
  /** Inner padding (default md = 20px). Use `none` for cards wrapping a DataTable. */
  padding?: keyof typeof PADDING;
  /** Hover lift for clickable cards */
  interactive?: boolean;
}

/** White surface card: 1px hairline border, 12px radius, soft shadow. */
export function Card({ padding = 'md', interactive, className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-card border border-line bg-surface shadow-card',
        PADDING[padding],
        interactive && 'cursor-pointer transition-[box-shadow,border-color,transform] duration-150 hover:-translate-y-px hover:border-line-strong hover:shadow-pop',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Small icon tile before the title */
  icon?: LucideIcon;
  iconTone?: 'primary' | 'mentor' | 'success' | 'warning' | 'danger' | 'neutral';
  /** Right-aligned actions (buttons, links, selects) */
  actions?: ReactNode;
  /** Bottom border + padding — use inside `padding="none"` cards */
  divider?: boolean;
  className?: string;
}

const ICON_TONES = {
  primary: 'bg-primary-soft text-primary',
  mentor: 'bg-mentor-soft text-mentor',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-neutral-soft text-neutral',
} as const;

/** Card title row: 15/600 title, optional subtitle, icon and actions. */
export function CardHeader({ title, subtitle, icon: Icon, iconTone = 'primary', actions, divider, className }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start gap-3', divider ? 'border-b border-line px-5 py-4' : 'mb-4', className)}>
      {Icon && (
        <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg', ICON_TONES[iconTone])}>
          <Icon className="size-4" strokeWidth={2} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] leading-6 font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] leading-5 text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Footer strip with a top divider (e.g. "View all →" links). */
export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex items-center justify-center gap-2 border-t border-line px-5 py-3 text-sm', className)}>{children}</div>;
}
