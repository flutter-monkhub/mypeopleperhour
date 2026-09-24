// Reports & export — /reports (SPEC A46).
// A report centre: eight CSV reports (MyPeopleHour, surveys, mentoring) with filters, a live preview of the
// first rows and a download, plus a print-friendly executive summary. Everything is limited to the admin's
// unit scope (a unit-scoped HR admin can only ever export their own unit — shown prominently).

import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Activity,
  CalendarCheck,
  CalendarX,
  ClipboardList,
  Download,
  FileSpreadsheet,
  HeartHandshake,
  Lock,
  Printer,
  ShieldCheck,
  Table2,
  UserCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { MonthKey } from '@shared/types';
import { fiscalQuarter, formatMonth, monthKeyToDate } from '@shared/utils/dates';
import { cn } from '@/lib/cn';
import { csvFilename } from '@/lib/csv';
import { formatNumber, pluralize } from '@/lib/format';
import { unitName } from '@/lib/lookup';
import { REPORTS, REPORT_BY_ID, REPORT_GROUPS, buildReport, defaultReportSurvey, downloadReport, exportableSurveys, reportFileStem, type ReportFilters, type ReportGroup, type ReportId } from '@/lib/reports';
import { useMonth, useScope } from '@/lib/scope';
import { useCurrentAdmin } from '@/store/auth';
import { useDb } from '@/store/db';
import { useUiStore } from '@/store/ui';
import { PageHeader } from '@/components/layout';
import { Badge, Button, Callout, Card, EmptyState, FilterSelect, IconButton, toast } from '@/components/ui';
import { PrintSummary } from './components/PrintSummary';
import { ReportPreview } from './components/ReportPreview';

const ICONS: Record<ReportId, LucideIcon> = {
  completion: CalendarCheck,
  sessions: Table2,
  missed: CalendarX,
  discipline: UserCheck,
  pulse: Activity,
  survey: ClipboardList,
  mentoring: HeartHandshake,
  pairs: Users,
};

const GROUP_TONE: Record<ReportGroup, string> = {
  mph: 'bg-primary-soft text-primary',
  surveys: 'bg-success-soft text-success',
  mentoring: 'bg-mentor-soft text-mentor',
};

/** FilterSelect shows an "All" option unless allLabel is null (undefined falls back to its default). */
const NO_ALL = null as unknown as string;

type Period = 'month' | 'last3' | 'all' | `q:${string}`;

/** Months covered by a period choice (programme months only). */
function monthsFor(period: Period, month: MonthKey, months: MonthKey[]): MonthKey[] {
  if (period === 'month') return [month];
  if (period === 'last3') return months.slice(-3);
  if (period === 'all') return months;
  const label = period.slice(2);
  return months.filter((m) => fiscalQuarter(monthKeyToDate(m)).label === label);
}

const periodLabel = (months: MonthKey[]) => (months.length === 0 ? '—' : months.length === 1 ? formatMonth(months[0], true) : `${formatMonth(months[0])} – ${formatMonth(months[months.length - 1])}`);

