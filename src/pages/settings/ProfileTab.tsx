import { useState, type FormEvent } from 'react';
import { Check, KeyRound, Lock, Mail } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatDate, formatDateTime, timeAgo } from '@/lib/format';
import { employeeName, functionName, unitName } from '@/lib/lookup';
import { isStrongPassword, passwordRules } from '@/lib/password';
import { ROLE_META, isUnitScoped } from '@/lib/rbac';
import { changePassword, useCurrentAdmin } from '@/store/auth';
import { useDb } from '@/store/db';
import { Avatar, Badge, Button, Card, CardHeader, DescriptionList, Input, toast } from '@/components/ui';

function ChangePasswordCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const rules = passwordRules(next);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!current) return setError('Enter your current password');
    if (!isStrongPassword(next)) return setError('The new password doesn’t meet all the requirements');
    if (next !== confirm) return setError('The passwords don’t match');
    setSaving(true);
    setTimeout(() => {
      const res = changePassword(current, next);
      setSaving(false);
      if (!res.ok) return setError(res.error ?? 'Could not change password');
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success('Password changed', 'Use your new password next time you sign in.');
    }, 500);
  };

  return (
    <Card>
      <CardHeader title="Change password" subtitle="Applies to this demo browser only." icon={KeyRound} />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Input label="Current password" type="password" icon={Lock} autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Input label="New password" type="password" icon={Lock} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {rules.map((r) => (
            <li key={r.id} className={cn('flex items-center gap-2 text-xs', r.ok ? 'text-success' : 'text-ink-2')}>
              <span className={cn('grid size-3.5 place-items-center rounded-full', r.ok ? 'bg-success text-white' : 'border border-line-strong')}>{r.ok && <Check className="size-2.5" strokeWidth={3.5} />}</span>
              {r.label}
            </li>
          ))}
        </ul>
        <Input
          label="Confirm new password"
          type="password"
          icon={Lock}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={confirm && confirm !== next ? 'Passwords don’t match' : error ?? undefined}
        />
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Update password
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function ProfileTab() {
  const admin = useCurrentAdmin();
  const db = useDb();
  if (!admin) return null;
  const emp = db.employees.find((e) => e.id === admin.employeeId);
  const meta = ROLE_META[admin.role];
  const scoped = isUnitScoped(admin, 'employees.view');

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.35fr_1fr]">
      <div className="flex flex-col gap-6">
        <Card padding="none" className="overflow-hidden">
          <div className="bg-brand-gradient h-20" />
          <div className="px-6 pb-6">
            <div className="-mt-10 flex flex-wrap items-start gap-4">
              <Avatar name={admin.name} size="xl" ring className="shadow-card" />
              <div className="min-w-0 flex-1 pt-12">
                <h2 className="text-xl font-bold text-ink">{admin.name}</h2>
                <p className="text-sm text-ink-2">{admin.title}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge tone={meta.tone}>{meta.label}</Badge>
              {scoped && (
                <Badge tone="warning" icon={Lock}>
                  {unitName(db, admin.unitScope)} only
                </Badge>
              )}
              <Badge tone="outline" icon={Mail}>
                {admin.email}
              </Badge>
            </div>
            <p className="mt-3 text-sm text-ink-2">{meta.description}</p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Linked employee record" subtitle="Admin accounts are linked to the organisation directory." />
          {emp ? (
            <DescriptionList
              columns={3}
              items={[
                { label: 'Employee code', value: emp.code },
                { label: 'Designation', value: emp.designation },
                { label: 'Department', value: emp.department },
                { label: 'Function', value: functionName(db, emp.functionId) },
                { label: 'Unit', value: unitName(db, emp.unitId) },
                { label: 'Location', value: emp.location },
                { label: 'Grade', value: emp.grade },
                { label: 'Reports to', value: employeeName(db, emp.managerId) },
                { label: 'Date of joining', value: formatDate(emp.dateOfJoining) },
              ]}
            />
          ) : (
            <p className="text-sm text-ink-2">No employee record linked.</p>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Account" />
          <DescriptionList
            columns={1}
            items={[
              { label: 'Admin ID', value: admin.id },
              { label: 'Access', value: meta.access },
              { label: 'Unit scope', value: admin.unitScope ? unitName(db, admin.unitScope) : 'All units' },
              { label: 'Last sign-in', value: admin.lastLoginAt ? `${formatDateTime(admin.lastLoginAt)} (${timeAgo(admin.lastLoginAt)})` : '—' },
            ]}
          />
        </Card>
        <ChangePasswordCard />
      </div>
    </div>
  );
}
