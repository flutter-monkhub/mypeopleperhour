// Matching workspace — Admin rows A33 (workspace), A34 capacity, A35 cross-functional,
// A36 reporting-line validation, A37 final matching.
//
//   Shortlist & propose: queue (left) ↔ mentor board (right) with a live match check.
//   Final matching:      accepted proposals → confirm (single / bulk); pending → withdraw;
//                        declined → re-match.
// URL: ?cohort= · ?tab=final · ?app=<applicationId>

import { useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCheck, Clock3, Inbox, Layers, Shuffle, UserRoundX } from 'lucide-react';
import { FINAL_MATCHING_RULE } from '@shared/content/mentoring';
import { PageHeader } from '@/components/layout';
import { Card, EmptyState, Tabs } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useCan } from '@/lib/rbac';
import { cohortLoads, openMatchFor } from '@/lib/analytics-mentoring';
import { proposalBlockers } from '@/store/actions';
import { useDb } from '@/store/db';
import { MentoringEyebrow, ViewOnlyBadge } from './components/bits';
import { CohortPicker, useCohortParam } from './components/cohort';
import { FinalMatching } from './components/matching/FinalMatching';
import { MatchCheck } from './components/matching/MatchCheck';
import { MentorBoard } from './components/matching/MentorBoard';
import { QueueList, buildQueue } from './components/matching/QueueList';

type TabId = 'shortlist' | 'final';

function Stat({ icon: Icon, label, value, tone, onClick }: { icon: typeof Inbox; label: string; value: number | string; tone: string; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn('flex min-w-0 items-center gap-3 px-4 py-3 text-left', onClick && 'transition-colors hover:bg-canvas')}
    >
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', tone)}>
        <Icon className="size-4.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl leading-6 font-bold text-ink tabular">{value}</span>
        <span className="block text-xs leading-4 text-ink-2">{label}</span>
      </span>
    </Tag>
  );
}

