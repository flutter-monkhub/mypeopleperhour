import { useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { Employee, EmployeeLevel, EmployeeStatus } from '@shared/types';
import { Button, Drawer, Input, Select, toast } from '@/components/ui';
import { pluralize } from '@/lib/format';
import { reportsByManager } from '@/lib/lookup';
import { useScope } from '@/lib/scope';
import { updateEmployee, validateEmployeeEdit, type EmployeeEdit } from '@/store/actions';
import { useDb } from '@/store/db';
import { LEVEL_LABELS } from './employeeRows';

const STATUS_OPTIONS: { value: EmployeeStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On leave' },
  { value: 'inactive', label: 'Inactive (left the organisation)' },
];

const initial = (e: Employee): EmployeeEdit => ({
  designation: e.designation,
  department: e.department,
  functionId: e.functionId,
  grade: e.grade,
  level: e.level,
  unitId: e.unitId,
  location: e.location,
  status: e.status,
});

/** A15: edit role, grade, location, unit and status. Mount with `key={employee.id}` to reset. */
export function EditEmployeeDrawer({ employee, open, onClose }: { employee: Employee; open: boolean; onClose: () => void }) {
  const db = useDb();
  const { locked, unit } = useScope();
  const [form, setForm] = useState<EmployeeEdit>(() => initial(employee));
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeEdit, string>>>({});
  const set = <K extends keyof EmployeeEdit>(k: K, v: EmployeeEdit[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const fn = db.functions.find((f) => f.id === form.functionId);
  const reports = reportsByManager(db).get(employee.id)?.length ?? 0;
  const dirty = (Object.keys(form) as (keyof EmployeeEdit)[]).some((k) => form[k] !== initial(employee)[k]);

  const close = () => {
    setForm(initial(employee));
    setErrors({});
    onClose();
  };
  const save = () => {
    const errs = validateEmployeeEdit(form);
    if (Object.values(errs).some(Boolean)) return setErrors(errs);
    const r = updateEmployee(employee.id, form);
    if (!r.ok) return toast.error('Couldn’t save', r.error);
    toast.success('Profile updated', employee.name);
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={close}
      title={`Edit ${employee.firstName}’s profile`}
      subtitle={`${employee.code} · changes apply immediately to dashboards and filters`}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!dirty}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input label="Designation" required value={form.designation} onChange={(e) => set('designation', e.target.value)} error={errors.designation} maxLength={80} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select
            label="Function"
            required
            value={form.functionId}
            onValueChange={(v) => {
              const nf = db.functions.find((f) => f.id === v);
              setForm((f) => ({ ...f, functionId: v, department: nf?.departments.includes(f.department) ? f.department : (nf?.departments[0] ?? '') }));
              setErrors((e) => ({ ...e, functionId: undefined, department: undefined }));
            }}
            options={db.functions.map((f) => ({ value: f.id, label: f.name }))}
            error={errors.functionId}
          />
          <Select label="Department" required value={form.department} onValueChange={(v) => set('department', v)} options={(fn?.departments ?? []).map((d) => ({ value: d, label: d }))} error={errors.department} />
          <Select label="Grade" required value={form.grade} onValueChange={(v) => set('grade', v)} options={db.grades.map((g) => ({ value: g, label: g }))} error={errors.grade} />
          <Select
            label="Level"
            value={form.level}
            onValueChange={(v) => set('level', v as EmployeeLevel)}
            options={(Object.keys(LEVEL_LABELS) as EmployeeLevel[]).map((l) => ({ value: l, label: LEVEL_LABELS[l] }))}
          />
          <Select
            label="Unit"
            required
            value={form.unitId}
            disabled={locked}
            hint={locked ? `You can only manage ${unit?.name}` : undefined}
            onValueChange={(v) => set('unitId', v)}
            options={db.units.map((u) => ({ value: u.id, label: u.name }))}
            error={errors.unitId}
          />
          <Select label="Location" required value={form.location} onValueChange={(v) => set('location', v)} options={db.locations.map((l) => ({ value: l, label: l }))} error={errors.location} />
        </div>
        <Select label="Employment status" value={form.status} onValueChange={(v) => set('status', v as EmployeeStatus)} options={STATUS_OPTIONS} hint="On leave and inactive people are left out of MyPeopleHour pairs." />
        {form.status === 'inactive' && reports > 0 && (
          <p className="flex items-start gap-2 rounded-xl bg-warning-soft px-3.5 py-3 text-[13px] text-[#9A5200]">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {employee.firstName} manages {pluralize(reports, 'person', 'people')}. They’ll show as unmapped until you re-map them in Organisation → Manager mapping.
          </p>
        )}
      </div>
    </Drawer>
  );
}
