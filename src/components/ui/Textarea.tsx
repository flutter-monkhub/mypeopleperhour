import { useId, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { Field, controlClasses } from './Field';

export interface TextareaProps extends ComponentProps<'textarea'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Show "n / maxLength" counter (requires maxLength) */
  showCount?: boolean;
  containerClassName?: string;
}

export function Textarea({ label, hint, error, showCount = true, maxLength, value, rows = 4, containerClassName, className, id, required, ...rest }: TextareaProps) {
  const auto = useId();
  const tid = id ?? auto;
  const len = typeof value === 'string' ? value.length : 0;
  return (
    <Field
      label={label}
      htmlFor={tid}
      hint={hint}
      error={error}
      required={required}
      className={containerClassName}
      labelAside={showCount && maxLength ? <span className={cn('tabular', len >= maxLength && 'text-danger')}>{`${len}/${maxLength}`}</span> : undefined}
    >
      <textarea
        id={tid}
        rows={rows}
        value={value}
        maxLength={maxLength}
        required={required}
        aria-invalid={!!error || undefined}
        className={cn(controlClasses(!!error), 'resize-y px-3 py-2 leading-relaxed', className)}
        {...rest}
      />
    </Field>
  );
}
