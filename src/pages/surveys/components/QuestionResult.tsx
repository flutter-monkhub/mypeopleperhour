// Per-question result card (SPEC A27): scale distributions (diverging, 1–5), NPS breakdown + score,
// choice counts, yes/no split and searchable text answers. Plain HTML bars with native tooltips.

import { useMemo, useState, type ReactNode } from 'react';
import { Quote, Star } from 'lucide-react';
import type { DemoDatabase, ID, SurveyQuestion } from '@shared/types';
import { EMOJI_FACES, NPS_COLORS, SCALE_COLORS, SCALE_LABELS, type QuestionAggregate } from '@/lib/analytics-pulse';
import { SERIES_COLORS } from '@/components/charts';
import { cn } from '@/lib/cn';
import { formatDate, formatDecimal, formatNumber, formatPercent, pluralize } from '@/lib/format';
import { employeeName, unitName } from '@/lib/lookup';
import { Badge, Button, Card, SearchInput } from '@/components/ui';
import { TYPE_META } from './meta';

const pctOf = (n: number, total: number) => (total ? n / total : 0);

/** 100% stacked bar made of segments (2px surface gaps between fills). */
function StackBar({ parts, height = 'h-3' }: { parts: { label: string; value: number; color: string }[]; height?: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div className={cn('flex w-full gap-[2px] overflow-hidden rounded-full bg-[#EDF0F6]', height)}>
      {parts.map((p) =>
        p.value > 0 ? (
          <div key={p.label} title={`${p.label}: ${formatNumber(p.value)} (${formatPercent(pctOf(p.value, total))})`} style={{ width: `${pctOf(p.value, total) * 100}%`, background: p.color }} className="h-full first:rounded-l-full last:rounded-r-full" />
        ) : null,
      )}
    </div>
  );
}

