import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS, seriesColor } from './palette';
import { ChartLegend, ChartTooltip, type ValueFormatter } from './ChartTooltip';
import type { Datum, Series } from './types';

export interface StackedBarProps {
  data: Datum[];
  xKey: string;
  /** Bottom → top order */
  series: Series[];
  height?: number;
  /** Normalise every bar to 100 % (stackOffset="expand") */
  percent?: boolean;
  layout?: 'horizontal' | 'vertical';
  valueFormatter?: ValueFormatter;
  legend?: boolean;
  categoryWidth?: number;
}

/** Stacked bars — e.g. status mix (completed/scheduled/to be scheduled/missed) per unit. */
export function StackedBar({ data, xKey, series, height = 280, percent, layout = 'horizontal', valueFormatter = (v) => String(v), legend = true, categoryWidth = 120 }: StackedBarProps) {
  const vertical = layout === 'vertical';
  const pctFmt = (v: number) => `${Math.round(v * 100)}%`;
  const last = series.length - 1;
  return (
    <div className="w-full">
      {legend && <ChartLegend className="mb-3" items={series.map((s, i) => ({ label: s.label, color: s.color ?? seriesColor(i) }))} />}
      <BarChart
        responsive
        data={data}
        layout={layout}
        stackOffset={percent ? 'expand' : undefined}
        style={{ width: '100%', height }}
        margin={{ top: 4, right: 8, bottom: 0, left: vertical ? 0 : -8 }}
        barCategoryGap="26%"
      >
        <CartesianGrid stroke={AXIS.grid} vertical={vertical} horizontal={!vertical} />
        {vertical ? (
          <>
            <XAxis type="number" tick={AXIS.tick} tickLine={false} axisLine={false} tickFormatter={percent ? pctFmt : (v: number) => valueFormatter(v)} />
            <YAxis type="category" dataKey={xKey} width={categoryWidth} tick={AXIS.tick} tickLine={false} axisLine={{ stroke: AXIS.line }} interval={0} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={AXIS.tick} tickLine={false} axisLine={{ stroke: AXIS.line }} interval={0} />
            <YAxis tick={AXIS.tick} tickLine={false} axisLine={false} width={48} tickFormatter={percent ? pctFmt : (v: number) => valueFormatter(v)} />
          </>
        )}
        <Tooltip cursor={{ fill: 'rgba(47,86,232,.06)' }} content={<ChartTooltip valueFormatter={valueFormatter} />} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="stack"
            fill={s.color ?? seriesColor(i)}
            stroke="#fff"
            strokeWidth={1}
            maxBarSize={vertical ? 22 : 40}
            radius={i === last ? (vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]) : undefined}
          />
        ))}
      </BarChart>
    </div>
  );
}
