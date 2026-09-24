// Survey builder — /surveys/new and /surveys/:id (SPEC A23–A26).
//
// Local form state, saved explicitly (Save draft / Save changes). Question list with inline editing,
// reorder, duplicate, delete and a live mobile preview. Lifecycle rules:
//   • draft            → everything editable; Publish validates first.
//   • live, 0 answers  → editable (changes reach employees on save); Unpublish allowed.
//   • live, answers    → questions + setup locked; description & due date only; Close instead of Unpublish.
//   • closed / no surveys.edit → read-only.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useNavigate, useParams } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  CircleCheck,
  CircleDashed,
  ClipboardList,
  Copy,
  Eye,
  FileQuestion,
  Lock,
  MoreHorizontal,
  Save,
  Send,
  Trash2,
  Undo2,
  Users,
  CircleX,
} from 'lucide-react';
import type { ID, Survey, SurveyKind, SurveyQuestion } from '@shared/types';
import { addDays, fiscalQuarter } from '@shared/utils/dates';
import { surveyAudience, surveyStats } from '@/lib/analytics-pulse';
import { cn } from '@/lib/cn';
import { formatDate, formatNumber, pluralize, timeAgo } from '@/lib/format';
import { useCan } from '@/lib/rbac';
import {
  createSurvey,
  currentSurveyPeriod,
  duplicateSurveyQuestion,
  newSurveyQuestion,
  publishSurvey,
  reorderSurveyItem,
  surveyDueIso,
  surveyIssues,
  updateSurvey,
  type SurveyFields,
  type SurveyIssue,
} from '@/store/actions';
import { getDb, useDb } from '@/store/db';
import { PageHeader } from '@/components/layout';
import {
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  DropdownMenu,
  EmptyState,
  Input,
  LinkButton,
  Select,
  StatusBadge,
  Tabs,
  Textarea,
  Toggle,
  confirm,
  toast,
  type MenuItem,
} from '@/components/ui';
import { AnonymityBadge, KIND_META, audienceLabel, toDateInput } from './components/meta';
import { PhonePreview } from './components/PhonePreview';
import { AddQuestionButton, QuestionEditor, TypeGrid } from './components/QuestionEditor';
import { useSurveyLifecycle } from './components/useSurveyLifecycle';

interface Form extends SurveyFields {
  audienceMode: 'all' | 'units';
}

const toForm = (s: Survey | undefined): Form =>
  s
    ? {
        title: s.title,
        description: s.description,
        kind: s.kind,
        period: s.period,
        dueDate: s.dueDate,
        audienceUnitIds: [...s.audienceUnitIds],
        anonymous: s.anonymous,
        questions: s.questions,
        audienceMode: s.audienceUnitIds.length ? 'units' : 'all',
      }
    : {
        title: '',
        description: '',
        kind: 'adhoc',
        period: currentSurveyPeriod(),
        dueDate: surveyDueIso(addDays(new Date(), 14)),
        audienceUnitIds: [],
        anonymous: true,
        questions: [],
        audienceMode: 'all',
      };

const fieldsOf = (f: Form): SurveyFields => ({
  title: f.title.trim(),
  description: f.description.trim(),
  kind: f.kind,
  period: f.period.trim(),
  dueDate: f.dueDate,
  audienceUnitIds: f.audienceMode === 'all' ? [] : f.audienceUnitIds,
  anonymous: f.anonymous,
  questions: f.questions.map((q) => ({ ...q, text: q.text.trim(), helpText: q.helpText?.trim() || undefined, options: q.options?.map((o) => o.trim()) })),
});

const same = (a: SurveyFields, b: SurveyFields) => JSON.stringify(a) === JSON.stringify(b);

/** Upcoming quarter labels for the period field. */
function periodSuggestions(now = new Date()): string[] {
  const out: string[] = [];
  let d = new Date(now);
  for (let i = 0; i < 4; i++) {
    const q = fiscalQuarter(d);
    out.push(q.label);
    d = addDays(q.end, 1);
  }
  return out;
}

