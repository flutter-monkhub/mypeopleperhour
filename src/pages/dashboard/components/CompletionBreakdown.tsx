import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Lock } from 'lucide-react';
import type { DemoDatabase, MonthKey } from '@shared/types';
import { formatMonth } from '@shared/utils/dates';
import { BarChart } from '@/components/charts';
import { Badge, Card, CardHeader, DataTable, PersonCell, Tabs, type Column } from '@/components/ui';
import type { CompletionGroup } from '@/lib/analytics';
import { COMPLETION_TARGET } from '@/lib/analytics-outcomes';
import { formatNumber, formatPercent } from '@/lib/format';
import { employeeMap, unitName } from '@/lib/lookup';
import { RateCell } from './shared';

type View = 'groups' | 'managers';

interface Props {
  db: DemoDatabase;
  month: MonthKey;
  /** Units (no unit filter) or departments (a unit is selected) */
  groups: CompletionGroup[];
  groupKind: 'unit' | 'department';
  managers: CompletionGroup[];
  scopeLabel: string;
  locked: boolean;
  onPickGroup: (key: string) => void;
  canViewEmployees: boolean;
  query: string;
}

const clip = (s: string, n = 22) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** A6: completion rate across units (or departments within a unit) + the manager league table. */
export function CompletionBreakdown({ db, month, groups, groupKind, managers, scopeLabel, locked, onPickGroup, canViewEmployees, query }: Props) {
  const [view, setView] = useState<View>('groups');
  const navigate = useNavigate();
  const emp = employeeMap(db);
  const noun = groupKind === 'unit' ? 'Unit' : 'Department';
  const nounPlural = groupKind === 'unit' ? 'Units' : 'Departments';
  const clickable = groupKind === 'department' || !locked;

  const groupCols: Column<CompletionGroup>[] = [
    {
      key: 'label',
      header: noun,
      sortValue: (g) => g.label,
      cell: (g) => (
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-ink">{g.label}</span>
        </span>
      ),
    },
    { key: 'total', header: 'Pairs', align: 'right', sortValue: (g) => g.total, cell: (g) => <span className="tabular">{formatNumber(g.total)}</span> },
    { key: 'completed', header: 'Completed', align: 'right', sortValue: (g) => g.completed, cell: (g) => <span className="tabular">{formatNumber(g.completed)}</span> },
    { key: 'scheduled', header: 'Scheduled', align: 'right', hideBelow: '2xl', sortValue: (g) => g.scheduled, cell: (g) => <span className="tabular">{formatNumber(g.scheduled)}</span> },
    { key: 'missed', header: 'Missed', align: 'right', hideBelow: 'xl', sortValue: (g) => g.missed, cell: (g) => <span className={g.missed ? 'text-danger tabular' : 'tabular'}>{formatNumber(g.missed)}</span> },
    { key: 'tbs', header: 'To be sched.', align: 'right', hideBelow: 'xl', sortValue: (g) => g.toBeScheduled, cell: (g) => <span className="tabular">{formatNumber(g.toBeScheduled)}</span> },
    { key: 'rate', header: 'Completion', width: 140, sortValue: (g) => g.completionRate, cell: (g) => <RateCell rate={g.completionRate} total={g.total} compact /> },
  ];

  const managerCols: Column<CompletionGroup>[] = [
    {
      key: 'label',
      header: 'Manager',
      sortValue: (g) => g.label,
      cell: (g) => {
        const m = emp.get(g.key);
        return <PersonCell name={g.label} secondary={m ? `${m.designation} · ${unitName(db, m.unitId, true)}` : undefined} />;
      },
    },
    { key: 'total', header: 'Team', align: 'right', sortValue: (g) => g.total, cell: (g) => <span className="tabular">{formatNumber(g.total)}</span> },
    { key: 'completed', header: 'Completed', align: 'right', sortValue: (g) => g.completed, cell: (g) => <span className="tabular">{formatNumber(g.completed)}</span> },
    { key: 'scheduled', header: 'Scheduled', align: 'right', hideBelow: 'xl', sortValue: (g) => g.scheduled, cell: (g) => <span className="tabular">{formatNumber(g.scheduled)}</span> },
    { key: 'missed', header: 'Missed', align: 'right', hideBelow: 'lg', sortValue: (g) => g.missed, cell: (g) => <span className={g.missed ? 'text-danger tabular' : 'tabular'}>{formatNumber(g.missed)}</span> },
    { key: 'tbs', header: 'To be sched.', align: 'right', hideBelow: 'lg', sortValue: (g) => g.toBeScheduled, cell: (g) => <span className="tabular">{formatNumber(g.toBeScheduled)}</span> },
    { key: 'rate', header: 'Completion', width: 170, sortValue: (g) => g.completionRate, cell: (g) => <RateCell rate={g.completionRate} total={g.total} /> },
  ];

  // Lowest completion first; ties → the bigger team (more people without their hour) first
  const managerRows = [...managers].sort((a, b) => a.completionRate - b.completionRate || b.total - b.completed - (a.total - a.completed) || a.label.localeCompare(b.label));
  const onTarget = groups.filter((g) => g.completionRate >= COMPLETION_TARGET).length;
  const chartData = [...groups].sort((a, b) => b.completionRate - a.completionRate).map((g) => ({ key: g.key, name: clip(groupKind === 'unit' ? g.shortLabel : g.label), rate: Math.round(g.completionRate * 100), completed: g.completed, total: g.total }));

  return (
    <Card padding="none">
      <CardHeader
        divider
        icon={Building2}
        title={view === 'groups' ? `Completion rate across ${nounPlural.toLowerCase()}` : 'Completion by manager'}
        subtitle={
          view === 'groups'
            ? `${scopeLabel} · ${formatMonth(month)} · ${onTarget} of ${groups.length} on the ${formatPercent(COMPLETION_TARGET)} target${clickable ? ` · click a ${noun.toLowerCase()} to drill in` : ''}`
            : `${scopeLabel} · ${formatMonth(month)} · lowest completion first`
        }
        actions={
          <Tabs<View>
            variant="segmented"
            value={view}
            onChange={setView}
            tabs={[
              { id: 'groups', label: nounPlural, count: groups.length },
              { id: 'managers', label: 'Managers', count: managers.length },
            ]}
          />
        }
      />
      {view === 'groups' ? (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,4fr)_minmax(0,8fr)]">
          <div className="border-b border-line px-5 pt-5 pb-3 xl:border-r xl:border-b-0">
            <BarChart
              data={chartData}
              xKey="name"
              yKey="rate"
              label="Completion"
              layout="vertical"
              domain={[0, 100]}
              height={Math.max(220, chartData.length * 38 + 50)}
              categoryWidth={groupKind === 'unit' ? 78 : 150}
              valueFormatter={(v) => `${v}%`}
              showValues
              target={{ value: COMPLETION_TARGET * 100, label: `Target ${formatPercent(COMPLETION_TARGET)}` }}
              tooltipFooter={(d) => `${formatNumber(d.completed as number)} of ${formatNumber(d.total as number)} pairs completed`}
              onBarClick={clickable ? (d) => onPickGroup(String(d.key)) : undefined}
            />
            {locked && groupKind === 'unit' && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-2">
                <Lock className="size-3" /> Your access is limited to one unit
              </p>
            )}
          </div>
          <DataTable
            columns={groupCols}
            rows={groups}
            rowKey={(g) => g.key}
            pageSize={0}
            dense
            onRowClick={clickable ? (g) => onPickGroup(g.key) : undefined}
            initialSort={{ key: 'rate', dir: 'desc' }}
            emptyTitle="No pairs"
            footer={
              groups.length > 1 ? (
                <tr className="bg-[#F8FAFD] text-[13px] font-semibold text-ink">
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-4 py-2.5 text-right tabular">{formatNumber(groups.reduce((s, g) => s + g.total, 0))}</td>
                  <td className="px-4 py-2.5 text-right tabular">{formatNumber(groups.reduce((s, g) => s + g.completed, 0))}</td>
                  <td className="hidden px-4 py-2.5 text-right tabular 2xl:table-cell">{formatNumber(groups.reduce((s, g) => s + g.scheduled, 0))}</td>
                  <td className="hidden px-4 py-2.5 text-right tabular xl:table-cell">{formatNumber(groups.reduce((s, g) => s + g.missed, 0))}</td>
                  <td className="hidden px-4 py-2.5 text-right tabular xl:table-cell">{formatNumber(groups.reduce((s, g) => s + g.toBeScheduled, 0))}</td>
                  <td className="px-4 py-2.5">
                    {(() => {
                      const t = groups.reduce((s, g) => s + g.total, 0);
                      const c = groups.reduce((s, g) => s + g.completed, 0);
                      return <RateCell rate={t ? c / t : 0} total={t} />;
                    })()}
                  </td>
                </tr>
              ) : undefined
            }
          />
        </div>
      ) : (
        <>
          <DataTable
            columns={managerCols}
            rows={managerRows}
            rowKey={(g) => g.key}
            pageSize={8}
            pageSizeOptions={[8, 25, 50]}
            dense
            minWidth={620}
            onRowClick={(g) => navigate(canViewEmployees ? `/employees/${g.key}` : `/sessions${query ? `${query}&` : '?'}manager=${g.key}`)}
            emptyTitle="No managers"
          />
          <p className="flex items-center gap-2 border-t border-line px-5 py-3 text-xs text-ink-2">
            <Badge tone="outline" size="sm">
              Tip
            </Badge>
            {canViewEmployees ? 'Open a manager to see their team and reporting line.' : 'Open a manager to see their team’s sessions.'}
          </p>
        </>
      )}
    </Card>
  );
}
