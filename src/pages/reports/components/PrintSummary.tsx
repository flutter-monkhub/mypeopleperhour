// One-page executive summary (SPEC A46 "print-friendly view"). Rendered full-screen in a portal with
// its own print stylesheet: when printing, everything else on the page is hidden and the A4 sheet
// prints on its own (window.print() → "Save as PDF" works too).

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import type { DemoDatabase, ID, MonthKey } from '@shared/types';
import { MPH_TAGLINE } from '@shared/content/mph';
import { monthKey } from '@shared/utils/dates';
import { MENTORING_NAME } from '@shared/content/mentoring';
import { formatDate, formatMonth, formatNumber, formatPercent } from '@/lib/format';
import { MIN_GROUP } from '@/lib/analytics-pulse';
import { executiveSummary } from '@/lib/reports';
import { Button } from '@/components/ui';

const PRINT_CSS = `
@media print {
  @page { size: A4 portrait; margin: 12mm; }
  html, body { background: #fff !important; }
  body > *:not(.print-summary-root) { display: none !important; }
  .print-summary-root { position: static !important; inset: auto !important; overflow: visible !important; background: #fff !important; padding: 0 !important; }
  .print-summary-root .no-print { display: none !important; }
  .print-summary-root .print-sheet { box-shadow: none !important; border: 0 !important; margin: 0 !important; padding: 0 !important; max-width: none !important; width: auto !important; zoom: 0.86; }
  .print-summary-root .avoid-break { break-inside: avoid; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}`;

