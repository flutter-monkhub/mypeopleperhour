// Admin-relevant events for the top-bar notification bell, derived from the data
// (no separate admin inbox in the seed): new mentoring applications, mentor decisions,
// missed sessions, calendar sync failures, pulse survey activity.

import type { AdminPermission, DemoDatabase, ID } from '@shared/types';
import { MISSED_REASON_LABELS } from '@shared/content/mph';
import { formatDayShort } from '@shared/utils/dates';
import { employeeMap } from './lookup';

export type AdminEventKind = 'application' | 'match_accepted' | 'match_declined' | 'session_missed' | 'calendar_failed' | 'survey';

export interface AdminEvent {
  id: string;
  kind: AdminEventKind;
  title: string;
  body: string;
  at: string;
  /** Admin route to open */
  link: string;
}

interface Options {
  permissions: readonly AdminPermission[];
  unitId: ID | null;
  now?: Date;
  /** look-back window in days (default 14) */
  days?: number;
  limit?: number;
}

export function adminEvents(db: DemoDatabase, { permissions, unitId, now = new Date(), days = 14, limit = 12 }: Options): AdminEvent[] {
  const since = now.getTime() - days * 86400000;
  const inWindow = (iso?: string) => !!iso && new Date(iso).getTime() >= since && new Date(iso).getTime() <= now.getTime();
  const emp = employeeMap(db);
  const inUnit = (id: ID) => !unitId || emp.get(id)?.unitId === unitId;
  const name = (id: ID) => emp.get(id)?.name ?? id;
  const out: AdminEvent[] = [];

  if (permissions.includes('mentoring.view')) {
    for (const a of db.applications) {
      if (a.status === 'draft' || !inWindow(a.submittedAt) || !inUnit(a.employeeId)) continue;
      const cohort = db.cohorts.find((c) => c.id === a.cohortId);
      out.push({
        id: `app-${a.id}`,
        kind: 'application',
        title: 'New mentoring application',
        body: `${name(a.employeeId)} applied to ${cohort?.name ?? 'the programme'} · prefers ${a.preferredMentorIds.map(name).slice(0, 2).join(', ')}`,
        at: a.submittedAt as string,
        link: `/mentoring/applications/${a.id}`,
      });
    }
    for (const m of db.matches) {
      for (const h of m.history) {
        if ((h.status !== 'accepted' && h.status !== 'declined') || !inWindow(h.at)) continue;
        out.push({
          id: `match-${m.id}-${h.status}`,
          kind: h.status === 'accepted' ? 'match_accepted' : 'match_declined',
          title: h.status === 'accepted' ? 'Mentor accepted a mentee' : 'Mentor declined a request',
          body: `${name(m.mentorId)} ${h.status} ${name(m.menteeId)}${h.status === 'declined' && m.declineReason ? ` — “${m.declineReason}”` : ''}`,
          at: h.at,
          link: '/mentoring/history',
        });
      }
    }
  }

  if (permissions.includes('sessions.view')) {
    for (const s of db.sessions) {
      if (!inUnit(s.employeeId)) continue;
      if (s.status === 'missed') {
        const ev = s.history.find((h) => h.type === 'missed');
        const at = ev?.at ?? s.end;
        if (!inWindow(at)) continue;
        out.push({
          id: `missed-${s.id}`,
          kind: 'session_missed',
          title: 'Session marked as missed',
          body: `${name(s.managerId)} ↔ ${name(s.employeeId)} · ${s.missedReason ? MISSED_REASON_LABELS[s.missedReason] : 'No reason'} · ${formatDayShort(s.start)}`,
          at,
          link: '/sessions/missed-reasons',
        });
      } else if (s.status === 'scheduled' && !s.calendarSynced) {
        const ev = s.history.find((h) => h.type === 'calendar_failed');
        const at = ev?.at ?? s.createdAt;
        if (!inWindow(at)) continue;
        out.push({
          id: `cal-${s.id}`,
          kind: 'calendar_failed',
          title: 'Calendar sync failed',
          body: `${name(s.managerId)} ↔ ${name(s.employeeId)} · Outlook invite not created`,
          at,
          link: '/sessions',
        });
      }
    }
  }

  if (permissions.includes('surveys.view')) {
    for (const sv of db.surveys) {
      if (sv.status !== 'published' || !inWindow(sv.publishedAt)) continue;
      const n = db.responses.filter((r) => r.surveyId === sv.id && r.status === 'submitted' && (!unitId || r.unitId === unitId)).length;
      out.push({ id: `survey-${sv.id}`, kind: 'survey', title: `${sv.title} is live`, body: `${n} responses so far`, at: sv.publishedAt as string, link: `/surveys/${sv.id}/responses` });
    }
  }

  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}
