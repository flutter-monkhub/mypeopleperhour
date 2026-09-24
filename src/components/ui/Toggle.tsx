import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  /** Accessible name when there is no visible label */
  'aria-label'?: string;
}

/** Switch (role="switch"). */
export function Toggle({ checked, onChange, label, description, disabled, size = 'md', className, ...aria }: ToggleProps) {
  const id = useId();
  const track = size === 'sm' ? 'h-5 w-9' : 'h-6 w-11';
  const knob = size === 'sm' ? 'size-4 data-[on=true]:translate-x-4' : 'size-5 data-[on=true]:translate-x-5';
  return (
    <div className={cn('inline-flex items-start gap-3', className)}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={aria['aria-label']}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50',
          track,
          checked ? 'bg-primary' : 'bg-[#cfd6e4]',
        )}
      >
        <span data-on={checked} className={cn('rounded-full bg-white shadow-[0_1px_3px_rgba(15,23,42,.25)] transition-transform duration-200', knob)} />
      </button>
      {(label || description) && (
        <label htmlFor={id} className="min-w-0 cursor-pointer">
          {label && <span className="block text-sm leading-6 font-medium text-ink">{label}</span>}
          {description && <span className="block text-xs text-ink-2">{description}</span>}
        </label>
      )}
    </div>
  );
}