export default function MatchingWorkspace() {
  const db = useDb();
  const canEdit = useCan('mentoring.edit');
  const [params, setParams] = useSearchParams();
  const { cohortId, cohort, cohorts, setCohortId } = useCohortParam('matching');
  const tab: TabId = params.get('tab') === 'final' ? 'final' : 'shortlist';
  const setTab = (t: TabId) =>
    setParams(
      (p) => {
        if (t === 'final') p.set('tab', 'final');
        else p.delete('tab');
        return p;
      },
      { replace: true },
    );

  const queue = useMemo(() => buildQueue(db, cohortId), [db, cohortId]);
  const requestedApp = params.get('app');
  const [selectedApp, setSelectedApp] = useState<string | null>(null);
  const [selectedMentor, setSelectedMentor] = useState<string | null>(null);
  const checkRef = useRef<HTMLDivElement>(null);

  // Selection: explicit pick → ?app= deep link → first in queue
  const appId = [selectedApp, requestedApp, queue[0]?.app.id].find((id) => id && queue.some((q) => q.app.id === id)) ?? null;
  const app = appId ? (queue.find((q) => q.app.id === appId)?.app ?? null) : null;

  const selectApp = (id: string) => {
    setSelectedApp(id);
    setSelectedMentor(null);
    if (params.get('app')) setParams((p) => (p.delete('app'), p), { replace: true });
  };
  const selectMentor = (id: string) => {
    setSelectedMentor(id);
    requestAnimationFrame(() => checkRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
  };
  // Default mentor for the match check: the first preferred mentor who passes every rule (and hasn't declined)
  const defaultMentor = useMemo(() => {
    if (!app) return null;
    const declined = new Set(db.matches.filter((m) => m.applicationId === app.id && m.status === 'declined').map((m) => m.mentorId));
    return app.preferredMentorIds.find((id) => !declined.has(id) && proposalBlockers(db, app, id).length === 0) ?? null;
  }, [db, app]);
  const mentorId = selectedMentor ?? defaultMentor;
  const changeCohort = (id: string) => {
    setCohortId(id);
    setSelectedApp(null);
    setSelectedMentor(null);
  };

  const loads = cohortLoads(db, cohortId);
  const activeMentors = db.mentors.filter((m) => m.active);
  const freeSlots = activeMentors.reduce((s, m) => s + (loads.get(m.employeeId)?.free ?? 0), 0);
  const totalSlots = activeMentors.reduce((s, m) => s + (loads.get(m.employeeId)?.capacity ?? 0), 0);
  const inCohort = db.matches.filter((m) => m.cohortId === cohortId);
  const accepted = inCohort.filter((m) => m.status === 'accepted').length;
  const proposed = inCohort.filter((m) => m.status === 'proposed').length;
  const declinedOpen = inCohort.filter(
    (m) =>
      m.status === 'declined' && !openMatchFor(db, m.applicationId) && ['submitted', 'under_review'].includes(db.applications.find((a) => a.id === m.applicationId)?.status ?? ''),
  ).length;

  const onProposed = (id: string) => {
    const idx = queue.findIndex((q) => q.app.id === id);
    const next = queue[idx + 1] ?? queue[idx - 1];
    setSelectedApp(next && next.app.id !== id ? next.app.id : null);
    setSelectedMentor(null);
  };

  const rematchFromFinal = (id: string) => {
    setTab('shortlist');
    setSelectedApp(id);
    setSelectedMentor(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <PageHeader
        eyebrow={<MentoringEyebrow />}
        title="Matching workspace"
        subtitle={FINAL_MATCHING_RULE}
        meta={!canEdit ? <ViewOnlyBadge /> : undefined}
        actions={<CohortPicker cohorts={cohorts} value={cohortId} onChange={changeCohort} />}
      />

      <Card padding="none" className="mb-6 overflow-hidden">
        <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-5 [&>*]:bg-white max-lg:[&>*:last-child]:col-span-2">
          <Stat icon={Inbox} label="Applications to match" value={queue.length} tone="bg-mentor-soft text-mentor" onClick={() => setTab('shortlist')} />
          <Stat icon={Clock3} label="Awaiting mentor reply" value={proposed} tone="bg-warning-soft text-warning" onClick={() => setTab('final')} />
          <Stat icon={CheckCheck} label="Ready for final match" value={accepted} tone="bg-success-soft text-success" onClick={() => setTab('final')} />
          <Stat icon={UserRoundX} label="Declined — to re-match" value={declinedOpen} tone="bg-danger-soft text-danger" onClick={() => setTab('final')} />
          <Stat icon={Layers} label={`Free mentor slots of ${totalSlots}`} value={freeSlots} tone="bg-info-soft text-info" />
        </div>
      </Card>

      <Tabs<TabId>
        className="mb-6"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'shortlist', label: 'Shortlist & propose', icon: Shuffle, count: queue.length },
          { id: 'final', label: 'Final matching', icon: CheckCheck, count: accepted },
        ]}
      />

      {tab === 'final' ? (
        <FinalMatching db={db} cohortId={cohortId} canEdit={canEdit} onRematch={rematchFromFinal} />
      ) : (cohort?.status === 'active' || cohort?.status === 'completed') && queue.length === 0 ? (
        <Card>
          <EmptyState
            size="lg"
            tone="mentor"
            icon={Shuffle}
            title={`${cohort.name} is already ${cohort.status === 'active' ? 'running' : 'complete'}`}
            message="Every application in this cohort has been matched or closed — matching happens before a cohort starts. Switch to the cohort that is taking applications."
            action={cohorts
              .filter((c) => c.id !== cohortId && (c.status === 'applications_open' || c.status === 'matching'))
              .map((c) => (
                <button key={c.id} type="button" onClick={() => changeCohort(c.id)} className="text-sm font-semibold text-mentor hover:underline">
                  Go to {c.name} →
                </button>
              ))}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <QueueList db={db} items={queue} selectedId={appId} onSelect={selectApp} />
          <div className="flex min-w-0 flex-col gap-6">
            {app ? (
              <MatchCheck key={`${app.id}-${app.updatedAt}`} ref={checkRef} db={db} app={app} mentorId={mentorId} canEdit={canEdit} onProposed={onProposed} />
            ) : (
              <Card>
                <EmptyState
                  tone="mentor"
                  icon={Inbox}
                  title={queue.length ? 'Select an application' : 'All applications are shortlisted'}
                  message={
                    queue.length
                      ? 'Pick someone from the queue to see their preferred mentors and live rule checks.'
                      : 'Nothing is waiting for a proposal. Mentor replies and final matches are on the Final matching tab.'
                  }
                />
              </Card>
            )}
            <MentorBoard db={db} cohortId={cohortId} app={app} selectedMentorId={mentorId} onSelectMentor={selectMentor} />
          </div>
        </div>
      )}
    </>
  );
}
