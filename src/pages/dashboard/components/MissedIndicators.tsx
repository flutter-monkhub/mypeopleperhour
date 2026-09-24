import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, CircleCheck, Flag, PieChart, Repeat2 } from 'lucide-react';
import type { DemoDatabase, MonthKey } from '@shared/types';
import { MISSED_REASON_LABELS } from '@shared/content/mph';
import { formatMonth } from '@shared/utils/dates';
import { Donut } from '@/components/charts';
import { Avatar, Badge, Card, CardFooter, CardHeader, EmptyState, Tabs } from '@/components/ui';
import type { MissedFlags } from '@/lib/analytics';
import type { MissedRecord } from '@/lib/analytics-outcomes';
import { formatNumber, formatPercent, pluralize } from '@/lib/format';
import { unitName } from '@/lib/lookup';

export const REASON_COLORS = { business_emergency: '#2F56E8', personal_emergency: '#EB6834', unspecified: '#94A3B8' } as const;

type FlagView = 'pairs' | 'managers';

interface FlagsProps {
  db: DemoDatabase;
  month: MonthKey;
  flags: MissedFlags;
  canViewEmployees: boolean;
  query: string;
}

/** A8: missed-session flags — pairs (missed / unscheduled after the 20th) and repeat-miss managers. */
export function MissedFlagsCard({ db, month, flags, canViewEmployees, query }: FlagsProps) {
  const [view, setView] = useState<FlagView>(flags.managers.length && !flags.pairs.length ? 'managers' : 'pairs');
  const missed = flags.pairs.filter((p) => p.reason === 'missed');
  const late = flags.pairs.filter((p) => p.reason === 'unscheduled_late');
  const pairs = [...missed, ...late];
  const personLink = (id: string) => (canViewEmployees ? `/employees/${id}` : undefined);
  const sessions = (tab: string) => `/sessions${query ? `${query}&` : '?'}tab=${tab}`;

  return (
    <Card padding="none" className="flex flex-col" id="missed-indicators">
      <CardHeader
        divider
        icon={Flag}
        iconTone="danger"
        title="Missed session indicators"
        subtitle={`${formatMonth(month)} · pairs to follow up and repeat-miss managers`}
        actions={
          <Tabs<FlagView>
            variant="segmented"
            value={view}
            onChange={setView}
            tabs={[
              { id: 'pairs', label: 'Pairs', count: pairs.length },
              { id: 'managers', label: 'Managers', count: flags.managers.length },
            ]}
          />
        }
      />
      <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
        <Badge tone="danger" dot>
          {pluralize(missed.length, 'missed pair')}
        </Badge>
        <Badge tone="warning" dot>
          {flags.lateCutoffPassed ? `${formatNumber(late.length)} unscheduled after the 20th` : 'Unscheduled pairs flag after the 20th'}
        </Badge>
        <Badge tone="outline" icon={Repeat2}>
          {flags.managers.length} with ≥ 2 misses in 3 months
        </Badge>
      </div>
      <div className="scrollbar-thin max-h-[360px] min-h-[240px] flex-1 overflow-y-auto">
        {view === 'pairs' ? (
          pairs.length ? (
            <ul className="divide-y divide-line">
              {pairs.map(({ pair, reason }) => {
                const s = pair.session;
                const link = personLink(pair.employeeId);
                const body = (
                  <>
                    <Avatar name={pair.employee.name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink">{pair.employee.name}</span>
                      <span className="block truncate text-xs text-ink-2">
                        with {pair.manager?.name ?? '—'} · {unitName(db, pair.employee.unitId, true)}
                      </span>
                    </span>
                    {reason === 'missed' ? (
                      <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        {s?.missedReason && (
                          <Badge tone="outline" size="sm">
                            {MISSED_REASON_LABELS[s.missedReason]}
                          </Badge>
                        )}
                        <Badge tone="danger" size="sm" dot>
                          Missed
                        </Badge>
                      </span>
                    ) : (
                      <Badge tone="warning" size="sm" icon={CalendarClock}>
                        Not scheduled
                      </Badge>
                    )}
                  </>
                );
                return (
                  <li key={pair.employeeId}>
                    {link ? (
                      <Link to={link} className="flex items-center gap-3 px-5 py-2.5 hover:bg-[#F8FAFE]">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-5 py-2.5">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState size="sm" icon={CircleCheck} title="No flagged pairs" message="Every pair has either met, booked or is still within the scheduling window." />
          )
        ) : flags.managers.length ? (
          <ul className="divide-y divide-line">
            {flags.managers.map((m) => {
              const link = personLink(m.managerId);
              const body = (
                <>
                  <Avatar name={m.manager?.name ?? m.managerId} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">{m.manager?.name ?? m.managerId}</span>
                    <span className="block truncate text-xs text-ink-2">
                      {m.manager?.designation} · {pluralize(m.employeeIds.length, 'report')} affected · {m.months.map((x) => formatMonth(x).slice(0, 3)).join(', ')}
                    </span>
                  </span>
                  <Badge tone="danger" size="sm">
                    {m.missedCount} missed
                  </Badge>
                </>
              );
              return (
                <li key={m.managerId}>
                  {link ? (
                    <Link to={link} className="flex items-center gap-3 px-5 py-2.5 hover:bg-[#F8FAFE]">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-5 py-2.5">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState size="sm" icon={CircleCheck} title="No repeat misses" message="No manager has missed two or more sessions in the last three months." />
        )}
      </div>
      <CardFooter className="justify-between">
        <Link to={sessions('missed')} className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary-dark">
          Missed sessions <ArrowRight className="size-3.5" />
        </Link>
        <Link to={sessions('to_be_scheduled')} className="inline-flex items-center gap-1 text-[13px] font-medium text-primary hover:text-primary-dark">
          To be scheduled <ArrowRight className="size-3.5" />
        </Link>
      </CardFooter>
    </Card>
  );
}

interface ReasonsProps {
  month: MonthKey;
  split: { business_emergency: number; personal_emergency: number; unspecified: number; total: number };
  records: MissedRecord[];
  /** Missed records of the trailing window (e.g. last 3 months) */
  windowRecords: MissedRecord[];
  windowMonths: MonthKey[];
}

/** A8: missed reasons split (Business vs Personal emergency) for the month + the 3-month context. */
export function MissedReasonsCard({ month, split, records, windowRecords, windowMonths }: ReasonsProps) {
  const recovered = records.filter((r) => r.recovered).length;
  const slices = [
    { name: MISSED_REASON_LABELS.business_emergency, value: split.business_emergency, color: REASON_COLORS.business_emergency },
    { name: MISSED_REASON_LABELS.personal_emergency, value: split.personal_emergency, color: REASON_COLORS.personal_emergency },
    ...(split.unspecified ? [{ name: 'No reason given', value: split.unspecified, color: REASON_COLORS.unspecified }] : []),
  ];
  const perMonth = windowMonths.map((m) => {
    const list = windowRecords.filter((r) => r.session.month === m);
    return { month: m, total: list.length, business: list.filter((r) => r.reason === 'business_emergency').length, personal: list.filter((r) => r.reason === 'personal_emergency').length };
  });
  const maxTotal = Math.max(1, ...perMonth.map((p) => p.total));
  return (
    <Card className="flex flex-col">
      <CardHeader icon={PieChart} iconTone="warning" title="Why sessions were missed" subtitle={`${formatMonth(month)} · reason given by the manager`} />
      {split.total ? (
        <>
          <Donut
            data={slices}
            size={150}
            thickness={18}
            center={
              <div>
                <p className="text-2xl leading-7 font-bold text-ink">{formatNumber(split.total)}</p>
                <p className="text-xs text-ink-2">missed</p>
              </div>
            }
          />
          <p className="mt-4 text-[13px] text-ink-2">
            <span className="font-semibold text-ink">{formatNumber(recovered)}</span> of {pluralize(records.length, 'missed pair')} re-booked the hour within the month
            {records.length ? ` (${formatPercent(recovered / records.length)})` : ''}.
          </p>
        </>
      ) : (
        <EmptyState size="sm" icon={CircleCheck} title="No missed sessions" message={`Nothing was missed in ${formatMonth(month)} for this selection.`} />
      )}
      {perMonth.length > 1 && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2.5 text-xs font-medium text-ink-2">Missed per month · last {perMonth.length} months</p>
          <ul className="flex flex-col gap-2">
            {perMonth.map((p) => (
              <li key={p.month} className="flex items-center gap-3 text-[13px]">
                <span className="w-9 shrink-0 text-ink-2">{formatMonth(p.month).slice(0, 3)}</span>
                <span className="flex h-2.5 flex-1 gap-0.5 overflow-hidden rounded-full bg-[#EDF0F6]" title={`${p.business} business · ${p.personal} personal`}>
                  <span className="h-full rounded-l-full" style={{ width: `${(p.business / maxTotal) * 100}%`, background: REASON_COLORS.business_emergency }} />
                  <span className="h-full" style={{ width: `${(p.personal / maxTotal) * 100}%`, background: REASON_COLORS.personal_emergency }} />
                </span>
                <span className="w-7 shrink-0 text-right font-semibold text-ink tabular">{p.total}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link to="/sessions/missed-reasons" className="mt-auto inline-flex items-center gap-1 pt-4 text-[13px] font-medium text-primary hover:text-primary-dark">
        Missed reason analysis <ArrowRight className="size-3.5" />
      </Link>
    </Card>
  );
}
