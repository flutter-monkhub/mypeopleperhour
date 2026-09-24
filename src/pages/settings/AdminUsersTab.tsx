import { useMemo, useState } from 'react';
import { Lock, UserPlus } from 'lucide-react';
import type { AdminRole, AdminUser, Employee } from '@shared/types';
import { cn } from '@/lib/cn';
import { timeAgo } from '@/lib/format';
import { unitName } from '@/lib/lookup';
import { ROLE_META, ROLES } from '@/lib/rbac';
import { addAdminUser, updateAdminUser } from '@/store/actions';
import { DEFAULT_ADMIN_PASSWORD, useCurrentAdmin } from '@/store/auth';
import { useDb } from '@/store/db';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  Modal,
  PersonCell,
  SearchInput,
  Select,
  Toggle,
  confirm,
  toast,
  type Column,
} from '@/components/ui';

const roleOptions = ROLES.map((r) => ({ value: r, label: ROLE_META[r].label }));

function AddAdminModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDb();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Employee | null>(null);
  const [role, setRole] = useState<AdminRole>('hr_admin');
  const [unit, setUnit] = useState('');
  const [error, setError] = useState<string | null>(null);

  const existing = useMemo(() => new Set(db.adminUsers.map((u) => u.employeeId)), [db.adminUsers]);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return db.employees
      .filter((e) => e.status !== 'inactive' && !existing.has(e.id) && (e.name.toLowerCase().includes(s) || e.code.toLowerCase().includes(s) || e.email.toLowerCase().includes(s)))
      .slice(0, 6);
  }, [q, db.employees, existing]);

  const close = () => {
    setQ('');
    setPicked(null);
    setRole('hr_admin');
    setUnit('');
    setError(null);
    onClose();
  };

  const submit = () => {
    if (!picked) return setError('Choose an employee');
    if (role === 'hr_admin' && !unit) return setError('Choose the unit this HR admin is responsible for');
    const u = addAdminUser({ employeeId: picked.id, role, unitScope: role === 'hr_admin' ? unit : undefined });
    toast.success(`${u.name} can now sign in`, `${ROLE_META[role].label} · default password ${DEFAULT_ADMIN_PASSWORD}`);
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Add admin user"
      description="Give an employee access to this admin panel."
      icon={UserPlus}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!picked}>
            Add admin user
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {picked ? (
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary-soft/50 p-3">
            <Avatar name={picked.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{picked.name}</p>
              <p className="truncate text-xs text-ink-2">
                {picked.designation} · {unitName(db, picked.unitId)}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
              Change
            </Button>
          </div>
        ) : (
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink">Employee</p>
            <SearchInput value={q} onChange={setQ} placeholder="Search by name, code or email" className="sm:w-full" autoFocus />
            {q.trim() && (
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line">
                {results.length === 0 && <li className="px-3 py-4 text-center text-sm text-ink-2">No matching employees without admin access</li>}
                {results.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => (setPicked(e), setUnit(e.unitId), setError(null))} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-canvas">
                      <PersonCell name={e.name} secondary={`${e.code} · ${e.designation}`} />
                      <span className="ml-auto shrink-0 text-xs text-ink-2">{unitName(db, e.unitId, true)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Select label="Role" options={roleOptions} value={role} onValueChange={(v) => setRole(v as AdminRole)} hint={ROLE_META[role].access} />
          <Select
            label="Unit scope"
            value={role === 'hr_admin' ? unit : ''}
            disabled={role !== 'hr_admin'}
            placeholder={role === 'hr_admin' ? 'Choose a unit' : 'All units'}
            options={db.units.map((u) => ({ value: u.id, label: u.name }))}
            onValueChange={setUnit}
            hint={role === 'hr_admin' ? 'HR admins only see their unit' : 'Only HR admins are unit-scoped'}
          />
        </div>
        {error && <p className="text-sm font-medium text-danger">{error}</p>}
      </div>
    </Modal>
  );
}

export function AdminUsersTab() {
  const db = useDb();
  const me = useCurrentAdmin();
  const [adding, setAdding] = useState(false);

  const changeRole = async (u: AdminUser, role: AdminRole) => {
    if (role === u.role) return;
    const ok = await confirm({
      title: `Change ${u.name}’s role?`,
      message: (
        <>
          <strong className="text-ink">{ROLE_META[u.role].label}</strong> → <strong className="text-ink">{ROLE_META[role].label}</strong>. They will get: {ROLE_META[role].access.toLowerCase()}.
        </>
      ),
      confirmLabel: 'Change role',
    });
    if (!ok) return;
    const firstUnit = db.units.find((x) => x.id === db.employees.find((e) => e.id === u.employeeId)?.unitId)?.id ?? db.units[0]?.id;
    updateAdminUser(u.id, { role, unitScope: role === 'hr_admin' ? (u.unitScope ?? firstUnit) : undefined });
    toast.success('Role updated', `${u.name} is now ${ROLE_META[role].label.toLowerCase()}.`);
  };

  const toggleActive = async (u: AdminUser, active: boolean) => {
    if (!active) {
      const ok = await confirm({
        title: `Deactivate ${u.name}?`,
        message: 'They will be signed out and won’t be able to sign in until reactivated.',
        confirmLabel: 'Deactivate',
        tone: 'danger',
      });
      if (!ok) return;
    }
    updateAdminUser(u.id, { active });
    toast.success(active ? 'Admin user reactivated' : 'Admin user deactivated', u.name);
  };

  const columns: Column<AdminUser>[] = [
    {
      key: 'name',
      header: 'Admin user',
      sortValue: (u) => u.name,
      cell: (u) => (
        <div className="flex items-center gap-2">
          <PersonCell name={u.name} secondary={u.email} />
          {u.id === me?.id && (
            <Badge tone="primary" size="sm">
              You
            </Badge>
          )}
        </div>
      ),
    },
    { key: 'title', header: 'Title', sortValue: (u) => u.title, hideBelow: 'xl', cell: (u) => <span className="text-ink-2">{u.title}</span> },
    {
      key: 'role',
      header: 'Role',
      sortValue: (u) => ROLE_META[u.role].label,
      width: 215,
      cell: (u) =>
        u.id === me?.id ? (
          <Badge tone={ROLE_META[u.role].tone}>{ROLE_META[u.role].label}</Badge>
        ) : (
          <Select aria-label={`Role of ${u.name}`} size="sm" containerClassName="min-w-36" options={roleOptions} value={u.role} onValueChange={(v) => void changeRole(u, v as AdminRole)} />
        ),
    },
    {
      key: 'scope',
      header: 'Unit scope',
      sortValue: (u) => (u.unitScope ? unitName(db, u.unitScope) : ''),
      width: 225,
      cell: (u) =>
        u.role === 'hr_admin' ? (
          <Select
            aria-label={`Unit scope of ${u.name}`}
            size="sm"
            containerClassName="min-w-40"
            icon={Lock}
            value={u.unitScope ?? ''}
            options={db.units.map((x) => ({ value: x.id, label: x.name }))}
            onValueChange={(v) => {
              updateAdminUser(u.id, { unitScope: v });
              toast.success('Unit scope updated', `${u.name} → ${unitName(db, v)}`);
            }}
          />
        ) : (
          <span className="text-ink-2">All units</span>
        ),
    },
    { key: 'last', header: 'Last sign-in', sortValue: (u) => u.lastLoginAt ?? '', hideBelow: 'xl', cell: (u) => <span className="text-ink-2">{u.lastLoginAt ? timeAgo(u.lastLoginAt) : 'Never'}</span> },
    {
      key: 'active',
      header: 'Access',
      sortValue: (u) => u.active,
      width: 110,
      cell: (u) => (
        <div className="flex items-center gap-2.5">
          <Toggle size="sm" checked={u.active} disabled={u.id === me?.id} onChange={(v) => void toggleActive(u, v)} aria-label={`${u.active ? 'Deactivate' : 'Activate'} ${u.name}`} />
          <span className={cn('hidden text-xs font-medium xl:inline', u.active ? 'text-success' : 'text-ink-2')}>{u.active ? 'Active' : 'Inactive'}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card padding="none">
        <CardHeader
          divider
          title="Admin users"
          subtitle="People who can sign in to this admin panel. Everyone else uses the MyPeopleHour mobile app."
          actions={
            <Button icon={UserPlus} onClick={() => setAdding(true)}>
              Add admin user
            </Button>
          }
        />
        <DataTable columns={columns} rows={db.adminUsers} rowKey={(u) => u.id} pageSize={0} dense minWidth={660} initialSort={{ key: 'name', dir: 'asc' }} />
      </Card>
      <AddAdminModal open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}
