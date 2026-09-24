# MyPeopleHour & PCBL Mentoring — Admin

React 19 · Vite 8 · TypeScript 6 · Tailwind 4 · react-router 7 · zustand 5 · recharts 3 · lucide-react.
Product spec: `../docs/SPEC.md` (§2 roles, §3 rules, §4 design tokens, §6 admin).

```bash
npm run dev      # http://localhost:5173
npm run build    # tsc -b && vite build (must pass)
npx oxlint src   # only "fast refresh" hints are expected
```

## Demo hooks (dev, or builds with `VITE_DEMO_HOOKS=true`)

| URL param | Effect |
|---|---|
| `?as=super_admin\|programme_admin\|leadership\|hr_admin` | signs in as that role's demo admin (works on any path, e.g. `/settings?tab=users&as=super_admin`) |
| `?reset=1` | resets demo data + password overrides before rendering |
| `?idle=demo` / `?idle=off` | idle warning after 10 s (sign-out after 70 s) / normal 14 + 1 min |

Dev only: `/dev/ui-kit` (living style guide with every component and chart on real data) and `window.__mph`
(`__mph.getDb()`, `__mph.patch(...)`, `__mph.auth.getState()`, `__mph.ui.getState()`).

Demo logins: password `Admin@123` for nandini.rao@ (super admin), kavita.menon@ (programme admin),
rakesh.agarwal@ (leadership), sameer.joshi@ (HR admin, Durgapur only) — all `@pcbl.demo`. Forgot-password code `123456`.

## Imports

- `@/…` → `src/…`; `@shared/…` → `../shared/src/…` (import sub-modules: `@shared/types`, `@shared/logic`,
  `@shared/utils/dates`, `@shared/content/mph`, `@shared/content/mentoring`, `@shared/utils/random` for `uid`).
- `import type` for types (`verbatimModuleSyntax`), no enums (`erasableSyntaxOnly`).

## Data store — `src/store/db.ts`

The whole `DemoDatabase` lives in one zustand store persisted to localStorage (`mph-admin-db-v1`, debounced).
First load / reset: the seed chunk is lazy-imported and rebased to today. `main.tsx` awaits `initDb()` before rendering,
so `useDb()` is always ready.

Read: `useDb()` (whole db), `useCollection('sessions')` (one array), `useDbMemo(db => …, deps)` (derived),
`getDb()` (non-reactive, for actions). **Never return a new object/array from a raw `useDbStore(selector)`** — zustand 5 loops.

Write (immutable — replace records, never mutate them):
`patch('sessions', id, partial | fn)`, `insert('notes', item | items, { prepend })`, `remove('notes', id | predicate)`,
`update('sessions', draft => { … })` (draft is a copied array), `setDb(db => ({ matches, applications }))` for multi-collection
atomic writes, `resetDemoData()`. Mentor profiles are keyed by `employeeId`.

Actions live in `src/store/actions/<domain>.ts` (plain functions, no React/toasts), re-exported from `store/actions/index.ts`.
Stamp the actor with `currentActorId()` from `store/auth`; new ids with `uid('S')` from `@shared/utils/random`.

## Auth, RBAC, scope

- `store/auth.ts`: `useCurrentAdmin()`, `getCurrentAdmin()`, `currentActorId()`, `signIn`, `signOut(reason)`, `useSession()`.
- `lib/rbac.tsx`: `can(user, perm)`, `useCan(perm)`, `usePermissions()`, `<Can perm>`, `<RequirePermission perm>` (403),
  `ROLE_META`, `PERMISSION_META`, `isUnitScoped(user, perm)`.
- `lib/scope.ts`: `useScope()` → `{ unitId, locked, unit }` (hr_admin locked to `unitScope`), `useScopeFilters(extra)`
  → analytics filters, `useMonth()` → `{ month, months, currentMonth, setMonth }`, `useScopedEmployees()`, `useInScope()`.
  Always scope data through these — never read `useUiStore().unitId` directly.

## Analytics — `src/lib/analytics.ts` (pure, memoised)

Filters: `{ unitId?, functionId?, department?, managerId? }` (employee side of the pair).
`programmeMonths(db)`, `pairMonthStatuses(db, month, f)`, `completionSummary(db, month, f)`,
`completionByUnit|Function|Department|Manager(db, month, f)`, `monthlyTrend(db, months, f)`,
`missedFlags(db, month, f, now?)`, `missedReasonSplit(db, months, f)`, `sessionIndex`, `pairSessions`, `summarize`, `describeFilters`.
Lookups: `lib/lookup.ts` (`employeeMap`, `unitMap`, `functionMap`, `mentorMap`, `reportsByManager`, `employeeName`, `unitName`, `functionName`).
Cache your own pure helpers with `memoOn([db.x, db.y], key, compute)` from `lib/memo.ts`.

## UI

- `@/components/ui`: Button/LinkButton/IconButton, Card/CardHeader/CardFooter, Badge/CountBadge, StatusBadge, Avatar/PersonCell,
  Input, Select, Textarea, Checkbox, Toggle, SearchInput, Field, Modal, Drawer, Tabs, DataTable/Pagination, KpiCard/DeltaChip,
  FilterBar/FilterSelect, EmptyState/ErrorState, Skeleton/SkeletonText/SkeletonCard/SkeletonTable/PageSkeleton,
  ProgressBar/ProgressRing, DescriptionList, Popover/DropdownMenu, Tooltip, ConfirmDialog + `confirm()`, `toast` / `useToast()`.
- `@/components/charts`: BarChart, GroupedBar, StackedBar, LineTrend, Donut, ChartTooltip/ChartLegend, `SERIES_COLORS`, `STATUS_COLORS`.
- `@/components/layout`: `PageHeader` (first element of every page), `ComingSoon`, route `handle` (`title`, `group`, `filters: ['unit','month']`).
- Formatting: `lib/format.ts`; CSV: `downloadCsv(name, rows, [{ header, value }])` from `lib/csv.ts`.
- Tailwind tokens (`src/index.css` `@theme`): `primary`, `navy`, `mentor`, `success|info|warning|danger|neutral` (+ `-soft`),
  `ink`, `ink-2`, `muted`, `line`, `canvas`, `surface`, `rounded-card`, `rounded-btn`, `shadow-card`, `shadow-pop`.
  No tailwind-merge: use component props (padding, size, tone) rather than overriding conflicting utilities via className.
