import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatNumber } from '@/lib/format';
import { EmptyState } from './EmptyState';
import { Skeleton } from './Skeleton';

export type SortValue = string | number | boolean | Date | null | undefined;
export type SortDir = 'asc' | 'desc';
export interface SortState {
  key: string;
  dir: SortDir;
}

export interface Column<T> {
  /** Unique column id (also the sort key) */
  key: string;
  header: ReactNode;
  /** Cell renderer. Defaults to the sort value / row[key] as text. */
  cell?: (row: T, index: number) => ReactNode;
  /** Value used for sorting. Providing it makes the column sortable. */
  sortValue?: (row: T) => SortValue;
  /** Force-disable sorting even with sortValue */
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  /** CSS width, e.g. 120 or '20%' */
  width?: number | string;
  className?: string;
  headerClassName?: string;
  /** Hide below the md breakpoint (shorthand for hideBelow: 'md') */
  hideOnMobile?: boolean;
  /** Hide the column below a breakpoint, e.g. 'xl' for low-priority columns */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const HIDE = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell', xl: 'hidden xl:table-cell', '2xl': 'hidden 2xl:table-cell' } as const;
const hideCls = <T,>(c: Column<T>) => (c.hideBelow ? HIDE[c.hideBelow] : c.hideOnMobile ? HIDE.md : undefined);

export interface DataTableProps<T> {
  columns: readonly Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Rows per page (default 10). 0 disables pagination. */
  pageSize?: number;
  pageSizeOptions?: number[];
  initialSort?: SortState;
  /** Controlled sort (optional) */
  sort?: SortState | null;
  onSortChange?: (s: SortState | null) => void;
  loading?: boolean;
  emptyTitle?: ReactNode;
  emptyMessage?: ReactNode;
  emptyIcon?: LucideIcon;
  emptyAction?: ReactNode;
  /** Scroll the body inside the table with a sticky header (e.g. 560) */
  maxHeight?: number | string;
  dense?: boolean;
  rowClassName?: (row: T) => string | undefined;
  /** Highlight a row */
  selectedKey?: string | null;
  /** Extra content rendered as a <tfoot> row (e.g. totals) */
  footer?: ReactNode;
  className?: string;
  /** Accessible table caption (visually hidden) */
  caption?: string;
  /** Minimum table width in px — below it the table scrolls horizontally instead of squashing columns */
  minWidth?: number;
}

const cmp = (a: SortValue, b: SortValue): number => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a instanceof Date || b instanceof Date) return new Date(a as Date).getTime() - new Date(b as Date).getTime();
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), 'en-IN', { numeric: true, sensitivity: 'base' });
};

