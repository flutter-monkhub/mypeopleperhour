// Mentors — Admin rows A29 (mentor management) & A34 (capacity, live per cohort).
// Target banner (~25 senior-leader mentors), filters, table / card views, add mentor, edit drawer,
// activate / deactivate with a warning when the mentor has active mentees.

import { useMemo, useState } from 'react';
import { GraduationCap, LayoutGrid, MoreHorizontal, Pencil, Power, Rows3, Target, UserPlus } from 'lucide-react';
import type { MentorProfile, MentorStyle } from '@shared/types';
import { MENTORING_FRAMEWORK, MENTOR_ROLES } from '@shared/content/mentoring';
import { PageHeader } from '@/components/layout';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  DropdownMenu,
  EmptyState,
  FilterBar,
  FilterSelect,
  IconButton,
  PersonCell,
  ProgressBar,
  SearchInput,
  StatusBadge,
  Tabs,
  confirm,
  toast,
  type Column,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatNumber, pluralize } from '@/lib/format';
import { functionName, unitName } from '@/lib/lookup';
import { useCan } from '@/lib/rbac';
import { mentorLoad, mentorRatings, type MentorLoad } from '@/lib/analytics-mentoring';
import { setMentorActive } from '@/store/actions';
import { useDb } from '@/store/db';
import { AddMentorModal } from './components/AddMentorModal';
import { CapacityLegend, CapacityMeter } from './components/CapacityMeter';
import { CohortPicker, useCohortParam } from './components/cohort';
import { MentorDrawer } from './components/MentorDrawer';
import { MentoringEyebrow, Rating, StyleChips, ViewOnlyBadge } from './components/bits';

const TARGET_MENTORS = Number(MENTORING_FRAMEWORK.mentors.replace(/\D/g, '')) || 25;

interface MentorRow {
  profile: MentorProfile;
  id: string;
  name: string;
  designation: string;
  functionId: string;
  unitId: string;
  load: MentorLoad;
  activeMentees: number;
  pending: number;
  accepted: number;
  rating: number | null;
  ratingCount: number;
}

