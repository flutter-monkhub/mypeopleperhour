// Rule 11 capacity meter: one slot per mentee (3–5). Active = solid, accepted = strong tint,
// proposed = hatched, free = grey. `preview` outlines the slot a new proposal would take.

import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import type { MentorLoad } from '@/lib/analytics-mentoring';

export interface CapacityMeterProps {
  load: MentorLoad;
  size?: 'sm' | 'md';
  /** Show "3 of 5" (+ Full) next to / above the slots */
  label?: 'inline' | 'top' | false;
  /** Outline the next free slot (a proposal being considered) */
  preview?: boolean;
  className?: string;
}

const HATCH = 'repeating-linear-gradient(135deg, rgba(126,55,148,.55) 0 3px, rgba(126,55,148,.18) 3px 6px)';

export function CapacityMeter({ load, size = 'md', label = 'inline', preview, className }: CapacityMeterProps) {
  const slots = Array.from({ length: load.capacity }, (_, i) =>
    i < load.active ? 'active' : i < load.active + load.accepted ? 'accepted' : i < load.occupied ? 'proposed' : 'free',
  );
  // Over-capacity (e.g. capacity was lowered after proposals) — show the overflow in red
  const overflow = Math.max(0, load.occupied - load.capacity);
  const previewIndex = preview && !load.atCapacity ? load.occupied : -1;
  const text = (
    <span className={cn('shrink-0 tabular', size === 'sm' ? 'text-xs' : 'text-[13px]', load.atCapacity ? 'font-semibold text-danger' : 'text-ink-2')}>
      <span className={cn('font-semibold', load.atCapacity ? 'text-danger' : 'text-ink')}>{load.occupied}</span> of {load.capacity}
      {load.atCapacity && <span className="ml-1 font-semibold">· Full</span>}
    </span>
  );
  const bar = (
    <span
      className="flex min-w-0 flex-1 gap-[3px]"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={load.capacity}
      aria-valuenow={load.occupied}
      aria-label={`${load.occupied} of ${load.capacity} slots used: ${load.active} active, ${load.accepted} accepted, ${load.proposed} proposed`}
    >
      {slots.map((s, i) => (
        <span
          key={i}
          className={cn(
            'min-w-3 flex-1 rounded-[3px]',
            size === 'sm' ? 'h-1.5' : 'h-2',
            s === 'active' && 'bg-mentor',
            s === 'accepted' && 'bg-[#B57CC7]',
            s === 'free' && (i === previewIndex ? 'bg-success-soft ring-[1.5px] ring-success ring-inset' : 'bg-[#E8EBF2]'),
          )}
          style={s === 'proposed' ? { background: HATCH } : undefined}
        />
      ))}
      {Array.from({ length: overflow }, (_, i) => (
        <span key={`o${i}`} className={cn('min-w-3 flex-1 rounded-[3px] bg-danger', size === 'sm' ? 'h-1.5' : 'h-2')} />
      ))}
    </span>
  );
  if (label === 'top')
    return (
      <div className={cn('flex flex-col gap-1.5', className)}>
        <div className="flex items-center justify-between gap-2 text-xs text-ink-2">
          <span>Capacity</span>
          {text}
        </div>
        {bar}
      </div>
    );
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {bar}
      {label === 'inline' && text}
    </div>
  );
}

/** Legend for the meter segments. */
export function CapacityLegend({ className }: { className?: string }) {
  const item = (cls: string, text: string, style?: CSSProperties) => (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('h-2 w-3.5 rounded-[3px]', cls)} style={style} />
      {text}
    </span>
  );
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-ink-2', className)}>
      {item('bg-mentor', 'Active')}
      {item('bg-[#B57CC7]', 'Accepted')}
      {item('', 'Proposed', { background: HATCH })}
      {item('bg-[#E8EBF2]', 'Free')}
    </div>
  );
}