export default function ReportsPage() {
  const db = useDb();
  const admin = useCurrentAdmin();
  const { unitId, locked, unit } = useScope();
  const { month, months, setMonth, currentMonth } = useMonth();
  const setUnitId = useUiStore((s) => s.setUnitId);
  const [params, setParams] = useSearchParams();
  const [period, setPeriod] = useState<Period>('month');
  const [functionId, setFunctionId] = useState('');
  const [surveyId, setSurveyId] = useState('');
  const [cohortId, setCohortId] = useState('');
  const [printing, setPrinting] = useState(false);

  const requested = params.get('report') as ReportId | null;
  const selected = requested && REPORT_BY_ID[requested] ? REPORT_BY_ID[requested] : REPORTS[0];
  const quarters = useMemo(() => [...new Set(months.map((m) => fiscalQuarter(monthKeyToDate(m)).label))], [months]);
  const surveys = exportableSurveys(db);

  const filters: ReportFilters = useMemo(
    () => ({
      months: monthsFor(period, month, months),
      unitId,
      functionId: functionId || null,
      surveyId: surveyId || defaultReportSurvey(db)?.id || null,
      cohortId: cohortId || null,
    }),
    [period, month, months, unitId, functionId, surveyId, cohortId, db],
  );

  // Row counts for every card + the selected table (cheap: memoised analytics underneath)
  const tables = useMemo(() => Object.fromEntries(REPORTS.map((r) => [r.id, buildReport(db, r.id, filters)])) as Record<ReportId, ReturnType<typeof buildReport>>, [db, filters]);
  const table = tables[selected.id];
  const scopeLabel = unitId ? unitName(db, unitId) : 'All units';

  const download = (id: ReportId) => {
    const def = REPORT_BY_ID[id];
    const t = tables[id];
    if (!t.rows.length) {
      toast.warning('Nothing to export', t.notice ?? 'No rows match the current filters.');
      return;
    }
    downloadReport(t, csvFilename(reportFileStem(db, def, filters)));
    toast.success('CSV downloaded', `${def.title} · ${pluralize(t.rows.length, 'row')}${unitId ? ` · ${unitName(db, unitId)}` : ''}`);
  };

  const periodOptions = [
    { value: 'month', label: 'Single month' },
    ...quarters.map((q) => ({ value: `q:${q}`, label: q })),
    { value: 'last3', label: 'Last 3 months' },
    { value: 'all', label: `Since launch (${months[0] ? formatMonth(months[0]) : '—'})` },
  ];
  const f = selected.filters;
  const activeFilterCount = (functionId ? 1 : 0) + (cohortId ? 1 : 0) + (!locked && unitId ? 1 : 0);

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Reports & exports"
        subtitle="Download programme data as CSV (opens in Excel), or print a one-page executive summary for leadership reviews."
        actions={
          <Button variant="secondary" icon={Printer} onClick={() => setPrinting(true)}>
            Print summary
          </Button>
        }
      />

      {locked && unit ? (
        <Callout tone="warning" icon={Lock} title={`Your reports are limited to ${unit.name}`} className="mb-6">
          As HR admin for {unit.shortName}, every preview, export and the printed summary only include people in your unit. Mentoring reports include mentees from {unit.shortName}.
        </Callout>
      ) : (
        <Callout tone="neutral" icon={ShieldCheck} className="mb-6">
          Exports follow the unit selected in the top bar (now: <strong className="text-ink">{scopeLabel}</strong>). Private manager notes are never exported, and survey results are anonymised.
        </Callout>
      )}

      {/* ── report cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {REPORTS.map((r) => {
          const Icon = ICONS[r.id];
          const active = r.id === selected.id;
          const n = tables[r.id].rows.length;
          return (
            <div
              key={r.id}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              onClick={() => setParams({ report: r.id }, { replace: true })}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setParams({ report: r.id }, { replace: true }))}
              className={cn(
                'group flex cursor-pointer flex-col rounded-card border bg-surface p-4 text-left shadow-card transition-[box-shadow,border-color] duration-150',
                active ? 'border-primary shadow-[0_0_0_3px_rgba(47,86,232,.14)]' : 'border-line hover:border-line-strong hover:shadow-pop',
              )}
            >
              <div className="flex items-start gap-3">
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', GROUP_TONE[r.group])}>
                  <Icon className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold tracking-wide text-ink-2 uppercase">{REPORT_GROUPS[r.group]}</p>
                  <p className="mt-0.5 text-[14px] leading-5 font-semibold text-ink">{r.title}</p>
                </div>
              </div>
              <p className="mt-2 mb-3 line-clamp-2 min-h-10 text-[12.5px] leading-5 text-ink-2" title={r.description}>
                {r.description}
              </p>
              <div className="mt-auto flex items-center justify-between border-t border-line pt-3">
                <span className="text-xs text-ink-2 tabular">
                  <span className="font-semibold text-ink">{formatNumber(n)}</span> {n === 1 ? 'row' : 'rows'}
                </span>
                <IconButton
                  icon={Download}
                  label={`Download ${r.title} CSV`}
                  size="sm"
                  variant={active ? 'primary' : 'ghost'}
                  onClick={(e) => {
                    e.stopPropagation();
                    download(r.id);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── selected report ── */}
      <Card padding="none" className="mt-6">
        <div className="flex flex-col gap-4 border-b border-line px-5 py-4 sm:flex-row sm:items-start">
          <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', GROUP_TONE[selected.group])}>
            {(() => {
              const Icon = ICONS[selected.id];
              return <Icon className="size-5" />;
            })()}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] leading-6 font-semibold text-ink">{selected.title}</h2>
            <p className="mt-0.5 text-[13px] text-ink-2">{selected.description}</p>
          </div>
          <Button icon={FileSpreadsheet} onClick={() => download(selected.id)} disabled={!table.rows.length}>
            Download CSV
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-b border-line bg-[#FAFBFE] px-5 py-3">
          {f.includes('period') && (
            <>
              <FilterSelect label="Period" value={period} allLabel={NO_ALL} options={periodOptions} onChange={(v) => setPeriod(v as Period)} />
              {period === 'month' && (
                <FilterSelect
                  label="Month"
                  value={month}
                  allLabel={NO_ALL}
                  options={[...months].reverse().map((m) => ({ value: m, label: `${formatMonth(m, true)}${m === currentMonth ? ' (current)' : ''}` }))}
                  onChange={(v) => setMonth(v === currentMonth ? null : v)}
                />
              )}
            </>
          )}
          {f.includes('survey') && (
            <FilterSelect label="Survey" value={filters.surveyId ?? ''} allLabel={NO_ALL} options={surveys.map((s) => ({ value: s.id, label: s.title }))} onChange={setSurveyId} className="max-w-80" />
          )}
          {f.includes('cohort') && <FilterSelect label="Cohort" value={cohortId} allLabel="All cohorts" options={db.cohorts.map((c) => ({ value: c.id, label: c.name }))} onChange={setCohortId} />}
          {f.includes('unit') && (
            <FilterSelect
              label="Unit"
              value={unitId ?? ''}
              allLabel={locked ? (NO_ALL) : 'All units'}
              disabled={locked}
              options={db.units.filter((u) => !locked || u.id === unitId).map((u) => ({ value: u.id, label: u.name }))}
              onChange={(v) => setUnitId(v || null)}
            />
          )}
          {f.includes('function') && <FilterSelect label="Function" value={functionId} allLabel="All functions" options={db.functions.map((x) => ({ value: x.id, label: x.name }))} onChange={setFunctionId} />}
          {locked && (
            <Badge tone="warning" icon={Lock}>
              {unit?.shortName} only
            </Badge>
          )}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setFunctionId('');
                setCohortId('');
                if (!locked) setUnitId(null);
              }}
              className="text-[13px] font-medium text-primary hover:underline"
            >
              Reset
            </button>
          )}
          <span className="ml-auto text-xs text-ink-2">{f.includes('period') ? periodLabel(filters.months) : f.includes('survey') ? 'Submitted responses' : 'All quarters / whole programme'}</span>
        </div>

        {table.notice && (
          <div className="px-5 pt-4">
            <Callout tone="neutral" icon={ShieldCheck}>
              {table.notice}
            </Callout>
          </div>
        )}

        {table.rows.length === 0 ? (
          <EmptyState icon={FileSpreadsheet} title="No rows for these filters" message={table.notice ? undefined : 'Try a longer period, another unit or clear the function filter.'} />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4 pb-2 text-xs text-ink-2">
              <span>
                Preview · first {Math.min(10, table.rows.length)} of <strong className="text-ink">{pluralize(table.rows.length, 'row')}</strong> · {table.columns.length} columns
              </span>
              <span className="text-muted">The CSV contains every row and column.</span>
            </div>
            <ReportPreview table={table} />
          </>
        )}
        {selected.note && (
          <p className="flex items-center gap-2 border-t border-line px-5 py-3 text-xs text-ink-2">
            <ShieldCheck className="size-4 shrink-0 text-success" /> {selected.note}
          </p>
        )}
      </Card>

      <PrintSummary open={printing} onClose={() => setPrinting(false)} db={db} month={month} unitId={unitId} scopeLabel={scopeLabel} preparedBy={admin?.name ?? 'Admin'} />
    </>
  );
}
