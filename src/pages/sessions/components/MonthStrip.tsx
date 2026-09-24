import { CalendarCheck, CalendarClock, CalendarX, CircleCheck, Minus, type LucideIcon } from 'lucide-react';
import type { MonthKey } from '@shared/types';
import { MONTHLY_STATUS_LABELS } from '@shared/content/mph';
import { formatDateTime, formatMonth } from '@shared/utils/dates';
import type { EmployeeMonth, EmployeeMonthStatus } from '@/lib/analytics-outcomes';
import { cn } from '@/lib/cn';

const META: Record<EmployeeMonthStatus, { icon: LucideIcon; cls: string; label: string }> = {
  completed: { icon: CircleCheck, cls: 'bg-success-soft text-success border-success/20', label: MONTHLY_STATUS_LABELS.completed },
  scheduled: { icon: CalendarCheck, cls: 'bg-info-soft text-info border-info/20', label: MONTHLY_STATUS_LABELS.scheduled },
  missed: { icon: CalendarX, cls: 'bg-danger-soft text-danger border-danger/20', label: MONTHLY_STATUS_LABELS.missed },
  to_be_scheduled: { icon: CalendarClock, cls: 'bg-warning-soft text-warning border-warning/25', label: MONTHLY_STATUS_LABELS.to_be_scheduled },
  not_eligible: { icon: Minus, cls: 'bg-canvas text-muted border-line', label: 'Not in a pair' },
};

/** Month-by-month MyPeopleHour status tiles (employee detail, pair drawer). */
export function MonthStrip({ items, highlight, className }: { items: EmployeeMonth[]; highlight?: MonthKey; className?: string }) {
  return (
    <ol className={cn('grid gap-2', className)} style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))` }}>
      {items.map((t) => {
        const status: EmployeeMonthStatus = t.awaitingUpdate ? 'scheduled' : t.status;
        const m = META[status];
        const label = t.awaitingUpdate ? 'Awaiting update' : m.label;
        const title = `${formatMonth(t.month)} · ${label}${t.session ? ` · ${formatDateTime(t.session.start)}` : ''}`;
        return (
          <li key={t.month} title={title} className="min-w-0">
            <p className={cn('mb-1 text-center text-xs font-medium', t.month === highlight ? 'text-primary' : 'text-ink-2')}>{formatMonth(t.month).slice(0, 3)}</p>
            <div className={cn('flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg border px-1 py-2 text-center', m.cls, t.month === highlight && 'ring-2 ring-primary/30 ring-offset-1')}>
              <m.icon className="size-4" />
              <span className="text-[11px] leading-tight font-medium">{label}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
