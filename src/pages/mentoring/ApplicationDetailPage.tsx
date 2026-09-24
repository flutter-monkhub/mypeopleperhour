// Application detail — Admin rows A31 (review & scoring) and A32 (preferred mentor information).
// Document view · scoring panel · status actions (start review, shortlist & propose, confirm,
// withdraw, not matched, reopen) · match records · status history.

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, CircleCheck, FileSearch, History, Hourglass, PlayCircle, RotateCcw, Send, Undo2, UserX } from 'lucide-react';
import type { MenteeApplication, MentorMatch } from '@shared/types';
import { PageHeader } from '@/components/layout';
import { Avatar, Button, Card, CardHeader, EmptyState, LinkButton, StatusBadge, confirm, toast } from '@/components/ui';
import { formatDate, timeAgo } from '@/lib/format';
import { employeeName, functionName, unitName } from '@/lib/lookup';
import { useCan } from '@/lib/rbac';
import { cohortTimeline, matchesByApplication, openMatchFor, progressOfMatch } from '@/lib/analytics-mentoring';
import { confirmMatch, setApplicationStatus, withdrawProposal } from '@/store/actions';
import { useDb } from '@/store/db';
import { ApplicationDocument } from './components/ApplicationDocument';
import { NotMatchedModal } from './components/NotMatchedModal';
import { ProposeModal } from './components/ProposeModal';
import { ScoringPanel } from './components/ScoringPanel';
import { StatusTimeline } from './components/StatusTimeline';
import { AnchorDots, MentoringEyebrow, PairHealthBadge, Rating, SectionLabel, ViewOnlyBadge } from './components/bits';
import { applicationTimeline } from './components/timeline';

function Callout({
  tone,
  icon: Icon,
  title,
  children,
}: {
  tone: 'mentor' | 'warning' | 'info' | 'success' | 'danger' | 'neutral';
  icon: typeof Send;
  title: string;
  children?: React.ReactNode;
}) {
  const cls = {
    mentor: 'bg-mentor-soft/70 text-mentor',
    warning: 'bg-warning-soft text-[#9a5500]',
    info: 'bg-info-soft text-info',
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger',
    neutral: 'bg-neutral-soft text-neutral',
  }[tone];
  return (
    <div className={`flex gap-3 rounded-xl px-3.5 py-3 ${cls}`}>
      <Icon className="mt-0.5 size-4.5 shrink-0" />
      <div className="min-w-0 text-[13px]">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5 text-ink-2">{children}</div>}
      </div>
    </div>
  );
}

