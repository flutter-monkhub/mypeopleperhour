import { Check, Info, Lock, Minus } from 'lucide-react';
import type { AdminPermission } from '@shared/types';
import { ALL_PERMISSIONS, PERMISSION_META, ROLE_META, ROLES, ROLE_PERMISSIONS, UNIT_SCOPED_PERMISSIONS } from '@/lib/rbac';
import { useCollection } from '@/store/db';
import { Badge, Card, CardHeader } from '@/components/ui';

/** Read-only visual of the SPEC §2 permission matrix. */
export function RolesTab() {
  const adminUsers = useCollection('adminUsers');
  const modules = [...new Set(ALL_PERMISSIONS.map((p) => PERMISSION_META[p].module))];
  const count = (role: string) => adminUsers.filter((u) => u.role === role && u.active).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ROLES.map((r) => (
          <Card key={r} padding="sm" className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Badge tone={ROLE_META[r].tone}>{ROLE_META[r].label}</Badge>
              <span className="text-xs text-ink-2 tabular">
                {count(r)} active {count(r) === 1 ? 'user' : 'users'}
              </span>
            </div>
            <p className="text-[13px] leading-snug text-ink-2">{ROLE_META[r].description}</p>
            <p className="mt-auto text-xs font-medium text-ink">{ROLE_PERMISSIONS[r].length} of {ALL_PERMISSIONS.length} permissions</p>
          </Card>
        ))}
      </div>

      <Card padding="none">
        <CardHeader divider title="Permission matrix" subtitle="Roles are fixed in this version — assign them to people under Admin users & roles." />
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[760px] border-separate border-spacing-0 text-[13px]">
            <thead>
              <tr>
                <th className="border-b border-line bg-[#F8FAFD] px-5 py-3 text-left text-xs font-semibold text-ink-2">Permission</th>
                {ROLES.map((r) => (
                  <th key={r} className="w-[15%] border-b border-line bg-[#F8FAFD] px-3 py-3 text-center text-xs font-semibold text-ink-2">
                    {ROLE_META[r].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {modules.map((m) => (
                <ModuleRows key={m} module={m} perms={ALL_PERMISSIONS.filter((p) => PERMISSION_META[p].module === m)} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-5 py-3 text-xs text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <Cell state="yes" /> Allowed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Cell state="unit" /> Own unit only (HR admin with a unit scope)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Cell state="no" /> Not allowed
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5">
            <Info className="size-3.5" /> Hidden navigation items and a 403 page enforce this in the app.
          </span>
        </div>
      </Card>
    </div>
  );
}

function ModuleRows({ module, perms }: { module: string; perms: AdminPermission[] }) {
  return (
    <>
      <tr>
        <td colSpan={ROLES.length + 1} className="border-b border-line bg-canvas px-5 py-2 text-[11px] font-semibold tracking-wider text-ink-2 uppercase">
          {module}
        </td>
      </tr>
      {perms.map((p) => (
        <tr key={p} className="hover:bg-[#FAFBFE]">
          <td className="border-b border-line px-5 py-3">
            <p className="font-medium text-ink">{PERMISSION_META[p].label}</p>
            <p className="text-xs text-ink-2">
              {PERMISSION_META[p].description} · <code className="text-[11px] text-muted">{p}</code>
            </p>
          </td>
          {ROLES.map((r) => (
            <td key={r} className="border-b border-line px-3 py-3 text-center">
              <Cell state={!ROLE_PERMISSIONS[r].includes(p) ? 'no' : r === 'hr_admin' && UNIT_SCOPED_PERMISSIONS.includes(p) ? 'unit' : 'yes'} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function Cell({ state }: { state: 'yes' | 'unit' | 'no' }) {
  if (state === 'yes')
    return (
      <span className="inline-grid size-6 place-items-center rounded-full bg-success-soft text-success" aria-label="Allowed">
        <Check className="size-3.5" strokeWidth={3} />
      </span>
    );
  if (state === 'unit')
    return (
      <span className="inline-flex h-6 items-center gap-1 rounded-full bg-warning-soft px-2 text-[11px] font-semibold text-[#9A5200]" aria-label="Own unit only">
        <Lock className="size-3" /> Own unit
      </span>
    );
  return (
    <span className="inline-grid size-6 place-items-center rounded-full bg-neutral-soft text-muted" aria-label="Not allowed">
      <Minus className="size-3.5" />
    </span>
  );
}
