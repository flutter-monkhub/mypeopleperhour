// Rule 14 — Mentor of the month: most completed sessions in the month, tie-break by average
// mentee rating. Winner + runner-ups, with a month switcher.

import { Award, CalendarCheck, Trophy, UsersRound } from 'lucide-react';
import type { MonthKey } from '@shared/types';
import { cn } from '@/lib/cn';
import { formatMonth, pluralize } from '@/lib/format';
import { functionName } from '@/lib/lookup';
import type { MentorMonthRank } from '@/lib/analytics-mentoring';
import { useDb } from '@/store/db';
import { Avatar, Card, EmptyState } from '@/components/ui';
import { Rating } from './bits';

export function MentorOfMonth({ ranks, month, months, onMonth }: { ranks: MentorMonthRank[]; month: MonthKey; months: MonthKey[]; onMonth: (m: MonthKey) => void }) {
  const db = useDb();
  const [winner, ...rest] = ranks;
  const tied = winner && rest[0] && rest[0].sessions === winner.sessions;
  return (
    <Card padding="none" className="flex flex-col overflow-hidden">
      <div className="relative overflow-hidden bg-gradient-to-br from-[#6B2B80] via-mentor to-[#A2448C] px-5 pt-4 pb-5 text-white">
        <Trophy className="pointer-events-none absolute -top-3 -right-3 size-28 text-white/10" strokeWidth={1.4} aria-hidden />
        <div className="flex items-center justify-between gap-3">
          <p className="inline-flex items-center gap-2 text-[13px] font-semibold text-white/90">
            <Award className="size-4" /> Mentor of the month
          </p>
          {months.length > 1 && (
            <select
              aria-label="Month"
              value={month}
              onChange={(e) => onMonth(e.target.value)}
              className="relative z-[1] h-7 rounded-md border border-white/25 bg-white/10 px-2 text-xs font-medium text-white outline-none [&>option]:text-ink"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(m)}
                </option>
              ))}
            </select>
          )}
        </div>
        {winner ? (
          <div className="mt-4 flex items-center gap-4">
            <Avatar name={winner.mentor?.name ?? winner.mentorId} size="lg" ring />
            <div className="min-w-0">
              <p className="truncate text-lg leading-6 font-bold">{winner.mentor?.name ?? winner.mentorId}</p>
              <p className="truncate text-[13px] text-white/80">
                {winner.mentor?.designation} · {functionName(db, winner.mentor?.functionId)}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-lg font-bold">No conversations yet</p>
        )}
        {winner && (
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              { icon: CalendarCheck, label: 'Sessions', value: winner.sessions },
              { icon: UsersRound, label: 'Mentees met', value: winner.mentees },
              { icon: Award, label: 'Avg rating', value: winner.avgRating != null ? winner.avgRating.toFixed(1) : '—' },
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-white/12 px-2 py-2">
                <dd className="text-xl leading-7 font-bold tabular">{s.value}</dd>
                <dt className="text-[11px] text-white/75">{s.label}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="flex-1 px-5 py-4">
        {winner ? (
          <>
            <p className="mb-2 text-xs text-ink-2">
              Most completed conversations in {formatMonth(month)}
              {tied ? ' — tie broken by average mentee rating' : ''}.
            </p>
            {rest.length === 0 ? (
              <p className="text-[13px] text-ink-2">No runner-ups this month.</p>
            ) : (
              <ol className="flex flex-col divide-y divide-line">
                {rest.slice(0, 4).map((r, i) => (
                  <li key={r.mentorId} className="flex items-center gap-3 py-2">
                    <span className={cn('w-4 text-center text-xs font-bold tabular', i === 0 ? 'text-mentor' : 'text-muted')}>{i + 2}</span>
                    <Avatar name={r.mentor?.name ?? r.mentorId} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{r.mentor?.name}</span>
                      <span className="block truncate text-xs text-ink-2">{functionName(db, r.mentor?.functionId)}</span>
                    </span>
                    <span className="text-right text-xs">
                      <span className="block font-semibold text-ink tabular">{pluralize(r.sessions, 'session')}</span>
                      <Rating value={r.avgRating} className="text-xs" />
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </>
        ) : (
          <EmptyState size="sm" tone="mentor" icon={Trophy} title="Nothing to rank yet" message={`No mentoring conversations were completed in ${formatMonth(month)}.`} />
        )}
      </div>
    </Card>
  );
}
