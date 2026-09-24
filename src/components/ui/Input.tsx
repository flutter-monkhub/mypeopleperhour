import { useId, type ComponentProps, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Field, controlClasses } from './Field';

export interface InputProps extends Omit<ComponentProps<'input'>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  labelAside?: ReactNode;
  /** Lucide icon inside the left edge */
  icon?: LucideIcon;
  /** Element inside the right edge (e.g. show/hide password button) */
  rightElement?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  containerClassName?: string;
}

const H = { sm: 'h-8.5 text-[13px]', md: 'h-10', lg: 'h-11 text-[15px]' } as const;

/** Text input with label, hint/error, optional icons. React 19: pass `ref` as a normal prop. */
export function Input({ label, hint, error, labelAside, icon: Icon, rightElement, size = 'md', containerClassName, className, id, required, ...rest }: InputProps) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field label={label} htmlFor={inputId} hint={hint} error={error} required={required} labelAside={labelAside} className={containerClassName}>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />}
        <input
          id={inputId}
          required={required}
          aria-invalid={!!error || undefined}
          className={cn(controlClasses(!!error), H[size], Icon ? 'pl-9' : 'pl-3', rightElement ? 'pr-10' : 'pr-3', className)}
          {...rest}
        />
        {rightElement && <div className="absolute inset-y-0 right-1 flex items-center">{rightElement}</div>}
      </div>
    </Field>
  );
}
