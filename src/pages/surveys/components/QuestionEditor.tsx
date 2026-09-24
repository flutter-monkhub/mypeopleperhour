// Builder question card (SPEC A24/A25): collapsed summary row + inline editor with type-specific
// settings, reorder / duplicate / delete. `readOnly` renders the same card as a static summary.

import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, CircleAlert, Copy, GripVertical, Plus, Trash2, X } from 'lucide-react';
import type { PulseCategory, QuestionType, SurveyQuestion } from '@shared/types';
import { ALL_CATEGORIES, EMOJI_FACES, SCALE_LABELS, isScaleType } from '@/lib/analytics-pulse';
import { cn } from '@/lib/cn';
import { changeSurveyQuestionType, isChoiceQuestion, reorderSurveyItem } from '@/store/actions';
import { Button, IconButton, Input, Popover, Select, Textarea, Toggle } from '@/components/ui';
import { QUESTION_TYPES, TYPE_META } from './meta';

// ───────────────────────── type picker ─────────────────────────

export function TypeGrid({ onPick, className }: { onPick: (t: QuestionType) => void; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 gap-2 sm:grid-cols-2', className)}>
      {QUESTION_TYPES.map((t) => {
        const m = TYPE_META[t];
        return (
          <button
            key={t}
            type="button"
            onClick={() => onPick(t)}
            className="flex items-start gap-3 rounded-xl border border-line bg-white p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary-soft/40"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
              <m.icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink">{m.label}</span>
              <span className="block text-xs text-ink-2">{m.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function AddQuestionButton({ onPick, variant = 'secondary', label = 'Add question', align = 'end' }: { onPick: (t: QuestionType) => void; variant?: 'primary' | 'secondary' | 'outline'; label?: string; align?: 'start' | 'end' }) {
  return (
    <Popover
      align={align}
      width="w-[min(34rem,calc(100vw-2rem))]"
      trigger={(p) => (
        <Button {...p} variant={variant} icon={Plus} size="sm">
          {label}
        </Button>
      )}
    >
      {(close) => (
        <div className="p-3">
          <p className="mb-2.5 px-1 text-xs font-semibold tracking-wide text-ink-2 uppercase">Choose a question type</p>
          <TypeGrid
            onPick={(t) => {
              close();
              onPick(t);
            }}
          />
        </div>
      )}
    </Popover>
  );
}

// ───────────────────────── options ─────────────────────────

function OptionsEditor({ q, onChange, disabled }: { q: SurveyQuestion; onChange: (q: SurveyQuestion) => void; disabled?: boolean }) {
  const options = q.options ?? [];
  const setOptions = (next: string[]) => {
    const out: SurveyQuestion = { ...q, options: next };
    if (out.maxSelections && out.maxSelections > next.length) out.maxSelections = next.length || undefined;
    onChange(out);
  };
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-medium text-ink">
        Options <span className="font-normal text-ink-2">· at least two</span>
      </p>
      <ol className="flex flex-col gap-2">
        {options.map((o, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <span className={cn('grid size-5 shrink-0 place-items-center border-[1.5px] border-[#B9C2D4]', q.type === 'multi_choice' ? 'rounded-[4px]' : 'rounded-full')} aria-hidden />
            <Input
              aria-label={`Option ${i + 1}`}
              size="sm"
              value={o}
              disabled={disabled}
              maxLength={80}
              containerClassName="flex-1"
              placeholder={`Option ${i + 1}`}
              onChange={(e) => setOptions(options.map((x, j) => (j === i ? e.target.value : x)))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && i === options.length - 1 && o.trim()) {
                  e.preventDefault();
                  const list = e.currentTarget.closest('ol');
                  setOptions([...options, '']);
                  requestAnimationFrame(() => list?.querySelector<HTMLInputElement>('li:last-child input')?.focus());
                }
              }}
            />
            <IconButton icon={ArrowUp} label="Move option up" size="sm" disabled={disabled || i === 0} onClick={() => setOptions(reorderSurveyItem(options, i, -1))} />
            <IconButton icon={ArrowDown} label="Move option down" size="sm" disabled={disabled || i === options.length - 1} onClick={() => setOptions(reorderSurveyItem(options, i, 1))} />
            <IconButton icon={X} label="Remove option" size="sm" disabled={disabled || options.length <= 2} onClick={() => setOptions(options.filter((_, j) => j !== i))} />
          </li>
        ))}
      </ol>
      {!disabled && (
        <Button variant="link" size="sm" icon={Plus} className="mt-2" onClick={() => setOptions([...options, ''])} disabled={options.length >= 12}>
          Add option
        </Button>
      )}
    </div>
  );
}

// ───────────────────────── scale hints ─────────────────────────

function ScaleHint({ type }: { type: QuestionType }) {
  if (isScaleType(type))
    return (
      <div className="rounded-xl bg-canvas p-3">
        <div className="flex flex-wrap gap-1.5">
          {SCALE_LABELS[type].map((l, i) => (
            <span key={l} className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-xs text-ink-2">
              {type === 'emoji' && <span>{EMOJI_FACES[i]}</span>}
              <span className="font-semibold text-ink tabular">{i + 1}</span> {type === 'rating' ? '★' : l}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-2">Scored 1–5 in results and pulse analysis; 4–5 counts as favourable.</p>
      </div>
    );
  if (type === 'nps')
    return <p className="rounded-xl bg-canvas p-3 text-xs text-ink-2">0–10 scale. Promoters 9–10 · Passives 7–8 · Detractors 0–6. eNPS = % promoters − % detractors.</p>;
  if (type === 'yes_no') return <p className="rounded-xl bg-canvas p-3 text-xs text-ink-2">Two large buttons in the app. Results show the yes / no split.</p>;
  if (type === 'text') return <p className="rounded-xl bg-canvas p-3 text-xs text-ink-2">Up to 500 characters. Comments are shown without names on anonymous surveys and grouped into themes.</p>;
  return null;
}

// ───────────────────────── question card ─────────────────────────

export interface QuestionEditorProps {
  q: SurveyQuestion;
  index: number;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (q: SurveyQuestion) => void;
  onMove: (delta: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** No editing at all (view-only role, closed or locked survey) */
  readOnly?: boolean;
  issues?: string[];
  /** Show validation messages even before the field was touched (after a publish attempt) */
  forceIssues?: boolean;
}

export function QuestionEditor({ q, index, count, expanded, onToggle, onChange, onMove, onDuplicate, onDelete, readOnly, issues = [], forceIssues }: QuestionEditorProps) {
  const meta = TYPE_META[q.type];
  const [blurred, setTouched] = useState(false);
  const touched = blurred || !!forceIssues;
  const showIssues = issues.length > 0 && (touched || !expanded);
  const set = (patch: Partial<SurveyQuestion>) => onChange({ ...q, ...patch });

  return (
    <div
      className={cn(
        'rounded-xl border bg-white transition-shadow',
        expanded ? 'border-primary/50 shadow-[0_0_0_3px_rgba(47,86,232,.10)]' : showIssues ? 'border-danger/40' : 'border-line hover:border-line-strong',
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2.5">
        {!readOnly && <GripVertical className="hidden size-4 shrink-0 text-muted sm:block" aria-hidden />}
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', expanded ? 'bg-primary text-white' : 'bg-primary-soft text-primary')} title={meta.label}>
          <meta.icon className="size-4" />
        </span>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 py-0.5 text-left" aria-expanded={expanded}>
          <span className={cn('line-clamp-2 text-[13.5px] leading-5', q.text.trim() ? 'font-medium text-ink' : 'text-muted italic')}>
            <span className="mr-1.5 font-semibold text-ink-2 tabular">{index + 1}.</span>
            {q.text.trim() || 'Untitled question'}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-2">
            <span>{meta.label}</span>
            {isChoiceQuestion(q.type) && <span className="text-muted">· {q.options?.length ?? 0} options{q.maxSelections ? `, max ${q.maxSelections}` : ''}</span>}
            {q.category && <span className="text-muted">· {q.category}</span>}
            <span className="text-muted">· {q.required ? 'Required' : 'Optional'}</span>
            {showIssues && (
              <span className="inline-flex items-center gap-1 font-medium text-danger">
                <CircleAlert className="size-3.5" /> Needs attention
              </span>
            )}
          </span>
        </button>
        {!readOnly && (
          <div className="flex shrink-0 items-center">
            <IconButton icon={ArrowUp} label="Move up" size="sm" disabled={index === 0} onClick={() => onMove(-1)} />
            <IconButton icon={ArrowDown} label="Move down" size="sm" disabled={index === count - 1} onClick={() => onMove(1)} />
            <IconButton icon={Copy} label="Duplicate question" size="sm" onClick={onDuplicate} className="hidden sm:inline-flex" />
            <IconButton icon={Trash2} label="Delete question" size="sm" onClick={onDelete} />
          </div>
        )}
        <IconButton icon={ChevronDown} label={expanded ? 'Collapse' : 'Expand'} size="sm" onClick={onToggle} className={cn('transition-transform', expanded && 'rotate-180')} />
      </div>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-line px-4 pt-4 pb-4 sm:pl-[4.5rem]" onBlur={() => setTouched(true)}>
          <Textarea
            label="Question"
            required
            rows={2}
            maxLength={200}
            value={q.text}
            disabled={readOnly}
            autoFocus={!readOnly && !q.text}
            placeholder="e.g. I feel heard and understood by my manager."
            error={touched && !q.text.trim() ? 'Question text is required' : undefined}
            onChange={(e) => set({ text: e.target.value })}
          />
          <Input label="Help text" hint="Optional line shown under the question" value={q.helpText ?? ''} disabled={readOnly} maxLength={140} placeholder="e.g. Select up to three." onChange={(e) => set({ helpText: e.target.value || undefined })} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Select
              label="Type"
              value={q.type}
              disabled={readOnly}
              options={QUESTION_TYPES.map((t) => ({ value: t, label: TYPE_META[t].label }))}
              onValueChange={(v) => onChange(changeSurveyQuestionType(q, v as QuestionType))}
            />
            <Select
              label="Category"
              value={q.category ?? ''}
              disabled={readOnly}
              placeholder="No category"
              options={ALL_CATEGORIES.map((c) => ({ value: c, label: c }))}
              onValueChange={(v) => set({ category: (v || undefined) as PulseCategory | undefined })}
            />
            <div className="pb-2">
              <Toggle checked={q.required} onChange={(v) => set({ required: v })} label="Required" disabled={readOnly} />
            </div>
          </div>
          {isChoiceQuestion(q.type) ? (
            <div className={cn('grid grid-cols-1 gap-4', q.type === 'multi_choice' && 'lg:grid-cols-[1fr_12rem]')}>
              <OptionsEditor q={q} onChange={onChange} disabled={readOnly} />
              {q.type === 'multi_choice' && (
                <Select
                  label="Max selections"
                  value={q.maxSelections ? String(q.maxSelections) : ''}
                  disabled={readOnly}
                  placeholder="No limit"
                  options={Array.from({ length: Math.max(0, (q.options?.length ?? 0) - 1) }, (_, i) => ({ value: String(i + 1), label: `Up to ${i + 1}` }))}
                  onValueChange={(v) => set({ maxSelections: v ? Number(v) : undefined })}
                  hint="Rule enforced in the app"
                />
              )}
            </div>
          ) : (
            <ScaleHint type={q.type} />
          )}
          {issues.length > 0 && touched && (
            <ul className="flex flex-col gap-1 text-xs font-medium text-danger">
              {issues.map((m) => (
                <li key={m} className="flex items-center gap-1.5">
                  <CircleAlert className="size-3.5" /> {m.replace(/^Question \d+ (\w)/, (_, c: string) => c.toUpperCase())}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
