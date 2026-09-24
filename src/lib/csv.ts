// CSV export. Excel-friendly: UTF-8 BOM, CRLF line endings, RFC 4180 quoting,
// and formula-injection guard for user-entered text (=, +, @ prefixes).

export type CsvValue = string | number | boolean | Date | null | undefined;

export interface CsvColumn<T> {
  header: string;
  /** Value accessor. Dates are written as `24 Sep 2026` unless you format them yourself. */
  value: (row: T, index: number) => CsvValue;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function cell(v: CsvValue): string {
  if (v == null) return '';
  let s: string;
  if (v instanceof Date) s = `${v.getDate()} ${MONTHS[v.getMonth()]} ${v.getFullYear()}`;
  else if (typeof v === 'number') s = Number.isFinite(v) ? String(v) : '';
  else if (typeof v === 'boolean') s = v ? 'Yes' : 'No';
  else {
    s = v;
    if (/^[=+@\t\r]/.test(s)) s = `'${s}`; // don't let Excel evaluate text as a formula
  }
  return /[",\r\n]/.test(s) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Build CSV text (no BOM). */
export function toCsv<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const lines = [columns.map((c) => cell(c.header)).join(',')];
  rows.forEach((row, i) => lines.push(columns.map((c) => cell(c.value(row, i))).join(',')));
  return lines.join('\r\n');
}

/** Trigger a browser download of `rows` as CSV. `.csv` is appended when missing. */
export function downloadCsv<T>(filename: string, rows: readonly T[], columns: readonly CsvColumn<T>[]): void {
  const blob = new Blob(['﻿' + toCsv(rows, columns)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** `mph-sessions-2026-09-24` style file names */
export const csvFilename = (base: string, d = new Date()) =>
  `${base}-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
