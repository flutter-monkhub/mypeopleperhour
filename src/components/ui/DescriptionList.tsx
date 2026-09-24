import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface DescriptionItem {
  label: ReactNode;
  value: ReactNode;
  /** Span both columns */
  wide?: boolean;
}

/** Label/value grid for profile & detail panels. */
export function DescriptionList({ items, columns = 2, className }: { items: DescriptionItem[]; columns?: 1 | 2 | 3; className?: string }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-4', columns === 1 ? 'grid-cols-1' : columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {items.map((it, i) => (
        <div key={i} className={cn('min-w-0', it.wide && 'sm:col-span-full')}>
          <dt className="text-xs font-medium text-ink-2">{it.label}</dt>
          <dd className="mt-0.5 text-sm break-words text-ink">{it.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
