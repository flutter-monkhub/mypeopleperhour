import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Check, Minus } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  description?: ReactNode;
  indeterminate?: boolean;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
}

export function Checkbox({ checked, onChange, label, description, indeterminate, disabled, className, id, name }: CheckboxProps) {
  const auto = useId();
  const cid = id ?? auto;
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate;
  }, [indeterminate]);
  const on = checked || indeterminate;
  return (
    <label htmlFor={cid} className={cn('group inline-flex items-start gap-2.5 text-sm', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer', className)}>
      <span className="relative mt-0.5 grid size-4.5 shrink-0 place-items-center">
        <input
          ref={ref}
          id={cid}
          name={name}
          type="checkbox"
          className="peer absolute inset-0 size-full cursor-[inherit] opacity-0"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          aria-hidden
          className={cn(
            'grid size-4.5 place-items-center rounded-[5px] border transition-colors peer-focus-visible:shadow-[var(--shadow-focus)]',
            on ? 'border-primary bg-primary text-white' : 'border-line-strong bg-white group-hover:border-[#b7c0d3]',
          )}
        >
          {indeterminate ? <Minus className="size-3" strokeWidth={3} /> : checked ? <Check className="size-3" strokeWidth={3} /> : null}
        </span>
      </span>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block leading-5 text-ink">{label}</span>}
          {description && <span className="block text-xs text-ink-2">{description}</span>}
        </span>
      )}
    </label>
  );
}
