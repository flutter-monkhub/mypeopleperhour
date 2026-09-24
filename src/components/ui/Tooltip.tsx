import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Lightweight CSS tooltip (hover/focus). For long content use a Popover. */
export function Tooltip({ content, side = 'top', className, children }: { content: ReactNode; side?: 'top' | 'bottom'; className?: string; children: ReactNode }) {
  return (
    <span className={cn('group/tip relative inline-flex', className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute left-1/2 z-[90] w-max max-w-64 -translate-x-1/2 rounded-md bg-navy px-2.5 py-1.5 text-xs leading-snug font-medium text-white opacity-0 shadow-pop transition-opacity duration-150 group-focus-within/tip:opacity-100 group-hover/tip:opacity-100',
          side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
        )}
      >
        {content}
      </span>
    </span>
  );
}