export default function MentorsPage() {
  const db = useDb();
  const canEdit = useCan('mentoring.edit');
  const { cohortId, cohort, cohorts, setCohortId } = useCohortParam('matching');
  const [q, setQ] = useState('');
  const [fn, setFn] = useState('');
  const [unit, setUnit] = useState('');
  const [style, setStyle] = useState('');
  const [status, setStatus] = useState('active');
  const [view, setView] = useState<'table' | 'cards'>('table');
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = useMemo<MentorRow[]>(() => {
    const ratings = mentorRatings(db);
    const counts = new Map<string, { active: number; pending: number; accepted: number }>();
    for (const m of db.matches) {
      const c = counts.get(m.mentorId) ?? { active: 0, pending: 0, accepted: 0 };
      if (m.status === 'active') c.active++;
      if (m.status === 'proposed') c.pending++;
      if (m.status === 'accepted') c.accepted++;
      counts.set(m.mentorId, c);
    }
    return db.mentors.map((p) => {
      const e = db.employees.find((x) => x.id === p.employeeId);
      const r = ratings.get(p.employeeId);
      const c = counts.get(p.employeeId);
      return {
        profile: p,
        id: p.employeeId,
        name: e?.name ?? p.employeeId,
        designation: e?.designation ?? '',
        functionId: e?.functionId ?? '',
        unitId: e?.unitId ?? '',
        load: mentorLoad(db, p.employeeId, cohortId),
        activeMentees: c?.active ?? 0,
        pending: c?.pending ?? 0,
        accepted: c?.accepted ?? 0,
        rating: r?.avg ?? null,
        ratingCount: r?.count ?? 0,
      };
    });
  }, [db, cohortId]);

  const suggestions = useMemo(() => [...new Set(db.mentors.flatMap((m) => m.expertise))].sort(), [db.mentors]);
  const activeCount = rows.filter((r) => r.profile.active).length;
  const visible = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!fn || r.functionId === fn) &&
        (!unit || r.unitId === unit) &&
        (!style || r.profile.styles.includes(style as MentorStyle)) &&
        (!status || (status === 'active') === r.profile.active) &&
        (!s || `${r.name} ${r.designation} ${r.profile.expertise.join(' ')}`.toLowerCase().includes(s)),
    );
  }, [rows, q, fn, unit, style, status]);

  const cohortSlots = rows.filter((r) => r.profile.active).reduce((s, r) => s + r.load.capacity, 0);
  const cohortTaken = rows.reduce((s, r) => s + r.load.occupied, 0);
  const cohortApps = db.applications.filter((a) => a.cohortId === cohortId && a.status !== 'draft' && a.status !== 'withdrawn').length;
  const filterCount = [fn, unit, style, status !== 'active' ? status || 'all' : ''].filter(Boolean).length;

  const toggleActive = async (r: MentorRow) => {
    const next = !r.profile.active;
    if (!next) {
      const ok = await confirm({
        title: `Deactivate ${r.name}?`,
        tone: 'danger',
        confirmLabel: 'Deactivate mentor',
        message:
          r.activeMentees || r.pending ? (
            <>
              <strong className="text-ink">
                {r.name.split(' ')[0]} has {pluralize(r.activeMentees, 'active mentee')}
                {r.pending ? ` and ${pluralize(r.pending, 'request')} awaiting a reply` : ''}.
              </strong>{' '}
              Running pairs continue until the cohort ends, but no new proposals can be made. Withdraw pending requests from the Matching workspace if needed.
            </>
          ) : (
            'They won’t appear in the mentor directory or receive new proposals until reactivated.'
          ),
      });
      if (!ok) return;
    }
    setMentorActive(r.id, next);
    toast.success(next ? 'Mentor reactivated' : 'Mentor deactivated', r.name);
  };

  const rowMenu = (r: MentorRow) => (
    <DropdownMenu
      align="end"
      width="w-48"
      trigger={(p) => <IconButton icon={MoreHorizontal} label={`Actions for ${r.name}`} size="sm" {...p} onClick={(e) => (e.stopPropagation(), p.onClick())} />}
      items={[
        { label: 'Edit profile', icon: Pencil, onClick: () => setEditing(r.id) },
        { label: r.profile.active ? 'Deactivate' : 'Reactivate', icon: Power, tone: r.profile.active ? 'danger' : 'default', onClick: () => void toggleActive(r), divider: true },
      ]}
    />
  );

  const columns: Column<MentorRow>[] = [
    { key: 'name', header: 'Mentor', sortValue: (r) => r.name, cell: (r) => <PersonCell name={r.name} secondary={r.designation} /> },
    {
      key: 'function',
      header: 'Function · unit',
      sortValue: (r) => functionName(db, r.functionId),
      hideBelow: 'lg',
      cell: (r) => (
        <span className="flex flex-col text-xs leading-5 whitespace-nowrap">
          <span className="text-ink">{functionName(db, r.functionId)}</span>
          <span className="text-ink-2">{unitName(db, r.unitId, true)}</span>
        </span>
      ),
    },
    {
      key: 'capacity',
      header: <span title={cohort?.name}>Capacity · {cohort?.name.split(' · ')[0] ?? 'cohort'}</span>,
      sortValue: (r) => r.load.free,
      width: 190,
      cell: (r) => <CapacityMeter load={r.load} size="sm" />,
    },
    { key: 'active', header: 'Active mentees', align: 'center', sortValue: (r) => r.activeMentees, cell: (r) => <span className="font-semibold tabular">{r.activeMentees}</span> },
    {
      key: 'pending',
      header: 'Requests',
      sortValue: (r) => r.pending + r.accepted,
      cell: (r) =>
        r.pending || r.accepted ? (
          <span className="flex flex-col text-xs leading-5 whitespace-nowrap">
            {r.pending > 0 && <span className="font-medium text-warning">{r.pending} awaiting reply</span>}
            {r.accepted > 0 && <span className="text-info">{r.accepted} accepted</span>}
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    { key: 'rating', header: 'Rating', sortValue: (r) => r.rating ?? -1, hideBelow: 'md', cell: (r) => <Rating value={r.rating} count={r.ratingCount || undefined} /> },
    { key: 'styles', header: 'Mentoring style', hideBelow: '2xl', cell: (r) => <StyleChips styles={r.profile.styles} max={2} /> },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r) => r.profile.active,
      hideBelow: 'xl',
      cell: (r) => <StatusBadge status={r.profile.active ? 'active' : 'inactive'} kind="employee" size="sm" />,
    },
    ...(canEdit ? [{ key: 'menu', header: '', width: 52, align: 'right' as const, cell: (r: MentorRow) => rowMenu(r) }] : []),
  ];

  const editingProfile = editing ? db.mentors.find((m) => m.employeeId === editing) : undefined;

  return (
    <>
      <PageHeader
        eyebrow={<MentoringEyebrow />}
        title="Mentors"
        subtitle="Senior leaders who mentor across functions — their capacity, expertise and the way they like to help."
        meta={!canEdit ? <ViewOnlyBadge /> : undefined}
        actions={
          <>
            <CohortPicker cohorts={cohorts} value={cohortId} onChange={setCohortId} />
            {canEdit && (
              <Button variant="mentor" icon={UserPlus} onClick={() => setAdding(true)}>
                Add mentor
              </Button>
            )}
          </>
        }
      />

      {/* Target banner */}
      <Card className="mb-6 overflow-hidden" padding="none">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="flex items-center gap-4 bg-gradient-to-r from-mentor-soft via-mentor-soft/60 to-white px-5 py-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-mentor text-white shadow-[0_6px_16px_rgba(126,55,148,.3)]">
              <Target className="size-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-mentor">Programme target · {MENTORING_FRAMEWORK.mentors.toLowerCase()} senior-leader mentors</p>
              <p className="mt-0.5 text-xl font-bold text-ink">
                {activeCount} active mentor{activeCount === 1 ? '' : 's'}
                <span className="ml-2 text-sm font-medium text-ink-2">
                  {activeCount >= TARGET_MENTORS ? '— target reached' : `— ${TARGET_MENTORS - activeCount} more to reach ~${TARGET_MENTORS}`}
                </span>
              </p>
              <ProgressBar value={activeCount} max={TARGET_MENTORS} tone="mentor" size="sm" className="mt-2 max-w-md" />
            </div>
          </div>
          <dl className="grid grid-cols-3 divide-x divide-line border-t border-line lg:border-t-0 lg:border-l">
            {[
              { label: `Slots · ${cohort?.name ?? '—'}`, value: formatNumber(cohortSlots), hint: `${MENTORING_FRAMEWORK.menteesPerMentor} per mentor` },
              { label: 'Taken', value: formatNumber(cohortTaken), hint: 'incl. open proposals' },
              { label: 'Applications', value: formatNumber(cohortApps), hint: cohortApps > cohortSlots ? 'more demand than slots' : 'submitted to this cohort' },
            ].map((s) => (
              <div key={s.label} className="min-w-0 px-4 py-4">
                <dt className="truncate text-xs text-ink-2">{s.label}</dt>
                <dd className="text-xl font-bold text-ink tabular">{s.value}</dd>
                <dd className="truncate text-[11px] text-muted">{s.hint}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>

      <FilterBar
        className="mb-4"
        activeCount={filterCount}
        onReset={() => (setFn(''), setUnit(''), setStyle(''), setStatus('active'))}
        actions={
          <>
            <Tabs<'table' | 'cards'>
              variant="segmented"
              value={view}
              onChange={setView}
              tabs={[
                { id: 'table', label: <span className="sr-only">Table</span>, icon: Rows3 },
                { id: 'cards', label: <span className="sr-only">Cards</span>, icon: LayoutGrid },
              ]}
            />
          </>
        }
      >
        <SearchInput value={q} onChange={setQ} placeholder="Search name or expertise" size="sm" className="sm:w-56" />
        <FilterSelect label="Function" value={fn} onChange={setFn} options={db.functions.map((f) => ({ value: f.id, label: f.name }))} allLabel="All" />
        <FilterSelect label="Unit" value={unit} onChange={setUnit} options={db.units.map((u) => ({ value: u.id, label: u.name }))} allLabel="All" />
        <FilterSelect label="Style" value={style} onChange={setStyle} options={MENTOR_ROLES.map((r) => ({ value: r.id, label: r.title }))} allLabel="Any" />
        <FilterSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
          allLabel="All"
        />
      </FilterBar>

      {view === 'table' ? (
        <Card padding="none">
          <CardHeader
            divider
            title={`${visible.length} mentor${visible.length === 1 ? '' : 's'}`}
            subtitle={`Capacity shown for ${cohort?.name ?? 'the selected cohort'} (rule: 3–5 mentees, occupied = proposed + accepted + active).`}
            actions={<CapacityLegend className="hidden md:flex" />}
          />
          <DataTable
            columns={columns}
            rows={visible}
            rowKey={(r) => r.id}
            onRowClick={(r) => setEditing(r.id)}
            initialSort={{ key: 'name', dir: 'asc' }}
            pageSize={25}
            minWidth={880}
            emptyIcon={GraduationCap}
            emptyTitle="No mentors match"
            emptyMessage="Try a different function, unit or style — or clear the search."
            rowClassName={(r) => (r.profile.active ? undefined : 'opacity-60')}
          />
        </Card>
      ) : visible.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {visible
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((r) => (
              <Card key={r.id} interactive onClick={() => setEditing(r.id)} className={cn('flex flex-col gap-4', !r.profile.active && 'opacity-60')}>
                <div className="flex items-start gap-3">
                  <Avatar name={r.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{r.name}</p>
                    <p className="truncate text-xs text-ink-2">{r.designation}</p>
                    <p className="truncate text-xs text-ink-2">
                      {functionName(db, r.functionId)} · {unitName(db, r.unitId, true)}
                    </p>
                  </div>
                  {!r.profile.active && <StatusBadge status="inactive" kind="employee" size="sm" />}
                  {canEdit && <div onClick={(e) => e.stopPropagation()}>{rowMenu(r)}</div>}
                </div>
                <CapacityMeter load={r.load} label="top" />
                <StyleChips styles={r.profile.styles} />
                <div className="flex flex-wrap gap-1">
                  {r.profile.expertise.map((x) => (
                    <Badge key={x} tone="outline" size="sm">
                      {x}
                    </Badge>
                  ))}
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-line pt-3 text-xs text-ink-2">
                  <span>
                    <strong className="text-ink tabular">{r.activeMentees}</strong> active · <strong className="text-ink tabular">{r.pending}</strong> awaiting reply
                  </span>
                  <Rating value={r.rating} count={r.ratingCount || undefined} />
                </div>
              </Card>
            ))}
        </div>
      ) : (
        <Card>
          <EmptyState tone="mentor" icon={GraduationCap} title="No mentors match" message="Try a different function, unit or style — or clear the search." />
        </Card>
      )}

      {editingProfile && <MentorDrawer key={editingProfile.employeeId} profile={editingProfile} canEdit={canEdit} suggestions={suggestions} onClose={() => setEditing(null)} />}
      {canEdit && <AddMentorModal open={adding} onClose={() => setAdding(false)} suggestions={suggestions} />}
    </>
  );
}
