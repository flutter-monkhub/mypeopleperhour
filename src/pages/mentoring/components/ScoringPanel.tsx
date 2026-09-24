// Scoring on the matching framework (A31): the three High-weightage criteria scored 1–5, the
// Required / Hard-constraint criteria shown as automatic pass/fail from validateMatch, HR notes.

import { useState } from 'react';
import { ClipboardCheck, Save } from 'lucide-react';
import type { ApplicationScores, MenteeApplication } from '@shared/types';
import { validateMatch } from '@shared/logic';
import { cn } from '@/lib/cn';
import { employeeName } from '@/lib/lookup';
import { SCORE_MAX, openMatchFor } from '@/lib/analytics-mentoring';
import { scoreApplication } from '@/store/actions';
import { useDb } from '@/store/db';
import { Button, Card, CardHeader, Select, Textarea, toast } from '@/components/ui';
import { RuleChecks } from './RuleChecks';
import { SCORED_CRITERIA, ScoreInput } from './ScoreInput';
import { SectionLabel } from './bits';

export const scoreBand = (total: number) =>
  total >= 12
    ? { label: 'Strong candidate', cls: 'text-success' }
    : total >= 9
      ? { label: 'Good candidate', cls: 'text-ink' }
      : { label: 'Needs more clarity', cls: 'text-warning' };

export function ScoringPanel({ app, canEdit }: { app: MenteeApplication; canEdit: boolean }) {
  const db = useDb();
  const editable = canEdit && (app.status === 'submitted' || app.status === 'under_review' || app.status === 'shortlisted');
  const [scores, setScores] = useState<Partial<ApplicationScores>>(app.scores ?? {});
  const [notes, setNotes] = useState(app.hrNotes ?? '');
  const open = openMatchFor(db, app.id);
  const mentorOptions = [...new Set([...(open ? [open.mentorId] : []), ...app.preferredMentorIds])];
  const [ruleMentor, setRuleMentor] = useState(mentorOptions[0] ?? '');
  const rules = ruleMentor ? validateMatch(db, ruleMentor, app.employeeId, app.cohortId) : [];

  const complete = SCORED_CRITERIA.every((c) => scores[c.id] != null);
  const total = complete ? SCORED_CRITERIA.reduce((s, c) => s + (scores[c.id] ?? 0), 0) : null;
  const dirty = SCORED_CRITERIA.some((c) => scores[c.id] !== app.scores?.[c.id]) || notes.trim() !== (app.hrNotes ?? '');
  const band = total != null ? scoreBand(total) : null;

  const save = () => {
    if (!complete) return toast.warning('Score all three criteria', 'Clarity of purpose, career reflection and mentor fit are each scored 1–5.');
    try {
      const next = scoreApplication(app.id, scores as ApplicationScores, notes);
      toast.success('Scores saved', next.status !== app.status ? 'Review started — the application is now under review.' : `${total}/${SCORE_MAX} · ${band?.label}`);
    } catch (e) {
      toast.error('Couldn’t save scores', e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Card>
      <CardHeader
        icon={ClipboardCheck}
        iconTone="mentor"
        title="Matching criteria"
        subtitle="Score the three high-weightage criteria. Required and hard constraints are checked automatically."
      />
      <div className="flex flex-col gap-4">
        {SCORED_CRITERIA.map((c) => (
          <ScoreInput key={c.id} id={c.id} value={scores[c.id] ?? null} readOnly={!editable} onChange={(v) => setScores((s) => ({ ...s, [c.id]: v }))} />
        ))}
        <div className="flex items-center justify-between rounded-xl bg-mentor-soft/60 px-4 py-3">
          <div>
            <p className="text-xs text-ink-2">Total score</p>
            <p className={cn('text-sm font-semibold', band?.cls ?? 'text-muted')}>{band?.label ?? 'Not fully scored yet'}</p>
          </div>
          <p className="text-2xl font-bold text-ink tabular">
            {total ?? '—'}
            <span className="text-base font-medium text-muted"> / {SCORE_MAX}</span>
          </p>
        </div>

        <div className="border-t border-line pt-4">
          <SectionLabel
            aside={
              mentorOptions.length > 1 ? (
                <Select
                  aria-label="Mentor to check"
                  size="sm"
                  value={ruleMentor}
                  onValueChange={setRuleMentor}
                  options={mentorOptions.map((id) => ({
                    value: id,
                    label: `${open?.mentorId === id ? 'Proposed · ' : `#${app.preferredMentorIds.indexOf(id) + 1} · `}${employeeName(db, id)}`,
                  }))}
                  containerClassName="w-52"
                />
              ) : undefined
            }
          >
            Automatic checks
          </SectionLabel>
          <RuleChecks rules={rules} compact />
        </div>

        {editable ? (
          <Textarea
            label="HR notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Private to the programme team — e.g. strong fit with plant operations"
          />
        ) : (
          <div>
            <p className="mb-1 text-[13px] font-medium text-ink">HR notes</p>
            <p className={cn('rounded-lg bg-canvas px-3 py-2 text-[13px]', app.hrNotes ? 'text-ink' : 'text-muted')}>{app.hrNotes || 'No notes'}</p>
          </div>
        )}
        {editable && (
          <Button variant="mentor" icon={Save} onClick={save} disabled={!dirty} fullWidth>
            {app.status === 'submitted' ? 'Save scores & start review' : 'Save scores'}
          </Button>
        )}
      </div>
    </Card>
  );
}