function StatusCard({ app, canEdit }: { app: MenteeApplication; canEdit: boolean }) {
  const db = useDb();
  const [proposing, setProposing] = useState<null | 'propose' | 'rematch'>(null);
  const [closing, setClosing] = useState(false);
  const applicant = db.employees.find((e) => e.id === app.employeeId);
  const open = openMatchFor(db, app.id);
  const all = matchesByApplication(db).get(app.id) ?? [];
  const lastDeclined = [...all].reverse().find((m) => m.status === 'declined');
  const since = app.history[app.history.length - 1]?.at ?? app.updatedAt;
  const mentorName = (m?: MentorMatch) => (m ? employeeName(db, m.mentorId) : '');
  const cohort = db.cohorts.find((c) => c.id === app.cohortId);

  const run = (fn: () => void, ok: string, detail?: string) => {
    try {
      fn();
      toast.success(ok, detail);
    } catch (e) {
      toast.error('Action blocked', e instanceof Error ? e.message : String(e));
    }
  };

  const withdraw = async (m: MentorMatch) => {
    const yes = await confirm({
      title: `Withdraw the proposal to ${mentorName(m)}?`,
      message: `${mentorName(m)} will be told the request was withdrawn and ${applicant?.firstName}’s application goes back to review so you can propose another mentor.`,
      confirmLabel: 'Withdraw proposal',
      tone: 'danger',
    });
    if (yes) run(() => withdrawProposal(m.id), 'Proposal withdrawn', 'The application is back under review.');
  };

  const confirmFinal = async (m: MentorMatch) => {
    const yes = await confirm({
      title: 'Confirm the final match?',
      message: `${applicant?.name} and ${mentorName(m)} become an active pair in ${cohort?.name}. Both are notified; ${applicant?.firstName} owns scheduling Conversation 1.`,
      confirmLabel: 'Confirm match',
    });
    if (yes) run(() => confirmMatch(m.id), 'Match confirmed', `${applicant?.name} ↔ ${mentorName(m)} is now active. Both have been notified.`);
  };

  let body: React.ReactNode = null;
  let actions: React.ReactNode = null;
  switch (app.status) {
    case 'submitted':
      body = (
        <Callout tone="info" icon={FileSearch} title="New application">
          Read the application, score it on the matching criteria and start the review.
        </Callout>
      );
      actions = (
        <Button variant="mentor" icon={PlayCircle} fullWidth onClick={() => run(() => setApplicationStatus(app.id, 'under_review', 'Review started'), 'Review started')}>
          Start review
        </Button>
      );
      break;
    case 'under_review':
      body = lastDeclined ? (
        <Callout tone="danger" icon={Undo2} title={`${mentorName(lastDeclined)} declined ${timeAgo(lastDeclined.respondedAt ?? since)}`}>
          “{lastDeclined.declineReason ?? 'No reason given'}” — propose another mentor to re-match.
        </Callout>
      ) : (
        <Callout tone="warning" icon={Hourglass} title="Under review">
          When the scores look right, shortlist {applicant?.firstName} and propose a mentor. The mentor has the final say.
        </Callout>
      );
      actions = (
        <Button variant="mentor" icon={Send} fullWidth onClick={() => setProposing(lastDeclined ? 'rematch' : 'propose')}>
          {lastDeclined ? 'Re-match with another mentor' : 'Shortlist & propose to mentor'}
        </Button>
      );
      break;
    case 'shortlisted':
      body = open ? (
        open.status === 'accepted' ? (
          <Callout tone="success" icon={CircleCheck} title={`${mentorName(open)} accepted ${timeAgo(open.respondedAt ?? since)}`}>
            Ready for the final match — confirm to make the pair active and notify both.
          </Callout>
        ) : (
          <Callout tone="mentor" icon={Hourglass} title={`Awaiting ${mentorName(open)}’s reply`}>
            Proposed {timeAgo(open.proposedAt)}. The mentor accepts or declines in the app.
          </Callout>
        )
      ) : null;
      actions = open && (
        <div className="flex flex-col gap-2">
          {open.status === 'accepted' && (
            <Button variant="mentor" icon={CircleCheck} fullWidth onClick={() => void confirmFinal(open)}>
              Confirm final match
            </Button>
          )}
          <Button variant="secondary" icon={Undo2} fullWidth onClick={() => void withdraw(open)}>
            Withdraw proposal
          </Button>
        </div>
      );
      break;
    case 'matched': {
      const m = open ?? all.find((x) => x.status === 'active' || x.status === 'completed');
      const p = m && cohort ? progressOfMatch(db, m, cohortTimeline(cohort)) : null;
      body = m && (
        <div className="rounded-xl border border-success/25 bg-success-soft/40 p-3.5">
          <div className="flex items-center gap-3">
            <Avatar name={mentorName(m)} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-ink">Matched with {mentorName(m)}</p>
              <p className="truncate text-xs text-ink-2">{m.activatedAt ? `Active since ${formatDate(m.activatedAt)}` : 'Active'}</p>
            </div>
            {p && <PairHealthBadge health={p.health} note={p.healthNote} size="sm" />}
          </div>
          {p && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-success/20 pt-3 text-xs text-ink-2">
              <AnchorDots anchors={p.anchors} extra={p.extraCompleted} size="sm" />
              <span>
                {p.openActions} open action{p.openActions === 1 ? '' : 's'} · <Rating value={p.avgRating} />
              </span>
            </div>
          )}
        </div>
      );
      break;
    }
    case 'not_matched': {
      const reason = [...app.history].reverse().find((h) => h.status === 'not_matched')?.note;
      body = (
        <Callout tone="danger" icon={UserX} title="Not matched this cohort">
          {reason ?? 'No reason recorded.'}
        </Callout>
      );
      actions = (
        <Button
          variant="secondary"
          icon={RotateCcw}
          fullWidth
          onClick={() => run(() => setApplicationStatus(app.id, 'under_review', 'Reopened for review'), 'Application reopened', 'It is back under review.')}
        >
          Reopen review
        </Button>
      );
      break;
    }
    case 'withdrawn': {
      const note = [...app.history].reverse().find((h) => h.status === 'withdrawn')?.note;
      body = (
        <Callout tone="neutral" icon={Undo2} title={`Withdrawn by ${applicant?.firstName}`}>
          {note ?? 'The applicant withdrew before a match was made.'}
        </Callout>
      );
      break;
    }
  }
  const canClose = canEdit && (app.status === 'submitted' || app.status === 'under_review' || app.status === 'shortlisted');

  return (
    <Card>
      <CardHeader title="Status" subtitle={`Since ${formatDate(since)} · ${timeAgo(since)}`} actions={<StatusBadge status={app.status} kind="application" />} />
      <div className="flex flex-col gap-3">
        {body}
        {canEdit && actions}
        {canClose && (
          <Button variant="ghost" icon={UserX} size="sm" className="self-center text-danger! hover:bg-danger-soft!" onClick={() => setClosing(true)}>
            Mark as not matched
          </Button>
        )}
      </div>
      {proposing && <ProposeModal app={app} open onClose={() => setProposing(null)} mode={proposing} />}
      <NotMatchedModal app={app} applicantName={applicant?.name ?? 'The applicant'} open={closing} onClose={() => setClosing(false)} />
    </Card>
  );
}

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const db = useDb();
  const canEdit = useCan('mentoring.edit');
  const app = db.applications.find((a) => a.id === id);

  if (!app || app.status === 'draft')
    return (
      <>
        <PageHeader title="Application" backTo="/mentoring/applications" backLabel="Applications" />
        <Card>
          <EmptyState
            size="lg"
            tone="mentor"
            icon={FileSearch}
            title="Application not found"
            message="It may have been removed, or the link is incomplete."
            action={
              <LinkButton to="/mentoring/applications" variant="secondary">
                Back to applications
              </LinkButton>
            }
          />
        </Card>
      </>
    );

  const e = db.employees.find((x) => x.id === app.employeeId);
  const cohort = db.cohorts.find((c) => c.id === app.cohortId);
  const matches = matchesByApplication(db).get(app.id) ?? [];
  const timeline = applicationTimeline(db, app);

  return (
    <>
      <PageHeader
        backTo={`/mentoring/applications?cohort=${app.cohortId}`}
        backLabel="Applications"
        eyebrow={<MentoringEyebrow>{cohort?.name ?? 'Mentoring'} · application</MentoringEyebrow>}
        title={e?.name ?? app.employeeId}
        subtitle={`${e?.designation ?? ''} · ${functionName(db, e?.functionId)} · ${unitName(db, e?.unitId)}`}
        meta={
          <>
            <StatusBadge status={app.status} kind="application" />
            {app.submittedAt && <span className="text-xs text-ink-2">Submitted {formatDate(app.submittedAt)}</span>}
            {!canEdit && <ViewOnlyBadge />}
          </>
        }
        actions={
          <LinkButton
            to={`/mentoring/matching?cohort=${app.cohortId}${app.status === 'submitted' || app.status === 'under_review' ? `&app=${app.id}` : ''}`}
            variant="secondary"
            iconRight={ArrowRight}
          >
            Matching workspace
          </LinkButton>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-7 2xl:col-span-8">
          <ApplicationDocument db={db} app={app} />
        </div>
        <div className="flex flex-col gap-6 xl:col-span-5 2xl:col-span-4">
          <StatusCard key={`${app.id}-${app.status}`} app={app} canEdit={canEdit} />
          <ScoringPanel key={`${app.id}-${app.updatedAt}`} app={app} canEdit={canEdit} />
          {matches.length > 0 && (
            <Card>
              <CardHeader
                title="Match records"
                subtitle="Every proposal made for this application"
                actions={
                  <Link to={`/mentoring/history?q=${encodeURIComponent(e?.name ?? '')}`} className="text-[13px] font-medium text-primary hover:underline">
                    History
                  </Link>
                }
              />
              <ul className="flex flex-col gap-2">
                {matches.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5">
                    <Avatar name={employeeName(db, m.mentorId)} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">{employeeName(db, m.mentorId)}</p>
                      <p className="truncate text-xs text-ink-2">
                        Proposed {formatDate(m.proposedAt)}
                        {m.declineReason ? ` · “${m.declineReason}”` : ''}
                      </p>
                    </div>
                    <StatusBadge status={m.status} kind="match" size="sm" />
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card>
            <CardHeader icon={History} iconTone="mentor" title="Status history" subtitle="Application and match events, oldest first" />
            <SectionLabel>{timeline.length} events</SectionLabel>
            <StatusTimeline items={timeline} />
          </Card>
        </div>
      </div>
    </>
  );
}
