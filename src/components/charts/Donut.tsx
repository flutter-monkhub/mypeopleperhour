import type { ReactNode } from 'react';
import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { seriesColor } from './palette';
import { ChartTooltip, type ValueFormatter } from './ChartTooltip';

export interface DonutSlice {
  name: string;
  value: number;
  color?: string;
}

export interface DonutProps {
  data: DonutSlice[];
  size?: number;
  /** Ring thickness */
  thickness?: number;
  /** Center content (e.g. total) */
  center?: ReactNode;
  valueFormatter?: ValueFormatter;
  /** Legend: right of the donut, below it, or none */
  legend?: 'right' | 'bottom' | false;
  /** Show value + share next to legend labels */
  legendValues?: boolean;
}

/** Donut / part-to-whole (e.g. missed reasons split, sentiment). */
export function Donut({ data, size = 180, thickness = 22, center, valueFormatter = (v) => String(v), legend = 'right', legendValues = true }: DonutProps) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const colored = data.map((d, i) => ({ ...d, color: d.color ?? seriesColor(i) }));
  const chart = (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <PieChart width={size} height={size}>
        <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
        <Pie data={colored} dataKey="value" nameKey="name" innerRadius={size / 2 - thickness} outerRadius={size / 2} paddingAngle={total && data.filter((d) => d.value).length > 1 ? 2 : 0} stroke="none" startAngle={90} endAngle={-270}>
          {colored.map((d) => (
            <Cell key={d.name} fill={d.color} />
          ))}
        </Pie>
      </PieChart>
      {center != null && <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">{center}</div>}
    </div>
  );
  if (!legend) return chart;
  const items = (
    <ul className="flex min-w-0 flex-col gap-2 text-[13px]">
      {colored.map((d) => (
        <li key={d.name} className="flex items-center gap-2">
          <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: d.color }} />
          <span className="min-w-0 flex-1 truncate text-ink-2">{d.name}</span>
          {legendValues && (
            <span className="font-semibold text-ink tabular">
              {valueFormatter(d.value)}
              <span className="ml-1.5 font-normal text-muted">{total ? Math.round((d.value / total) * 100) : 0}%</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
  return legend === 'right' ? (
    <div className="flex flex-wrap items-center gap-6">
      {chart}
      <div className="min-w-44 flex-1">{items}</div>
    </div>
  ) : (
    <div className="flex flex-col items-center gap-4">
      {chart}
      <div className="w-full">{items}</div>
    </div>
  );
}

