// A survey question rendered the way the employee app shows it (SPEC M45/M46): emoji faces, stars,
// agreement pills, 0–10 NPS row, radios, checkboxes, yes/no and a comment box. Interactive, so the
// builder preview can be "tried out"; nothing is stored.

import { Check, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import type { AnswerValue, SurveyQuestion } from '@shared/types';
import { EMOJI_FACES, SCALE_LABELS } from '@/lib/analytics-pulse';
import { cn } from '@/lib/cn';

export interface QuestionPreviewProps {
  question: SurveyQuestion;
  number: number;
  total: number;
  value?: AnswerValue;
  onChange?: (v: AnswerValue | undefined) => void;
  /** Highlight (selected in the editor) */
  active?: boolean;
  /** Show the "answer this" hint after a failed submit */
  showError?: boolean;
  onFocus?: () => void;
}

const TEXT_MAX = 500;

export function QuestionPreview({ question: q, number, total, value, onChange, active, showError, onFocus }: QuestionPreviewProps) {
  const set = (v: AnswerValue | undefined) => onChange?.(v);
  const missing = showError && q.required && (value === undefined || value === '' || (Array.isArray(value) && value.length === 0));
  const opts = (q.options ?? []).map((o, i) => o.trim() || `Option ${i + 1}`);

  return (
    <div
      onClick={onFocus}
      className={cn(
        'rounded-2xl border bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,.04)] transition-shadow',
        active ? 'border-primary shadow-[0_0_0_3px_rgba(47,86,232,.14)]' : missing ? 'border-danger/60' : 'border-[#E8ECF4]',
      )}
    >
      <p className="text-[10.5px] font-semibold tracking-wide text-primary uppercase">
        Question {number} of {total}
        {q.category ? <span className="font-medium text-muted normal-case"> · {q.category}</span> : null}
      </p>
      <p className="mt-1 text-[13.5px] leading-snug font-semibold text-ink">
        {q.text.trim() || <span className="text-muted italic">Your question text</span>}
        {q.required && <span className="ml-0.5 text-danger">*</span>}
      </p>
      {q.helpText?.trim() && <p className="mt-0.5 text-[11.5px] leading-snug text-ink-2">{q.helpText}</p>}

      <div className="mt-3">
        {q.type === 'emoji' && (
          <div className="flex items-start justify-between gap-1">
            {EMOJI_FACES.map((face, i) => {
              const on = value === i + 1;
              return (
                <button key={face} type="button" onClick={() => set(on ? undefined : i + 1)} className="flex w-12 flex-col items-center gap-1" aria-label={SCALE_LABELS.emoji[i]}>
                  <span
                    className={cn(
                      'grid size-10 place-items-center rounded-full text-[22px] transition-all',
                      on ? 'scale-110 bg-primary-soft ring-2 ring-primary' : value != null ? 'opacity-45 grayscale-[.4]' : 'bg-canvas',
                    )}
                  >
                    {face}
                  </span>
                  <span className={cn('text-center text-[9.5px] leading-tight', on ? 'font-semibold text-primary' : 'text-muted')}>{SCALE_LABELS.emoji[i]}</span>
                </button>
              );
            })}
          </div>
        )}

        {q.type === 'rating' && (
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((k) => (
              <button key={k} type="button" onClick={() => set(value === k ? undefined : k)} aria-label={`${k} star${k > 1 ? 's' : ''}`}>
                <Star className={cn('size-8 transition-colors', typeof value === 'number' && k <= value ? 'fill-[#F5B400] text-[#F5B400]' : 'text-[#D5DBE8]')} strokeWidth={1.6} />
              </button>
            ))}
            {typeof value === 'number' && <span className="ml-1 text-xs font-medium text-ink-2">{value}/5</span>}
          </div>
        )}

        {q.type === 'likert' && (
          <div className="flex flex-col gap-1.5">
            {SCALE_LABELS.likert.map((label, i) => {
              const on = value === i + 1;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => set(on ? undefined : i + 1)}
                  className={cn(
                    'h-8.5 rounded-full border px-3.5 text-left text-[12.5px] font-medium transition-colors',
                    on ? 'border-primary bg-primary text-white' : 'border-[#DCE2EE] bg-white text-ink hover:border-primary/40',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}

        {q.type === 'nps' && (
          <div>
            <div className="grid grid-cols-11 gap-[3px]">
              {Array.from({ length: 11 }, (_, k) => {
                const on = value === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set(on ? undefined : k)}
                    className={cn(
                      'grid h-8 place-items-center rounded-md border text-[11.5px] font-semibold tabular transition-colors',
                      on ? 'border-primary bg-primary text-white' : 'border-[#DCE2EE] bg-white text-ink-2',
                    )}
                  >
                    {k}
                  </button>
                );
              })}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] text-muted">
              <span>Not at all likely</span>
              <span>Extremely likely</span>
            </div>
          </div>
        )}

        {(q.type === 'single_choice' || q.type === 'multi_choice') && (
          <div className="flex flex-col gap-1.5">
            {q.type === 'multi_choice' && <p className="-mt-1 mb-0.5 text-[11px] text-ink-2">{q.maxSelections ? `Select up to ${q.maxSelections}` : 'Select all that apply'}</p>}
            {opts.map((o) => {
              const multi = q.type === 'multi_choice';
              const list = Array.isArray(value) ? value : [];
              const on = multi ? list.includes(o) : value === o;
              const atMax = multi && !on && !!q.maxSelections && list.length >= q.maxSelections;
              return (
                <button
                  key={o}
                  type="button"
                  disabled={atMax}
                  onClick={() => (multi ? set(on ? list.filter((x) => x !== o) : [...list, o]) : set(on ? undefined : o))}
                  className={cn(
                    'flex min-h-9 items-center gap-2.5 rounded-xl border px-3 py-1.5 text-left text-[12.5px] transition-colors disabled:opacity-45',
                    on ? 'border-primary bg-primary-soft text-ink' : 'border-[#DCE2EE] bg-white text-ink',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-4 shrink-0 place-items-center border-[1.5px]',
                      multi ? 'rounded-[4px]' : 'rounded-full',
                      on ? 'border-primary bg-primary text-white' : 'border-[#B9C2D4] bg-white',
                    )}
                  >
                    {on && (multi ? <Check className="size-3" strokeWidth={3} /> : <span className="size-1.5 rounded-full bg-white" />)}
                  </span>
                  <span className="min-w-0 flex-1">{o}</span>
                </button>
              );
            })}
          </div>
        )}

        {q.type === 'yes_no' && (
          <div className="grid grid-cols-2 gap-2">
            {[
              { v: true, label: 'Yes', icon: ThumbsUp },
              { v: false, label: 'No', icon: ThumbsDown },
            ].map(({ v, label, icon: Icon }) => {
              const on = value === v;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => set(on ? undefined : v)}
                  className={cn(
                    'flex h-10 items-center justify-center gap-2 rounded-xl border text-[13px] font-semibold transition-colors',
                    on ? 'border-primary bg-primary text-white' : 'border-[#DCE2EE] bg-white text-ink',
                  )}
                >
                  <Icon className="size-4" /> {label}
                </button>
              );
            })}
          </div>
        )}

        {q.type === 'text' && (
          <div>
            <textarea
              value={typeof value === 'string' ? value : ''}
              maxLength={TEXT_MAX}
              onChange={(e) => set(e.target.value || undefined)}
              rows={3}
              placeholder="Type your answer…"
              className="w-full resize-none rounded-xl border border-[#DCE2EE] bg-white px-3 py-2 text-[12.5px] text-ink placeholder:text-muted focus:border-primary focus:outline-none"
            />
            <p className="text-right text-[10px] text-muted tabular">
              {typeof value === 'string' ? value.length : 0}/{TEXT_MAX}
            </p>
          </div>
        )}
      </div>
      {missing && <p className="mt-2 text-[11px] font-medium text-danger">Please answer this question</p>}
    </div>
  );
}
