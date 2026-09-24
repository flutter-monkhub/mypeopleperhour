// Mentor profile fields shared by "Add mentor" and the edit drawer (A29).

import type { Dispatch, SetStateAction } from 'react';
import { Check } from 'lucide-react';
import type { MentorStyle } from '@shared/types';
import { MENTOR_ROLES, PROGRAMME_LIMITS } from '@shared/content/mentoring';
import { cn } from '@/lib/cn';
import { Field, Textarea } from '@/components/ui';
import { TagInput } from './TagInput';

export interface MentorFormValue {
  capacity: number;
  expertise: string[];
  styles: MentorStyle[];
  bio: string;
}

export interface MentorFormErrors {
  capacity?: string;
  expertise?: string;
  styles?: string;
  bio?: string;
}

export function validateMentorForm(v: MentorFormValue, minCapacity: number = PROGRAMME_LIMITS.minMenteesPerMentor): MentorFormErrors {
  const e: MentorFormErrors = {};
  if (v.capacity < minCapacity) e.capacity = `Already ${minCapacity} mentees or proposals in a running cohort — capacity can’t go lower`;
  if (!v.expertise.length) e.expertise = 'Add at least one area of expertise';
  if (!v.styles.length) e.styles = 'Choose at least one way this mentor helps';
  if (v.bio.trim().length < 20) e.bio = 'Write a short bio (at least 20 characters) — mentees read it when choosing';
  return e;
}

const CAPACITIES = Array.from({ length: PROGRAMME_LIMITS.maxMenteesPerMentor - PROGRAMME_LIMITS.minMenteesPerMentor + 1 }, (_, i) => PROGRAMME_LIMITS.minMenteesPerMentor + i);

export function MentorFormFields({
  value,
  onChange,
  errors = {},
  suggestions,
  minCapacity = PROGRAMME_LIMITS.minMenteesPerMentor,
  readOnly,
}: {
  value: MentorFormValue;
  /** A state setter (functional updates keep rapid toggles from overwriting each other) */
  onChange: Dispatch<SetStateAction<MentorFormValue>>;
  errors?: MentorFormErrors;
  suggestions: string[];
  /** Lowest capacity allowed (mentees already occupying slots) */
  minCapacity?: number;
  readOnly?: boolean;
}) {
  const set = <K extends keyof MentorFormValue>(k: K, v: MentorFormValue[K]) => onChange((cur) => ({ ...cur, [k]: v }));
  const toggleStyle = (s: MentorStyle) => onChange((cur) => ({ ...cur, styles: cur.styles.includes(s) ? cur.styles.filter((x) => x !== s) : [...cur.styles, s] }));
  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Capacity per cohort"
        hint={errors.capacity ? undefined : `${PROGRAMME_LIMITS.minMenteesPerMentor}–${PROGRAMME_LIMITS.maxMenteesPerMentor} mentees (hard constraint)`}
        error={errors.capacity}
      >
        <div role="radiogroup" aria-label="Capacity" className="inline-flex w-fit gap-1 rounded-lg bg-neutral-soft p-1">
          {CAPACITIES.map((n) => {
            const on = value.capacity === n;
            const blocked = n < minCapacity;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={readOnly || blocked}
                title={blocked ? `Already ${minCapacity} mentees or proposals in a running cohort` : undefined}
                onClick={() => set('capacity', n)}
                className={cn(
                  'h-8 min-w-24 rounded-md px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed',
                  on ? 'bg-mentor text-white shadow-[0_1px_2px_rgba(126,55,148,.35)]' : 'text-ink-2 hover:bg-white hover:text-ink',
                  blocked && 'opacity-40 hover:bg-transparent',
                )}
              >
                {n} mentees
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="How they mentor" hint={errors.styles ? undefined : 'From the mentor proposition — most mentors pick 2–3'} error={errors.styles}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MENTOR_ROLES.map((r) => {
            const on = value.styles.includes(r.id);
            return (
              <button
                key={r.id}
                type="button"
                role="checkbox"
                aria-checked={on}
                disabled={readOnly}
                onClick={() => toggleStyle(r.id)}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors disabled:cursor-default',
                  on ? 'border-mentor/60 bg-mentor-soft/60' : 'border-line hover:border-line-strong hover:bg-canvas',
                )}
              >
                <span
                  className={cn('mt-0.5 grid size-4 shrink-0 place-items-center rounded-[4px] border', on ? 'border-mentor bg-mentor text-white' : 'border-line-strong bg-white')}
                >
                  {on && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink">{r.title}</span>
                  <span className="block text-xs leading-snug text-ink-2">{r.body}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <TagInput label="Expertise" value={value.expertise} onChange={(v) => set('expertise', v)} suggestions={suggestions} error={errors.expertise} disabled={readOnly} max={6} />

      <Textarea
        label="Bio"
        value={value.bio}
        onChange={(e) => set('bio', e.target.value)}
        rows={4}
        maxLength={400}
        disabled={readOnly}
        error={errors.bio}
        hint="Shown to employees in the mentor directory."
        placeholder="A couple of lines about their journey and what they enjoy helping people with."
      />
    </div>
  );
}
