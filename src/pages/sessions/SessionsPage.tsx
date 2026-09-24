// Sessions (SPEC §6.2 A17–A20): every MyPeopleHour conversation of the selected month (global month
// selector) with tabs per status, filters, CSV export and a detail drawer with admin actions.

import { Link } from 'react-router-dom';
import { Archive, CalendarClock, MessageSquareWarning } from 'lucide-react';
import { formatMonth } from '@shared/utils/dates';
import { LinkButton } from '@/components/ui';
import { PageHeader } from '@/components/layout';
import { useCan } from '@/lib/rbac';
import { useMonth, useScope } from '@/lib/scope';
import { SkeletonTable } from '@/components/ui';
import { useWarmup } from '@/pages/dashboard/components/useWarmup';
import { SessionsExplorer } from './components/SessionsExplorer';

export default function SessionsPage() {
  const { month, currentMonth } = useMonth();
  const { unit, locked } = useScope();
  const canEdit = useCan('sessions.edit');
  const ready = useWarmup('sessions', 300);
  const closed = month < currentMonth;

  return (
    <>
      <PageHeader
        eyebrow="MyPeopleHour"
        title="Sessions"
        subtitle={
          <>
            Every conversation in <span className="font-medium text-ink">{formatMonth(month, true)}</span>
            {unit ? ` · ${unit.name}` : ' · all units'}
            {closed ? ' — this month is closed. ' : '. '}
            {canEdit ? 'Open a session to see its history, nudge the manager or update it on their behalf.' : 'Open a session to see its details and status history.'}
          </>
        }
        meta={
          locked ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
              <CalendarClock className="size-3.5" /> Showing {unit?.name} only
            </span>
          ) : undefined
        }
        actions={
          <>
            <LinkButton to="/sessions/missed-reasons" variant="secondary" icon={MessageSquareWarning}>
              Missed reasons
            </LinkButton>
            <LinkButton to={`/sessions/archive${closed ? `?month=${month}` : ''}`} variant="secondary" icon={Archive}>
              Archive
            </LinkButton>
          </>
        }
      />
      {ready ? (
        <SessionsExplorer month={month} />
      ) : (
        <div className="rounded-card border border-line bg-white shadow-card">
          <SkeletonTable rows={8} cols={6} />
        </div>
      )}
      {closed && (
        <p className="mt-4 text-center text-xs text-muted">
          Looking back? The <Link to={`/sessions/archive?month=${month}`} className="text-primary hover:underline">archive</Link> has a month summary and export.
        </p>
      )}
    </>
  );
}
