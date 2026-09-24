// Manager mapping (SPEC §6.2 A16): managers and their team sizes, unmapped people, and bulk
// re-mapping with the same no-loop validation as a single change.

import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CircleCheck, Lock, TriangleAlert, UserRoundCog, Users, X } from 'lucide-react';
import type { Employee, ID } from '@shared/types';
import { formatMonth } from '@shared/utils/dates';
import { Avatar, Badge, Button, Card, CardHeader, Checkbox, DataTable, FilterSelect, KpiCard, Modal, PersonCell, SearchInput, toast, type Column } from '@/components/ui';
import { completionByManager } from '@/lib/analytics';
import { formatDecimal, formatNumber, pluralize } from '@/lib/format';
import { employeeMap, reportsByManager, unitName } from '@/lib/lookup';
import { bulkChangeManager } from '@/store/actions';
import { RateCell } from '@/pages/dashboard/components/shared';
import { ManagerPicker } from './ManagerPicker';
import type { OrgTabProps } from './OrgStructureTabs';

interface MappingProps extends OrgTabProps {
  canEdit: boolean;
  unitId: ID | null;
  locked: boolean;
  unitLabel?: string;
}

/** Active people who have no valid manager (none, missing, or the manager has left). The MD is exempt. */
export function unmappedEmployees(all: readonly Employee[], people: readonly Employee[]): Employee[] {
  const byId = new Map(all.map((e) => [e.id, e]));
  return people.filter((e) => {
    if (e.level === 'executive' && !e.managerId && e.grade === 'G10') return false;
    if (!e.managerId) return true;
    const m = byId.get(e.managerId);
    return !m || m.status === 'inactive';
  });
}

function BulkRemapModal({ db, ids, onClose, candidates, scopeNote }: { db: MappingProps['db']; ids: ID[]; onClose: (done: boolean) => void; candidates: Employee[]; scopeNote?: string }) {
  const [picked, setPicked] = useState<ID | null>(null);
  const [step, setStep] = useState<'pick' | 'review'>('pick');
  const emp = employeeMap(db);
  const people = ids.map((id) => emp.get(id)).filter((e): e is Employee => !!e);
  const next = picked ? emp.get(picked) : undefined;
  const already = people.filter((p) => p.managerId === picked).length;
  const confirmIt = () => {
    if (!picked) return;
    const r = bulkChangeManager(ids, picked);
    if (!r.ok) {
      toast.error('Couldn’t re-map', r.error);
      setStep('pick');
      return;
    }
    toast.success(`${pluralize(r.moved.length, 'person', 'people')} re-mapped`, `Now reporting to ${next?.name}${r.unchanged.length ? ` · ${r.unchanged.length} already did` : ''}.`);
    onClose(true);
  };
  return (
    <Modal
      open
      onClose={() => onClose(false)}
      size="md"
      icon={UserRoundCog}
      title={step === 'pick' ? `Assign a new manager to ${pluralize(people.length, 'person', 'people')}` : 'Confirm re-mapping'}
      description={step === 'pick' ? 'People who report into anyone selected can’t be chosen — that would create a loop.' : 'Please check before you confirm.'}
      footer={
        step === 'pick' ? (
          <>
            <Button variant="secondary" onClick={() => onClose(false)}>
              Cancel
            </Button>
            <Button onClick={() => setStep('review')} disabled={!picked} iconRight={ArrowRight}>
              Review
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStep('pick')}>
              Back
            </Button>
            <Button onClick={confirmIt} data-autofocus>
              Re-map {pluralize(people.length - already, 'person', 'people')}
            </Button>
          </>
        )
      }
    >
      {step === 'pick' ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5">
            {people.slice(0, 8).map((p) => (
              <Badge key={p.id} tone="outline" size="sm">
                {p.name}
              </Badge>
            ))}
            {people.length > 8 && (
              <Badge tone="neutral" size="sm">
                +{people.length - 8} more
              </Badge>
            )}
          </div>
          <ManagerPicker db={db} employeeIds={ids} candidates={candidates} value={picked} onChange={setPicked} scopeNote={scopeNote} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary-soft/50 p-3">
            {next && <Avatar name={next.name} />}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wide text-muted uppercase">New manager</p>
              <p className="truncate text-sm font-semibold text-ink">{next?.name}</p>
              <p className="truncate text-xs text-ink-2">
                {next?.designation} · {unitName(db, next?.unitId, true)}
              </p>
            </div>
          </div>
          <ul className="scrollbar-thin max-h-60 divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                <PersonCell name={p.name} secondary={`currently ${p.managerId ? (emp.get(p.managerId)?.name ?? '—') : 'no manager'}`} className="flex-1" />
                {p.managerId === picked ? (
                  <Badge tone="neutral" size="sm">
                    No change
                  </Badge>
                ) : (
                  <ArrowRight className="size-4 text-primary" />
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-2">Sessions already booked stay on the calendar. From the next booking, {next?.firstName} owns the monthly hour with each of them.</p>
        </div>
      )}
    </Modal>
  );
}

