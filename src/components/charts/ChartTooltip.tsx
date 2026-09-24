import type { TooltipContentProps } from 'recharts';

export type ValueFormatter = (value: number) => string;

interface Props extends Omit<Partial<TooltipContentProps<number, string>>, 'labelFormatter'> {
  valueFormatter?: ValueFormatter;
  /** Rename the category label (x value) */
  labelFormatter?: (label: string) => string;
  /** Extra line at the bottom, computed from the hovered datum */
  footer?: (datum: Record<string, unknown>) => string | null;
}

/** White card tooltip used by every chart wrapper. */
export function ChartTooltip({ active, payload, label, valueFormatter = (v) => String(v), labelFormatter, footer }: Props) {
  if (!active || !payload?.length) return null;
  const datum = (payload[0]?.payload ?? {}) as Record<string, unknown>;
  const foot = footer?.(datum);
  return (
    <div className="min-w-40 rounded-lg border border-line bg-white px-3 py-2.5 text-xs shadow-pop">
      {label != null && label !== '' && <p className="mb-1.5 font-semibold text-ink">{labelFormatter ? labelFormatter(String(label)) : String(label)}</p>}
      <ul className="flex flex-col gap-1">
        {payload.map((p, i) => (
          <li key={`${String(p.dataKey)}-${i}`} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: (p.color ?? (p.payload as { fill?: string })?.fill) as string }} />
            <span className="flex-1 text-ink-2">{p.name}</span>
            <span className="font-semibold text-ink tabular">{typeof p.value === 'number' ? valueFormatter(p.value) : String(p.value ?? '')}</span>
          </li>
        ))}
      </ul>
      {foot && <p className="mt-1.5 border-t border-line pt-1.5 text-ink-2">{foot}</p>}
    </div>
  );
}

/** HTML legend (text stays in ink colours; swatch carries identity). */
export function ChartLegend({ items, className }: { items: { label: string; color: string }[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-2 ${className ?? ''}`}>
      {items.map((it) => (
        <li key={it.label} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px]" style={{ background: it.color }} />
          {it.label}
        </li>
      ))}
    </ul>
  );
}
