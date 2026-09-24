import type { ReactNode } from 'react';
import { ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { SelectOption } from './Select';

export interface FilterBarProps {
  children: ReactNode;
  /** Shows a "Reset" button when > 0 */
  activeCount?: number;
  onReset?: () => void;
  /** Right-aligned slot (export button, view toggle) */
  actions?: ReactNode;
  /** Hide the "Filters" label */
  hideLabel?: boolean;
  className?: string;
}

/** One row of filters above tables/charts (wraps on small screens). */
export function FilterBar({ children, activeCount = 0, onReset, actions, hideLabel, className }: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2.5 rounded-card border border-line bg-white px-4 py-3 shadow-card', className)}>
      {!hideLabel && (
        <span className="mr-1 inline-flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <SlidersHorizontal className="size-4 text-ink-2" /> Filters
        </span>
      )}
      {children}
      {activeCount > 0 && onReset && (
        <button type="button" onClick={onReset} className="inline-flex h-8.5 items-center gap-1.5 rounded-btn px-2.5 text-[13px] font-medium text-primary hover:bg-primary-soft">
          <RotateCcw className="size-3.5" /> Reset{activeCount > 1 ? ` (${activeCount})` : ''}
        </button>
      )}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export interface FilterSelectProps {
  /** Inline label shown inside the control ("Unit") */
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly SelectOption[];
  /** Label of the "no filter" option (value ""), default "All". Pass `null` to force a choice. */
  allLabel?: string | null;
  disabled?: boolean;
  className?: string;
}

/** Compact select for FilterBar: "Unit: All units ▾". Active filters are tinted. */
export function FilterSelect({ label, value, onChange, options, allLabel = 'All', disabled, className }: FilterSelectProps) {
  const active = value !== '' && allLabel != null;
  return (
    <label
      className={cn(
        'relative inline-flex h-8.5 max-w-full items-center rounded-btn border pr-8 pl-3 text-[13px] transition-colors',
        active ? 'border-primary/40 bg-primary-soft text-primary' : 'border-line-strong bg-white text-ink hover:border-[#c3cbdc]',
        disabled && 'opacity-60',
        className,
      )}
    >
      <span className={cn('mr-1 shrink-0', active ? 'text-primary/80' : 'text-ink-2')}>{label}:</span>
      <span className="truncate font-medium">{options.find((o) => o.value === value)?.label ?? allLabel ?? ''}</span>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-3.5 opacity-70" />
      <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label={label}>
        {allLabel != null && <option value="">{allLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
