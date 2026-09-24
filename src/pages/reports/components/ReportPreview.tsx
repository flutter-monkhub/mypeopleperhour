// Preview of the first rows of a report table (same columns as the CSV).

import type { CsvValue } from '@/lib/csv';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import type { ReportColumn, ReportTable } from '@/lib/reports';

function display(v: CsvValue, c: ReportColumn): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return c.kind === 'percent' ? `${v}%` : formatNumber(v, Number.isInteger(v) ? undefined : 1);
  if (v instanceof Date) return v.toDateString();
  return v;
}

export function ReportPreview({ table, limit = 10 }: { table: ReportTable; limit?: number }) {
  const rows = table.rows.slice(0, limit);
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            {table.columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn('border-b border-line bg-[#F8FAFD] px-4 py-2.5 text-xs font-semibold whitespace-nowrap text-ink-2', c.kind === 'number' || c.kind === 'percent' ? 'text-right' : 'text-left')}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cn(String(r.unit ?? '') === 'All units' && 'bg-primary-soft/40 font-semibold')}>
              {table.columns.map((c) => {
                const v = r[c.key];
                const num = c.kind === 'number' || c.kind === 'percent';
                return (
                  <td
                    key={c.key}
                    className={cn('max-w-72 truncate border-b border-line px-4 py-2 whitespace-nowrap', num ? 'text-right tabular' : 'text-left', v == null || v === '' ? 'text-muted' : 'text-ink')}
                    title={typeof v === 'string' && v.length > 40 ? v : undefined}
                  >
                    {display(v, c)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
