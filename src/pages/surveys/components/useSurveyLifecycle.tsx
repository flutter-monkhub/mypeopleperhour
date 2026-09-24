// Publish / unpublish / close / duplicate / delete flows with confirmations + toasts (SPEC A26).
// Shared by the survey list, the builder and the responses page so the wording is identical everywhere.

import { useNavigate } from 'react-router-dom';
import type { Survey } from '@shared/types';
import { surveyAudience, surveyStats } from '@/lib/analytics-pulse';
import { formatDate, formatNumber, pluralize } from '@/lib/format';
import { closeSurvey, deleteSurvey, duplicateSurvey, publishSurvey, surveyIssues, unpublishSurvey } from '@/store/actions';
import { getDb } from '@/store/db';
import { confirm, toast } from '@/components/ui';
import { audienceLabel } from './meta';

export function useSurveyLifecycle() {
  const navigate = useNavigate();

  /** Confirmation for going live. Returns true when the admin confirmed. */
  const confirmPublish = (s: Pick<Survey, 'id' | 'title' | 'kind' | 'audienceUnitIds' | 'dueDate' | 'anonymous' | 'questions'>) => {
    const db = getDb();
    const people = surveyAudience(db, s).length;
    return confirm({
      title: `Publish “${s.title.trim() || 'Untitled survey'}”?`,
      message: (
        <div className="flex flex-col gap-2">
          <p>
            It goes live for <strong className="text-ink">{pluralize(people, 'employee')}</strong> ({audienceLabel(db, s)}), who will be notified in the MyPeopleHour app.
          </p>
          <p>
            {pluralize(s.questions.length, 'question')} · {s.anonymous ? 'anonymous' : 'named'} · responses until <strong className="text-ink">{formatDate(s.dueDate)}</strong>.
          </p>
          <p className="text-xs text-muted">Once someone responds, questions are locked — you can still change the description and due date.</p>
        </div>
      ),
      confirmLabel: 'Publish survey',
    });
  };

  /** Publish from anywhere (validates first; offers the builder when something is missing). */
  const publish = async (s: Survey) => {
    const issues = surveyIssues(s);
    if (issues.length) {
      const fix = await confirm({
        title: 'Not ready to publish',
        message: (
          <ul className="list-disc space-y-1 pl-5">
            {issues.slice(0, 6).map((i) => (
              <li key={i.field + i.message}>{i.message}</li>
            ))}
          </ul>
        ),
        confirmLabel: 'Open in builder',
      });
      if (fix) navigate(`/surveys/${s.id}`);
      return false;
    }
    if (!(await confirmPublish(s))) return false;
    try {
      const { notified } = publishSurvey(s.id);
      toast.success('Survey published', notified ? `${formatNumber(notified)} employees notified in the app.` : 'It is now live.');
      return true;
    } catch (e) {
      toast.error('Could not publish', e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  const close = async (s: Survey) => {
    const st = surveyStats(getDb(), s);
    const ok = await confirm({
      title: `Close “${s.title}”?`,
      message: (
        <>
          Employees can no longer respond. {pluralize(st.submitted, 'submitted response')} {st.submitted === 1 ? 'is' : 'are'} kept for analysis
          {st.drafts ? `; ${pluralize(st.drafts, 'unfinished draft')} won’t be counted` : ''}. This can’t be undone.
        </>
      ),
      confirmLabel: 'Close survey',
      tone: 'danger',
    });
    if (!ok) return false;
    closeSurvey(s.id);
    toast.success('Survey closed', `${s.title} is no longer accepting responses.`);
    return true;
  };

  const unpublish = async (s: Survey) => {
    const st = surveyStats(getDb(), s);
    const started = st.submitted + st.drafts;
    if (started > 0) {
      const ok = await confirm({
        title: 'This survey already has responses',
        message: `${pluralize(started, 'employee')} ${started === 1 ? 'has' : 'have'} started or submitted it, so it can’t go back to draft. Close it instead to stop new responses and keep the results.`,
        confirmLabel: 'Close survey instead',
      });
      return ok ? close(s) : false;
    }
    const ok = await confirm({
      title: `Unpublish “${s.title}”?`,
      message: 'It moves back to draft and disappears from the employee app until you publish it again. Nobody has responded yet.',
      confirmLabel: 'Move to draft',
    });
    if (!ok) return false;
    unpublishSurvey(s.id);
    toast.success('Moved back to draft', s.title);
    return true;
  };

  const duplicate = (s: Survey, opts: { open?: boolean } = {}) => {
    const copy = duplicateSurvey(s.id);
    if (opts.open) {
      navigate(`/surveys/${copy.id}`);
      toast.success('Draft copy created', 'You are now editing the copy.');
    } else toast.show({ tone: 'success', title: 'Draft copy created', message: copy.title, action: { label: 'Open copy', onClick: () => navigate(`/surveys/${copy.id}`) } });
    return copy;
  };

  const remove = async (s: Survey, opts: { thenGoTo?: string } = {}) => {
    const ok = await confirm({ title: `Delete draft “${s.title || 'Untitled survey'}”?`, message: 'The draft and its questions are deleted permanently.', confirmLabel: 'Delete draft', tone: 'danger' });
    if (!ok) return false;
    deleteSurvey(s.id);
    toast.success('Draft deleted', s.title || 'Untitled survey');
    if (opts.thenGoTo) navigate(opts.thenGoTo, { replace: true, state: { skipGuard: true } });
    return true;
  };

  return { confirmPublish, publish, close, unpublish, duplicate, remove };
}
