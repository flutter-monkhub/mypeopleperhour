// Assembles the complete demo database. Deterministic for a given `now` (day precision).

import type { AdminUser, AppNotification, DemoDatabase, NotificationKind } from '../types';
import { addDays, formatDayShort, formatTime, startOfDay } from '../utils/dates';
import { DEMO, FUNCTIONS, GRADES, LOCATIONS, UNITS, generateEmployees } from './org';
import { generateMph } from './mph';
import { generateSurveys } from './surveys';
import { generateMentoring } from './mentoring';

export const SEED_VERSION = 1;

export { DEMO } from './org';

export function createSeed(now: Date = new Date()): DemoDatabase {
  // Anchor generation to 09:00 today so the output is stable for the whole day.
  const anchor = new Date(startOfDay(now).getTime() + 9 * 3600000);
  const employees = generateEmployees();
  const mph = generateMph(employees, anchor);
  const surveys = generateSurveys(employees, mph.discipline, anchor);
  const mentoring = generateMentoring(employees, anchor);

  const db: DemoDatabase = {
    version: SEED_VERSION,
    generatedAt: anchor.toISOString(),
    units: UNITS,
    functions: FUNCTIONS,
    grades: GRADES,
    locations: LOCATIONS,
    employees,
    sessions: mph.sessions,
    notes: mph.notes,
    moodChecks: mph.moodChecks,
    surveys: surveys.surveys,
    responses: surveys.responses,
    ...mentoring,
    notifications: [],
    adminUsers: ADMIN_USERS(anchor),
  };
  db.notifications = generateNotifications(db, anchor);
  return db;
}

const ADMIN_USERS = (now: Date): AdminUser[] => [
  { id: 'AD01', employeeId: DEMO.chro, name: 'Nandini Rao', email: 'nandini.rao@pcbl.demo', title: 'Chief Human Resources Officer', role: 'super_admin', active: true, lastLoginAt: addDays(now, -1).toISOString() },
  { id: 'AD02', employeeId: DEMO.talentHead, name: 'Kavita Menon', email: 'kavita.menon@pcbl.demo', title: 'Head – Talent & L&D', role: 'programme_admin', active: true, lastLoginAt: addDays(now, -0.2).toISOString() },
  { id: 'AD03', employeeId: DEMO.coo, name: 'Rakesh Agarwal', email: 'rakesh.agarwal@pcbl.demo', title: 'Chief Operating Officer', role: 'leadership', active: true, lastLoginAt: addDays(now, -3).toISOString() },
  { id: 'AD04', employeeId: DEMO.hrbpDurgapur, name: 'Sameer Joshi', email: 'sameer.joshi@pcbl.demo', title: 'HR Business Partner – Durgapur', role: 'hr_admin', unitScope: 'U-DGP', active: true, lastLoginAt: addDays(now, -2).toISOString() },
  { id: 'AD05', employeeId: 'E00005', name: 'Vikrant Chopra', email: 'vikrant.chopra@pcbl.demo', title: 'Chief Commercial Officer', role: 'leadership', active: true, lastLoginAt: addDays(now, -9).toISOString() },
];

