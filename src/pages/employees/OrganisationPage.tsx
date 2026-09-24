// Organisation (SPEC §6.2 A14–A16): functions & departments, units & locations, grades and manager
// mapping. Editing needs `employees.edit`; organisation-wide lists (functions, departments, locations)
// are left to unscoped admins, while a unit-scoped HR admin can still re-map people in their unit.

import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Building2, Layers, Lock, Network, UserRoundCog } from 'lucide-react';
import { PageHeader } from '@/components/layout';
import { Badge, SkeletonCard, Tabs, type TabItem } from '@/components/ui';
import { pluralize } from '@/lib/format';
import { useCan } from '@/lib/rbac';
import { useMonth, useScope, useScopedEmployees } from '@/lib/scope';
import { useDb } from '@/store/db';
import { useWarmup } from '@/pages/dashboard/components/useWarmup';
import { ManagerMappingTab, unmappedEmployees } from './components/ManagerMappingTab';
import { FunctionsTab, GradesTab, UnitsTab } from './components/OrgStructureTabs';

type TabId = 'functions' | 'units' | 'grades' | 'mapping';

export default function OrganisationPage() {
  const db = useDb();
  const ready = useWarmup('organisation', 280);
  const [params, setParams] = useSearchParams();
  const { month } = useMonth();
  const { unitId, locked, unit } = useScope();
  const canEdit = useCan('employees.edit');
  const canEditOrg = canEdit && !locked;
  const scoped = useScopedEmployees();
  const people = useMemo(() => scoped.filter((e) => e.status !== 'inactive'), [scoped]);
  const unmapped = useMemo(() => unmappedEmployees(db.employees, people).length, [db.employees, people]);

  const tabs: TabItem<TabId>[] = [
    { id: 'functions', label: 'Functions & departments', icon: Layers, count: db.functions.length },
    { id: 'units', label: 'Units & locations', icon: Building2, count: unitId ? 1 : db.units.length },
    { id: 'grades', label: 'Grades', icon: Network, count: db.grades.length },
    { id: 'mapping', label: 'Manager mapping', icon: UserRoundCog, ...(unmapped ? { count: unmapped } : {}) },
  ];
  const requested = params.get('tab') as TabId | null;
  const tab: TabId = tabs.some((t) => t.id === requested) ? (requested as TabId) : 'functions';
  const scopeLabel = unit?.name ?? 'All units';
  const common = { db, people, canEditOrg, scopeLabel, month };

  return (
    <>
      <PageHeader
        eyebrow="Organisation"
        title="Organisation"
        subtitle={`How PCBL is organised — ${pluralize(people.length, 'person', 'people')} ${unit ? `in ${unit.name}` : 'across every unit'}. Changes flow straight into dashboards, filters and MyPeopleHour pairs.`}
        meta={
          locked ? (
            <Badge tone="warning" icon={Lock}>
              {unit?.name} only
            </Badge>
          ) : !canEdit ? (
            <Badge tone="outline" icon={Lock}>
              Read-only
            </Badge>
          ) : undefined
        }
      />
      <Tabs<TabId> tabs={tabs} value={tab} onChange={(id) => setParams(id === 'functions' ? {} : { tab: id }, { replace: true })} className="mb-6" />
      {!ready ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <SkeletonCard key={i} lines={5} />
          ))}
        </div>
      ) : (
        <>
          {tab === 'functions' && <FunctionsTab {...common} scoped={locked} />}
          {tab === 'units' && <UnitsTab {...common} scoped={locked} unitId={unitId} />}
          {tab === 'grades' && <GradesTab {...common} />}
          {tab === 'mapping' && <ManagerMappingTab {...common} canEdit={canEdit} unitId={unitId} locked={locked} unitLabel={unit?.name} />}
        </>
      )}
    </>
  );
}
