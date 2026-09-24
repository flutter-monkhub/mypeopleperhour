import { Bar, CartesianGrid, Cell, LabelList, BarChart as RBarChart, ReferenceLine, Tooltip, XAxis, YAxis } from 'recharts';
import { ACCENT, AXIS } from './palette';
import { ChartTooltip, type ValueFormatter } from './ChartTooltip';
import type { Datum } from './types';

export interface BarChartProps {
  data: Datum[];
  /** Category field */
  xKey: string;
  /** Value field */
  yKey: string;
  /** Tooltip series name */
  label?: string;
  color?: string;
  /** Per-bar colour (e.g. highlight a unit, or status colours) */
  colorOf?: (d: Datum, i: number) => string;
  /** 'vertical' = horizontal bars with categories on the Y axis (good for long unit names) */
  layout?: 'horizontal' | 'vertical';
  height?: number;
  valueFormatter?: ValueFormatter;
  /** Fixed value axis domain, e.g. [0, 100] for percentages */
  domain?: [number, number];
  /** Print values at the bar ends */
  showValues?: boolean;
  /** Dashed target line (e.g. 80 for the 80% goal) */
  target?: { value: number; label?: string };
  /** Width reserved for category labels in vertical layout */
  categoryWidth?: number;
  tooltipFooter?: (d: Record<string, unknown>) => string | null;
  /** Click on a bar (e.g. drill into a unit). Adds a pointer cursor. */
  onBarClick?: (d: Datum, index: number) => void;
}

/** Single-series bar chart. */
export function BarChart({
  data,
  xKey,
  yKey,
  label = 'Value',
  color = ACCENT.primary,
  colorOf,
  layout = 'horizontal',
  height = 280,
  valueFormatter = (v) => String(v),
  domain,
  showValues,
  target,
  categoryWidth = 120,
  tooltipFooter,
  onBarClick,
}: BarChartProps) {
  const vertical = layout === 'vertical';
  return (
    <RBarChart responsive data={data} layout={layout} style={{ width: '100%', height }} margin={{ top: target && vertical ? 22 : 8, right: showValues ? 36 : 12, bottom: 0, left: vertical ? 0 : -8 }} barCategoryGap="28%">
      <CartesianGrid stroke={AXIS.grid} vertical={vertical} horizontal={!vertical} />
      {vertical ? (
        <>
          <XAxis type="number" domain={domain} tick={AXIS.tick} tickLine={false} axisLine={false} tickFormatter={(v: number) => valueFormatter(v)} />
          <YAxis type="category" dataKey={xKey} width={categoryWidth} tick={AXIS.tick} tickLine={false} axisLine={{ stroke: AXIS.line }} interval={0} />
        </>
      ) : (
        <>
          <XAxis dataKey={xKey} tick={AXIS.tick} tickLine={false} axisLine={{ stroke: AXIS.line }} interval={0} />
          <YAxis domain={domain} tick={AXIS.tick} tickLine={false} axisLine={false} tickFormatter={(v: number) => valueFormatter(v)} width={48} />
        </>
      )}
      <Tooltip cursor={{ fill: 'rgba(47,86,232,.06)' }} content={<ChartTooltip valueFormatter={valueFormatter} footer={tooltipFooter} />} />
      {target && (
        <ReferenceLine
          {...(vertical ? { x: target.value } : { y: target.value })}
          stroke="#94A3B8"
          strokeDasharray="4 4"
          label={target.label ? { value: target.label, position: vertical ? 'top' : 'insideTopRight', fill: '#64748B', fontSize: 11 } : undefined}
        />
      )}
      <Bar dataKey={yKey} name={label} fill={color} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={vertical ? 22 : 44} onClick={onBarClick ? (_: unknown, i: number) => onBarClick(data[i], i) : undefined} style={onBarClick ? { cursor: 'pointer' } : undefined}>
        {colorOf && data.map((d, i) => <Cell key={i} fill={colorOf(d, i)} />)}
        {showValues && <LabelList dataKey={yKey} position={vertical ? 'right' : 'top'} formatter={(v: unknown) => (typeof v === 'number' ? valueFormatter(v) : String(v ?? ''))} style={{ fill: '#0F172A', fontSize: 12, fontWeight: 600 }} />}
      </Bar>
    </RBarChart>
  );
}
