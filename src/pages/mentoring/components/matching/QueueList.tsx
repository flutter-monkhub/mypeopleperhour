// Left pane of the matching workspace: applications needing action (submitted / under review,
// incl. declined-to-rematch), sorted by score, with preferred mentors and flags.

import { useMemo, useState } from 'react';
import { Inbox, TriangleAlert, Undo2 } from 'lucide-react';
import type { DemoDatabase, MenteeApplication } from '@shared/types';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';
import { employeeMap, functionName } from '@/lib/lookup';
import { SCORE_MAX, hasStructuralRuleIssue, matchesByApplication, scoreTotal } from '@/lib/analytics-mentoring';
import { Avatar, Card, EmptyState, SearchInput } from '@/components/ui';

export interface QueueItem {
  app: MenteeApplication;
  name: string;
  designation: string;
  functionId: string;
  score: number | null;
  conflict: boolean;
  declinedBy: string | null;
}

export function buildQueue(db: DemoDatabase, cohortId: string): QueueItem[] {
  const emp = employeeMap(db);
  return db.applications
    .filter((a) => a.cohortId === cohortId && (a.status === 'submitted' || a.status === 'under_review'))
    .map((a) => {
      const e = emp.get(a.employeeId);
      const declined = [...(matchesByApplication(db).get(a.id) ?? [])].reverse().find((m) => m.status === 'declined');
      return {
        app: a,
        name: e?.name ?? a.employeeId,
        designation: e?.designation ?? '',
        functionId: e?.functionId ?? '',
        score: scoreTotal(a),
        conflict: hasStructuralRuleIssue(db, a),
        declinedBy: declined ? (emp.get(declined.mentorId)?.name ?? declined.mentorId) : null,
      };
    })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || (a.app.submittedAt ?? '').localeCompare(b.app.submittedAt ?? ''));
}

type Filter = 'all' | 'unscored' | 'declined' | 'conflict';

export function QueueList({ db, items, selectedId, onSelect }: { db: DemoDatabase; items: QueueItem[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const emp = employeeMap(db);
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return items.filter(
      (i) =>
        (filter === 'all' || (filter === 'unscored' && i.score == null) || (filter === 'declined' && i.declinedBy) || (filter === 'conflict' && i.conflict)) &&
        (!s || `${i.name} ${i.designation}`.toLowerCase().includes(s)),
    );
  }, [items, q, filter]);
  const n = (f: Filter) => items.filter((i) => (f === 'unscored' ? i.score == null : f === 'declined' ? !!i.declinedBy : f === 'conflict' ? i.conflict : true)).length;

  return (
    <Card padding="none" className="flex max-h-[28rem] flex-col overflow-hidden xl:sticky xl:top-20 xl:max-h-[calc(100vh-7.5rem)]">
      <div className="border-b border-line px-4 pt-4 pb-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-ink">Applications to match</h3>
          <span className="rounded-full bg-mentor-soft px-2 py-0.5 text-xs font-semibold text-mentor tabular">{items.length}</span>
        </div>
        <SearchInput value={q} onChange={setQ} placeholder="Search applicants" size="sm" className="sm:w-full" />
        <div role="radiogroup" aria-label="Filter queue" className="mt-3 flex flex-wrap gap-1.5">
          {(
            [
              ['all', 'All', items.length],
              ['unscored', 'Unscored', n('unscored')],
              ['declined', 'Declined', n('declined')],
              ['conflict', 'Conflicts', n('conflict')],
            ] as const
          ).map(([id, label, count]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={filter === id}
              onClick={() => setFilter(id)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors',
                filter === id ? 'border-mentor bg-mentor-soft text-mentor' : 'border-line-strong bg-white text-ink-2 hover:text-ink',
              )}
            >
              {label}
              <span className="tabular opacity-70">{count}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-2">
        {visible.length === 0 ? (
          <EmptyState
            size="sm"
            tone="mentor"
            icon={Inbox}
            title={items.length ? 'Nothing matches' : 'Queue is clear'}
            message={items.length ? 'Try another filter or search.' : 'Every application in this cohort has been shortlisted or closed. Check Final matching for mentor replies.'}
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {visible.map((i) => {
              const on = i.app.id === selectedId;
              return (
                <li key={i.app.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(i.app.id)}
                    aria-pressed={on}
                    className={cn(
                      'w-full rounded-xl border px-3 py-2.5 text-left transition-colors',
                      on ? 'border-mentor bg-mentor-soft/70 shadow-[inset_3px_0_0_var(--color-mentor)]' : 'border-transparent hover:border-line hover:bg-canvas',
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <Avatar name={i.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-[13px] font-semibold text-ink">{i.name}</p>
                          {i.score != null ? (
                            <span className="shrink-0 text-xs font-semibold text-mentor tabular">
                              {i.score}
                              <span className="font-normal text-muted">/{SCORE_MAX}</span>
                            </span>
                          ) : (
                            <span className="shrink-0 text-[11px] font-medium text-muted">Not scored</span>
                          )}
                        </div>
                        <p className="truncate text-xs text-ink-2">
                          {functionName(db, i.functionId)} · {i.designation}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1">
                          {i.app.preferredMentorIds.map((id, k) => (
                            <span
                              key={id}
                              className="inline-flex h-5 items-center gap-1 rounded-full bg-white px-1.5 text-[11px] text-ink-2 ring-1 ring-line"
                              title={`#${k + 1} ${emp.get(id)?.name}`}
                            >
                              <span className="font-semibold text-mentor">{k + 1}</span>
                              {emp.get(id)?.firstName}
                            </span>
                          ))}
                        </div>
                        {(i.declinedBy || i.conflict || i.app.status === 'submitted') && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-medium">
                            {i.app.status === 'submitted' && <span className="text-info">New · {timeAgo(i.app.submittedAt ?? i.app.updatedAt)}</span>}
                            {i.declinedBy && (
                              <span className="inline-flex items-center gap-1 text-danger">
                                <Undo2 className="size-3" /> Declined by {i.declinedBy.split(' ')[0]}
                              </span>
                            )}
                            {i.conflict && (
                              <span className="inline-flex items-center gap-1 text-danger">
                                <TriangleAlert className="size-3" /> Rule conflict
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}
