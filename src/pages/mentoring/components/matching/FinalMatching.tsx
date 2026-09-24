// A37 — Final matching: mentor-accepted proposals awaiting HR confirmation (single or bulk),
// proposals still with mentors (withdraw), and declined proposals that need a re-match.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCheck, CircleCheck, Hourglass, PartyPopper, Undo2, UserRoundX } from 'lucide-react';
import type { DemoDatabase, MentorMatch } from '@shared/types';
import { validateMatch } from '@shared/logic';
import { cn } from '@/lib/cn';
import { formatDate, pluralize, timeAgo } from '@/lib/format';
import { employeeMap, functionName } from '@/lib/lookup';
import { openMatchFor } from '@/lib/analytics-mentoring';
import { confirmMatch, confirmMatches, withdrawProposal } from '@/store/actions';
import { Avatar, Badge, Button, Card, CardHeader, Checkbox, EmptyState, confirm, toast } from '@/components/ui';
import { RuleDots } from '../RuleChecks';

function Pair({ db, m }: { db: DemoDatabase; m: MentorMatch }) {
  const emp = employeeMap(db);
  const mentee = emp.get(m.menteeId);
  const mentor = emp.get(m.mentorId);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <div className="flex shrink-0 gap-1">
        <Avatar name={mentee?.name ?? m.menteeId} size="sm" />
        <Avatar name={mentor?.name ?? m.mentorId} size="sm" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-ink">
          <Link to={`/mentoring/applications/${m.applicationId}`} className="hover:text-mentor hover:underline" onClick={(e) => e.stopPropagation()}>
            {mentee?.name}
          </Link>
          <span className="mx-1.5 font-normal text-muted">→</span>
          {mentor?.name}
        </p>
        <p className="truncate text-xs text-ink-2">
          {functionName(db, mentee?.functionId)} → {functionName(db, mentor?.functionId)}
        </p>
      </div>
    </div>
  );
}

