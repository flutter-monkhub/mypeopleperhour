// Dependency-free date helpers (local time). Kept tiny so both apps can share them.

import type { ISODate, MonthKey } from '../types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const toDate = (d: ISODate | Date): Date => (d instanceof Date ? d : new Date(d));

export const monthKey = (d: ISODate | Date): MonthKey => {
  const x = toDate(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
};

export const monthKeyToDate = (key: MonthKey): Date => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1);
};

export const addMonthsToKey = (key: MonthKey, n: number): MonthKey => {
  const d = monthKeyToDate(key);
  return monthKey(new Date(d.getFullYear(), d.getMonth() + n, 1));
};

/** Inclusive list of month keys from `from` to `to`. */
export const monthRange = (from: MonthKey, to: MonthKey): MonthKey[] => {
  const out: MonthKey[] = [];
  let k = from;
  while (k <= to) {
    out.push(k);
    k = addMonthsToKey(k, 1);
  }
  return out;
};

export const formatMonth = (key: MonthKey, long = false): string => {
  const d = monthKeyToDate(key);
  return `${(long ? MONTHS_LONG : MONTHS)[d.getMonth()]} ${d.getFullYear()}`;
};

export const formatMonthShort = (key: MonthKey): string => MONTHS[monthKeyToDate(key).getMonth()];

export const addDays = (d: Date, n: number): Date => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

export const addMinutes = (d: Date, n: number): Date => new Date(d.getTime() + n * 60000);

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const isSameDay = (a: ISODate | Date, b: ISODate | Date): boolean => {
  const x = toDate(a);
  const y = toDate(b);
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate();
};

export const daysInMonth = (year: number, monthIndex: number): number => new Date(year, monthIndex + 1, 0).getDate();

export const pad2 = (n: number) => String(n).padStart(2, '0');

/** 24 Sep 2026 */
export const formatDate = (d: ISODate | Date): string => {
  const x = toDate(d);
  return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
};

/** Thu, 24 Sep */
export const formatDayShort = (d: ISODate | Date): string => {
  const x = toDate(d);
  return `${DAYS[x.getDay()]}, ${x.getDate()} ${MONTHS[x.getMonth()]}`;
};

/** Thursday, 24 September 2026 */
export const formatDateLong = (d: ISODate | Date): string => {
  const x = toDate(d);
  return `${DAYS_LONG[x.getDay()]}, ${x.getDate()} ${MONTHS_LONG[x.getMonth()]} ${x.getFullYear()}`;
};

/** 11:00 AM */
export const formatTime = (d: ISODate | Date): string => {
  const x = toDate(d);
  let h = x.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${pad2(h)}:${pad2(x.getMinutes())} ${ampm}`;
};

/** 24 Sep 2026, 11:00 AM */
export const formatDateTime = (d: ISODate | Date): string => `${formatDate(d)}, ${formatTime(d)}`;

export const formatTimeRange = (start: ISODate, end: ISODate): string => `${formatTime(start)} – ${formatTime(end)}`;

export const dayOfMonth = (d: ISODate | Date) => toDate(d).getDate();
export const monthAbbr = (d: ISODate | Date) => MONTHS[toDate(d).getMonth()].toUpperCase();
export const weekdayShort = (d: ISODate | Date) => DAYS[toDate(d).getDay()];

/** "in 2 days", "tomorrow", "today", "3 days ago" */
export const relativeDay = (d: ISODate | Date, now: Date = new Date()): string => {
  const diff = Math.round((startOfDay(toDate(d)).getTime() - startOfDay(now).getTime()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 1) return `in ${diff} days`;
  return `${-diff} days ago`;
};

/** "just now", "5m ago", "3h ago", "2d ago", or a date */
export const timeAgo = (d: ISODate | Date, now: Date = new Date()): string => {
  const s = Math.floor((now.getTime() - toDate(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return formatDate(d);
};

/** Indian financial year quarter label: Apr–Jun = Q1. */
export const fiscalQuarter = (d: ISODate | Date): { q: number; fy: number; label: string; start: Date; end: Date } => {
  const x = toDate(d);
  const m = x.getMonth(); // 0-11
  const fyStartYear = m >= 3 ? x.getFullYear() : x.getFullYear() - 1;
  const q = Math.floor(((m + 12 - 3) % 12) / 3) + 1;
  const fy = fyStartYear + 1;
  const startMonth = 3 + (q - 1) * 3; // months since Jan of fyStartYear
  const start = new Date(fyStartYear, startMonth, 1);
  const end = new Date(fyStartYear, startMonth + 3, 0, 23, 59, 59);
  return { q, fy, label: `Q${q} FY${String(fy).slice(-2)}`, start, end };
};

export const isPast = (d: ISODate | Date, now: Date = new Date()) => toDate(d).getTime() < now.getTime();
export const isFuture = (d: ISODate | Date, now: Date = new Date()) => toDate(d).getTime() > now.getTime();

export const greeting = (now: Date = new Date()): string => {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};
