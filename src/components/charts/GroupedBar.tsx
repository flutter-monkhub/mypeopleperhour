import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS, seriesColor } from './palette';
import { ChartLegend, ChartTooltip, type ValueFormatter } from './ChartTooltip';
import type { Datum, Series } from './types';

export interface GroupedBarProps {
  data: Datum[];
  xKey: string;
  series: Series[];
  height?: number;
  valueFormatter?: ValueFormatter;
  domain?: [number, number];
  /** Legend above the plot (default true for ≥ 2 series) */
  legend?: boolean;
}

/** Side-by-side bars per category (e.g. scheduled vs completed by month). */
export function GroupedBar({ data, xKey, series, height = 280, valueFormatter = (v) => String(v), domain, legend = series.length > 1 }: GroupedBarProps) {
  return (
    <div className="w-full">
      {legend && <ChartLegend className="mb-3" items={series.map((s, i) => ({ label: s.label, color: s.color ?? seriesColor(i) }))} />}
      <BarChart responsive data={data} style={{ width: '100%', height }} margin={{ top: 4, right: 8, bottom: 0, left: -8 }} barCategoryGap="22%" barGap={2}>
        <CartesianGrid stroke={AXIS.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS.tick} tickLine={false} axisLine={{ stroke: AXIS.line }} interval={0} />
        <YAxis domain={domain} tick={AXIS.tick} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => valueFormatter(v)} />
        <Tooltip cursor={{ fill: 'rgba(47,86,232,.06)' }} content={<ChartTooltip valueFormatter={valueFormatter} />} />
        {series.map((s, i) => (
          <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color ?? seriesColor(i)} radius={[4, 4, 0, 0]} maxBarSize={28} />
        ))}
      </BarChart>
    </div>
  );
}