export function FinalMatching({ db, cohortId, canEdit, onRematch }: { db: DemoDatabase; cohortId: string; canEdit: boolean; onRematch: (appId: string) => void }) {
  const inCohort = useMemo(() => db.matches.filter((m) => m.cohortId === cohortId), [db.matches, cohortId]);
  const accepted = inCohort.filter((m) => m.status === 'accepted').sort((a, b) => (a.respondedAt ?? '').localeCompare(b.respondedAt ?? ''));
  const proposed = inCohort.filter((m) => m.status === 'proposed').sort((a, b) => a.proposedAt.localeCompare(b.proposedAt));
  const declined = inCohort
    .filter((m) => m.status === 'declined')
    .filter((m) => {
      const app = db.applications.find((a) => a.id === m.applicationId);
      return app && (app.status === 'under_review' || app.status === 'submitted') && !openMatchFor(db, app.id);
    })
    .sort((a, b) => (b.respondedAt ?? '').localeCompare(a.respondedAt ?? ''));
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [now] = useState(() => Date.now());
  const pickedIds = accepted.filter((m) => picked.has(m.id)).map((m) => m.id);
  const allPicked = accepted.length > 0 && pickedIds.length === accepted.length;
  const cohortName = db.cohorts.find((c) => c.id === cohortId)?.name;

  const confirmOne = async (m: MentorMatch) => {
    const emp = employeeMap(db);
    const ok = await confirm({
      title: 'Confirm this final match?',
      message: `${emp.get(m.menteeId)?.name} and ${emp.get(m.mentorId)?.name} become an active pair in ${cohortName}. Both are notified in the app.`,
      confirmLabel: 'Confirm match',
    });
    if (!ok) return;
    try {
      confirmMatch(m.id);
      toast.success('Match confirmed', `${emp.get(m.menteeId)?.name} ↔ ${emp.get(m.mentorId)?.name} is now active.`);
    } catch (e) {
      toast.error('Couldn’t confirm', e instanceof Error ? e.message : String(e));
    }
  };

  const confirmBulk = async () => {
    const ok = await confirm({
      title: `Confirm ${pluralize(pickedIds.length, 'match', 'matches')}?`,
      message: `Each pair becomes active in ${cohortName} and both people are notified. Rules are re-checked for every pair first.`,
      confirmLabel: `Confirm ${pickedIds.length}`,
    });
    if (!ok) return;
    const r = confirmMatches(pickedIds);
    setPicked(new Set());
    if (r.confirmed.length) toast.success(`${pluralize(r.confirmed.length, 'match', 'matches')} confirmed`, 'Mentors and mentees have been notified.');
    if (r.failed.length) toast.error(`${r.failed.length} couldn’t be confirmed`, r.failed.map((f) => f.error).join(' · '));
  };

  const withdraw = async (m: MentorMatch) => {
    const emp = employeeMap(db);
    const ok = await confirm({
      title: `Withdraw the request to ${emp.get(m.mentorId)?.name}?`,
      message: `${emp.get(m.menteeId)?.name}’s application goes back to the queue so you can propose someone else. The mentor is told no action is needed.`,
      confirmLabel: 'Withdraw request',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      withdrawProposal(m.id);
      toast.success('Request withdrawn', `${emp.get(m.menteeId)?.name} is back in the queue.`);
    } catch (e) {
      toast.error('Couldn’t withdraw', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Ready for final match */}
      <Card padding="none">
        <CardHeader
          divider
          icon={CheckCheck}
          iconTone="success"
          title="Ready for final match"
          subtitle="Mentors accepted these proposals. Confirming makes the pair active and notifies both."
          actions={
            canEdit &&
            accepted.length > 0 && (
              <Button variant="mentor" icon={CheckCheck} disabled={!pickedIds.length} onClick={() => void confirmBulk()}>
                {pickedIds.length ? `Confirm ${pickedIds.length} selected` : 'Select to confirm'}
              </Button>
            )
          }
        />
        {accepted.length === 0 ? (
          <EmptyState
            tone="mentor"
            icon={PartyPopper}
            title="Nothing waiting for final match"
            message={
              proposed.length
                ? `${pluralize(proposed.length, 'proposal')} still with mentors — accepted ones land here for you to confirm.`
                : 'When a mentor accepts a proposal, it lands here for HR to confirm.'
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {canEdit && (
              <li className="flex items-center gap-3 bg-[#F8FAFD] px-5 py-2 text-xs font-semibold text-ink-2">
                <Checkbox
                  checked={allPicked}
                  indeterminate={!allPicked && pickedIds.length > 0}
                  onChange={(v) => setPicked(new Set(v ? accepted.map((m) => m.id) : []))}
                  label="Select all"
                />
              </li>
            )}
            {accepted.map((m) => {
              const rules = validateMatch(db, m.mentorId, m.menteeId, m.cohortId);
              const ok = rules.every((r) => r.ok);
              return (
                <li key={m.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3', picked.has(m.id) && 'bg-mentor-soft/40')}>
                  {canEdit && (
                    <Checkbox
                      checked={picked.has(m.id)}
                      onChange={(v) =>
                        setPicked((s) => {
                          const n = new Set(s);
                          if (v) n.add(m.id);
                          else n.delete(m.id);
                          return n;
                        })
                      }
                    />
                  )}
                  <Pair db={db} m={m} />
                  <span className="flex items-center gap-2 text-xs text-ink-2">
                    <CircleCheck className="size-3.5 text-success" /> Accepted {timeAgo(m.respondedAt ?? m.proposedAt)}
                  </span>
                  <span className="flex items-center gap-2">
                    <RuleDots rules={rules} />
                    {!ok && (
                      <Badge tone="danger" size="sm">
                        Rule now fails
                      </Badge>
                    )}
                  </span>
                  {canEdit && (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => void withdraw(m)}>
                        Withdraw
                      </Button>
                      <Button variant="mentor" size="sm" icon={CircleCheck} onClick={() => void confirmOne(m)} disabled={!ok}>
                        Confirm match
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 2xl:grid-cols-2">
        {/* With mentors */}
        <Card padding="none">
          <CardHeader
            divider
            icon={Hourglass}
            iconTone="warning"
            title="Awaiting mentor reply"
            subtitle="Proposals the mentor hasn’t accepted or declined yet."
            actions={<Badge tone="warning">{proposed.length}</Badge>}
          />
          {proposed.length === 0 ? (
            <EmptyState size="sm" tone="mentor" icon={Hourglass} title="No pending proposals" message="Every proposal in this cohort has an answer." />
          ) : (
            <ul className="divide-y divide-line">
              {proposed.map((m) => {
                const days = Math.floor((now - new Date(m.proposedAt).getTime()) / 86400000);
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                    <Pair db={db} m={m} />
                    <span className={cn('text-xs', days >= 5 ? 'font-semibold text-warning' : 'text-ink-2')} title={formatDate(m.proposedAt)}>
                      {days >= 5 ? `Waiting ${days} days` : `Proposed ${timeAgo(m.proposedAt)}`}
                    </span>
                    {canEdit && (
                      <Button variant="secondary" size="sm" icon={Undo2} onClick={() => void withdraw(m)}>
                        Withdraw
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Declined */}
        <Card padding="none">
          <CardHeader
            divider
            icon={UserRoundX}
            iconTone="danger"
            title="Declined — needs a new mentor"
            subtitle="The mentor has the final say. Re-match these applicants."
            actions={<Badge tone="danger">{declined.length}</Badge>}
          />
          {declined.length === 0 ? (
            <EmptyState size="sm" tone="mentor" icon={UserRoundX} title="No declines to handle" message="Declined proposals that still need a mentor show up here." />
          ) : (
            <ul className="divide-y divide-line">
              {declined.map((m) => (
                <li key={m.id} className="flex flex-col gap-2 px-5 py-3">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Pair db={db} m={m} />
                    {canEdit && (
                      <Button variant="mentor" size="sm" onClick={() => onRematch(m.applicationId)}>
                        Re-match
                      </Button>
                    )}
                  </div>
                  <p className="rounded-lg bg-danger-soft/50 px-3 py-2 text-xs text-ink-2">
                    <span className="font-semibold text-danger">Declined {timeAgo(m.respondedAt ?? m.proposedAt)}:</span> “{m.declineReason ?? 'No reason given'}”
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
