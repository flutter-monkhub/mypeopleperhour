// Matching rule checks from `validateMatch` (A34 capacity · A35 cross-functional · A36 reporting),
// labelled with the matching framework's criterion + weightage.

import { CircleCheck, CircleX } from 'lucide-react';
import type { RuleResult } from '@shared/logic';
import { MATCHING_CRITERIA } from '@shared/content/mentoring';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui';

const CRITERION = new Map(MATCHING_CRITERIA.map((c) => [c.id as string, c]));
const ORDER = ['cross_functional', 'capacity', 'reporting'];
const sortRules = (rules: RuleResult[]) => [...rules].sort((a, b) => ORDER.indexOf(a.id) - ORDER.indexOf(b.id));

/** Excel row reference per rule, shown as a subtle hint. */
const ROW: Record<RuleResult['id'], string> = { capacity: 'A34', cross_functional: 'A35', reporting: 'A36' };

/** Green / red rows: criterion, weightage, message. */
export function RuleChecks({ rules, compact, className }: { rules: RuleResult[]; compact?: boolean; className?: string }) {
  return (
    <ul className={cn('flex flex-col gap-1.5', className)}>
      {sortRules(rules).map((r) => {
        const c = CRITERION.get(r.id);
        return (
          <li
            key={r.id}
            className={cn(
              'flex items-start gap-2.5 rounded-lg border px-3',
              compact ? 'py-2' : 'py-2.5',
              r.ok ? 'border-success/20 bg-success-soft/50' : 'border-danger/25 bg-danger-soft/60',
            )}
          >
            {r.ok ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-label="Pass" />
            ) : (
              <CircleX className="mt-0.5 size-4 shrink-0 text-danger" aria-label="Fail" />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-[13px] font-semibold text-ink">{c?.criterion ?? r.id}</span>
                {c && (
                  <Badge tone={c.weightage === 'Required' ? 'warning' : 'navy'} size="sm" title={c.rule}>
                    {c.weightage}
                  </Badge>
                )}
                {!compact && <span className="text-[11px] text-muted">{ROW[r.id]}</span>}
              </div>
              <p className={cn('text-xs', r.ok ? 'text-ink-2' : 'font-medium text-danger')}>{r.message}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Three tiny status dots (cross-functional · capacity · reporting) with a tooltip. */
export function RuleDots({ rules, className }: { rules: RuleResult[]; className?: string }) {
  const sorted = sortRules(rules);
  const failed = sorted.filter((r) => !r.ok);
  return (
    <span
      className={cn('inline-flex items-center gap-1', className)}
      title={failed.length ? failed.map((r) => `✕ ${r.message}`).join('\n') : 'All matching rules pass'}
      aria-label={failed.length ? `Rules failing: ${failed.map((r) => r.message).join('; ')}` : 'All matching rules pass'}
    >
      {sorted.map((r) => (
        <span key={r.id} className={cn('size-2 rounded-full', r.ok ? 'bg-success' : 'bg-danger')} />
      ))}
    </span>
  );
}

/** Short human label of the first failing rule ("Same function", "Reporting line", "At capacity"). */
export function ruleShortLabel(r: RuleResult): string {
  if (r.id === 'cross_functional') return 'Same function';
  if (r.id === 'reporting') return 'Reporting line';
  return 'At capacity';
}