export function ManagerMappingTab({ db, people, canEdit, month, unitId, locked, unitLabel }: MappingProps) {
  const navigate = useNavigate();
  const remapRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState('');
  const [mgrFilter, setMgrFilter] = useState('');
  const [selected, setSelected] = useState<Set<ID>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const emp = employeeMap(db);
  const reports = reportsByManager(db);

  const managers = useMemo(() => {
    const completion = new Map(completionByManager(db, month, unitId ? { unitId } : {}).map((c) => [c.key, c]));
    const ids = new Set<ID>();
    const inScope = new Set(people.map((e) => e.id));
    for (const e of people) if (e.managerId) ids.add(e.managerId);
    return [...ids]
      .map((id) => {
        const m = emp.get(id);
        const team = (reports.get(id) ?? []).filter((e) => inScope.has(e.id));
        return { id, m, team: team.length, onLeave: team.filter((e) => e.status === 'on_leave').length, c: completion.get(id) };
      })
      .filter((x) => x.team > 0);
  }, [db, month, unitId, people, emp, reports]);

  const unmapped = useMemo(() => unmappedEmployees(db.employees, people), [db.employees, people]);
  const teamSizes = managers.map((m) => m.team);
  const avgTeam = teamSizes.length ? teamSizes.reduce((a, b) => a + b, 0) / teamSizes.length : 0;
  const largest = managers.reduce<(typeof managers)[number] | null>((b, m) => (!b || m.team > b.team ? m : b), null);

  const pool = useMemo(() => {
    const s = q.trim().toLowerCase();
    return people.filter((e) => {
      if (mgrFilter === '__unmapped') return unmapped.includes(e);
      if (mgrFilter && e.managerId !== mgrFilter) return false;
      return !s || e.name.toLowerCase().includes(s) || e.code.toLowerCase().includes(s) || e.designation.toLowerCase().includes(s);
    });
  }, [people, q, mgrFilter, unmapped]);

  const toggle = (id: ID, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const allOn = pool.length > 0 && pool.every((e) => selected.has(e.id));
  const someOn = pool.some((e) => selected.has(e.id));
  const pickManager = (id: string) => {
    setMgrFilter(id);
    setSelected(new Set());
    remapRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  type MRow = (typeof managers)[number];
  const managerCols: Column<MRow>[] = [
    { key: 'name', header: 'Manager', sortValue: (r) => r.m?.name ?? r.id, cell: (r) => <PersonCell name={r.m?.name ?? r.id} secondary={r.m ? `${r.m.designation} · ${unitName(db, r.m.unitId, true)}` : 'Not in directory'} className="max-w-[300px]" /> },
    { key: 'team', header: 'Team size', align: 'right', sortValue: (r) => r.team, cell: (r) => <span className="font-semibold tabular">{formatNumber(r.team)}</span> },
    { key: 'leave', header: 'On leave', align: 'right', hideBelow: 'lg', sortValue: (r) => r.onLeave, cell: (r) => <span className="text-ink-2 tabular">{r.onLeave || '—'}</span> },
    { key: 'rate', header: `MPH · ${formatMonth(month).slice(0, 3)}`, width: 170, sortValue: (r) => r.c?.completionRate ?? -1, cell: (r) => (r.c ? <RateCell rate={r.c.completionRate} total={r.c.total} /> : <span className="text-muted">—</span>) },
    {
      key: 'act',
      header: '',
      align: 'right',
      sortable: false,
      cell: (r) => (
        <Button
          variant="ghost"
          size="xs"
          onClick={(ev) => {
            ev.stopPropagation();
            pickManager(r.id);
          }}
        >
          {canEdit ? 'Re-map team' : 'View team'}
        </Button>
      ),
    },
  ];

  const personCols: Column<Employee>[] = [
    ...(canEdit
      ? [
          {
            key: 'sel',
            header: <Checkbox checked={allOn} indeterminate={!allOn && someOn} onChange={(on) => setSelected((prev) => { const next = new Set(prev); for (const e of pool) { if (on) next.add(e.id); else next.delete(e.id); } return next; })} />,
            width: 44,
            sortable: false,
            cell: (e: Employee) => (
              <span onClick={(ev) => ev.stopPropagation()}>
                <Checkbox checked={selected.has(e.id)} onChange={(on) => toggle(e.id, on)} />
              </span>
            ),
          } satisfies Column<Employee>,
        ]
      : []),
    { key: 'name', header: 'Employee', sortValue: (e) => e.name, cell: (e) => <PersonCell name={e.name} secondary={`${e.code} · ${e.designation}`} className="max-w-[300px]" /> },
    { key: 'unit', header: 'Unit', hideBelow: 'lg', sortValue: (e) => unitName(db, e.unitId, true), cell: (e) => <span className="text-ink-2">{unitName(db, e.unitId, true)}</span> },
    {
      key: 'mgr',
      header: 'Current manager',
      sortValue: (e) => (e.managerId ? (emp.get(e.managerId)?.name ?? '') : ''),
      cell: (e) => {
        const m = e.managerId ? emp.get(e.managerId) : undefined;
        if (unmapped.includes(e))
          return (
            <Badge tone="warning" size="sm" icon={TriangleAlert}>
              {m ? `${m.name} (left)` : 'Unmapped'}
            </Badge>
          );
        return <span className="whitespace-nowrap">{m?.name ?? '—'}</span>;
      },
    },
  ];

  const candidates = locked && unitId ? db.employees.filter((e) => e.unitId === unitId) : db.employees;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Managers" value={formatNumber(managers.length)} icon={Users} tone="primary" hint={`with reports in ${unitLabel ?? 'scope'}`} />
        <KpiCard label="Average team size" value={formatDecimal(avgTeam)} icon={Users} tone="info" hint="direct reports per manager" />
        <KpiCard label="Largest team" value={largest ? formatNumber(largest.team) : '—'} icon={UserRoundCog} tone="mentor" hint={largest?.m?.name} />
        <KpiCard
          label="Unmapped people"
          value={formatNumber(unmapped.length)}
          icon={unmapped.length ? TriangleAlert : CircleCheck}
          tone={unmapped.length ? 'warning' : 'success'}
          toneValue={unmapped.length > 0}
          hint={unmapped.length ? 'no active manager' : 'everyone has a manager'}
          onClick={unmapped.length ? () => pickManager('__unmapped') : undefined}
        />
      </div>

      {unmapped.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-warning/30 bg-warning-soft px-5 py-3.5">
          <TriangleAlert className="size-5 shrink-0 text-warning" />
          <p className="min-w-0 flex-1 text-[13px] text-[#9A5200]">
            <strong>{pluralize(unmapped.length, 'person', 'people')}</strong> {unmapped.length === 1 ? 'has' : 'have'} no active manager, so {unmapped.length === 1 ? 'they have' : 'they have'} no MyPeopleHour: {unmapped.slice(0, 3).map((e) => e.name).join(', ')}
            {unmapped.length > 3 ? '…' : ''}
          </p>
          <Button variant="secondary" size="sm" onClick={() => pickManager('__unmapped')}>
            {canEdit ? 'Map them now' : 'Show them'}
          </Button>
        </div>
      )}

      <Card padding="none">
        <CardHeader divider icon={Users} title="Managers and team sizes" subtitle="Click a manager to work with their team below" />
        <DataTable columns={managerCols} rows={managers} rowKey={(r) => r.id} initialSort={{ key: 'team', dir: 'desc' }} pageSize={8} pageSizeOptions={[8, 25, 50]} dense minWidth={620} onRowClick={(r) => pickManager(r.id)} emptyTitle="No managers in scope" />
      </Card>

      <div ref={remapRef} className="scroll-mt-20">
        <Card padding="none">
          <CardHeader
            divider
            icon={UserRoundCog}
            title={canEdit ? 'Re-map employees' : 'Who reports to whom'}
            subtitle={canEdit ? 'Select people, then assign them a new manager. Loops are blocked automatically.' : 'Read-only — re-mapping needs the “Edit employees” permission.'}
            actions={!canEdit ? <Lock className="size-4 text-muted" /> : undefined}
          />
          <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-5 py-3">
            <FilterSelect
              label="Current manager"
              value={mgrFilter}
              allLabel="Anyone"
              onChange={(v) => {
                setMgrFilter(v);
                setSelected(new Set());
              }}
              options={[
                ...(unmapped.length ? [{ value: '__unmapped', label: `Unmapped (${unmapped.length})` }] : []),
                ...managers
                  .slice()
                  .sort((a, b) => (a.m?.name ?? '').localeCompare(b.m?.name ?? ''))
                  .map((m) => ({ value: m.id, label: `${m.m?.name ?? m.id} (${m.team})` })),
              ]}
            />
            <SearchInput value={q} onChange={setQ} placeholder="Search people" size="sm" />
            {canEdit && selected.size > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <Badge tone="primary">{pluralize(selected.size, 'selected', 'selected')}</Badge>
                <Button variant="ghost" size="sm" icon={X} onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
                <Button size="sm" icon={UserRoundCog} onClick={() => setBulkOpen(true)}>
                  Assign new manager
                </Button>
              </div>
            )}
          </div>
          <DataTable
            columns={personCols}
            rows={pool}
            rowKey={(e) => e.id}
            initialSort={{ key: 'name', dir: 'asc' }}
            pageSize={10}
            pageSizeOptions={[10, 25, 50]}
            dense
            minWidth={560}
            onRowClick={canEdit ? (e) => toggle(e.id, !selected.has(e.id)) : (e) => navigate(`/employees/${e.id}`)}
            rowClassName={(e) => (selected.has(e.id) ? 'bg-primary-soft/50' : undefined)}
            emptyTitle="Nobody matches"
          />
        </Card>
      </div>

      {bulkOpen && (
        <BulkRemapModal
          db={db}
          ids={[...selected]}
          candidates={candidates}
          scopeNote={locked ? `Only people in ${unitLabel} are listed` : undefined}
          onClose={(done) => {
            setBulkOpen(false);
            if (done) setSelected(new Set());
          }}
        />
      )}
    </div>
  );
}
