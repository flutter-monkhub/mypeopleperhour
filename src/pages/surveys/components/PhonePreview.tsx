// Live preview of a survey inside a phone frame — "All questions" (scroll) or "One per page"
// (how the questionnaire actually runs in the app, with progress). Answers are local only.

import { useEffect, useMemo, useRef, useState } from 'react';
import { BatteryFull, ChevronLeft, ClipboardList, Clock3, Lock, Signal, Wifi } from 'lucide-react';
import type { AnswerValue, Survey } from '@shared/types';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { Tabs, toast } from '@/components/ui';
import { QuestionPreview } from './QuestionPreview';

type Mode = 'paged' | 'list';

export interface PhonePreviewProps {
  survey: Pick<Survey, 'title' | 'description' | 'anonymous' | 'dueDate' | 'questions'>;
  /** Question selected in the editor — the preview follows it */
  activeId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
}

const isEmpty = (v: AnswerValue | undefined) => v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

export function PhonePreview({ survey, activeId, onSelect, className }: PhonePreviewProps) {
  const [mode, setMode] = useState<Mode>('paged');
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [page, setPage] = useState(0);
  const [tried, setTried] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const qs = survey.questions;
  const total = qs.length;
  const minutes = Math.max(1, Math.round(total * 0.3));

  // Follow the editor's selection
  const activeIndex = useMemo(() => qs.findIndex((q) => q.id === activeId), [qs, activeId]);
  const [followed, setFollowed] = useState<string | null | undefined>(activeId);
  if (followed !== activeId) {
    setFollowed(activeId);
    if (activeIndex >= 0) setPage(activeIndex);
  }
  const current = Math.min(page, Math.max(0, total - 1));
  useEffect(() => {
    if (mode !== 'list' || !activeId) return;
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-qid="${CSS.escape(activeId)}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeId, mode]);

  const answeredCount = qs.filter((q) => !isEmpty(answers[q.id])).length;
  const requiredMissing = qs.filter((q) => q.required && isEmpty(answers[q.id]));
  const setAnswer = (id: string, v: AnswerValue | undefined) =>
    setAnswers((a) => {
      const next = { ...a };
      if (v === undefined) delete next[id];
      else next[id] = v;
      return next;
    });

  const submit = () => {
    setTried(true);
    if (requiredMissing.length) {
      const i = qs.indexOf(requiredMissing[0]);
      setPage(i);
      return;
    }
    toast.info('Preview only', 'In the app this would submit the response. Nothing was saved.');
    setAnswers({});
    setTried(false);
    setPage(0);
  };

  const header = (
    <div className="rounded-2xl bg-white p-3.5 shadow-[0_1px_2px_rgba(15,23,42,.04)]">
      <div className="flex items-start gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <ClipboardList className="size-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] leading-snug font-bold text-ink">{survey.title.trim() || <span className="text-muted italic">Survey title</span>}</p>
          <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-ink-2">
            <Clock3 className="size-3" /> ~{minutes} min · Due {formatDate(survey.dueDate)}
          </p>
        </div>
      </div>
      {survey.description.trim() && <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-2">{survey.description}</p>}
      {survey.anonymous && (
        <p className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-success-soft px-2.5 py-2 text-[10.5px] leading-snug text-[#15803D]">
          <Lock className="mt-px size-3 shrink-0" />
          Your responses are confidential and reported only in aggregate.
        </p>
      )}
    </div>
  );

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <Tabs<Mode>
        variant="segmented"
        value={mode}
        onChange={setMode}
        tabs={[
          { id: 'paged', label: 'One per page' },
          { id: 'list', label: 'All questions' },
        ]}
      />
      <div className="w-[330px] rounded-[44px] bg-[#0B1433] p-[9px] shadow-[0_18px_50px_rgba(15,23,42,.22)] ring-1 ring-black/10" aria-label="Mobile preview">
        <div className="relative flex h-[650px] flex-col overflow-hidden rounded-[36px] bg-[#F4F6FB]">
          {/* status bar */}
          <div className="flex h-9 shrink-0 items-center justify-between px-6 pt-1 text-[11px] font-semibold text-ink">
            <span className="tabular">9:41</span>
            <span className="absolute top-2 left-1/2 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-[#0B1433]" aria-hidden />
            <span className="flex items-center gap-1">
              <Signal className="size-3" strokeWidth={2.5} />
              <Wifi className="size-3" strokeWidth={2.5} />
              <BatteryFull className="size-3.5" strokeWidth={2} />
            </span>
          </div>
          {/* app bar */}
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[#E6EAF2] bg-white px-3">
            <ChevronLeft className="size-5 text-ink" />
            <p className="flex-1 truncate text-[14px] font-semibold text-ink">{mode === 'paged' && total ? `Question ${current + 1} of ${total}` : 'Survey'}</p>
            <span className="text-[11px] font-medium text-ink-2 tabular">
              {answeredCount}/{total}
            </span>
          </div>
          {mode === 'paged' && total > 0 && (
            <div className="h-1 shrink-0 bg-[#E6EAF2]">
              <div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${((current + 1) / total) * 100}%` }} />
            </div>
          )}

          <div ref={scrollRef} className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3">
            {(mode === 'list' || current === 0) && header}
            {total === 0 ? (
              <div className="grid flex-1 place-items-center px-6 text-center text-[12px] text-muted">Questions you add will appear here exactly as employees see them.</div>
            ) : mode === 'list' ? (
              qs.map((q, i) => (
                <div key={q.id} data-qid={q.id}>
                  <QuestionPreview question={q} number={i + 1} total={total} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} active={q.id === activeId} showError={tried} onFocus={() => onSelect?.(q.id)} />
                </div>
              ))
            ) : (
              <QuestionPreview
                key={qs[current].id}
                question={qs[current]}
                number={current + 1}
                total={total}
                value={answers[qs[current].id]}
                onChange={(v) => setAnswer(qs[current].id, v)}
                showError={tried}
                onFocus={() => onSelect?.(qs[current].id)}
              />
            )}
          </div>

          {/* bottom actions */}
          <div className="shrink-0 border-t border-[#E6EAF2] bg-white px-3 pt-2.5 pb-5">
            {mode === 'paged' && total > 0 ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={current === 0}
                  onClick={() => {
                    setPage(current - 1);
                    onSelect?.(qs[current - 1].id);
                  }}
                  className="h-10 flex-1 rounded-xl border border-[#DCE2EE] text-[13px] font-semibold text-ink disabled:opacity-40"
                >
                  Back
                </button>
                {current < total - 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const q = qs[current];
                      if (q.required && isEmpty(answers[q.id])) return setTried(true);
                      setTried(false);
                      setPage(current + 1);
                      onSelect?.(qs[current + 1].id);
                    }}
                    className="h-10 flex-[2] rounded-xl bg-primary text-[13px] font-semibold text-white"
                  >
                    Next
                  </button>
                ) : (
                  <button type="button" onClick={submit} className="h-10 flex-[2] rounded-xl bg-primary text-[13px] font-semibold text-white">
                    Submit
                  </button>
                )}
              </div>
            ) : (
              <button type="button" onClick={submit} disabled={!total} className="h-10 w-full rounded-xl bg-primary text-[13px] font-semibold text-white disabled:opacity-40">
                Submit response
              </button>
            )}
            <div className="mx-auto mt-3 h-1 w-28 rounded-full bg-[#0B1433]/80" aria-hidden />
          </div>
        </div>
      </div>
      <p className="max-w-[300px] text-center text-xs text-ink-2">Try it — answers here are only a preview and are never saved.</p>
    </div>
  );
}
