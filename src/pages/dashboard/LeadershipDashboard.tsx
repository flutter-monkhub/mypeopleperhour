// Leadership dashboard (SPEC §6.2 A5–A10): completion discipline, quality of conversations and
// outcomes across PCBL. Global unit + month come from the top bar; function & department are local
// filters kept in the URL (?fn=&dept=) so the view is linkable and carried into the Sessions page.

import { useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { Download, Filter, Lock, RotateCcw, Users } from 'lucide-react';
import { formatMonth } from '@shared/utils/dates';
import { PageHeader } from '@/components/layout';
import { Button, Card, EmptyState, FilterBar, FilterSelect, Skeleton, SkeletonCard, toast } from '@/components/ui';
import {
  completionByDepartment,
  completionByManager,
  completionByUnit,
  completionSummary,
  describeFilters,
  missedFlags,
  missedReasonSplit,
  monthlyTrend,
  pairMonthStatuses,
} from '@/lib/analytics';
import { completionPulseCorrelation, missedRecords, pulseTrend, qualityMetrics } from '@/lib/analytics-outcomes';
import { useCan } from '@/lib/rbac';
import { useMonth, useScope, useScopeFilters } from '@/lib/scope';
import { useDb } from '@/store/db';
import { useUiStore } from '@/store/ui';
import { CompletionBreakdown } from './components/CompletionBreakdown';
import { KpiSection } from './components/KpiSection';
import { CorrelationCard, MeasurementLevels, PulseTrendCard } from './components/Measurement';
import { MissedFlagsCard, MissedReasonsCard } from './components/MissedIndicators';
import { carryQuery, SectionTitle } from './components/shared';
import { ComparisonCard, TrendCard } from './components/TrendCards';
import { useWarmup } from './components/useWarmup';
import { exportCompletionReport } from './components/exportReport';

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-card border border-line bg-white p-5 shadow-card sm:col-span-2 xl:col-span-1 xl:row-span-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-6 size-32 rounded-full" />
          <Skeleton className="mt-5 h-4 w-40" />
          <Skeleton className="mt-2 h-4 w-28" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} lines={1} />
        ))}
      </div>
      <div className="rounded-card border border-line bg-white p-5 shadow-card">
        <Skeleton className="h-4 w-56" />
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-5" />
            ))}
          </div>
          <div className="flex flex-col gap-3">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-5" />
            ))}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <SkeletonCard lines={6} />
        <SkeletonCard lines={6} />
      </div>
    </div>
  );
}

