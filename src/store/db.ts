// The demo database store.
//
// • One zustand store holding the whole `DemoDatabase` (same shape as shared/generated/seed.json).
// • Persisted to localStorage under `mph-admin-db-v1` (zustand `persist`, version 1). Writes are
//   debounced (the DB is ~1.7 MB of JSON) and flushed when the page is hidden/closed.
// • First load (or "Reset demo data"): the seed chunk is lazy-imported and rebased to today with
//   `rebaseDatabase` (SPEC §3). Persisted data is never rebased again.
// • Every write replaces the touched collection array (immutable, immer-free) so React/zustand
//   selectors and memoised analytics see a new reference only for what actually changed.

import { useMemo } from 'react';
import { create } from 'zustand';
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware';
import type { DemoDatabase } from '@shared/types';
import { rebaseDatabase } from '@shared/rebase';
import { startOfDay } from '@shared/utils/dates';

export const DB_STORAGE_KEY = 'mph-admin-db-v1';
const DB_STORAGE_VERSION = 1;

/** Keys of DemoDatabase whose value is an array (the "collections"). */
export type CollectionKey = {
  [K in keyof DemoDatabase]-?: DemoDatabase[K] extends readonly unknown[] ? K : never;
}[keyof DemoDatabase];
/** Record type of a collection, e.g. `Item<'sessions'>` = `Session`. */
export type Item<K extends CollectionKey> = DemoDatabase[K][number];

export interface DbMeta {
  /** `generatedAt` of the pristine seed file */
  seedGeneratedAt: string;
  /** When this browser loaded (and rebased) the seed */
  loadedAt: string;
  /** Days every timestamp was shifted by on load (whole weeks) */
  rebasedDays: number;
}

interface DbState {
  db: DemoDatabase;
  meta: DbMeta | null;
  /** true once hydrated from storage or seeded — the app only renders after this */
  ready: boolean;
}

type Persisted = Pick<DbState, 'db' | 'meta'>;

const EMPTY_DB: DemoDatabase = {
  version: 0,
  generatedAt: new Date(0).toISOString(),
  units: [],
  functions: [],
  grades: [],
  locations: [],
  employees: [],
  sessions: [],
  notes: [],
  surveys: [],
  responses: [],
  moodChecks: [],
  cohorts: [],
  mentors: [],
  applications: [],
  matches: [],
  mentoringSessions: [],
  notifications: [],
  adminUsers: [],
};

// ───────────────────────── debounced localStorage ─────────────────────────

let pending: { name: string; value: StorageValue<Persisted> } | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let lastPersistError: string | null = null;

function flushPersist() {
  if (!pending) return;
  const { name, value } = pending;
  pending = null;
  clearTimeout(timer);
  try {
    localStorage.setItem(name, JSON.stringify(value));
    lastPersistError = null;
  } catch (e) {
    lastPersistError = e instanceof Error ? e.message : String(e);
    console.warn('[db] could not persist demo data', e);
  }
}

const debouncedStorage: PersistStorage<Persisted> = {
  getItem: (name) => {
    try {
      const raw = localStorage.getItem(name);
      return raw ? (JSON.parse(raw) as StorageValue<Persisted>) : null;
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    // Never overwrite real data with the un-hydrated placeholder
    if (!value.state.db.employees.length) return;
    pending = { name, value };
    clearTimeout(timer);
    timer = setTimeout(flushPersist, 400);
  },
  removeItem: (name) => {
    pending = null;
    clearTimeout(timer);
    localStorage.removeItem(name);
  },
};

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPersist);
  window.addEventListener('beforeunload', flushPersist);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPersist();
  });
}

// ───────────────────────── store ─────────────────────────

export const useDbStore = create<DbState>()(
  persist((): DbState => ({ db: EMPTY_DB, meta: null, ready: false }), {
    name: DB_STORAGE_KEY,
    version: DB_STORAGE_VERSION,
    storage: debouncedStorage,
    partialize: (s) => ({ db: s.db, meta: s.meta }),
    // Unknown/older shape → start again from the seed
    migrate: () => ({ db: EMPTY_DB, meta: null }),
    skipHydration: true,
  }),
);

async function loadSeed(): Promise<Persisted> {
  const seed = (await import('@seed')).default as DemoDatabase;
  const now = new Date();
  const rebased = rebaseDatabase(seed, now);
  // rebaseDatabase returns the module object untouched when no shift is needed → never share it
  const db = rebased === seed ? structuredClone(seed) : rebased;
  const days = Math.round((startOfDay(now).getTime() - startOfDay(new Date(seed.generatedAt)).getTime()) / 86400000);
  return {
    db,
    meta: { seedGeneratedAt: seed.generatedAt, loadedAt: now.toISOString(), rebasedDays: Math.round(days / 7) * 7 },
  };
}

