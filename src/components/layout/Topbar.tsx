import { Building2, CalendarDays, ChevronDown, ChevronRight, KeyRound, Lock, LogOut, Menu, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatMonth } from '@shared/utils/dates';
import { cn } from '@/lib/cn';
import { ROLE_META } from '@/lib/rbac';
import { useMonth, useScope } from '@/lib/scope';
import { signOut, useCurrentAdmin } from '@/store/auth';
import { useCollection } from '@/store/db';
import { useUiStore } from '@/store/ui';
import { Avatar, Badge, DropdownMenu, Tooltip } from '@/components/ui';
import { NotificationBell } from './NotificationBell';
import { useRouteHandle } from './routeHandle';

const pill =
  'relative inline-flex h-9 items-center gap-2 rounded-full border border-line-strong bg-white pr-8 pl-3 text-[13px] font-medium whitespace-nowrap text-ink transition-colors hover:border-[#c3cbdc]';

function UnitFilter() {
  const { unitId, locked, unit } = useScope();
  const units = useCollection('units');
  const setUnitId = useUiStore((s) => s.setUnitId);
  if (locked)
    return (
      <Tooltip content={`Your access is limited to ${unit?.name ?? 'your unit'}`} side="bottom">
        <span className="inline-flex h-9 items-center gap-2 rounded-full border border-warning/30 bg-warning-soft px-3 text-[13px] font-semibold whitespace-nowrap text-[#9A5200]">
          <Lock className="size-3.5" />
          <span className="hidden xl:inline">{unit?.name}</span>
          <span className="xl:hidden">{unit?.shortName}</span>
        </span>
      </Tooltip>
    );
  return (
    <label className={cn(pill, unitId && 'border-primary/40 bg-primary-soft text-primary')}>
      <Building2 className={cn('size-4', unitId ? 'text-primary' : 'text-ink-2')} />
      <span className="hidden max-w-40 truncate sm:inline">{unit?.name ?? 'All units'}</span>
      <span className="sm:hidden">{unit?.shortName ?? 'All'}</span>
      <ChevronDown className="pointer-events-none absolute right-3 size-3.5 opacity-70" />
      <select aria-label="Unit filter" value={unitId ?? ''} onChange={(e) => setUnitId(e.target.value || null)} className="absolute inset-0 cursor-pointer opacity-0">
        <option value="">All units</option>
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function MonthFilter() {
  const { month, months, currentMonth, setMonth } = useMonth();
  return (
    <label className={pill}>
      <CalendarDays className="size-4 text-ink-2" />
      <span className="tabular">{formatMonth(month)}</span>
      <ChevronDown className="pointer-events-none absolute right-3 size-3.5 opacity-70" />
      <select aria-label="Month" value={month} onChange={(e) => setMonth(e.target.value === currentMonth ? null : e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        {[...months].reverse().map((m) => (
          <option key={m} value={m}>
            {formatMonth(m, true)}
            {m === currentMonth ? ' (current)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

function UserMenu() {
  const admin = useCurrentAdmin();
  const units = useCollection('units');
  const navigate = useNavigate();
  if (!admin) return null;
  const meta = ROLE_META[admin.role];
  const scope = admin.unitScope ? units.find((u) => u.id === admin.unitScope)?.name : null;
  return (
    <DropdownMenu
      width="w-72"
      trigger={(p) => (
        <button {...p} type="button" className="flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-neutral-soft">
          <Avatar name={admin.name} size="sm" />
          <span className="hidden text-left leading-tight xl:block">
            <span className="block text-[13px] font-semibold text-ink">{admin.name}</span>
            <span className="block text-xs text-ink-2">{meta.label}</span>
          </span>
          <ChevronDown className="size-4 text-ink-2" />
        </button>
      )}
      header={
        <div className="flex items-center gap-3">
          <Avatar name={admin.name} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{admin.name}</p>
            <p className="truncate text-xs text-ink-2">{admin.email}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <Badge tone={meta.tone} size="sm">
                {meta.label}
              </Badge>
              {scope && (
                <Badge tone="outline" size="sm" icon={Lock}>
                  {scope}
                </Badge>
              )}
            </div>
          </div>
        </div>
      }
      items={[
        { label: 'My profile', icon: UserRound, to: '/settings?tab=profile' },
        { label: 'Sessions & security', icon: KeyRound, to: '/settings?tab=security' },
        {
          label: 'Sign out',
          icon: LogOut,
          tone: 'danger',
          divider: true,
          onClick: () => {
            signOut('manual');
            navigate('/login', { replace: true });
          },
        },
      ]}
    />
  );
}

/** Sticky top bar: breadcrumb, global unit/month filters (per route), notifications, user menu. */
export function Topbar() {
  const handle = useRouteHandle();
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const filters = handle?.filters ?? [];
  return (
    <header className="no-print sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <button type="button" onClick={() => setSidebarOpen(true)} className="-ml-1 grid size-10 place-items-center rounded-lg text-ink-2 hover:bg-neutral-soft lg:hidden" aria-label="Open navigation">
        <Menu className="size-5" />
      </button>
      <nav className="hidden min-w-0 items-center gap-1.5 text-[13px] md:flex" aria-label="Breadcrumb">
        {handle?.group && (
          <>
            <span className="truncate text-ink-2">{handle.group}</span>
            <ChevronRight className="size-3.5 shrink-0 text-muted" />
          </>
        )}
        <span className="truncate font-semibold text-ink">{handle?.title}</span>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {filters.includes('unit') && <UnitFilter />}
        {filters.includes('month') && <MonthFilter />}
        {filters.length > 0 && <span className="mx-1 hidden h-6 w-px bg-line sm:block" />}
        <NotificationBell />
        <span className="mx-1 hidden h-6 w-px bg-line sm:block" />
        <UserMenu />
      </div>
    </header>
  );
}
