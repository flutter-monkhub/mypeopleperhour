import { useId, type ComponentProps, type ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Field, controlClasses } from './Field';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<ComponentProps<'select'>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options?: readonly SelectOption[];
  /** Adds a first option with value "" (e.g. "All units") */
  placeholder?: string;
  /** Convenience change handler with the string value */
  onValueChange?: (value: string) => void;
  icon?: LucideIcon;
  size?: 'sm' | 'md';
  containerClassName?: string;
}

/** Native select, styled. Pass `options` or <option> children. */
export function Select({ label, hint, error, options, placeholder, onValueChange, onChange, icon: Icon, size = 'md', containerClassName, className, id, required, children, ...rest }: SelectProps) {
  const auto = useId();
  const selectId = id ?? auto;
  return (
    <Field label={label} htmlFor={selectId} hint={hint} error={error} required={required} className={containerClassName}>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />}
        <select
          id={selectId}
          required={required}
          aria-invalid={!!error || undefined}
          onChange={(e) => {
            onChange?.(e);
            onValueChange?.(e.target.value);
          }}
          className={cn(controlClasses(!!error), 'appearance-none truncate pr-9', size === 'sm' ? 'h-8.5 text-[13px]' : 'h-10', Icon ? 'pl-9' : 'pl-3', className)}
          {...rest}
        >
          {placeholder != null && <option value="">{placeholder}</option>}
          {options?.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-2" aria-hidden />
      </div>
    </Field>
  );
}
