// The one-page application rendered like a document: the five sections from the programme deck,
// with rule validation for each preferred mentor (A32).

import type { ReactNode } from 'react';
import { CircleCheck, CircleX, FileText } from 'lucide-react';
import type { DemoDatabase, MenteeApplication } from '@shared/types';
import { APPLICATION_SECTIONS } from '@shared/content/mentoring';
import type { RuleResult } from '@shared/logic';
import { cn } from '@/lib/cn';
import { formatDate } from '@/lib/format';
import { employeeName, functionName, unitName } from '@/lib/lookup';
import { preferredMentorChecks } from '@/lib/analytics-mentoring';
import { Avatar, Badge, Card } from '@/components/ui';
import { CapacityMeter } from './CapacityMeter';
import { StyleChips } from './bits';

const SECTION = new Map(APPLICATION_SECTIONS.map((s) => [s.id, s]));

function Section({ id, children, className }: { id: (typeof APPLICATION_SECTIONS)[number]['id']; children: ReactNode; className?: string }) {
  const s = SECTION.get(id)!;
  return (
    <section className={cn('grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 border-t border-line pt-5', className)}>
      <span className="grid size-7 place-items-center rounded-full bg-mentor-soft text-[13px] font-bold text-mentor">{s.number}</span>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-ink">{s.title}</h3>
        <div className="mt-2">{children}</div>
      </div>
    </section>
  );
}

function Prose({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed whitespace-pre-line text-ink">{children}</p>;
}

const RULE_SHORT: Record<RuleResult['id'], string> = { cross_functional: 'Cross-functional', capacity: 'Capacity', reporting: 'Reporting line' };

function RulePill({ r }: { r: RuleResult }) {
  return (
    <span
      title={r.message}
      className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-semibold', r.ok ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger')}
    >
      {r.ok ? <CircleCheck className="size-3.5" /> : <CircleX className="size-3.5" />}
      {RULE_SHORT[r.id]}
    </span>
  );
}

export function ApplicationDocument({ db, app }: { db: DemoDatabase; app: MenteeApplication }) {
  const e = db.employees.find((x) => x.id === app.employeeId);
  const cohort = db.cohorts.find((c) => c.id === app.cohortId);
  const checks = preferredMentorChecks(db, app);
  const order = ['cross_functional', 'capacity', 'reporting'];
  return (
    <Card padding="none" className="overflow-hidden">
      {/* Paper header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-mentor-soft/70 to-white px-6 py-3.5">
        <p className="inline-flex items-center gap-2 text-[13px] font-semibold text-mentor">
          <FileText className="size-4" /> One-page mentee application
        </p>
        <p className="text-xs text-ink-2">
          {cohort?.name} · {app.submittedAt ? `submitted ${formatDate(app.submittedAt)}` : 'draft'} · ref {app.id}
        </p>
      </div>

      <div className="flex flex-col gap-5 px-6 pt-5 pb-6">
        {/* 1 */}
        <section className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3">
          <span className="grid size-7 place-items-center rounded-full bg-mentor-soft text-[13px] font-bold text-mentor">1</span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-ink">{SECTION.get('profile')!.title}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <Avatar name={e?.name ?? app.employeeId} size="lg" />
              <div className="min-w-0">
                <p className="text-lg font-bold text-ink">{e?.name}</p>
                <p className="text-sm text-ink-2">{e?.designation}</p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {[
                ['Function', functionName(db, e?.functionId)],
                ['Department', e?.department],
                ['Unit', unitName(db, e?.unitId)],
                ['Grade', e?.grade],
                ['Employee code', e?.code],
                ['Reports to', employeeName(db, e?.managerId)],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-xs text-ink-2">{k}</dt>
                  <dd className="truncate text-sm font-medium text-ink">{v ?? '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* 2 */}
        <Section id="mentors">
          <p className="mb-3 text-xs text-ink-2">In order of preference. Each mentor is checked against the matching rules for {cohort?.name}.</p>
          <ol className="flex flex-col gap-2.5">
            {checks.map((c) => (
              <li key={c.mentorId} className={cn('rounded-xl border p-3.5', c.ok ? 'border-line' : 'border-danger/30 bg-danger-soft/30')}>
                <div className="flex flex-wrap items-start gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-mentor text-xs font-bold text-white">{c.rank}</span>
                  <Avatar name={c.mentor?.name ?? c.mentorId} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
                      {c.mentor?.name}
                      {c.profile && !c.profile.active && (
                        <Badge tone="neutral" size="sm">
                          Inactive mentor
                        </Badge>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink-2">
                      {c.mentor?.designation} · {functionName(db, c.mentor?.functionId)} · {unitName(db, c.mentor?.unitId, true)}
                    </p>
                    {c.profile && (
                      <div className="mt-2">
                        <StyleChips styles={c.profile.styles} />
                      </div>
                    )}
                  </div>
                  <div className="w-full shrink-0 sm:w-44">
                    <CapacityMeter load={c.load} label="top" size="sm" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line/70 pt-3 sm:pl-9">
                  {[...c.rules]
                    .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
                    .map((r) => (
                      <RulePill key={r.id} r={r} />
                    ))}
                  {c.rules
                    .filter((r) => !r.ok)
                    .map((r) => (
                      <span key={r.id} className="text-xs font-medium text-danger">
                        {r.message}
                      </span>
                    ))}
                </div>
              </li>
            ))}
          </ol>
        </Section>

        {/* 3–4 */}
        <Section id="why">
          <Prose>{app.whyMentors}</Prose>
        </Section>
        <Section id="goals">
          <Prose>{app.goals}</Prose>
        </Section>

        {/* 5 */}
        <Section id="reflection">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              ['My aspirations', app.aspirations],
              ['Current challenges', app.challenges],
              ['What I expect from a mentor', app.expectations],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-canvas px-3.5 py-3">
                <p className="text-xs font-semibold text-mentor">{k}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink">{v}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </Card>
  );
}
