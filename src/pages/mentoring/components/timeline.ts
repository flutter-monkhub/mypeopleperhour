// Builds the status story of an application and its match records for <StatusTimeline>.

import type { DemoDatabase, MenteeApplication, MentorMatch } from '@shared/types';
import { employeeName } from '@/lib/lookup';
import { matchesByApplication } from '@/lib/analytics-mentoring';
import type { TimelineItem } from './StatusTimeline';

const actor = (db: DemoDatabase, by: string) => (by === 'system' ? 'System' : employeeName(db, by));

/** One match record's history. */
export function matchTimeline(db: DemoDatabase, m: MentorMatch): TimelineItem[] {
  const mentor = employeeName(db, m.mentorId);
  return m.history.map((h, i) => {
    const base = { key: `${m.id}-${i}`, at: h.at, by: actor(db, h.by) };
    switch (h.status) {
      case 'proposed':
        return { ...base, title: `Proposed to ${mentor}`, note: h.note && h.note !== 'HR shortlist' ? h.note : undefined, tone: 'warning' as const };
      case 'accepted':
        return { ...base, title: `${mentor} accepted`, tone: 'info' as const };
      case 'declined':
        return { ...base, title: `${mentor} declined`, note: h.note ?? m.declineReason, tone: 'danger' as const };
      case 'active':
        return { ...base, title: `Final match confirmed with ${mentor}`, note: h.note, tone: 'success' as const };
      case 'completed':
        return { ...base, title: 'Programme completed', tone: 'mentor' as const };
      case 'withdrawn':
        return { ...base, title: `Proposal to ${mentor} withdrawn`, note: h.note, tone: 'neutral' as const };
      default:
        return { ...base, title: h.status };
    }
  });
}

/** Application history merged with its match records (duplicated milestones collapsed). */
export function applicationTimeline(db: DemoDatabase, app: MenteeApplication): TimelineItem[] {
  const matches = matchesByApplication(db).get(app.id) ?? [];
  const items: TimelineItem[] = [];
  app.history.forEach((h, i) => {
    const base = { key: `${app.id}-${i}`, at: h.at, by: actor(db, h.by) };
    switch (h.status) {
      case 'submitted':
        items.push({ ...base, title: 'Application submitted', tone: 'info' });
        break;
      case 'under_review':
        items.push({ ...base, title: h.note?.startsWith('Mentor declined') || h.note?.includes('withdrawn') ? 'Back to review' : 'Review started', note: h.note, tone: 'warning' });
        break;
      case 'shortlisted':
        // the match record's "Proposed to …" tells the same story with the mentor's name
        if (!matches.length) items.push({ ...base, title: 'Shortlisted', note: h.note, tone: 'mentor' });
        break;
      case 'matched':
        if (!matches.some((m) => m.status === 'active' || m.status === 'completed')) items.push({ ...base, title: 'Matched', note: h.note, tone: 'success' });
        break;
      case 'not_matched':
        items.push({ ...base, title: 'Not matched', note: h.note, tone: 'danger' });
        break;
      case 'withdrawn':
        items.push({ ...base, title: 'Withdrawn by applicant', note: h.note, tone: 'neutral' });
        break;
      default:
        items.push({ ...base, title: h.status, note: h.note });
    }
  });
  for (const m of matches) items.push(...matchTimeline(db, m));
  return items.sort((a, b) => a.at.localeCompare(b.at));
}
