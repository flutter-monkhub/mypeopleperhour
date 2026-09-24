// Cohort selection shared by every mentoring page. The selection lives in `?cohort=` so views are
// linkable; each page picks a sensible default (running cohort vs the cohort being staffed).

import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { MentoringCohort } from '@shared/types';
import { cn } from '@/lib/cn';
import { defaultCohortId } from '@/lib/analytics-mentoring';
import { useCollection } from '@/store/db';
import { Select } from '@/components/ui';

const STATUS_DOT: Record<MentoringCohort['status'], string> = {
  upcoming: 'bg-muted',
  applications_open: 'bg-info',
  matching: 'bg-warning',
  active: 'bg-success',
  completed: 'bg-mentor',
};

const STATUS_LABEL: Record<MentoringCohort['status'], string> = {
  upcoming: 'Upcoming',
  applications_open: 'Applications open',
  matching: 'Matching',
  active: 'Active',
  completed: 'Completed',
};

/**
 * `?cohort=` with a page default. `allowAll` pages use '' for "all cohorts" (the default there).
 */
export function useCohortParam(purpose: 'programme' | 'matching', opts: { allowAll?: boolean } = {}) {
  const cohorts = useCollection('cohorts');
  const [params, setParams] = useSearchParams();
  const raw = params.get('cohort');
  const fallback = opts.allowAll ? '' : (defaultCohortId(cohorts, purpose) ?? '');
  const cohortId = raw === 'all' && opts.allowAll ? '' : raw && cohorts.some((c) => c.id === raw) ? raw : fallback;
  const setCohortId = useCallback(
    (id: string) =>
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          if (id === fallback) n.delete('cohort');
          else n.set('cohort', id || 'all');
          return n;
        },
        { replace: true },
      ),
    [setParams, fallback],
  );
  const cohort = cohorts.find((c) => c.id === cohortId) ?? null;
  return { cohortId, cohort, cohorts, setCohortId };
}

export interface CohortPickerProps {
  cohorts: MentoringCohort[];
  value: string;
  onChange: (id: string) => void;
  allowAll?: boolean;
  className?: string;
}

/** Segmented cohort switch with a status dot (falls back to a select for many cohorts). */
export function CohortPicker({ cohorts, value, onChange, allowAll, className }: CohortPickerProps) {
  if (cohorts.length > 3)
    return (
      <Select
        aria-label="Cohort"
        size="sm"
        value={value}
        onValueChange={onChange}
        placeholder={allowAll ? 'All cohorts' : undefined}
        options={cohorts.map((c) => ({ value: c.id, label: `${c.name} · ${STATUS_LABEL[c.status]}` }))}
        containerClassName={cn('min-w-56', className)}
      />
    );
  const items = [...(allowAll ? [{ id: '', name: 'All cohorts', status: null }] : []), ...cohorts.map((c) => ({ id: c.id, name: c.name, status: c.status }))];
  return (
    <div role="radiogroup" aria-label="Cohort" className={cn('inline-flex max-w-full gap-1 overflow-x-auto rounded-lg bg-neutral-soft p-1', className)}>
      {items.map((c) => {
        const active = c.id === value;
        return (
          <button
            key={c.id || 'all'}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(c.id)}
            title={c.status ? STATUS_LABEL[c.status] : undefined}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-2 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors',
              active ? 'bg-white text-ink shadow-[0_1px_2px_rgba(15,23,42,.08)]' : 'text-ink-2 hover:text-ink',
            )}
          >
            {c.status && <span className={cn('size-1.5 rounded-full', STATUS_DOT[c.status])} aria-hidden />}
            {c.name}
            {c.status && active && <span className="hidden text-xs font-normal text-ink-2 lg:inline">· {STATUS_LABEL[c.status]}</span>}
          </button>
        );
      })}
    </div>
  );
}

export const cohortStatusLabel = (c: MentoringCohort) => STATUS_LABEL[c.status];
