// Selected application ↔ selected mentor: the three rule checks from validateMatch (A34–A36),
// the three scored criteria, and "Propose to mentor" (blocked with an explanation when a
// Required / Hard-constraint rule fails).

import { forwardRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, MousePointerClick, Save, Send, ShieldAlert, Sparkles } from 'lucide-react';
import type { ApplicationScores, DemoDatabase, MenteeApplication } from '@shared/types';
import { validateMatch } from '@shared/logic';
import { cn } from '@/lib/cn';
import { employeeName, functionName, unitName } from '@/lib/lookup';
import { SCORE_MAX, mentorLoad } from '@/lib/analytics-mentoring';
import { proposeMatch, proposalBlockers, rematch, scoreApplication } from '@/store/actions';
import { Avatar, Button, Card, Input, toast } from '@/components/ui';
import { CapacityMeter } from '../CapacityMeter';
import { RuleChecks } from '../RuleChecks';
import { SCORED_CRITERIA, ScoreInput } from '../ScoreInput';
import { SectionLabel } from '../bits';

interface Props {
  db: DemoDatabase;
  app: MenteeApplication;
  mentorId: string | null;
  canEdit: boolean;
  onProposed: (appId: string) => void;
}

export const MatchCheck = forwardRef<HTMLDivElement, Props>(function MatchCheck({ db, app, mentorId, canEdit, onProposed }, ref) {
  const applicant = db.employees.find((e) => e.id === app.employeeId);
  const mentor = mentorId ? db.employees.find((e) => e.id === mentorId) : undefined;
  const [scores, setScores] = useState<Partial<ApplicationScores>>(app.scores ?? {});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const rules = mentorId ? validateMatch(db, mentorId, app.employeeId, app.cohortId) : null;
  const blockers = mentorId ? proposalBlockers(db, app, mentorId) : [];
  const scoresComplete = SCORED_CRITERIA.every((c) => scores[c.id] != null);
  const scoresDirty = SCORED_CRITERIA.some((c) => scores[c.id] !== app.scores?.[c.id]);
  const total = scoresComplete ? SCORED_CRITERIA.reduce((s, c) => s + (scores[c.id] ?? 0), 0) : null;
  const hasDecline = db.matches.some((m) => m.applicationId === app.id && m.status === 'declined');
  const rank = mentorId ? app.preferredMentorIds.indexOf(mentorId) + 1 : 0;

  const saveScores = () => {
    try {
      scoreApplication(app.id, scores as ApplicationScores);
      toast.success('Scores saved', `${applicant?.name} · ${total}/${SCORE_MAX}`);
    } catch (e) {
      toast.error('Couldn’t save scores', e instanceof Error ? e.message : String(e));
    }
  };

  const propose = () => {
    if (!mentorId) return;
    setBusy(true);
    try {
      if (scoresComplete && scoresDirty) scoreApplication(app.id, scores as ApplicationScores);
      if (hasDecline) rematch(app.id, mentorId);
      else proposeMatch(app.id, mentorId, note);
      toast.success(`Proposed to ${mentor?.name}`, `${applicant?.firstName} is shortlisted. ${mentor?.firstName} has the final say and was notified in the app.`);
      onProposed(app.id);
    } catch (e) {
      toast.error('Proposal blocked', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card ref={ref} padding="none" className="scroll-mt-24 overflow-hidden">
      {/* Pair header */}
      <div className="grid grid-cols-1 items-center gap-3 border-b border-line bg-gradient-to-r from-mentor-soft/70 via-white to-white px-5 py-4 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={applicant?.name ?? app.employeeId} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.06em] text-mentor uppercase">Mentee</p>
            <p className="truncate text-sm font-semibold text-ink">{applicant?.name}</p>
            <p className="truncate text-xs text-ink-2">
              {applicant?.designation} · {functionName(db, applicant?.functionId)} · {unitName(db, applicant?.unitId, true)}
            </p>
          </div>
        </div>
        <ArrowRight className="mx-auto hidden size-5 text-mentor md:block" />
        {mentor ? (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={mentor.name} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.06em] text-mentor uppercase">Mentor {rank > 0 ? `· #${rank} choice` : '· not a preference'}</p>
              <p className="truncate text-sm font-semibold text-ink">{mentor.name}</p>
              <p className="truncate text-xs text-ink-2">
                {mentor.designation} · {functionName(db, mentor.functionId)}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-mentor/40 px-3 py-2.5 text-[13px] text-ink-2">
            <MousePointerClick className="size-4 shrink-0 text-mentor" /> Pick a mentor on the board below — preferred mentors are highlighted.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 px-5 py-4 xl:grid-cols-2">
        {/* Rules */}
        <div className="min-w-0">
          <SectionLabel aside={mentorId ? <CapacityMeter load={mentorLoad(db, mentorId, app.cohortId)} size="sm" preview={blockers.length === 0} className="w-36" /> : undefined}>
            Matching rules
          </SectionLabel>
          {rules ? (
            <RuleChecks rules={rules} compact />
          ) : (
            <p className="rounded-lg bg-canvas px-3 py-6 text-center text-[13px] text-ink-2">Rule checks appear when you pick a mentor.</p>
          )}
        </div>
        {/* Scores */}
        <div className="min-w-0">
          <SectionLabel aside={<span className="text-xs font-semibold text-mentor tabular">{total != null ? `${total} / ${SCORE_MAX}` : 'Not fully scored'}</span>}>
            Scored criteria
          </SectionLabel>
          <div className="flex flex-col gap-3">
            {SCORED_CRITERIA.map((c) => (
              <ScoreInput key={c.id} id={c.id} compact value={scores[c.id] ?? null} readOnly={!canEdit} onChange={(v) => setScores((s) => ({ ...s, [c.id]: v }))} />
            ))}
          </div>
          {canEdit && scoresDirty && (
            <Button variant="secondary" size="sm" icon={Save} className="mt-3" onClick={saveScores} disabled={!scoresComplete}>
              Save scores
            </Button>
          )}
        </div>
      </div>

      {/* Why / goals (context for "mentor fit") */}
      <div className="mx-5 mb-4 rounded-xl bg-canvas px-4 py-3 text-[13px]">
        <p className="text-xs font-semibold text-ink-2">What {applicant?.firstName} wants from the relationship</p>
        <p className="mt-0.5 text-ink">{app.goals}</p>
        <Link to={`/mentoring/applications/${app.id}`} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          Open full application <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      {canEdit && (
        <div className={cn('flex flex-col gap-3 border-t border-line px-5 py-4', blockers.length && mentor ? 'bg-danger-soft/40' : 'bg-canvas/60')}>
          {mentor && blockers.length > 0 ? (
            <div className="flex gap-2.5 text-[13px] text-danger">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <p>
                <span className="font-semibold">Can’t propose {mentor.firstName}.</span> {blockers.join('. ')}. Cross-functional exposure is required, and capacity and reporting
                line are hard constraints — pick another mentor.
              </p>
            </div>
          ) : mentor && !scoresComplete ? (
            <p className="inline-flex items-center gap-2 text-[13px] text-[#9a5500]">
              <Sparkles className="size-4 shrink-0" /> Score clarity, reflection and fit before shortlisting — it keeps the shortlist fair.
            </p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {!hasDecline && (
              <Input
                aria-label="Note to the mentor"
                size="sm"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                placeholder="Optional note to the mentor — why this pairing"
                containerClassName="flex-1"
                disabled={!mentor || blockers.length > 0}
              />
            )}
            <Button
              variant="mentor"
              icon={Send}
              onClick={propose}
              loading={busy}
              disabled={!mentor || blockers.length > 0 || !scoresComplete}
              className={hasDecline ? 'sm:ml-auto' : undefined}
            >
              {mentor ? `${hasDecline ? 'Re-match' : 'Propose'} to ${mentor.firstName}` : 'Propose to mentor'}
            </Button>
          </div>
          {hasDecline && (
            <p className="text-xs text-ink-2">
              A previous mentor declined — this proposal is recorded as a re-match. Last decline:{' '}
              {employeeName(db, [...db.matches].reverse().find((m) => m.applicationId === app.id && m.status === 'declined')?.mentorId)}.
            </p>
          )}
        </div>
      )}
    </Card>
  );
});