/** Label | bar | % | n rows. */
function BarRows({ rows, color, max }: { rows: { label: ReactNode; key: string; count: number; share: number; color?: string }[]; color?: string; max?: number }) {
  const top = max ?? Math.max(...rows.map((r) => r.share), 0.0001);
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)_3rem_2.5rem] items-center gap-3 text-[13px]" title={`${formatNumber(r.count)} (${formatPercent(r.share)})`}>
          <span className="truncate text-ink-2">{r.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-[#EDF0F6]">
            <span className="block h-full rounded-full" style={{ width: `${(r.share / top) * 100}%`, background: r.color ?? color ?? SERIES_COLORS[0] }} />
          </span>
          <span className="text-right font-semibold text-ink tabular">{formatPercent(r.share)}</span>
          <span className="text-right text-xs text-muted tabular">{formatNumber(r.count)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Big number + caption. Values stay in ink; an optional swatch ties them to the chart colour. */
function Stat({ value, label, swatch }: { value: ReactNode; label: ReactNode; swatch?: string }) {
  return (
    <div>
      <p className="text-2xl leading-8 font-bold tracking-tight text-ink tabular">{value}</p>
      <p className="flex items-center gap-1.5 text-xs text-ink-2">
        {swatch && <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: swatch }} />}
        {label}
      </p>
    </div>
  );
}

export interface QuestionResultProps {
  db: DemoDatabase;
  q: SurveyQuestion;
  index: number;
  agg: QuestionAggregate;
  anonymous: boolean;
  /** response id → employee id (named surveys only) */
  respondentOf?: (responseId: ID) => ID | undefined;
}

export function QuestionResult({ db, q, index, agg, anonymous, respondentOf }: QuestionResultProps) {
  const meta = TYPE_META[q.type];
  const wide = agg.kind === 'text';
  return (
    <Card className={cn('flex flex-col', wide && 'lg:col-span-2')}>
      <div className="mb-4 flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary" title={meta.label}>
          <meta.icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-ink-2">
            Q{index + 1} · {meta.label}
            {q.category ? ` · ${q.category}` : ''}
          </p>
          <h3 className="mt-0.5 text-[14.5px] leading-snug font-semibold text-ink">{q.text}</h3>
        </div>
        <span className="shrink-0 text-right text-xs text-ink-2 tabular">
          {formatNumber(agg.n)} answered
          {agg.skipped > 0 && <span className="block text-muted">{formatNumber(agg.skipped)} skipped</span>}
        </span>
      </div>
      {agg.n === 0 ? <p className="rounded-lg bg-canvas px-4 py-6 text-center text-sm text-ink-2">No answers yet.</p> : <Body db={db} q={q} agg={agg} anonymous={anonymous} respondentOf={respondentOf} />}
    </Card>
  );
}

function Body({ db, q, agg, anonymous, respondentOf }: Omit<QuestionResultProps, 'index'>) {
  switch (agg.kind) {
    case 'scale': {
      const labels = SCALE_LABELS[agg.type];
      const total = agg.counts.reduce((a, b) => a + b, 0);
      const rows = agg.counts
        .map((c, i) => ({
          key: String(i),
          count: c,
          share: pctOf(c, total),
          color: SCALE_COLORS[i],
          label:
            agg.type === 'emoji' ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-base leading-none">{EMOJI_FACES[i]}</span> {labels[i]}
              </span>
            ) : agg.type === 'rating' ? (
              <span className="inline-flex items-center gap-0.5 text-[#E0A100]" aria-label={labels[i]}>
                {Array.from({ length: i + 1 }, (_, k) => (
                  <Star key={k} className="size-3.5 fill-current" />
                ))}
              </span>
            ) : (
              labels[i]
            ),
        }))
        .reverse();
      const face = agg.avg != null ? EMOJI_FACES[Math.min(4, Math.max(0, Math.round(agg.avg) - 1))] : null;
      return (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <Stat
              value={
                <span className="inline-flex items-baseline gap-1.5">
                  {agg.type === 'emoji' && face && <span className="text-xl">{face}</span>}
                  {agg.avg == null ? '—' : agg.avg.toFixed(1)}
                  <span className="text-sm font-medium text-muted">/ 5</span>
                </span>
              }
              label="Average"
            />
            <Stat value={formatPercent(agg.favourable)} label={agg.type === 'likert' ? 'Agree (4–5)' : 'Favourable (4–5)'} swatch={SCALE_COLORS[4]} />
            <Stat value={formatPercent(agg.unfavourable)} label={agg.type === 'likert' ? 'Disagree (1–2)' : 'Unfavourable (1–2)'} swatch={SCALE_COLORS[0]} />
          </div>
          <StackBar parts={agg.counts.map((c, i) => ({ label: labels[i], value: c, color: SCALE_COLORS[i] }))} />
          <BarRows rows={rows} max={1} />
        </div>
      );
    }
    case 'nps': {
      const groups = [
        { label: 'Detractors (0–6)', value: agg.detractors, color: NPS_COLORS.detractors },
        { label: 'Passives (7–8)', value: agg.passives, color: NPS_COLORS.passives },
        { label: 'Promoters (9–10)', value: agg.promoters, color: NPS_COLORS.promoters },
      ];
      const maxCount = Math.max(...agg.counts, 1);
      return (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <Stat value={agg.score == null ? '—' : `${agg.score > 0 ? '+' : ''}${agg.score}`} label="eNPS (−100 to +100)" />
            <div className="grid min-w-0 flex-1 grid-cols-3 gap-3">
              {groups.map((g) => (
                <div key={g.label} className="min-w-0 text-xs text-ink-2">
                  <p className="text-base font-semibold text-ink tabular">
                    {formatPercent(pctOf(g.value, agg.n))} <span className="text-xs font-normal text-muted">({formatNumber(g.value)})</span>
                  </p>
                  <p className="flex items-center gap-1.5 truncate">
                    <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: g.color }} /> {g.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <StackBar parts={groups} />
          <div>
            <div className="flex h-24 items-end gap-1">
              {agg.counts.map((c, k) => (
                <div key={k} className="flex h-full flex-1 flex-col justify-end" title={`${k}: ${formatNumber(c)} (${formatPercent(pctOf(c, agg.n))})`}>
                  <div className="rounded-t-[4px]" style={{ height: `${Math.max(c ? 3 : 0, (c / maxCount) * 100)}%`, background: k >= 9 ? NPS_COLORS.promoters : k >= 7 ? NPS_COLORS.passives : NPS_COLORS.detractors }} />
                </div>
              ))}
            </div>
            <div className="mt-1 flex gap-1 border-t border-line pt-1">
              {agg.counts.map((_, k) => (
                <span key={k} className="flex-1 text-center text-[11px] text-ink-2 tabular">
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>
      );
    }
    case 'choice':
      return (
        <div className="flex flex-col gap-3">
          <BarRows rows={agg.options.map((o) => ({ key: o.label, label: o.label, count: o.count, share: o.share }))} max={agg.multi ? 1 : undefined} />
          {agg.multi && (
            <p className="text-xs text-ink-2">
              % of respondents who picked each option · {formatDecimal(agg.avgSelections)} picks on average{q.maxSelections ? ` (max ${q.maxSelections})` : ''}
            </p>
          )}
        </div>
      );
    case 'yes_no': {
      const parts = [
        { label: 'Yes', value: agg.yes, color: SERIES_COLORS[0] },
        { label: 'No', value: agg.no, color: SERIES_COLORS[1] },
      ];
      return (
        <div className="flex flex-col gap-4">
          <div className="flex items-end gap-8">
            <Stat value={formatPercent(agg.yesShare)} label={`Yes · ${formatNumber(agg.yes)}`} swatch={SERIES_COLORS[0]} />
            <Stat value={formatPercent(agg.yesShare == null ? null : 1 - agg.yesShare)} label={`No · ${formatNumber(agg.no)}`} swatch={SERIES_COLORS[1]} />
          </div>
          <StackBar parts={parts} height="h-4" />
        </div>
      );
    }
    case 'text':
      return <TextAnswers db={db} answers={agg.answers} anonymous={anonymous} respondentOf={respondentOf} />;
  }
}

function TextAnswers({ db, answers, anonymous, respondentOf }: { db: DemoDatabase; answers: Extract<QuestionAggregate, { kind: 'text' }>['answers']; anonymous: boolean; respondentOf?: (id: ID) => ID | undefined }) {
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(6);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? answers.filter((a) => a.text.toLowerCase().includes(s)) : answers;
  }, [answers, q]);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search comments" size="sm" />
        <span className="text-xs text-ink-2">{q.trim() ? `${pluralize(list.length, 'match', 'matches')}` : `${pluralize(answers.length, 'comment')}, newest first`}</span>
      </div>
      {list.length === 0 ? (
        <p className="rounded-lg bg-canvas px-4 py-6 text-center text-sm text-ink-2">No comments match “{q}”.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {list.slice(0, limit).map((a) => {
            const who = !anonymous && respondentOf ? respondentOf(a.responseId) : undefined;
            return (
              <li key={a.responseId} className="flex gap-2.5 rounded-xl border border-line bg-[#FAFBFE] p-3.5">
                <Quote className="mt-0.5 size-4 shrink-0 text-primary/50" />
                <div className="min-w-0">
                  <p className="text-[13.5px] leading-relaxed text-ink">{a.text}</p>
                  <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-ink-2">
                    {who && <span className="font-medium text-ink">{employeeName(db, who)}</span>}
                    <Badge tone="outline" size="sm">
                      {unitName(db, a.unitId, true)}
                    </Badge>
                    {a.at && <span>{formatDate(a.at)}</span>}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {list.length > limit && (
        <div className="mt-3 text-center">
          <Button variant="ghost" size="sm" onClick={() => setLimit((l) => l + 12)}>
            Show more ({formatNumber(list.length - limit)} more)
          </Button>
        </div>
      )}
    </div>
  );
}
