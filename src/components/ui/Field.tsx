import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface FieldProps {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** Right side of the label row (e.g. "Forgot password?" link or a counter) */
  labelAside?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error. Used by Input, Select, Textarea; use directly for custom controls. */
export function Field({ label, htmlFor, hint, error, required, labelAside, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {(label || labelAside) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
              {label}
              {required && <span className="ml-0.5 text-danger">*</span>}
            </label>
          )}
          {labelAside && <div className="text-xs text-ink-2">{labelAside}</div>}
        </div>
      )}
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-2">{hint}</p>
      ) : null}
    </div>
  );
}

/** Shared control chrome (height set by the control). */
export const controlClasses = (invalid?: boolean) =>
  cn(
    'w-full rounded-btn border bg-white text-sm text-ink placeholder:text-muted transition-[border-color,box-shadow] duration-150',
    'hover:border-[#c3cbdc] focus:outline-none focus:border-primary focus:shadow-[var(--shadow-focus)]',
    'disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted',
    invalid ? 'border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgba(220,38,38,.15)]' : 'border-line-strong',
  );
