// Vertical status history (applications + matches). Newest last, like a story.

import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { formatDateTime, timeAgo } from '@/lib/format';
import type { BadgeTone } from '@/components/ui';

export interface TimelineItem {
  key: string;
  at: string;
  title: ReactNode;
  by?: string;
  note?: ReactNode;
  tone?: BadgeTone;
}

const DOT: Partial<Record<BadgeTone, string>> = {
  success: 'bg-success ring-success-soft',
  danger: 'bg-danger ring-danger-soft',
  warning: 'bg-warning ring-warning-soft',
  info: 'bg-info ring-info-soft',
  mentor: 'bg-mentor ring-mentor-soft',
  primary: 'bg-primary ring-primary-soft',
  neutral: 'bg-neutral ring-neutral-soft',
};

export function StatusTimeline({ items, className, dense }: { items: TimelineItem[]; className?: string; dense?: boolean }) {
  return (
    <ol className={cn('relative', className)}>
      {items.map((it, i) => (
        <li key={it.key} className={cn('relative flex gap-3', i < items.length - 1 && (dense ? 'pb-3' : 'pb-4'))}>
          {i < items.length - 1 && <span className="absolute top-4 bottom-0 left-[5px] w-px bg-line" aria-hidden />}
          <span className={cn('relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4', DOT[it.tone ?? 'neutral'] ?? DOT.neutral)} aria-hidden />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-[13px] font-semibold text-ink">{it.title}</p>
              <time dateTime={it.at} title={formatDateTime(it.at)} className="text-xs text-muted tabular">
                {timeAgo(it.at)}
              </time>
            </div>
            {it.by && <p className="text-xs text-ink-2">by {it.by}</p>}
            {it.note && <p className="mt-1 rounded-md bg-canvas px-2.5 py-1.5 text-xs leading-relaxed text-ink-2">{it.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