/** Hydrate from localStorage, or load + rebase the seed. Called once from main.tsx before rendering. */
export async function initDb(): Promise<void> {
  await useDbStore.persist.rehydrate();
  if (!useDbStore.getState().db.employees.length) {
    useDbStore.setState(await loadSeed());
  }
  useDbStore.setState({ ready: true });
}

/** Throw away all local changes and start again from the pristine seed (rebased to today). */
export async function resetDemoData(): Promise<void> {
  pending = null;
  clearTimeout(timer);
  localStorage.removeItem(DB_STORAGE_KEY);
  useDbStore.setState(await loadSeed());
  flushPersist();
}

// Keep several open tabs in sync (another tab wrote the DB)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === DB_STORAGE_KEY && e.newValue && !pending) void useDbStore.persist.rehydrate();
  });
}

// ───────────────────────── read API ─────────────────────────

/** Current database snapshot (non-reactive — use in actions / event handlers). */
export const getDb = (): DemoDatabase => useDbStore.getState().db;

/** Whole database, reactive. Re-renders on any change. */
export const useDb = (): DemoDatabase => useDbStore((s) => s.db);

/** One collection, reactive (re-renders only when that array is replaced). */
export function useCollection<K extends CollectionKey>(key: K): DemoDatabase[K] {
  return useDbStore((s) => s.db[key]);
}

/**
 * Derived data, memoised on the db reference (+ your deps). Use this for anything that
 * builds new arrays/objects — never return fresh objects from a raw zustand selector
 * (zustand 5 would loop forever).
 */
export function useDbMemo<T>(fn: (db: DemoDatabase) => T, deps: readonly unknown[] = []): T {
  const db = useDb();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => fn(db), [db, ...deps]);
}

export const useDbMeta = () => useDbStore((s) => s.meta);
export const getPersistError = () => lastPersistError;

/** Size of the persisted JSON in characters (≈ bytes; browsers allow ~5M characters per origin). */
export function persistedBytes(): number {
  flushPersist();
  return localStorage.getItem(DB_STORAGE_KEY)?.length ?? 0;
}

// ───────────────────────── write API ─────────────────────────

/**
 * Replace several collections at once (atomic, one render).
 *   setDb((db) => ({ matches: [...], applications: [...] }))
 */
export function setDb(recipe: (db: DemoDatabase) => Partial<DemoDatabase>): void {
  useDbStore.setState((s) => ({ db: { ...s.db, ...recipe(s.db) } }));
}

/**
 * Update one collection. `fn` receives a shallow *copy* of the array: mutate the copy
 * (push / splice / assign a replaced element) or return a brand-new array.
 * Never mutate an existing element in place — replace it (`draft[i] = { ...draft[i], … }`).
 */
export function update<K extends CollectionKey>(key: K, fn: (draft: DemoDatabase[K]) => DemoDatabase[K] | void): void {
  useDbStore.setState((s) => {
    const draft = [...s.db[key]] as DemoDatabase[K];
    const next = fn(draft) ?? draft;
    return { db: { ...s.db, [key]: next } };
  });
}

/** Primary key of a record. Mentor profiles are keyed by `employeeId`; everything else by `id`. */
export function idOf<K extends CollectionKey>(key: K, item: Item<K>): string {
  const rec = item as unknown as { id?: string; employeeId?: string };
  return key === 'mentors' ? (rec.employeeId as string) : (rec.id as string);
}

/**
 * Patch one record by id. `change` is a partial object or a function returning the new record.
 * Returns false when the id was not found.
 */
export function patch<K extends CollectionKey>(key: K, id: string, change: Partial<Item<K>> | ((item: Item<K>) => Item<K>)): boolean {
  let found = false;
  update(key, (draft) => {
    const list = draft as Item<K>[];
    const i = list.findIndex((x) => idOf(key, x) === id);
    if (i < 0) return;
    found = true;
    list[i] = typeof change === 'function' ? change(list[i]) : ({ ...(list[i] as object), ...(change as object) } as Item<K>);
  });
  return found;
}

/** Insert one or more records (appended; `{ prepend: true }` to put them first). */
export function insert<K extends CollectionKey>(key: K, items: Item<K> | Item<K>[], opts: { prepend?: boolean } = {}): void {
  const list = (Array.isArray(items) ? items : [items]) as Item<K>[];
  update(key, (draft) => {
    const arr = draft as Item<K>[];
    if (opts.prepend) arr.unshift(...list);
    else arr.push(...list);
  });
}

/** Remove records by id (or predicate). Returns number removed. */
export function remove<K extends CollectionKey>(key: K, idOrPredicate: string | ((item: Item<K>) => boolean)): number {
  let removed = 0;
  update(key, (draft) => {
    const arr = draft as Item<K>[];
    const keep = arr.filter((x) => {
      const hit = typeof idOrPredicate === 'string' ? idOf(key, x) === idOrPredicate : idOrPredicate(x);
      if (hit) removed++;
      return !hit;
    });
    return keep as unknown as DemoDatabase[K];
  });
  return removed;
}
