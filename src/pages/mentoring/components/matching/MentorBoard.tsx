// Right pane of the matching workspace: every mentor with a live capacity meter for the cohort.
// With an application selected, preferred mentors are highlighted and ranked first, and each card
// shows the three rule checks (capacity · cross-functional · reporting) as dots.

import { useMemo, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import type { DemoDatabase, MenteeApplication } from '@shared/types';
import { validateMatch, type RuleResult } from '@shared/logic';
import { cn } from '@/lib/cn';
import { employeeMap, functionName } from '@/lib/lookup';
import { mentorLoad, type MentorLoad } from '@/lib/analytics-mentoring';
import { Avatar, Badge, Card, CardHeader, EmptyState, FilterSelect, SearchInput } from '@/components/ui';
import { CapacityLegend, CapacityMeter } from '../CapacityMeter';
import { RuleDots, ruleShortLabel } from '../RuleChecks';

interface BoardItem {
  id: string;
  name: string;
  designation: string;
  functionId: string;
  active: boolean;
  load: MentorLoad;
  rank: number | null;
  rules: RuleResult[] | null;
  eligible: boolean;
  declined: boolean;
}

const STATUS_DOT = { proposed: 'bg-warning', accepted: 'bg-info', active: 'bg-mentor' } as const;

export function MentorBoard({
  db,
  cohortId,
  app,
  selectedMentorId,
  onSelectMentor,
}: {
  db: DemoDatabase;
  cohortId: string;
  app: MenteeApplication | null;
  selectedMentorId: string | null;
  onSelectMentor: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [fn, setFn] = useState('');
  const [showIneligible, setShowIneligible] = useState(false);
  const emp = employeeMap(db);

  const items = useMemo<BoardItem[]>(() => {
    const declined = new Set(app ? db.matches.filter((m) => m.applicationId === app.id && m.status === 'declined').map((m) => m.mentorId) : []);
    return db.mentors
      .filter((p) => p.active || app?.preferredMentorIds.includes(p.employeeId))
      .map((p) => {
        const e = emp.get(p.employeeId);
        const rules = app ? validateMatch(db, p.employeeId, app.employeeId, cohortId) : null;
        const rank = app ? app.preferredMentorIds.indexOf(p.employeeId) : -1;
        return {
          id: p.employeeId,
          name: e?.name ?? p.employeeId,
          designation: e?.designation ?? '',
          functionId: e?.functionId ?? '',
          active: p.active,
          load: mentorLoad(db, p.employeeId, cohortId),
          rank: rank >= 0 ? rank + 1 : null,
          rules,
          eligible: !!rules && rules.every((r) => r.ok) && p.active,
          declined: declined.has(p.employeeId),
        };
      })
      .sort((a, b) => {
        if (app) {
          if ((a.rank ?? 99) !== (b.rank ?? 99)) return (a.rank ?? 99) - (b.rank ?? 99);
          if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
          if (a.load.free !== b.load.free) return b.load.free - a.load.free;
        }
        return a.name.localeCompare(b.name);
      });
  }, [db, emp, app, cohortId]);

  const matching = items.filter((i) => (!fn || i.functionId === fn) && (!q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase())));
  // With an applicant selected, mentors who fail a rule (and aren't a preference) are collapsed by default
  const hidden = app && !showIneligible ? matching.filter((i) => !i.eligible && !i.rank) : [];
  const visible = matching.filter((i) => !hidden.includes(i));
  const free = items.filter((i) => i.active).reduce((s, i) => s + i.load.free, 0);
  const total = items.filter((i) => i.active).reduce((s, i) => s + i.load.capacity, 0);

  return (
    <Card padding="none">
      <CardHeader
        divider
        icon={GraduationCap}
        iconTone="mentor"
        title="Mentor board"
        subtitle={
          app
            ? 'Preferred mentors first, then everyone who passes the rules. Pick a mentor to check the match.'
            : `${free} of ${total} slots free this cohort. Select an application to see who fits.`
        }
        actions={<CapacityLegend className="hidden xl:flex" />}
      />
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-5 py-3">
        <SearchInput value={q} onChange={setQ} placeholder="Search mentors" size="sm" className="sm:w-52" />
        <FilterSelect label="Function" value={fn} onChange={setFn} options={db.functions.map((f) => ({ value: f.id, label: f.name }))} allLabel="All" />
        {app && (
          <span className="ml-auto text-xs text-ink-2">
            <strong className="text-success tabular">{matching.filter((i) => i.eligible).length}</strong> eligible ·{' '}
            <strong className="text-danger tabular">{matching.filter((i) => !i.eligible).length}</strong> fail a rule
          </span>
        )}
      </div>
      <div className="p-4">
        {visible.length === 0 ? (
          <EmptyState size="sm" tone="mentor" icon={GraduationCap} title="No mentors match" message="Clear the search or function filter." />
        ) : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {visible.map((m) => {
              const on = m.id === selectedMentorId;
              const failed = m.rules?.filter((r) => !r.ok) ?? [];
              return (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => onSelectMentor(m.id)}
                    aria-pressed={on}
                    className={cn(
                      'flex h-full w-full flex-col gap-2.5 rounded-xl border bg-white p-3.5 text-left transition-[border-color,box-shadow,opacity]',
                      on
                        ? 'border-mentor shadow-[0_0_0_3px_rgba(126,55,148,.15)]'
                        : m.rank
                          ? 'border-mentor/40 bg-mentor-soft/25 hover:border-mentor'
                          : 'border-line hover:border-line-strong hover:shadow-card',
                      app && !m.eligible && !on && 'opacity-60 hover:opacity-100',
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <Avatar name={m.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-ink">{m.name}</p>
                        <p className="truncate text-xs text-ink-2">
                          {functionName(db, m.functionId)} · {m.designation}
                        </p>
                      </div>
                      {m.rank && (
                        <Badge tone="mentor" size="sm" className="shrink-0">
                          #{m.rank} choice
                        </Badge>
                      )}
                    </div>
                    {(!m.active || m.declined) && (
                      <div className="-mt-1 flex flex-wrap items-center gap-1.5">
                        {!m.active && (
                          <Badge tone="neutral" size="sm">
                            Inactive
                          </Badge>
                        )}
                        {m.declined && (
                          <Badge tone="danger" size="sm">
                            Declined this applicant before
                          </Badge>
                        )}
                      </div>
                    )}
                    <CapacityMeter load={m.load} size="sm" preview={on && m.eligible} />
                    {m.load.matches.length > 0 ? (
                      <ul className="flex flex-col gap-0.5">
                        {m.load.matches.slice(0, 3).map((x) => (
                          <li key={x.id} className="flex items-center gap-1.5 text-[11px] text-ink-2">
                            <span className={cn('size-1.5 shrink-0 rounded-full', STATUS_DOT[x.status as keyof typeof STATUS_DOT])} />
                            <span className="truncate">{emp.get(x.menteeId)?.name}</span>
                            <span className="ml-auto shrink-0 text-muted">{x.status === 'proposed' ? 'awaiting' : x.status}</span>
                          </li>
                        ))}
                        {m.load.matches.length > 3 && <li className="text-[11px] text-muted">+{m.load.matches.length - 3} more</li>}
                      </ul>
                    ) : null}
                    {m.rules && (
                      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-2.5">
                        <RuleDots rules={m.rules} />
                        <span className={cn('truncate text-[11px] font-semibold', failed.length ? 'text-danger' : m.active ? 'text-success' : 'text-neutral')}>
                          {failed.length ? failed.map(ruleShortLabel).join(' · ') : m.active ? 'All rules pass' : 'Inactive'}
                        </span>
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {app && (hidden.length > 0 || showIneligible) && (
          <button
            type="button"
            onClick={() => setShowIneligible((v) => !v)}
            className="mt-3 w-full rounded-xl border border-dashed border-line-strong px-4 py-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-mentor hover:text-mentor"
          >
            {showIneligible
              ? 'Hide mentors who fail a rule'
              : `Show ${hidden.length} mentor${hidden.length === 1 ? '' : 's'} who fail a rule (same function, reporting line or full)`}
          </button>
        )}
      </div>
    </Card>
  );
}