export default function LeadershipDashboard() {
  const db = useDb();
  const ready = useWarmup('dashboard');
  const [params, setParams] = useSearchParams();
  const { month, months, currentMonth } = useMonth();
  const { unitId, locked } = useScope();
  const setUnitId = useUiStore((s) => s.setUnitId);
  const canExport = useCan('reports.export');
  const canViewEmployees = useCan('employees.view');
  const canViewSurveys = useCan('surveys.view');
  const { hash } = useLocation();
  useEffect(() => {
    if (!ready || !hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [ready, hash]);

  // ── local filters (URL) ──
  const fnParam = params.get('fn') ?? '';
  const functionId = db.functions.some((f) => f.id === fnParam) ? fnParam : '';
  const deptParam = params.get('dept') ?? '';
  const fnDepts = functionId ? (db.functions.find((f) => f.id === functionId)?.departments ?? []) : db.functions.flatMap((f) => f.departments);
  const department = fnDepts.includes(deptParam) ? deptParam : '';
  const setFilter = (next: { fn?: string; dept?: string }) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    setParams(p, { replace: true });
  };
  const filters = useScopeFilters({ functionId: functionId || null, department: department || null });
  const query = carryQuery({ fn: functionId, dept: department });

  // ── data ──
  const idx = months.indexOf(month);
  const prevMonth = idx > 0 ? months[idx - 1] : undefined;
  const trendMonths = useMemo(() => months.slice(0, idx + 1), [months, idx]);
  const d = useMemo(() => {
    const summary = completionSummary(db, month, filters);
    const prev = prevMonth ? completionSummary(db, prevMonth, filters) : undefined;
    const pairs = pairMonthStatuses(db, month, filters);
    const quality = qualityMetrics(db, [month], filters);
    const prevQuality = prevMonth ? qualityMetrics(db, [prevMonth], filters) : undefined;
    const groupKind: 'unit' | 'department' = filters.unitId ? 'department' : 'unit';
    const groups = groupKind === 'unit' ? completionByUnit(db, month, filters) : completionByDepartment(db, month, filters);
    const managers = completionByManager(db, month, filters);
    const trend = monthlyTrend(db, trendMonths, filters);
    const flags = missedFlags(db, month, filters);
    const split = missedReasonSplit(db, [month], filters);
    const windowMonths = trendMonths.slice(-3);
    const records = missedRecords(db, [month], filters);
    const windowRecords = missedRecords(db, windowMonths, filters);
    const quarters = pulseTrend(db, filters, months[0]);
    const reportable = quarters.filter((q) => !q.suppressed);
    const latest = reportable[reportable.length - 1];
    const previous = reportable[reportable.length - 2];
    const corrSurvey = [...quarters].reverse().find((q) => !q.baseline && !q.suppressed)?.survey;
    const correlation = corrSurvey ? completionPulseCorrelation(db, corrSurvey, months, filters) : null;
    return {
      summary,
      prev,
      awaiting: pairs.filter((p) => p.awaitingUpdate).length,
      quality,
      prevQuality,
      groupKind,
      groups,
      managers,
      trend,
      flags,
      split,
      windowRecords,
      windowMonths,
      records,
      quarters,
      latest,
      previous,
      correlation,
    };
  }, [db, month, prevMonth, filters, trendMonths, months]);

  const scopeLabel = describeFilters(db, filters);
  const activeLocal = (functionId ? 1 : 0) + (department ? 1 : 0) + (unitId && !locked ? 1 : 0);
  const resetLocal = () => {
    setFilter({ fn: '', dept: '' });
    if (!locked) setUnitId(null);
  };

  const pickGroup = (key: string) => {
    if (d.groupKind === 'unit') {
      if (!locked) setUnitId(key);
      return;
    }
    const fn = db.functions.find((f) => f.departments.includes(key));
    setFilter({ fn: fn?.id ?? functionId, dept: key });
  };

  const exportReport = () => {
    exportCompletionReport(db, { month, filters, groups: d.groups, groupKind: d.groupKind, managers: d.managers });
    toast.success('Report exported', `Completion by ${d.groupKind} and manager · ${formatMonth(month)}`);
  };

  return (
    <>
      <PageHeader
        eyebrow="MyPeopleHour"
        title="Leadership dashboard"
        subtitle="One hour. Every month. Every person. Are the conversations happening, are they meaningful, and are they making a difference?"
        actions={
          canExport && (
            <Button variant="secondary" icon={Download} onClick={exportReport} disabled={!d.summary.total}>
              Export report
            </Button>
          )
        }
      />

      <FilterBar
        className="mb-6"
        activeCount={activeLocal}
        onReset={resetLocal}
        actions={
          <span className="hidden items-center gap-2 text-[13px] text-ink-2 md:flex">
            {locked && <Lock className="size-3.5 text-warning" />}
            <span className="max-w-[420px] truncate">
              <span className="font-medium text-ink">{scopeLabel}</span> · {formatMonth(month)}
            </span>
          </span>
        }
      >
        <FilterSelect
          label="Unit"
          value={unitId ?? ''}
          allLabel="All units"
          disabled={locked}
          onChange={(v) => setUnitId(v || null)}
          options={db.units.map((u) => ({ value: u.id, label: u.name }))}
        />
        <FilterSelect
          label="Function"
          value={functionId}
          allLabel="All functions"
          onChange={(v) => setFilter({ fn: v, dept: v && department && !db.functions.find((f) => f.id === v)?.departments.includes(department) ? '' : department })}
          options={db.functions.map((f) => ({ value: f.id, label: f.name }))}
        />
        <FilterSelect label="Department" value={department} allLabel="All departments" onChange={(v) => setFilter({ dept: v })} options={fnDepts.map((x) => ({ value: x, label: x }))} />
      </FilterBar>

      {!ready ? (
        <DashboardSkeleton />
      ) : !d.summary.total ? (
        <Card padding="none">
          <EmptyState
            size="lg"
            icon={Users}
            title="No MyPeopleHour pairs for this selection"
            message={`Nobody in ${scopeLabel} had an active manager pairing in ${formatMonth(month)}. Try another function, department or unit.`}
            action={
              <>
                {activeLocal > 0 && (
                  <Button variant="secondary" icon={RotateCcw} onClick={resetLocal}>
                    Reset filters
                  </Button>
                )}
                {unitId && !locked && (
                  <Button variant="secondary" icon={Filter} onClick={() => setUnitId(null)}>
                    All units
                  </Button>
                )}
              </>
            }
          />
        </Card>
      ) : (
        <>
          <KpiSection
            month={month}
            currentMonth={currentMonth}
            prevMonth={prevMonth}
            summary={d.summary}
            prev={d.prev}
            quality={d.quality}
            prevQuality={d.prevQuality}
            flags={d.flags}
            awaiting={d.awaiting}
            query={query}
          />

          <SectionTitle title="Completion discipline" subtitle={`Where the hour is happening — ${scopeLabel}`} />
          <CompletionBreakdown
            db={db}
            month={month}
            groups={d.groups}
            groupKind={d.groupKind}
            managers={d.managers}
            scopeLabel={scopeLabel}
            locked={locked}
            onPickGroup={pickGroup}
            canViewEmployees={canViewEmployees}
            query={query}
          />
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <TrendCard trend={d.trend} month={month} currentMonth={currentMonth} />
            <ComparisonCard trend={d.trend} groups={d.groups} groupKind={d.groupKind} month={month} />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <MissedFlagsCard db={db} month={month} flags={d.flags} canViewEmployees={canViewEmployees} query={query} />
            <MissedReasonsCard month={month} split={d.split} records={d.records} windowRecords={d.windowRecords} windowMonths={d.windowMonths} />
          </div>

          <SectionTitle title="Three levels of measurement" subtitle="Completion discipline → quality of conversations → outcome indicator. Pulse metrics use the latest quarterly survey." />
          <MeasurementLevels summary={d.summary} quality={d.quality} latest={d.latest} previous={d.previous} correlation={d.correlation} monthLabel={formatMonth(month)} />
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
            <PulseTrendCard quarters={d.quarters} canOpenPulse={canViewSurveys} />
            <CorrelationCard correlation={d.correlation} />
          </div>
          <p className="mt-6 text-center text-xs text-muted">
            Months are counted per manager ↔ report pair · completion = pairs completed ÷ active pairs · {formatMonth(months[0] ?? month)} launch
          </p>
        </>
      )}
    </>
  );
}
