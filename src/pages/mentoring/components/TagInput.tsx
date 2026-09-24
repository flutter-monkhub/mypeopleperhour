// Chip input for free-form tags (mentor expertise). Enter / comma adds, Backspace removes the last.

import { useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Field } from '@/components/ui';

export interface TagInputProps {
  label?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  hint?: string;
  error?: string;
  max?: number;
  disabled?: boolean;
}

export function TagInput({ label, value, onChange, suggestions = [], placeholder = 'Type and press Enter', hint, error, max = 8, disabled }: TagInputProps) {
  const id = useId();
  const [draft, setDraft] = useState('');
  const has = (t: string) => value.some((v) => v.toLowerCase() === t.toLowerCase());
  const add = (raw: string) => {
    const t = raw.trim().replace(/,$/, '');
    if (!t || has(t) || value.length >= max) return;
    onChange([...value, t]);
    setDraft('');
  };
  const q = draft.trim().toLowerCase();
  const sugg = suggestions.filter((s) => !has(s) && (!q || s.toLowerCase().includes(q))).slice(0, 8);
  return (
    <Field label={label} htmlFor={id} hint={hint ?? `${value.length}/${max} · press Enter to add`} error={error}>
      <div
        className={cn(
          'flex min-h-10 flex-wrap items-center gap-1.5 rounded-btn border bg-white px-2 py-1.5 transition-[border-color,box-shadow] focus-within:border-primary focus-within:shadow-[var(--shadow-focus)]',
          error ? 'border-danger' : 'border-line-strong',
          disabled && 'bg-canvas',
        )}
      >
        {value.map((t) => (
          <span key={t} className="inline-flex h-6 items-center gap-1 rounded-full bg-mentor-soft pr-1 pl-2.5 text-xs font-medium text-mentor">
            {t}
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(value.filter((v) => v !== t))}
                className="grid size-4 place-items-center rounded-full hover:bg-mentor/15"
                aria-label={`Remove ${t}`}
              >
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
        {!disabled && value.length < max && (
          <input
            id={id}
            value={draft}
            onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setDraft(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add(draft);
              } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
            }}
            onBlur={() => draft.trim() && add(draft)}
            placeholder={value.length ? '' : placeholder}
            className="h-6 min-w-32 flex-1 border-0 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-muted focus-visible:outline-none"
          />
        )}
      </div>
      {!disabled && sugg.length > 0 && value.length < max && (
        <div className="flex flex-wrap gap-1.5">
          {sugg.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-line-strong px-2 text-xs text-ink-2 transition-colors hover:border-mentor hover:text-mentor"
            >
              <Plus className="size-3" /> {s}
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}
