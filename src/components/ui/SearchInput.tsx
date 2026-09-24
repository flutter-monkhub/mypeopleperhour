import { Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { controlClasses } from './Field';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  className?: string;
  autoFocus?: boolean;
  'aria-label'?: string;
}

/** Search box with icon and clear button. Filter with `value.trim().toLowerCase()`. */
export function SearchInput({ value, onChange, placeholder = 'Search…', size = 'md', className, autoFocus, ...aria }: SearchInputProps) {
  return (
    <div className={cn('relative w-full sm:w-72', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && value && (e.stopPropagation(), onChange(''))}
        placeholder={placeholder}
        aria-label={aria['aria-label'] ?? placeholder}
        className={cn(controlClasses(), 'pr-8 pl-9 [&::-webkit-search-cancel-button]:hidden', size === 'sm' ? 'h-8.5 text-[13px]' : 'h-10')}
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute top-1/2 right-2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-neutral-soft hover:text-ink" aria-label="Clear search">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