const signed = (n: number | null | undefined, digits = 0) => (n == null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(digits)}`);

function Bar({ value, color = '#2F56E8' }: { value: number; color?: string }) {
  return (
    <span className="block h-2 w-full overflow-hidden rounded-full bg-[#EDF0F6]">
      <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, background: color }} />
    </span>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-[#E5E9F2] px-3 py-2.5">
      <p className="text-[10.5px] font-medium tracking-wide text-[#475569] uppercase">{label}</p>
      <p className="mt-0.5 text-[20px] leading-7 font-bold text-[#0F172A] tabular">{value}</p>
      {sub && <p className="text-[10.5px] text-[#475569]">{sub}</p>}
    </div>
  );
}

function Section({ n, title, question, children }: { n: number; title: string; question: string; children: ReactNode }) {
  return (
    <section className="avoid-break mt-6">
      <div className="mb-3 flex items-baseline gap-2 border-b-2 border-[#0F1D4A] pb-1.5">
        <span className="text-[11px] font-bold text-[#2F56E8]">{n}</span>
        <h2 className="text-[14px] font-bold text-[#0F1D4A]">{title}</h2>
        <span className="ml-auto text-[10.5px] text-[#475569] italic">{question}</span>
      </div>
      {children}
    </section>
  );
}

export interface PrintSummaryProps {
  open: boolean;
  onClose: () => void;
  db: DemoDatabase;
  month: MonthKey;
  unitId: ID | null;
  scopeLabel: string;
  preparedBy: string;
}

export function PrintSummary({ open, onClose, db, month, unitId, scopeLabel, preparedBy }: PrintSummaryProps) {
  useEffect(() => {
    if (!open) return;
    const style = document.createElement('style');
    style.dataset.printSummary = '';
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      style.remove();
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;
  const x = executiveSummary(db, month, unitId);
  const { mph, pulse, mentoring } = x;
  const inProgress = month === monthKey(new Date());
  const support = pulse?.categories.find((c) => c.category === 'Manager Support')?.avg ?? null;
  const rateDelta = mph.prev ? (mph.summary.completionRate - mph.prev.completionRate) * 100 : null;

  return createPortal(
    <div className="print-summary-root fixed inset-0 z-[95] overflow-y-auto bg-[#E9EDF5] px-4 py-6" role="dialog" aria-modal="true" aria-label="Executive summary">
      <div className="no-print sticky top-0 z-10 mx-auto mb-4 flex max-w-[210mm] items-center gap-3 rounded-xl border border-line bg-white/95 px-4 py-3 shadow-card backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Executive summary · print preview</p>
          <p className="text-xs text-ink-2">A4, one page. Use your browser’s “Save as PDF” to share it.</p>
        </div>
        <Button variant="secondary" icon={X} onClick={onClose}>
          Close
        </Button>
        <Button icon={Printer} onClick={() => window.print()} autoFocus>
          Print
        </Button>
      </div>

      <article className="print-sheet mx-auto max-w-[210mm] bg-white px-[14mm] py-[12mm] text-[#0F172A] shadow-pop">
        <header className="flex items-start gap-4 border-b border-[#E5E9F2] pb-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-semibold tracking-[.12em] text-[#2F56E8] uppercase">MyPeopleHour & {MENTORING_NAME}</p>
            <h1 className="mt-1 text-[22px] leading-7 font-bold">Executive summary · {formatMonth(month, true)}</h1>
            <p className="mt-1 text-[11.5px] text-[#475569]">
              {scopeLabel} · prepared by {preparedBy} on {formatDate(new Date())}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <img src="/brand/rpsg-logo.png" alt="RP-Sanjiv Goenka Group" className="h-9 w-auto object-contain" />
            <img src="/brand/pcbl-logo.png" alt="PCBL Chemical" className="h-9 w-auto object-contain" />
          </div>
        </header>
        <p className="mt-3 text-[11.5px] text-[#475569] italic">“{MPH_TAGLINE}”</p>

        <Section n={1} title="Completion discipline" question="Are the conversations happening?">
          <div className="grid grid-cols-4 gap-2.5">
            <Tile label="Completion rate" value={formatPercent(mph.summary.completionRate)} sub={`${formatNumber(mph.summary.completed)} of ${formatNumber(mph.summary.total)} pairs · ${signed(rateDelta)} pts vs last month${inProgress ? ' (month in progress)' : ''}`} />
            <Tile label="Scheduled" value={formatNumber(mph.summary.scheduled)} sub="booked, not yet held" />
            <Tile label="To be scheduled" value={formatNumber(mph.summary.toBeScheduled)} sub={`${formatNumber(mph.flaggedPairs)} pairs flagged`} />
            <Tile label="Missed" value={formatNumber(mph.summary.missed)} sub={`${mph.reasons.business} business · ${mph.reasons.personal} personal`} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-5">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-[#475569]">Monthly trend</p>
              <table className="w-full text-[11.5px]">
                <tbody>
                  {mph.trend.map((t) => (
                    <tr key={t.month}>
                      <td className="w-20 py-0.5 text-[#475569]">{t.label}</td>
                      <td className="py-0.5">
                        <Bar value={t.rate} color={t.month === month ? '#2F56E8' : '#8FA5F3'} />
                      </td>
                      <td className="w-12 py-0.5 text-right font-semibold tabular">{formatPercent(t.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <p className="mb-1.5 text-[11px] font-semibold text-[#475569]">By unit · {formatMonth(month)}</p>
              <table className="w-full text-[11.5px]">
                <tbody>
                  {mph.byUnit.map((u) => (
                    <tr key={u.key}>
                      <td className="w-28 truncate py-0.5 text-[#475569]">{u.shortLabel}</td>
                      <td className="py-0.5">
                        <Bar value={u.completionRate} color="#16A34A" />
                      </td>
                      <td className="w-12 py-0.5 text-right font-semibold tabular">{formatPercent(u.completionRate)}</td>
                      <td className="w-14 py-0.5 text-right text-[#475569] tabular">
                        {u.completed}/{u.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-[#475569]">
            {mph.repeatManagers ? `${mph.repeatManagers} manager${mph.repeatManagers > 1 ? 's have' : ' has'} missed two or more sessions in the last three months.` : 'No manager has repeated misses in the last three months.'}
          </p>
        </Section>

        <Section n={2} title="Quality of conversations" question="Are they meaningful?">
          <div className="grid grid-cols-3 gap-2.5">
            <Tile label="Conversation score" value={mph.avgRating == null ? '—' : `${mph.avgRating.toFixed(1)} / 5`} sub={`rated by ${formatNumber(mph.ratedSessions)} team members this month`} />
            <Tile label="Manager support" value={support != null ? `${support.toFixed(1)} / 5` : '—'} sub={pulse ? `pulse category · ${pulse.period}` : undefined} />
            <Tile label="Discipline effect" value={pulse?.indexGap != null ? signed(pulse.indexGap, 2) : '—'} sub="pulse index, ≥ 90% vs < 70% managers" />
          </div>
        </Section>

        <Section n={3} title="Outcome indicator — quarterly pulse" question="Are they making a difference?">
          {pulse ? (
            <div className="grid grid-cols-[1fr_1.4fr] gap-5">
              <div className="grid grid-cols-2 gap-2.5">
                <Tile label="Pulse index" value={pulse.index == null ? '—' : pulse.index.toFixed(2)} sub={`${signed(pulse.index != null && pulse.prevIndex != null ? pulse.index - pulse.prevIndex : null, 2)} vs ${pulse.prevPeriod ?? '—'}`} />
                <Tile label="eNPS" value={signed(pulse.enps)} sub={`${signed(pulse.enps != null && pulse.prevEnps != null ? pulse.enps - pulse.prevEnps : null)} vs ${pulse.prevPeriod ?? '—'}`} />
                <Tile label="Response rate" value={formatPercent(pulse.responseRate)} sub={`${formatNumber(pulse.respondents)} responses${pulse.live ? ' · still open' : ''}`} />
                <Tile label="Quarter" value={pulse.period} sub="anonymous, aggregated" />
              </div>
              <table className="w-full self-start text-[11.5px]">
                <thead>
                  <tr className="text-[10.5px] text-[#475569]">
                    <th className="pb-1 text-left font-semibold">Category</th>
                    <th className="pb-1 text-right font-semibold">{pulse.prevPeriod ?? ''}</th>
                    <th className="pb-1 text-right font-semibold">{pulse.period}</th>
                    <th className="pb-1 text-right font-semibold">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {pulse.categories.map((c) => (
                    <tr key={c.category} className="border-t border-[#EEF1F6]">
                      <td className="py-1">{c.category}</td>
                      <td className="py-1 text-right text-[#475569] tabular">{c.prev == null ? '—' : c.prev.toFixed(2)}</td>
                      <td className="py-1 text-right font-semibold tabular">{c.avg == null ? '—' : c.avg.toFixed(2)}</td>
                      <td className="py-1 text-right tabular">{signed(c.avg != null && c.prev != null ? c.avg - c.prev : null, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[11.5px] text-[#475569]">Not enough pulse responses for this scope (minimum {MIN_GROUP}).</p>
          )}
        </Section>

        <Section n={4} title={MENTORING_NAME} question="Building connections beyond functions">
          <div className="grid grid-cols-4 gap-2.5">
            <Tile label="Active pairs" value={formatNumber(mentoring.activePairs)} />
            <Tile label="Sessions this month" value={formatNumber(mentoring.completedInMonth)} sub={`${formatNumber(mentoring.hoursInMonth)} hours invested · ${formatNumber(mentoring.completedTotal)} to date`} />
            <Tile label="Mentee sentiment" value={formatPercent(mentoring.positiveShare)} sub={mentoring.avgRating == null ? 'no feedback yet' : `positive · avg rating ${mentoring.avgRating.toFixed(1)}/5`} />
            <Tile label="Mentor of the month" value={mentoring.mentorOfMonth?.name.split(' ')[0] ?? '—'} sub={mentoring.mentorOfMonth ? `${mentoring.mentorOfMonth.name} · ${mentoring.mentorOfMonth.sessions} sessions` : 'no sessions this month'} />
          </div>
        </Section>

        <footer className="mt-7 flex items-center justify-between border-t border-[#E5E9F2] pt-2.5 text-[10px] text-[#64748B]">
          <span>Confidential — internal use. Survey results are aggregated; groups under {MIN_GROUP} are never shown. Manager notes are never included.</span>
          <span className="shrink-0 pl-4">PCBL Chemical · RP-Sanjiv Goenka Group</span>
        </footer>
      </article>
    </div>,
    document.body,
  );
}
