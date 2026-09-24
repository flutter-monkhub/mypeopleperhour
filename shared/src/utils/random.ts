// Deterministic pseudo-random helpers so the mobile app and admin panel
// generate exactly the same demo data from the same seed.

export type Rng = () => number;

export const createRng = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

export const int = (rng: Rng, min: number, max: number): number => Math.floor(rng() * (max - min + 1)) + min;

export const chance = (rng: Rng, p: number): boolean => rng() < p;

export const shuffle = <T>(rng: Rng, arr: readonly T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

export const sample = <T>(rng: Rng, arr: readonly T[], n: number): T[] => shuffle(rng, arr).slice(0, n);

/** Weighted pick: entries of [value, weight] */
export const weighted = <T>(rng: Rng, entries: readonly (readonly [T, number])[]): T => {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r <= 0) return v;
  }
  return entries[entries.length - 1][0];
};

let idCounter = 0;
/** Unique id for records created at runtime (not seed data). */
export const uid = (prefix: string): string => {
  idCounter = (idCounter + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`.toUpperCase();
};
