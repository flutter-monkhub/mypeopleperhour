// "Shortlist & propose to a mentor" — used on the application detail page.
// Preferred mentors first (in order), any other active mentor via a select; live rule checks.

import { useMemo, useState } from 'react';
import { Info, Send, ShieldAlert } from 'lucide-react';
import type { MenteeApplication } from '@shared/types';
import { validateMatch } from '@shared/logic';
import { cn } from '@/lib/cn';
import { functionName } from '@/lib/lookup';
import { mentorLoad } from '@/lib/analytics-mentoring';
import { proposeMatch, proposalBlockers, rematch } from '@/store/actions';
import { useDb } from '@/store/db';
import { Avatar, Button, Modal, Select, Textarea, toast } from '@/components/ui';
import { CapacityMeter } from './CapacityMeter';
import { RuleChecks, RuleDots } from './RuleChecks';
import { SectionLabel } from './bits';

export interface ProposeModalProps {
  app: MenteeApplication;
  open: boolean;
  onClose: () => void;
  /** Re-match after a decline (excludes mentors who already declined) */
  mode?: 'propose' | 'rematch';
}

export function ProposeModal({ app, open, onClose, mode = 'propose' }: ProposeModalProps) {
  const db = useDb();
  const declinedBy = useMemo(() => new Set(db.matches.filter((m) => m.applicationId === app.id && m.status === 'declined').map((m) => m.mentorId)), [db.matches, app.id]);
  const firstOk = app.preferredMentorIds.find((id) => !declinedBy.has(id) && !proposalBlockers(db, app, id).length);
  const [mentorId, setMentorId] = useState<string>(firstOk ?? app.preferredMentorIds.find((id) => !declinedBy.has(id)) ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const others = useMemo(
    () =>
      db.mentors
        .filter((m) => m.active && !app.preferredMentorIds.includes(m.employeeId))
        .map((m) => {
          const e = db.employees.find((x) => x.id === m.employeeId);
          const ok = validateMatch(db, m.employeeId, app.employeeId, app.cohortId).every((r) => r.ok);
          return { value: m.employeeId, label: `${ok ? '✓' : '✕'} ${e?.name ?? m.employeeId} · ${functionName(db, e?.functionId)}`, ok, name: e?.name ?? '' };
        })
        .sort((a, b) => Number(b.ok) - Number(a.ok) || a.name.localeCompare(b.name)),
    [db, app],
  );

  const mentor = db.employees.find((e) => e.id === mentorId);
  const rules = mentorId ? validateMatch(db, mentorId, app.employeeId, app.cohortId) : [];
  const blockers = mentorId ? proposalBlockers(db, app, mentorId) : ['Choose a mentor'];
  const applicant = db.employees.find((e) => e.id === app.employeeId);

  const submit = () => {
    setBusy(true);
    try {
      if (mode === 'rematch') rematch(app.id, mentorId);
      else proposeMatch(app.id, mentorId, note);
      toast.success(`Proposed to ${mentor?.name}`, `${mentor?.firstName} will see ${applicant?.firstName}’s request in the app and has the final say.`);
      onClose();
    } catch (e) {
      toast.error('Proposal blocked', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      icon={Send}
      iconTone="mentor"
      title={mode === 'rematch' ? 'Re-match with another mentor' : 'Shortlist & propose to a mentor'}
      description={`${applicant?.name ?? 'The applicant'} → the mentor has the final say. Matching rules are checked live.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="mentor" icon={Send} onClick={submit} loading={busy} disabled={blockers.length > 0 || !app.scores}>
            {mentor ? `Propose to ${mentor.firstName}` : 'Propose'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <SectionLabel>Preferred mentors · in the applicant’s order</SectionLabel>
          <div role="radiogroup" className="flex flex-col gap-2">
            {app.preferredMentorIds.map((id, i) => {
              const e = db.employees.find((x) => x.id === id);
              const r = validateMatch(db, id, app.employeeId, app.cohortId);
              const declined = declinedBy.has(id);
              const active = db.mentors.find((m) => m.employeeId === id)?.active;
              const on = id === mentorId;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setMentorId(id)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
                    on ? 'border-mentor bg-mentor-soft/60 ring-1 ring-mentor' : 'border-line hover:border-line-strong hover:bg-canvas',
                  )}
                >
                  <span className={cn('grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold', on ? 'bg-mentor text-white' : 'bg-neutral-soft text-ink-2')}>
                    {i + 1}
                  </span>
                  <Avatar name={e?.name ?? id} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">{e?.name ?? id}</span>
                    <span className="block truncate text-xs text-ink-2">
                      {e?.designation} · {functionName(db, e?.functionId)}
                    </span>
                  </span>
                  {declined && <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger">Declined before</span>}
                  {active === false && <span className="shrink-0 rounded-full bg-neutral-soft px-2 py-0.5 text-[11px] font-semibold text-neutral">Inactive</span>}
                  <CapacityMeter load={mentorLoad(db, id, app.cohortId)} size="sm" className="hidden w-32 sm:flex" />
                  <RuleDots rules={r} />
                </button>
              );
            })}
          </div>
          <Select
            size="sm"
            aria-label="Another mentor"
            value={app.preferredMentorIds.includes(mentorId) ? '' : mentorId}
            onValueChange={(v) => v && setMentorId(v)}
            placeholder="Or choose another mentor…"
            options={others}
            containerClassName="mt-2"
          />
        </div>

        {mentor && (
          <div>
            <SectionLabel aside={<CapacityMeter load={mentorLoad(db, mentorId, app.cohortId)} size="sm" preview={blockers.length === 0} className="w-40" />}>
              Rule checks · {mentor.name}
            </SectionLabel>
            <RuleChecks rules={rules} compact />
          </div>
        )}

        {blockers.length > 0 && mentor ? (
          <div className="flex gap-2.5 rounded-lg border border-danger/25 bg-danger-soft/60 p-3 text-[13px] text-danger">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">Can’t propose {mentor.firstName}</p>
              <p className="mt-0.5 text-danger/90">
                Cross-functional exposure is required and capacity / reporting line are hard constraints. {blockers.join('. ')}. Pick another preferred mentor or choose a different
                mentor.
              </p>
            </div>
          </div>
        ) : (
          mentor &&
          !app.scores && (
            <div className="flex gap-2.5 rounded-lg border border-warning/25 bg-warning-soft p-3 text-[13px] text-[#9a5500]">
              <Info className="mt-0.5 size-4 shrink-0" />
              <p>Score clarity of purpose, career reflection and mentor fit in the Matching criteria panel before shortlisting — it keeps the shortlist fair.</p>
            </div>
          )
        )}

        {mode === 'propose' && (
          <Textarea
            label="Note to the mentor (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={240}
            placeholder="Why this pairing — e.g. strong interest in plant operations"
          />
        )}
      </div>
    </Modal>
  );
}
