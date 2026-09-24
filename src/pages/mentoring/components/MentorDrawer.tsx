// Mentor profile drawer: stats, capacity per running cohort, editable profile (capacity 3–5,
// styles, expertise, bio, active) and the mentor's current mentees / requests.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Clock3, HeartHandshake, Star } from 'lucide-react';
import type { MentorProfile } from '@shared/types';
import { PROGRAMME_LIMITS } from '@shared/content/mentoring';
import { formatDate } from '@/lib/format';
import { functionName, unitName } from '@/lib/lookup';
import { mentorLoad, mentorRatings } from '@/lib/analytics-mentoring';
import { mentorPeakLoad, setMentorActive, updateMentor } from '@/store/actions';
import { useDb } from '@/store/db';
import { Avatar, Badge, Button, Drawer, StatusBadge, Toggle, confirm, toast } from '@/components/ui';
import { CapacityLegend, CapacityMeter } from './CapacityMeter';
import { MentorFormFields, validateMentorForm, type MentorFormErrors, type MentorFormValue } from './MentorFormFields';
import { SectionLabel } from './bits';

export function MentorDrawer({ profile, onClose, canEdit, suggestions }: { profile: MentorProfile; onClose: () => void; canEdit: boolean; suggestions: string[] }) {
  const db = useDb();
  const emp = db.employees.find((e) => e.id === profile.employeeId);
  const [value, setValue] = useState<MentorFormValue>({ capacity: profile.capacity, expertise: profile.expertise, styles: profile.styles, bio: profile.bio });
  const [tried, setTried] = useState(false);
  const minCapacity = Math.max(PROGRAMME_LIMITS.minMenteesPerMentor, mentorPeakLoad(db, profile.employeeId).count);
  const errors: MentorFormErrors = tried ? validateMentorForm(value, minCapacity) : {};
  const rating = mentorRatings(db).get(profile.employeeId);
  const runningCohorts = db.cohorts.filter((c) => c.status !== 'completed');
  const mine = useMemo(
    () =>
      db.matches
        .filter((m) => m.mentorId === profile.employeeId && (m.status === 'proposed' || m.status === 'accepted' || m.status === 'active'))
        .sort((a, b) => b.proposedAt.localeCompare(a.proposedAt)),
    [db.matches, profile.employeeId],
  );
  const active = mine.filter((m) => m.status === 'active').length;
  const pending = mine.filter((m) => m.status === 'proposed').length;
  const dirty =
    value.capacity !== profile.capacity ||
    value.bio !== profile.bio ||
    value.expertise.join('|') !== profile.expertise.join('|') ||
    value.styles.join('|') !== profile.styles.join('|');

  const save = () => {
    setTried(true);
    if (Object.keys(validateMentorForm(value, minCapacity)).length) return;
    try {
      updateMentor(profile.employeeId, value);
      toast.success('Mentor profile saved', emp?.name);
      onClose();
    } catch (err) {
      toast.error('Couldn’t save', err instanceof Error ? err.message : String(err));
    }
  };

  const toggleActive = async (next: boolean) => {
    if (!next) {
      const ok = await confirm({
        title: `Deactivate ${emp?.name}?`,
        tone: 'danger',
        confirmLabel: 'Deactivate mentor',
        message:
          active || pending ? (
            <>
              <strong className="text-ink">
                {emp?.firstName} has {active} active mentee{active === 1 ? '' : 's'}
                {pending ? ` and ${pending} request${pending === 1 ? '' : 's'} awaiting a reply` : ''}.
              </strong>{' '}
              Running pairs continue until the cohort ends, but {emp?.firstName} won’t receive new proposals. Withdraw pending requests from the Matching workspace if needed.
            </>
          ) : (
            `${emp?.firstName} won’t appear in the mentor directory or receive new proposals until reactivated.`
          ),
      });
      if (!ok) return;
    }
    setMentorActive(profile.employeeId, next);
    toast.success(next ? 'Mentor reactivated' : 'Mentor deactivated', emp?.name);
  };

  return (
    <Drawer
      open
      onClose={onClose}
      width="lg"
      title={
        <span className="flex items-center gap-3">
          <Avatar name={emp?.name ?? profile.employeeId} />
          <span className="min-w-0">
            <span className="block truncate">{emp?.name}</span>
            <span className="block truncate text-sm font-normal text-ink-2">
              {emp?.designation} · {functionName(db, emp?.functionId)} · {unitName(db, emp?.unitId, true)}
            </span>
          </span>
        </span>
      }
      header={
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={profile.active ? 'active' : 'inactive'} kind="employee" />
          <Badge tone="outline">{emp?.grade}</Badge>
          <Badge tone="outline">Mentor since {formatDate(profile.joinedAt)}</Badge>
        </div>
      }
      footer={
        canEdit ? (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="mentor" onClick={save} disabled={!dirty}>
              Save changes
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-6">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { icon: HeartHandshake, label: 'Active mentees', value: active },
            { icon: Clock3, label: 'Awaiting reply', value: pending },
            { icon: CalendarCheck, label: 'Sessions held', value: rating?.sessions ?? 0 },
            { icon: Star, label: 'Avg rating', value: rating?.avg != null ? rating.avg.toFixed(1) : '—' },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-line px-3 py-2.5">
              <dt className="flex items-center gap-1.5 text-xs text-ink-2">
                <s.icon className="size-3.5 text-mentor" /> {s.label}
              </dt>
              <dd className="mt-0.5 text-xl font-bold text-ink tabular">{s.value}</dd>
            </div>
          ))}
        </dl>

        <section>
          <SectionLabel aside={<CapacityLegend />}>Capacity by cohort</SectionLabel>
          <div className="flex flex-col gap-3 rounded-xl border border-line p-3.5">
            {runningCohorts.map((c) => (
              <div key={c.id} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3">
                <span className="truncate text-[13px] font-medium text-ink">{c.name}</span>
                <CapacityMeter load={mentorLoad(db, profile.employeeId, c.id)} />
              </div>
            ))}
          </div>
        </section>

        <section>
          <SectionLabel>Profile</SectionLabel>
          <MentorFormFields value={value} onChange={setValue} errors={errors} suggestions={suggestions} minCapacity={minCapacity} readOnly={!canEdit} />
        </section>

        {canEdit && (
          <section className="rounded-xl border border-line p-4">
            <Toggle
              checked={profile.active}
              onChange={(v) => void toggleActive(v)}
              label="Active mentor"
              description={profile.active ? 'Listed in the mentor directory and can be proposed to mentees.' : 'Hidden from the directory — no new proposals.'}
            />
          </section>
        )}

        <section>
          <SectionLabel>Mentees & requests</SectionLabel>
          {mine.length ? (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {mine.map((m) => {
                const e = db.employees.find((x) => x.id === m.menteeId);
                return (
                  <li key={m.id}>
                    <Link to={`/mentoring/applications/${m.applicationId}`} className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-canvas">
                      <Avatar name={e?.name ?? m.menteeId} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-ink">{e?.name}</span>
                        <span className="block truncate text-xs text-ink-2">
                          {functionName(db, e?.functionId)} · {db.cohorts.find((c) => c.id === m.cohortId)?.name}
                        </span>
                      </span>
                      <StatusBadge status={m.status} kind="match" size="sm" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-5 text-center text-[13px] text-ink-2">No mentees or open requests right now.</p>
          )}
        </section>
      </div>
    </Drawer>
  );
}
