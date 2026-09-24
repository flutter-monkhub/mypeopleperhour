// Display formatting. Dates/times come from the shared utils so both apps read identically
// (`24 Sep 2026`, `11:00 AM`, `Sep 2026`). Numbers use en-IN grouping (1,23,456).

export {
  formatDate,
  formatDateLong,
  formatDateTime,
  formatDayShort,
  formatMonth,
  formatMonthShort,
  formatTime,
  formatTimeRange,
  relativeDay,
  timeAgo,
  fiscalQuarter,
} from '@shared/utils/dates';

const nf = new Intl.NumberFormat('en-IN');
const nf1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

/** 12,345 (en-IN grouping) */
export const formatNumber = (n: number | null | undefined, digits?: number): string => {
  if (n == null || Number.isNaN(n)) return '—';
  return digits == null ? nf.format(n) : new Intl.NumberFormat('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
};

/** 4.3 — one decimal max */
export const formatDecimal = (n: number | null | undefined): string => (n == null || Number.isNaN(n) ? '—' : nf1.format(n));

/**
 * Percent from a 0–1 ratio: formatPercent(0.8123) → "81%", formatPercent(0.8123, 1) → "81.2%".
 * Pass `{ fromPercent: true }` when the value is already 0–100.
 */
export const formatPercent = (ratio: number | null | undefined, digits = 0, opts: { fromPercent?: boolean } = {}): string => {
  if (ratio == null || Number.isNaN(ratio)) return '—';
  const v = opts.fromPercent ? ratio : ratio * 100;
  return `${v.toFixed(digits).replace(/\.0+$/, '')}%`;
};

/** Signed delta for KPI chips: +4.2 pts, −3, +12% */
export const formatDelta = (n: number, suffix = '', digits = 0): string => {
  const v = Math.abs(n).toFixed(digits).replace(/\.0+$/, '');
  if (Number(v) === 0) return `0${suffix}`;
  return `${n > 0 ? '+' : '−'}${v}${suffix}`;
};

/** 1.2K, 3.4L (lakh), 1.1Cr — compact Indian notation */
export const formatCompact = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1e7) return `${(n / 1e7).toFixed(1).replace(/\.0$/, '')}Cr`;
  if (a >= 1e5) return `${(n / 1e5).toFixed(1).replace(/\.0$/, '')}L`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
};

/** pluralize(1, 'session') → "1 session", pluralize(3, 'person', 'people') → "3 people" */
export const pluralize = (n: number, one: string, many = `${one}s`) => `${formatNumber(n)} ${n === 1 ? one : many}`;

/** "Aarav Sharma" → "AS" */
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

/** Hours from minutes: 90 → "1.5 h" */
export const formatHours = (minutes: number) => `${formatDecimal(minutes / 60)} h`;

/** Bytes → "1.6 MB" */
export const formatBytes = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${Math.round(b / 1024)} KB` : `${b} B`);

/** Title-case a snake_case id: "under_review" → "Under review" */
export const humanize = (s: string) => {
  const t = s.replace(/[_-]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
};
