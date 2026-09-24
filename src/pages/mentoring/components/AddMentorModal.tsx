// Add a mentor: pick a senior employee (G7+, active, not already a mentor) and set up the profile.

import { useMemo, useState } from 'react';
import { GraduationCap, UserPlus } from 'lucide-react';
import type { Employee } from '@shared/types';
import { functionName, unitName } from '@/lib/lookup';
import { MIN_MENTOR_GRADE, addMentor, gradeNumber } from '@/store/actions';
import { useDb } from '@/store/db';
import { Avatar, Badge, Button, EmptyState, Modal, PersonCell, SearchInput, toast } from '@/components/ui';
import { MentorFormFields, validateMentorForm, type MentorFormErrors, type MentorFormValue } from './MentorFormFields';

const EMPTY: MentorFormValue = { capacity: 4, expertise: [], styles: [], bio: '' };

export function AddMentorModal({ open, onClose, suggestions }: { open: boolean; onClose: () => void; suggestions: string[] }) {
  const db = useDb();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Employee | null>(null);
  const [value, setValue] = useState<MentorFormValue>(EMPTY);
  const [tried, setTried] = useState(false);
  const errors: MentorFormErrors = tried ? validateMentorForm(value) : {};

  const mentorIds = useMemo(() => new Set(db.mentors.map((m) => m.employeeId)), [db.mentors]);
  const candidates = useMemo(() => {
    const s = q.trim().toLowerCase();
    return db.employees
      .filter((e) => e.status === 'active' && !mentorIds.has(e.id) && gradeNumber(e.grade) >= MIN_MENTOR_GRADE)
      .filter((e) => !s || `${e.name} ${e.code} ${e.designation}`.toLowerCase().includes(s))
      .sort((a, b) => gradeNumber(b.grade) - gradeNumber(a.grade) || a.name.localeCompare(b.name));
  }, [db.employees, mentorIds, q]);

  // Expertise already used by mentors in the same function first
  const fnSuggestions = useMemo(() => {
    if (!picked) return suggestions;
    const same = db.mentors.filter((m) => db.employees.find((e) => e.id === m.employeeId)?.functionId === picked.functionId).flatMap((m) => m.expertise);
    return [...new Set([...same, ...suggestions])];
  }, [picked, db.mentors, db.employees, suggestions]);

  const close = () => {
    setQ('');
    setPicked(null);
    setValue(EMPTY);
    setTried(false);
    onClose();
  };

  const submit = () => {
    if (!picked) return;
    setTried(true);
    if (Object.keys(validateMentorForm(value)).length) return;
    try {
      addMentor(picked.id, value);
      toast.success(`${picked.name} is now a mentor`, `Capacity ${value.capacity} mentees per cohort · listed in the mentor directory.`);
      close();
    } catch (err) {
      toast.error('Couldn’t add mentor', err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="lg"
      icon={UserPlus}
      iconTone="mentor"
      title="Add a mentor"
      description={`Mentors are senior leaders (G${MIN_MENTOR_GRADE} and above) who mentor outside their own function.`}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button variant="mentor" onClick={submit} disabled={!picked}>
            Add mentor
          </Button>
        </>
      }
    >
      {picked ? (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3 rounded-xl border border-mentor/30 bg-mentor-soft/50 p-3">
            <Avatar name={picked.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{picked.name}</p>
              <p className="truncate text-xs text-ink-2">
                {picked.designation} · {functionName(db, picked.functionId)} · {unitName(db, picked.unitId, true)}
              </p>
            </div>
            <Badge tone="outline">{picked.grade}</Badge>
            <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
              Change
            </Button>
          </div>
          <MentorFormFields value={value} onChange={setValue} errors={errors} suggestions={fnSuggestions} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <SearchInput value={q} onChange={setQ} placeholder="Search senior leaders by name, code or role" className="sm:w-full" autoFocus />
          {candidates.length ? (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
              {candidates.map((e) => (
                <li key={e.id}>
                  <button type="button" onClick={() => setPicked(e)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-canvas">
                    <PersonCell name={e.name} secondary={`${e.code} · ${e.designation}`} />
                    <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-ink-2">
                      {functionName(db, e.functionId)}
                      <Badge tone="outline" size="sm">
                        {e.grade}
                      </Badge>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              size="sm"
              tone="mentor"
              icon={GraduationCap}
              title={q ? 'No matching senior leaders' : 'Every senior leader is already a mentor'}
              message={q ? `Only active employees at G${MIN_MENTOR_GRADE}+ who aren’t mentors yet can be added.` : 'Promote or hire more senior leaders to grow the mentor pool.'}
            />
          )}
        </div>
      )}
    </Modal>
  );
}
