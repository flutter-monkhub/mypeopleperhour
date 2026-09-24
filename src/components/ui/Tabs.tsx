import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface TabItem<T extends string = string> {
  id: T;
  label: ReactNode;
  icon?: LucideIcon;
  count?: number;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** underline (page sections) · pills (filters) · segmented (compact toggles) */
  variant?: 'underline' | 'pills' | 'segmented';
  className?: string;
  /** Right side slot on the tab row */
  aside?: ReactNode;
}

/** Tab strip (controlled). Sync `value` with `?tab=` via useSearchParams when the tab should be linkable. */
export function Tabs<T extends string = string>({ tabs, value, onChange, variant = 'underline', className, aside }: TabsProps<T>) {
  return (
    <div className={cn('flex items-center gap-3', variant === 'underline' && 'border-b border-line', className)}>
      <div
        role="tablist"
        className={cn(
          'scrollbar-thin flex min-w-0 flex-1 overflow-x-auto',
          variant === 'underline' && 'gap-6',
          variant === 'pills' && 'gap-2',
          variant === 'segmented' && 'inline-flex flex-none gap-1 rounded-lg bg-neutral-soft p-1',
        )}
      >
        {tabs.map((t) => {
          const active = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              disabled={t.disabled}
              onClick={() => onChange(t.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 text-sm font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                variant === 'underline' && ['-mb-px border-b-2 px-0.5 pt-1 pb-3', active ? 'border-primary text-primary' : 'border-transparent text-ink-2 hover:border-line-strong hover:text-ink'],
                variant === 'pills' && ['h-8.5 rounded-full border px-3.5', active ? 'border-primary bg-primary-soft text-primary' : 'border-line-strong bg-white text-ink-2 hover:text-ink'],
                variant === 'segmented' && ['h-8 rounded-md px-3', active ? 'bg-white text-ink shadow-[0_1px_2px_rgba(15,23,42,.08)]' : 'text-ink-2 hover:text-ink'],
              )}
            >
              {t.icon && <t.icon className="size-4" />}
              {t.label}
              {t.count != null && (
                <span className={cn('rounded-full px-1.5 py-px text-[11px] font-semibold tabular', active ? 'bg-primary text-white' : 'bg-neutral-soft text-ink-2')}>{t.count}</span>
              )}
            </button>
          );
        })}
      </div>
      {aside && <div className="flex shrink-0 items-center gap-2 pb-2">{aside}</div>}
    </div>
  );
}
