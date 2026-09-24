// Unit (or function) × category heatmap for one pulse quarter. Sequential single-hue (blue) scale on
// the 1–5 average, value printed in every cell; groups under MIN_GROUP are suppressed.

import type { PulseCategory } from '@shared/types';
import { MIN_GROUP, PULSE_CATEGORIES, type GroupScores } from '@/lib/analytics-pulse';
import { formatNumber } from '@/lib/format';

export type HeatDomain = [number, number];
const LOW = [0xee, 0xf2, 0xff];
const HIGH = [0x1e, 0x3f, 0xc4];

/** Domain fitted to the visible values (0.1 steps, at least 0.8 wide) so differences stay readable. */
export function heatDomain(rows: GroupScores[], categories: readonly PulseCategory[] = PULSE_CATEGORIES): HeatDomain {
  const vals = rows.flatMap((r) => categories.map((c) => r.categories[c]?.avg).filter((v): v is number => v != null));
  if (!vals.length) return [3, 4.6];
  let lo = Math.floor((Math.min(...vals) - 0.05) * 10) / 10;
  let hi = Math.ceil((Math.max(...vals) + 0.05) * 10) / 10;
  if (hi - lo < 0.8) {
    const pad = (0.8 - (hi - lo)) / 2;
    lo = Math.max(1, Math.round((lo - pad) * 10) / 10);
    hi = Math.min(5, Math.round((hi + pad) * 10) / 10);
  }
  return [lo, hi];
}

export function heatColor(v: number, [a, b]: HeatDomain): { bg: string; fg: string } {
  const t = Math.max(0, Math.min(1, (v - a) / (b - a)));
  const c = LOW.map((l, i) => Math.round(l + (HIGH[i] - l) * t));
  return { bg: `rgb(${c.join(',')})`, fg: t > 0.52 ? '#FFFFFF' : '#0F172A' };
}

export function HeatLegend({ domain }: { domain: HeatDomain }) {
  return (
    <div className="flex items-center gap-2 text-xs text-ink-2">
      <span className="tabular">{domain[0].toFixed(1)}</span>
      <span className="h-2.5 w-32 rounded-full" style={{ background: `linear-gradient(90deg, rgb(${LOW.join(',')}), rgb(${HIGH.join(',')}))` }} />
      <span className="tabular">{domain[1].toFixed(1)}</span>
      <span className="text-muted">average (1–5), scale fitted to this table</span>
    </div>
  );
}

export function PulseHeatmap({ rows, groupLabel, domain, categories = PULSE_CATEGORIES }: { rows: GroupScores[]; groupLabel: string; domain: HeatDomain; categories?: readonly PulseCategory[] }) {
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[720px] border-separate border-spacing-[3px] text-[13px]">
        <thead>
          <tr>
            <th scope="col" className="px-2 py-2 text-left text-xs font-semibold text-ink-2">
              {groupLabel}
            </th>
            {categories.map((c) => (
              <th key={c} scope="col" className="px-2 py-2 text-center text-xs font-semibold text-ink-2">
                {c}
              </th>
            ))}
            <th scope="col" className="px-2 py-2 text-center text-xs font-semibold text-ink">
              Index
            </th>
            <th scope="col" className="px-2 py-2 text-right text-xs font-semibold text-ink-2">
              eNPS
            </th>
            <th scope="col" className="px-2 py-2 text-right text-xs font-semibold text-ink-2">
              Responses
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <th scope="row" className="max-w-52 truncate px-2 py-2 text-left font-medium text-ink" title={r.label}>
                {r.label}
              </th>
              {r.suppressed ? (
                <td colSpan={categories.length + 2} className="rounded-md bg-[repeating-linear-gradient(135deg,#F4F6FA_0,#F4F6FA_6px,#FFFFFF_6px,#FFFFFF_12px)] px-3 py-2 text-center text-xs text-ink-2">
                  Hidden — fewer than {MIN_GROUP} responses
                </td>
              ) : (
                <>
                  {categories.map((c) => {
                    const v = r.categories[c]?.avg;
                    if (v == null)
                      return (
                        <td key={c} className="rounded-md bg-canvas px-2 py-2 text-center text-muted">
                          —
                        </td>
                      );
                    const { bg, fg } = heatColor(v, domain);
                    return (
                      <td key={c} className="rounded-md px-2 py-2 text-center font-semibold tabular" style={{ background: bg, color: fg }} title={`${r.label} · ${c}: ${v.toFixed(2)} (${Math.round((r.categories[c]?.favourable ?? 0) * 100)}% favourable)`}>
                        {v.toFixed(1)}
                      </td>
                    );
                  })}
                  <td className="rounded-md border border-line bg-white px-2 py-2 text-center font-bold text-ink tabular">{r.index == null ? '—' : r.index.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right text-ink-2 tabular">{r.enps == null ? '—' : `${r.enps > 0 ? '+' : ''}${r.enps}`}</td>
                </>
              )}
              <td className="px-2 py-2 text-right text-ink-2 tabular">{formatNumber(r.respondents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