/**
 * Typed table: sortable headers, pagination, row click, loading skeleton & empty state.
 * Wrap it in `<Card padding="none">` (optionally with a `<CardHeader divider …/>` above).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  pageSize: initialPageSize = 10,
  pageSizeOptions = [10, 25, 50, 100],
  initialSort,
  sort: controlledSort,
  onSortChange,
  loading,
  emptyTitle = 'No records found',
  emptyMessage = 'Try adjusting your search or filters.',
  emptyIcon = Inbox,
  emptyAction,
  maxHeight,
  dense,
  rowClassName,
  selectedKey,
  footer,
  className,
  caption,
  minWidth,
}: DataTableProps<T>) {
  const [innerSort, setInnerSort] = useState<SortState | null>(initialSort ?? null);
  const sort = controlledSort !== undefined ? controlledSort : innerSort;
  const [pageSize, setPageSize] = useState(initialPageSize);
  // Back to the first page when the result size or sort changes (length, not identity: callers
  // often pass freshly filtered arrays on every render). Derived during render — no effect.
  const resetKey = `${rows.length}|${sort?.key ?? ''}|${sort?.dir ?? ''}|${pageSize}`;
  const [pageState, setPageState] = useState({ key: resetKey, page: 0 });
  const page = pageState.key === resetKey ? pageState.page : 0;
  const setPage = (p: number) => setPageState({ key: resetKey, page: p });

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    const out = [...rows].sort((a, b) => cmp(get(a), get(b)));
    return sort.dir === 'desc' ? out.reverse() : out;
  }, [rows, columns, sort]);

  const paginate = pageSize > 0;
  const pageCount = paginate ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, pageCount - 1);
  const visible = paginate ? sorted.slice(safePage * pageSize, safePage * pageSize + pageSize) : sorted;

  const toggleSort = (key: string) => {
    const next: SortState | null = sort?.key !== key ? { key, dir: 'asc' } : sort.dir === 'asc' ? { key, dir: 'desc' } : null;
    if (controlledSort === undefined) setInnerSort(next);
    onSortChange?.(next);
  };

  const cellPad = dense ? 'px-4 py-2' : 'px-5 py-3';
  const alignCls = (a?: Column<T>['align']) => (a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left');

  return (
    <div className={cn('w-full', className)}>
      <div className="scrollbar-thin overflow-auto" style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full border-separate border-spacing-0 text-[13px]" style={minWidth ? { minWidth } : undefined}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((c) => {
                const sortable = !!c.sortValue && c.sortable !== false;
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    style={{ width: c.width }}
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn(
                      'sticky top-0 z-[1] border-b border-line bg-[#F8FAFD] text-xs font-semibold whitespace-nowrap text-ink-2',
                      dense ? 'px-4 py-2.5' : 'px-5 py-3',
                      alignCls(c.align),
                      hideCls(c),
                      c.headerClassName,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cn('group inline-flex items-center gap-1 hover:text-ink', active && 'text-ink', c.align === 'right' && 'flex-row-reverse')}
                      >
                        {c.header}
                        {active ? (
                          sort.dir === 'asc' ? (
                            <ArrowUp className="size-3.5 text-primary" />
                          ) : (
                            <ArrowDown className="size-3.5 text-primary" />
                          )
                        ) : (
                          <ChevronsUpDown className="size-3.5 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: Math.min(pageSize || 8, 8) }, (_, r) => (
                <tr key={`sk-${r}`}>
                  {columns.map((c, i) => (
                    <td key={c.key} className={cn('border-b border-line', cellPad, hideCls(c))}>
                      <Skeleton className={cn('h-3.5', i === 0 ? 'w-32' : 'w-20')} />
                    </td>
                  ))}
                </tr>
              ))
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="border-b border-line">
                  <EmptyState icon={emptyIcon} title={emptyTitle} message={emptyMessage} action={emptyAction} size="sm" />
                </td>
              </tr>
            ) : (
              visible.map((row, i) => {
                const key = rowKey(row);
                return (
                  <tr
                    key={key}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={onRowClick ? (e) => e.key === 'Enter' && onRowClick(row) : undefined}
                    tabIndex={onRowClick ? 0 : undefined}
                    className={cn(
                      'group transition-colors',
                      onRowClick && 'cursor-pointer hover:bg-[#F8FAFE] focus-visible:bg-primary-soft focus-visible:outline-none',
                      selectedKey === key && 'bg-primary-soft/60',
                      rowClassName?.(row),
                    )}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn('border-b border-line align-middle text-ink', cellPad, alignCls(c.align), hideCls(c), c.className)}
                      >
                        {c.cell ? c.cell(row, safePage * pageSize + i) : String((c.sortValue?.(row) ?? (row as Record<string, unknown>)[c.key] ?? '—') as string)}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
          {footer && !loading && visible.length > 0 && <tfoot>{footer}</tfoot>}
        </table>
      </div>
      {paginate && !loading && sorted.length > 0 && (
        <Pagination
          page={safePage}
          pageCount={pageCount}
          total={sorted.length}
          pageSize={pageSize}
          onPage={setPage}
          pageSizeOptions={pageSizeOptions}
          onPageSize={(n) => setPageSize(n)}
        />
      )}
    </div>
  );
}

export interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSize?: (size: number) => void;
}

/** "Showing 1–10 of 249" + page buttons + rows-per-page. */
export function Pagination({ page, pageCount, total, pageSize, onPage, pageSizeOptions, onPageSize }: PaginationProps) {
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  const pages = pageWindow(page, pageCount);
  const btn = 'grid h-8 min-w-8 place-items-center rounded-lg px-2 text-[13px] font-medium tabular transition-colors';
  return (
    <div className="flex flex-col items-center justify-between gap-3 px-5 py-3 text-[13px] text-ink-2 sm:flex-row">
      <div className="flex items-center gap-3">
        <span className="tabular">
          Showing <span className="font-medium text-ink">{formatNumber(from)}</span>–<span className="font-medium text-ink">{formatNumber(to)}</span> of{' '}
          <span className="font-medium text-ink">{formatNumber(total)}</span>
        </span>
        {onPageSize && pageSizeOptions && total > Math.min(...pageSizeOptions) && (
          <label className="hidden items-center gap-1.5 sm:flex">
            <span className="text-muted">·</span> Rows
            <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} className="h-7 rounded-md border border-line-strong bg-white px-1.5 text-[13px] text-ink">
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {pageCount > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button type="button" className={cn(btn, 'text-ink-2 hover:bg-neutral-soft disabled:opacity-40')} disabled={page === 0} onClick={() => onPage(page - 1)} aria-label="Previous page">
            <ChevronLeft className="size-4" />
          </button>
          {pages.map((p, i) =>
            p === -1 ? (
              <span key={`gap-${i}`} className="px-1 text-muted">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                aria-current={p === page ? 'page' : undefined}
                className={cn(btn, p === page ? 'bg-primary text-white' : 'text-ink-2 hover:bg-neutral-soft')}
              >
                {p + 1}
              </button>
            ),
          )}
          <button
            type="button"
            className={cn(btn, 'text-ink-2 hover:bg-neutral-soft disabled:opacity-40')}
            disabled={page >= pageCount - 1}
            onClick={() => onPage(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="size-4" />
          </button>
        </nav>
      )}
    </div>
  );
}

function pageWindow(page: number, count: number): number[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i);
  const out = new Set([0, count - 1, page - 1, page, page + 1].filter((p) => p >= 0 && p < count));
  const sorted = [...out].sort((a, b) => a - b);
  const res: number[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) res.push(-1);
    res.push(p);
  });
  return res;
}
