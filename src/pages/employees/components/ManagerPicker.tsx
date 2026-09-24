import { useMemo, useState } from 'react';
import { Ban, Check, Lock } from 'lucide-react';
import type { DemoDatabase, Employee, ID } from '@shared/types';
import { Avatar, SearchInput } from '@/components/ui';
import { cn } from '@/lib/cn';
import { pluralize } from '@/lib/format';
import { reportsByManager, unitName } from '@/lib/lookup';
import { checkManagerChange } from '@/store/actions';

export interface ManagerPickerProps {
  db: DemoDatabase;
  /** Employees being re-mapped */
  employeeIds: readonly ID[];
  /** People who may be chosen (already scope-limited by the caller) */
  candidates: readonly Employee[];
  value: ID | null;
  onChange: (id: ID | null) => void;
  /** Shown under the search when the list is limited to one unit */
  scopeNote?: string;
}

/**
 * Search people and pick a new manager. Invalid choices stay visible but disabled with the reason
 * (can't pick yourself, someone who reports into you → loop, inactive, already the manager).
 */
export function ManagerPicker({ db, employeeIds, candidates, value, onChange, scopeNote }: ManagerPickerProps) {
  const [q, setQ] = useState('');
  const reports = reportsByManager(db);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const pool = candidates.filter((e) => e.status !== 'inactive');
    const hit = s ? pool.filter((e) => e.name.toLowerCase().includes(s) || e.code.toLowerCase().includes(s) || e.designation.toLowerCase().includes(s)) : pool.filter((e) => (reports.get(e.id)?.length ?? 0) > 0);
    // existing managers first, then by name
    return hit
      .map((e) => ({ e, check: checkManagerChange(db.employees, employeeIds, e.id), team: reports.get(e.id)?.length ?? 0 }))
      .sort((a, b) => Number(b.check.ok) - Number(a.check.ok) || b.team - a.team || a.e.name.localeCompare(b.e.name))
      .slice(0, s ? 12 : 8);
  }, [q, candidates, reports, db.employees, employeeIds]);

  return (
    <div className="flex flex-col gap-2">
      <SearchInput value={q} onChange={setQ} placeholder="Search by name, code or designation" className="sm:w-full" autoFocus />
      {scopeNote && (
        <p className="flex items-center gap-1.5 text-xs text-ink-2">
          <Lock className="size-3" /> {scopeNote}
        </p>
      )}
      {!q.trim() && <p className="text-xs text-muted">Suggested: people who already manage a team. Search to find anyone else.</p>}
      <ul className="scrollbar-thin max-h-72 divide-y divide-line overflow-y-auto rounded-xl border border-line" role="listbox" aria-label="Choose a manager">
        {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-2">No matching people</li>}
        {results.map(({ e, check, team }) => {
          const selected = value === e.id;
          return (
            <li key={e.id}>
              <button
                type="button"
                role="option"
                aria-selected={selected}
                disabled={!check.ok}
                onClick={() => onChange(selected ? null : e.id)}
                className={cn(
                  'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                  selected ? 'bg-primary-soft' : 'enabled:hover:bg-canvas',
                  !check.ok && 'cursor-not-allowed',
                )}
              >
                <Avatar name={e.name} size="sm" className={cn(!check.ok && 'opacity-50')} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[13px] font-medium', check.ok ? 'text-ink' : 'text-ink-2')}>{e.name}</span>
                  <span className="block truncate text-xs text-ink-2">
                    {e.designation} · {unitName(db, e.unitId, true)}
                    {team ? ` · ${pluralize(team, 'report')}` : ''}
                  </span>
                  {!check.ok && (
                    <span className={cn('mt-0.5 flex items-center gap-1 text-xs font-medium', check.code === 'same' ? 'text-ink-2' : 'text-danger')}>
                      <Ban className="size-3" /> {check.message}
                    </span>
                  )}
                </span>
                {selected && (
                  <span className="grid size-5 place-items-center rounded-full bg-primary text-white">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