function generateNotifications(db: DemoDatabase, now: Date): AppNotification[] {
  const out: AppNotification[] = [];
  let seq = 1;
  const name = (id: string) => db.employees.find((e) => e.id === id)?.name ?? id;
  const push = (recipientId: string, kind: NotificationKind, title: string, body: string, link: string, hoursAgo: number, read = false) =>
    out.push({ id: `NT${String(seq++).padStart(4, '0')}`, recipientId, kind, title, body, link, createdAt: new Date(now.getTime() - hoursAgo * 3600000).toISOString(), read });

  const pulse = db.surveys.find((s) => s.kind === 'pulse' && s.status === 'published');
  const sessionOf = (employeeId: string) => db.sessions.filter((s) => s.employeeId === employeeId && s.status === 'scheduled').sort((a, b) => a.start.localeCompare(b.start))[0];

  // Riya — employee
  const riya = sessionOf(DEMO.employee);
  if (riya) {
    push(DEMO.employee, 'session_reminder', 'Your MyPeopleHour is coming up', `${formatDayShort(riya.start)} at ${formatTime(riya.start)} with ${name(riya.managerId)}. Your calendar is blocked.`, `/session/${riya.id}`, 2);
    push(DEMO.employee, 'session_scheduled', 'MyPeopleHour scheduled', `${name(riya.managerId)} scheduled your monthly conversation. Teams link added to Outlook.`, `/session/${riya.id}`, 72, true);
  }
  if (pulse) push(DEMO.employee, 'survey_published', `${pulse.title} is live`, 'Takes about 3 minutes. Your responses are confidential.', `/surveys/${pulse.id}`, 30);
  push(DEMO.employee, 'mentoring_application', 'Mentoring applications are open', 'Cohort 2 is now accepting applications. Choose 2–3 mentors from outside your function.', '/mentoring', 50);

  // Priya — manager
  push(DEMO.manager, 'system', '2 team members still to be scheduled', 'Vikram Patel and Neha Kapoor do not have a MyPeopleHour this month yet.', '/team', 5);
  const karan = db.sessions.find((s) => s.employeeId === 'E00139' && s.status === 'missed');
  if (karan) push(DEMO.manager, 'session_missed', 'Session marked as missed', 'Karan Malhotra · Business Emergency. Consider rescheduling within the month.', `/session/${karan.id}`, 96, true);
  const arjun = db.sessions.find((s) => s.employeeId === 'E00136' && s.status === 'scheduled' && new Date(s.end) < now);
  if (arjun) push(DEMO.manager, 'session_reminder', 'Did your conversation with Arjun happen?', 'Mark yesterday’s MyPeopleHour as completed or missed so the month stays accurate.', `/session/${arjun.id}`, 3);
  const aarav = sessionOf(DEMO.mentee);
  if (aarav) push(DEMO.manager, 'session_reminder', 'Prepare for your conversation with Aarav', 'Review your observations and last month’s actions before the session.', `/session/${aarav.id}`, 20);
  if (pulse) push(DEMO.manager, 'survey_published', `${pulse.title} is live`, 'Share how you are feeling this quarter.', `/surveys/${pulse.id}`, 30, true);

  // Anjali — mentor
  const reqs = db.matches.filter((m) => m.mentorId === DEMO.mentor && m.status === 'proposed');
  reqs.forEach((m, i) => push(DEMO.mentor, 'mentoring_request', 'New mentee request', `HR has shortlisted ${name(m.menteeId)} for you. Review their application and accept or decline.`, `/mentoring/requests`, 6 + i * 20));
  const conv2 = db.mentoringSessions.find((s) => s.mentorId === DEMO.mentor && s.menteeId === DEMO.mentee && s.status === 'scheduled');
  if (conv2) push(DEMO.mentor, 'mentoring_session', 'Aarav scheduled Conversation 2', `${formatDayShort(conv2.start)} at ${formatTime(conv2.start)} · Challenge & Develop`, `/mentoring/conversation/${conv2.id}`, 26);
  const anjaliMph = db.sessions.find((s) => s.employeeId === DEMO.mentor && s.status === 'completed');
  if (anjaliMph) push(DEMO.mentor, 'session_completed', 'MyPeopleHour completed', `Your conversation with ${name(anjaliMph.managerId)} was marked completed.`, `/session/${anjaliMph.id}`, 160, true);

  // Aarav — mentee
  if (conv2) push(DEMO.mentee, 'mentoring_session', 'Conversation 2 is confirmed', `Challenge & Develop with Anjali Deshmukh · ${formatDayShort(conv2.start)}, ${formatTime(conv2.start)}`, `/mentoring/conversation/${conv2.id}`, 26);
  push(DEMO.mentee, 'mentoring_action', 'Action item due in 4 days', 'Map the demand-forecasting process end-to-end with plant planning', '/mentoring', 8);
  if (aarav) push(DEMO.mentee, 'session_scheduled', 'MyPeopleHour scheduled', `${formatDayShort(aarav.start)} at ${formatTime(aarav.start)} with ${name(aarav.managerId)}.`, `/session/${aarav.id}`, 60, true);
  if (pulse) push(DEMO.mentee, 'survey_published', `${pulse.title} is live`, 'Takes about 3 minutes.', `/surveys/${pulse.id}`, 30);

  return out.filter((n) => new Date(n.createdAt) <= now && new Date(n.createdAt) >= addDays(startOfDay(now), -30));
}
