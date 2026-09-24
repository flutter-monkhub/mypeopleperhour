import { useState } from 'react';
import { ArrowDown, ArrowRight, Info, UserRoundCog } from 'lucide-react';
import type { Employee, ID } from '@shared/types';
import { Avatar, Button, Modal, toast } from '@/components/ui';
import { pluralize } from '@/lib/format';
import { employeeMap, reportsByManager, unitName } from '@/lib/lookup';
import { useScope } from '@/lib/scope';
import { changeManager } from '@/store/actions';
import { useDb } from '@/store/db';
import { ManagerPicker } from './ManagerPicker';

function PersonTile({ e, caption, unit }: { e: Employee | undefined; caption: string; unit: string }) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-line bg-white p-3">
      {e ? <Avatar name={e.name} size="sm" /> : <span className="size-8 rounded-full bg-neutral-soft" />}
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">{caption}</p>
        <p className="truncate text-[13px] font-semibold text-ink">{e?.name ?? 'No manager'}</p>
        {e && (
          <p className="truncate text-xs text-ink-2">
            {e.designation} · {unit}
          </p>
        )}
      </div>
    </div>
  );
}

/** A16: change one employee's manager — search, validate (no loops), review, confirm. */
export function ChangeManagerModal({ employee, open, onClose }: { employee: Employee; open: boolean; onClose: () => void }) {
  const db = useDb();
  const { unitId, locked, unit } = useScope();
  const [picked, setPicked] = useState<ID | null>(null);
  const [step, setStep] = useState<'pick' | 'review'>('pick');
  const emp = employeeMap(db);
  const current = employee.managerId ? emp.get(employee.managerId) : undefined;
  const next = picked ? emp.get(picked) : undefined;
  const reports = reportsByManager(db).get(employee.id)?.length ?? 0;
  const candidates = locked && unitId ? db.employees.filter((e) => e.unitId === unitId) : db.employees;

  const close = () => {
    setPicked(null);
    setStep('pick');
    onClose();
  };
  const confirmChange = () => {
    if (!picked) return;
    const r = changeManager(employee.id, picked);
    if (!r.ok) {
      toast.error('Couldn’t change manager', r.error);
      setStep('pick');
      return;
    }
    toast.success('Manager updated', `${employee.name} now reports to ${next?.name}.`);
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      size="md"
      icon={UserRoundCog}
      title={step === 'pick' ? `Change ${employee.firstName}’s manager` : 'Confirm the change'}
      description={step === 'pick' ? 'The new manager owns the monthly MyPeopleHour with them from now on.' : 'Please check the reporting line before you confirm.'}
      footer={
        step === 'pick' ? (
          <>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button onClick={() => setStep('review')} disabled={!picked} iconRight={ArrowRight}>
              Review change
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStep('pick')}>
              Back
            </Button>
            <Button onClick={confirmChange} data-autofocus>
              Confirm change
            </Button>
          </>
        )
      }
    >
      {step === 'pick' ? (
        <div className="flex flex-col gap-4">
          <PersonTile e={current} caption="Current manager" unit={unitName(db, current?.unitId, true)} />
          <ManagerPicker
            db={db}
            employeeIds={[employee.id]}
            candidates={candidates}
            value={picked}
            onChange={setPicked}
            scopeNote={locked ? `Only people in ${unit?.name} are listed` : undefined}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <PersonTile e={current} caption="From" unit={unitName(db, current?.unitId, true)} />
          <ArrowDown className="mx-auto size-4 text-muted" />
          <PersonTile e={next} caption="To" unit={unitName(db, next?.unitId, true)} />
          <ul className="mt-2 flex flex-col gap-2 rounded-xl bg-primary-soft/60 px-4 py-3 text-[13px] text-ink">
            <li className="flex gap-2">
              <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span>
                {employee.name} will report to <strong>{next?.name}</strong>. Sessions already booked stay on the calendar; new months are owned by the new manager.
              </span>
            </li>
            {reports > 0 && (
              <li className="flex gap-2">
                <Info className="mt-0.5 size-3.5 shrink-0 text-primary" />
                <span>Their own {pluralize(reports, 'direct report')} keep reporting to {employee.firstName} — the whole team moves with them.</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </Modal>
  );
}