export default function SurveyBuilderPage() {
  const { id } = useParams();
  const db = useDb();
  const survey = id ? db.surveys.find((s) => s.id === id) : undefined;
  if (id && !survey)
    return (
      <>
        <PageHeader backTo="/surveys" backLabel="All surveys" title="Survey not found" />
        <Card>
          <EmptyState
            icon={FileQuestion}
            title="This survey doesn’t exist"
            message="It may have been a draft that was deleted, or the link is incomplete."
            action={
              <LinkButton to="/surveys" variant="secondary">
                Back to surveys
              </LinkButton>
            }
          />
        </Card>
      </>
    );
  return <Builder key={survey?.id ?? 'new'} survey={survey} />;
}

function Builder({ survey }: { survey: Survey | undefined }) {
  const db = useDb();
  const navigate = useNavigate();
  const canEdit = useCan('surveys.edit');
  const lifecycle = useSurveyLifecycle();
  const [form, setForm] = useState<Form>(() => toForm(survey));
  const [expanded, setExpanded] = useState<ID | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  const isNew = !survey;
  const status = survey?.status ?? 'draft';
  const stats = survey ? surveyStats(db, survey) : null;
  const started = stats ? stats.submitted + stats.drafts : 0;
  const readOnly = !canEdit || status === 'closed';
  const locked = readOnly || started > 0;
  const fields = useMemo(() => fieldsOf(form), [form]);
  const saved = useMemo(() => (survey ? fieldsOf(toForm(survey)) : null), [survey]);
  const dirty = !readOnly && (saved ? !same(fields, saved) : !!(fields.title || fields.description || fields.questions.length));

  const issues = useMemo(() => surveyIssues(fields, { specificAudience: form.audienceMode === 'units' }), [fields, form.audienceMode]);
  const issuesBy = (field: string) => issues.filter((i) => i.field === field).map((i) => i.message);
  const audienceCount = surveyAudience(db, { id: survey?.id ?? 'new', kind: fields.kind, audienceUnitIds: fields.audienceUnitIds }).length;

  // ── unsaved changes guard ──
  // Navigations we trigger ourselves (after create / delete) carry `state.skipGuard`.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => dirty && !(nextLocation.state as { skipGuard?: boolean } | null)?.skipGuard && currentLocation.pathname !== nextLocation.pathname,
  );
  const asking = useRef(false);
  useEffect(() => {
    if (blocker.state !== 'blocked' || asking.current) return;
    asking.current = true;
    void confirm({ title: 'Discard unsaved changes?', message: 'You have changes that haven’t been saved. Leave this page and lose them?', confirmLabel: 'Discard changes', tone: 'danger' }).then((ok) => {
      asking.current = false;
      if (ok) blocker.proceed();
      else blocker.reset();
    });
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [dirty]);

  // ── form helpers ──
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setQuestions = (fn: (qs: SurveyQuestion[]) => SurveyQuestion[]) => setForm((f) => ({ ...f, questions: fn(f.questions) }));
  const addQuestion = (q: SurveyQuestion, after?: number) => {
    setQuestions((qs) => (after == null ? [...qs, q] : [...qs.slice(0, after + 1), q, ...qs.slice(after + 1)]));
    setExpanded(q.id);
  };
  const deleteQuestion = async (q: SurveyQuestion, i: number) => {
    if (q.text.trim()) {
      const ok = await confirm({ title: `Delete question ${i + 1}?`, message: `“${q.text.trim()}” will be removed from this survey.`, confirmLabel: 'Delete question', tone: 'danger' });
      if (!ok) return;
    }
    setQuestions((qs) => qs.filter((x) => x.id !== q.id));
    if (expanded === q.id) setExpanded(null);
  };
  const copyFrom = (src: Survey) => {
    setQuestions((qs) => [...qs, ...src.questions.map(duplicateSurveyQuestion)]);
    if (!form.title.trim() && src.kind === 'pulse') setForm((f) => ({ ...f, kind: 'pulse', title: `Quarterly Pulse · ${f.period}`, anonymous: true }));
    toast.success(`${pluralize(src.questions.length, 'question')} copied`, `From “${src.title}”`);
  };

  // ── save / publish ──
  const persist = (): Survey | null => {
    if (isNew) {
      const s = createSurvey(fields);
      navigate(`/surveys/${s.id}`, { replace: true, state: { skipGuard: true } });
      return s;
    }
    updateSurvey(survey!.id, fields);
    return getDb().surveys.find((s) => s.id === survey!.id) ?? null;
  };

  const save = () => {
    // A live survey must stay valid; drafts can be saved half-finished.
    if (status === 'published') {
      const blocking = locked ? issues.filter((i) => i.field === 'dueDate') : issues;
      if (blocking.length) {
        setAttempted(true);
        toast.error('Can’t save yet', blocking[0].message);
        return;
      }
    } else if (!fields.dueDate || Number.isNaN(new Date(fields.dueDate).getTime())) {
      toast.error('Set a due date');
      return;
    }
    setSaving(true);
    const s = persist();
    setSaving(false);
    if (s) toast.success(status === 'published' ? 'Changes saved' : 'Draft saved', status === 'published' ? 'Live for employees now.' : s.title || 'Untitled survey');
  };

  const publish = async () => {
    setAttempted(true);
    if (issues.length) {
      const q = form.questions.find((x) => issues.some((i) => i.field === x.id));
      if (q) setExpanded(q.id);
      toast.error(`Fix ${pluralize(issues.length, 'issue')} before publishing`, issues[0].message);
      return;
    }
    if (!(await lifecycle.confirmPublish({ id: survey?.id ?? 'new', ...fields }))) return;
    const s = persist();
    if (!s) return;
    try {
      const { notified } = publishSurvey(s.id);
      toast.success('Survey published', notified ? `${formatNumber(notified)} employees notified in the app.` : 'It is now live.');
    } catch (e) {
      toast.error('Could not publish', e instanceof Error ? e.message : String(e));
    }
  };

  const discard = async () => {
    if (!(await confirm({ title: 'Discard unsaved changes?', message: 'The survey goes back to its last saved version.', confirmLabel: 'Discard changes', tone: 'danger' }))) return;
    setForm(toForm(survey));
    setAttempted(false);
  };

  // ── header ──
  const deleteDraft = (s: Survey) => lifecycle.remove(s, { thenGoTo: '/surveys' });
  const more: MenuItem[] = survey
    ? [
        ...(canEdit ? [{ label: 'Duplicate as new draft', icon: Copy, onClick: () => lifecycle.duplicate(survey, { open: true }) }] : []),
        ...(canEdit && status === 'published' ? [{ label: 'Unpublish', icon: Undo2, onClick: () => void lifecycle.unpublish(survey), divider: true }] : []),
        ...(canEdit && status === 'published' ? [{ label: 'Close survey', icon: CircleX, tone: 'danger' as const, onClick: () => void lifecycle.close(survey) }] : []),
        ...(canEdit && status === 'draft' ? [{ label: 'Delete draft', icon: Trash2, tone: 'danger' as const, divider: true, onClick: () => void deleteDraft(survey) }] : []),
      ]
    : [];

  const actions = (
    <>
      {dirty && !isNew && (
        <Button variant="ghost" onClick={() => void discard()}>
          Discard
        </Button>
      )}
      {!readOnly && status === 'draft' && (
        <Button variant="secondary" icon={Save} onClick={save} loading={saving} disabled={!dirty && !isNew}>
          Save draft
        </Button>
      )}
      {!readOnly && status === 'published' && (
        <Button variant="secondary" icon={Save} onClick={save} disabled={!dirty}>
          Save changes
        </Button>
      )}
      {!readOnly && status === 'draft' && (
        <Button icon={Send} onClick={() => void publish()}>
          Publish
        </Button>
      )}
      {status !== 'draft' && survey && (
        <LinkButton to={`/surveys/${survey.id}/responses`} variant={readOnly ? 'primary' : 'secondary'} icon={BarChart3}>
          View responses
        </LinkButton>
      )}
      {more.length > 0 && (
        <DropdownMenu
          items={more}
          width="w-56"
          trigger={(p) => <Button {...p} variant="secondary" iconOnly icon={MoreHorizontal} aria-label="More actions" />}
        />
      )}
    </>
  );

  const units = db.units;
  const suggestions = periodSuggestions();
  const copySources = db.surveys.filter((s) => s.id !== survey?.id && s.questions.length).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const copyMenu: MenuItem[] = copySources.slice(0, 8).map((s) => ({ label: s.title, hint: `${s.questions.length} q`, icon: KIND_META[s.kind].icon, onClick: () => copyFrom(s) }));
  const dueErr = (attempted || fields.dueDate !== saved?.dueDate) && issuesBy('dueDate')[0];

  return (
    <>
      <PageHeader
        backTo="/surveys"
        backLabel="All surveys"
        eyebrow={`${KIND_META[form.kind].label} survey · ${form.period || '—'}`}
        title={form.title.trim() || (isNew ? 'New survey' : 'Untitled survey')}
        meta={
          <>
            <StatusBadge status={status} kind="survey" />
            <AnonymityBadge anonymous={form.anonymous} />
            {survey && stats && status !== 'draft' && (
              <Badge tone="outline" icon={Users}>
                {formatNumber(stats.submitted)} responses
              </Badge>
            )}
            {dirty ? (
              <Badge tone="warning" dot>
                Unsaved changes
              </Badge>
            ) : survey ? (
              <span className="text-xs text-ink-2">
                {status === 'draft' ? `Created ${timeAgo(survey.createdAt)}` : status === 'published' ? `Published ${formatDate(survey.publishedAt ?? survey.createdAt)}` : `Closed ${formatDate(survey.closedAt ?? survey.dueDate)}`}
              </span>
            ) : null}
          </>
        }
        actions={actions}
      />

      <div className="mb-6 flex flex-col gap-3 empty:hidden">
        {!canEdit && (
          <Callout tone="neutral" icon={Eye} title="View only">
            You can see how this survey is set up and preview it, but only programme admins can change surveys.
          </Callout>
        )}
        {canEdit && status === 'closed' && survey && (
          <Callout
            tone="neutral"
            icon={Lock}
            title={`Closed on ${formatDate(survey.closedAt ?? survey.dueDate)}`}
            action={
              <Button size="sm" variant="secondary" icon={Copy} onClick={() => lifecycle.duplicate(survey, { open: true })}>
                Duplicate as new draft
              </Button>
            }
          >
            Kept read-only so results stay comparable. Duplicate it to run it again.
          </Callout>
        )}
        {canEdit && status === 'published' && started > 0 && survey && (
          <Callout
            tone="warning"
            icon={Lock}
            title={`Questions are locked — ${pluralize(started, 'employee has', 'employees have')} already responded`}
            action={
              <Button size="sm" variant="secondary" icon={Copy} onClick={() => lifecycle.duplicate(survey, { open: true })}>
                Duplicate to change questions
              </Button>
            }
          >
            Changing questions now would mix answers to different versions. You can still update the description and due date.
          </Callout>
        )}
        {canEdit && status === 'published' && started === 0 && (
          <Callout tone="info" title="Live — nobody has responded yet">
            Saved changes reach employees straight away. Unpublish from the ⋯ menu to take it offline while you work on it.
          </Callout>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_372px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* ── details ── */}
          <Card>
            <CardHeader title="Survey details" subtitle="What employees see at the top of the survey, and who receives it." icon={ClipboardList} />
            <div className="flex flex-col gap-4">
              <Input
                label="Title"
                required
                maxLength={90}
                value={form.title}
                disabled={locked}
                placeholder="e.g. Quarterly Pulse · Q3 FY27"
                error={attempted ? issuesBy('title')[0] : undefined}
                onChange={(e) => set('title', e.target.value)}
                autoFocus={isNew}
              />
              <Textarea
                label="Description"
                rows={3}
                maxLength={300}
                value={form.description}
                disabled={readOnly}
                placeholder="Why you are asking and how long it takes. e.g. A quick check on how supported you feel. Takes about 3 minutes."
                onChange={(e) => set('description', e.target.value)}
              />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Select
                  label="Kind"
                  value={form.kind}
                  disabled={locked}
                  options={(Object.keys(KIND_META) as SurveyKind[]).map((k) => ({ value: k, label: KIND_META[k].label }))}
                  onValueChange={(v) => set('kind', v as SurveyKind)}
                  hint={KIND_META[form.kind].description}
                />
                <div>
                  <Input label="Period" list="survey-periods" maxLength={24} value={form.period} disabled={locked} placeholder={currentSurveyPeriod()} onChange={(e) => set('period', e.target.value)} hint="Financial-year quarter, e.g. Q2 FY27" />
                  <datalist id="survey-periods">
                    {suggestions.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
                <Input
                  label="Due date"
                  type="date"
                  required
                  value={toDateInput(form.dueDate)}
                  min={toDateInput(new Date().toISOString())}
                  disabled={readOnly}
                  error={dueErr || undefined}
                  hint={!dueErr ? 'Responses close at the end of this day' : undefined}
                  onChange={(e) => {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    if (y && m && d) set('dueDate', surveyDueIso(new Date(y, m - 1, d)));
                  }}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 border-t border-line pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
                <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px] font-medium text-ink">Audience</p>
                    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
                      <Users className="size-3.5" /> {pluralize(audienceCount, 'employee')}
                      {form.kind === 'mentoring' ? ' (active mentees)' : ''}
                    </span>
                  </div>
                  <Tabs<'all' | 'units'>
                    variant="segmented"
                    value={form.audienceMode}
                    onChange={(v) => !locked && set('audienceMode', v)}
                    tabs={[
                      { id: 'all', label: 'All units', disabled: locked && form.audienceMode !== 'all' },
                      { id: 'units', label: 'Specific units', disabled: locked && form.audienceMode !== 'units' },
                    ]}
                  />
                  {form.audienceMode === 'units' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {units.map((u) => {
                        const on = form.audienceUnitIds.includes(u.id);
                        return (
                          <button
                            key={u.id}
                            type="button"
                            disabled={locked}
                            aria-pressed={on}
                            onClick={() => set('audienceUnitIds', on ? form.audienceUnitIds.filter((x) => x !== u.id) : [...form.audienceUnitIds, u.id])}
                            className={cn(
                              'inline-flex h-8.5 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                              on ? 'border-primary bg-primary-soft text-primary' : 'border-line-strong bg-white text-ink-2 hover:text-ink',
                            )}
                          >
                            {on ? <CircleCheck className="size-3.5" /> : <Building2 className="size-3.5" />}
                            {u.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {attempted && issuesBy('audience')[0] && <p className="mt-2 text-xs font-medium text-danger">{issuesBy('audience')[0]}</p>}
                </div>
                <div className="rounded-xl bg-canvas p-3.5">
                  <Toggle
                    checked={form.anonymous}
                    disabled={locked}
                    onChange={(v) => set('anonymous', v)}
                    label="Anonymous responses"
                    description={form.anonymous ? 'Results are shown only in aggregate (groups of 5+). Names are never shown to admins.' : 'Admins can see who answered what. Use for programme check-ins only.'}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* ── questions ── */}
          <Card padding="none">
            <CardHeader
              divider
              title={
                <span className="inline-flex items-center gap-2">
                  Questions <span className="rounded-full bg-neutral-soft px-2 py-px text-xs font-semibold text-ink-2 tabular">{form.questions.length}</span>
                </span>
              }
              subtitle={locked ? 'Locked — shown as employees see them.' : 'Click a question to edit it. Use the arrows to reorder.'}
              actions={
                !locked && form.questions.length > 0 ? (
                  <>
                    {copyMenu.length > 0 && (
                      <DropdownMenu
                        width="w-80"
                        items={copyMenu}
                        header={<p className="text-xs font-semibold tracking-wide text-ink-2 uppercase">Copy questions from</p>}
                        trigger={(p) => (
                          <Button {...p} variant="ghost" size="sm" icon={Copy}>
                            <span className="hidden sm:inline">Copy from…</span>
                          </Button>
                        )}
                      />
                    )}
                    <AddQuestionButton onPick={(t) => addQuestion(newSurveyQuestion(t))} />
                  </>
                ) : undefined
              }
            />
            <div className="flex flex-col gap-2.5 p-4">
              {form.questions.length === 0 ? (
                locked ? (
                  <EmptyState icon={FileQuestion} title="No questions" message="This survey has no questions." size="sm" />
                ) : (
                  <div className="py-4">
                    <div className="mx-auto mb-5 max-w-md text-center">
                      <p className="text-[15px] font-semibold text-ink">Add your first question</p>
                      <p className="mt-1 text-sm text-ink-2">Pick a type — you can change it later. Every type previews live on the right.</p>
                    </div>
                    <TypeGrid onPick={(t) => addQuestion(newSurveyQuestion(t))} />
                    {copyMenu.length > 0 && (
                      <div className="mt-5 flex items-center justify-center gap-2 text-sm text-ink-2">
                        or
                        <DropdownMenu
                          align="start"
                          width="w-80"
                          items={copyMenu}
                          header={<p className="text-xs font-semibold tracking-wide text-ink-2 uppercase">Copy questions from</p>}
                          trigger={(p) => (
                            <Button {...p} variant="link" size="sm" icon={Copy}>
                              copy questions from an existing survey
                            </Button>
                          )}
                        />
                      </div>
                    )}
                  </div>
                )
              ) : (
                form.questions.map((q, i) => (
                  <QuestionEditor
                    key={q.id}
                    q={q}
                    index={i}
                    count={form.questions.length}
                    expanded={expanded === q.id}
                    onToggle={() => setExpanded(expanded === q.id ? null : q.id)}
                    onChange={(nq) => setQuestions((qs) => qs.map((x) => (x.id === q.id ? nq : x)))}
                    onMove={(d) => setQuestions((qs) => reorderSurveyItem(qs, i, d))}
                    onDuplicate={() => addQuestion(duplicateSurveyQuestion(q), i)}
                    onDelete={() => void deleteQuestion(q, i)}
                    readOnly={locked}
                    issues={issuesBy(q.id)}
                    forceIssues={attempted}
                  />
                ))
              )}
              {!locked && form.questions.length > 0 && (
                <div className="flex justify-center pt-1">
                  <AddQuestionButton variant="outline" align="start" onPick={(t) => addQuestion(newSurveyQuestion(t))} label="Add another question" />
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── preview + readiness ── */}
        <div className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
          <Card padding="sm">
            <CardHeader title="Live preview" subtitle="Exactly as employees see it in the app." icon={Eye} className="mb-3" />
            <PhonePreview survey={fields} activeId={expanded} onSelect={(qid) => !locked && setExpanded(qid)} />
          </Card>
          {!readOnly && status === 'draft' && <Readiness issues={issues} fields={fields} audienceText={audienceLabel(db, fields)} onPublish={() => void publish()} />}
        </div>
      </div>
    </>
  );
}

function Readiness({ issues, fields, audienceText, onPublish }: { issues: SurveyIssue[]; fields: SurveyFields; audienceText: string; onPublish: () => void }) {
  const has = (pred: (i: SurveyIssue) => boolean) => !issues.some(pred);
  const qIds = new Set(fields.questions.map((q) => q.id));
  const checks = [
    { ok: has((i) => i.field === 'title'), label: 'Title' },
    { ok: fields.questions.length > 0, label: fields.questions.length ? `${pluralize(fields.questions.length, 'question')}` : 'At least one question' },
    { ok: has((i) => qIds.has(i.field) && /text/.test(i.message)), label: 'Every question has text' },
    { ok: has((i) => qIds.has(i.field) && /option/.test(i.message)), label: 'Choice questions have 2+ distinct options' },
    { ok: has((i) => i.field === 'dueDate'), label: `Due date in the future (${formatDate(fields.dueDate)})` },
    { ok: has((i) => i.field === 'audience'), label: `Audience: ${audienceText}` },
  ];
  const ready = issues.length === 0;
  return (
    <Card padding="sm">
      <p className="mb-3 flex items-center justify-between text-[15px] font-semibold text-ink">
        Ready to publish?
        {ready ? (
          <Badge tone="success" dot>
            Ready
          </Badge>
        ) : (
          <Badge tone="warning" dot>
            {pluralize(issues.length, 'issue')}
          </Badge>
        )}
      </p>
      <ul className="flex flex-col gap-2 text-[13px]">
        {checks.map((c) => (
          <li key={c.label} className={cn('flex items-start gap-2', c.ok ? 'text-ink' : 'text-ink-2')}>
            {c.ok ? <CircleCheck className="mt-px size-4 shrink-0 text-success" /> : <CircleDashed className="mt-px size-4 shrink-0 text-warning" />}
            <span className="min-w-0">{c.label}</span>
          </li>
        ))}
      </ul>
      <Button className="mt-4" fullWidth icon={Send} onClick={onPublish} disabled={!ready}>
        Publish survey
      </Button>
    </Card>
  );
}
