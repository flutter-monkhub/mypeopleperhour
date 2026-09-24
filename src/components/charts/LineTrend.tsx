import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { AXIS, seriesColor } from './palette';
import { ChartLegend, ChartTooltip, type ValueFormatter } from './ChartTooltip';
import type { Datum, Series } from './types';

export interface LineTrendProps {
  data: Datum[];
  xKey: string;
  series: Series[];
  height?: number;
  valueFormatter?: ValueFormatter;
  domain?: [number | 'auto', number | 'auto'];
  /** Soft gradient fill under the first series */
  area?: boolean;
  target?: { value: number; label?: string };
  legend?: boolean;
}

/** Line / area trend over time (e.g. completion % since launch). */
export function LineTrend({ data, xKey, series, height = 260, valueFormatter = (v) => String(v), domain, area = true, target, legend = series.length > 1 }: LineTrendProps) {
  const gid = `lt-${series.map((s) => s.key).join('-')}`;
  const first = series[0];
  const firstColor = first?.color ?? seriesColor(0);
  return (
    <div className="w-full">
      {legend && <ChartLegend className="mb-3" items={series.map((s, i) => ({ label: s.label, color: s.color ?? seriesColor(i) }))} />}
      <ComposedChart responsive data={data} style={{ width: '100%', height }} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={firstColor} stopOpacity={0.18} />
            <stop offset="100%" stopColor={firstColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={AXIS.grid} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS.tick} tickLine={false} axisLine={{ stroke: AXIS.line }} padding={{ left: 12, right: 12 }} />
        <YAxis domain={domain} tick={AXIS.tick} tickLine={false} axisLine={false} width={48} tickFormatter={(v: number) => valueFormatter(v)} />
        <Tooltip cursor={{ stroke: '#CBD5E1', strokeDasharray: '3 3' }} content={<ChartTooltip valueFormatter={valueFormatter} />} />
        {target && (
          <ReferenceLine y={target.value} stroke="#94A3B8" strokeDasharray="4 4" label={target.label ? { value: target.label, position: 'insideTopRight', fill: '#64748B', fontSize: 11 } : undefined} />
        )}
        {area && first && <Area type="monotone" dataKey={first.key} name={first.label} stroke="none" fill={`url(#${gid})`} legendType="none" tooltipType="none" isAnimationActive={false} />}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color ?? seriesColor(i)}
            strokeWidth={2}
            dot={{ r: 3.5, strokeWidth: 2, fill: '#fff' }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
          />
        ))}
      </ComposedChart>
    </div>
  );
}
