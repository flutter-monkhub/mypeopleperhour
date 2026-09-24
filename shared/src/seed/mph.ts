// MyPeopleHour seed: monthly sessions per manager ↔ direct report pair since programme
// launch (current month − 5), plus quick-capture notes and monthly mood checks.

import type { ActionItem, Employee, MissedReason, MoodCheck, Note, NoteTag, Session, SessionEvent, SessionMode } from '../types';
import { addDays, addMonthsToKey, daysInMonth, monthKey, monthKeyToDate, monthRange, startOfDay } from '../utils/dates';
import { chance, createRng, int, pick, weighted, type Rng } from '../utils/random';
import { DEMO } from './org';

const HOURS: [number, number][] = [
  [9, 30], [10, 0], [10, 30], [11, 0], [12, 0], [14, 0], [14, 30], [15, 0], [16, 0], [16, 30], [17, 0],
];
const VENUES = ['Cabin – Level 3', 'Conference Room B', 'Collaboration Zone', 'Plant Admin Block – Room 2', 'Café Corner', 'Board Room – Level 5'];
const AGENDAS = [
  'Career conversation – next steps',
  'Check-in after quarter close',
  'Workload & priorities for the month',
  'Learning plan for the next quarter',
  'Reflections on the recent project',
  'Well-being check-in',
];
const RESCHEDULE_NOTES = ['Clash with plant audit', 'Customer visit moved', 'Board review preparation', 'Travel to Palej plant', 'Employee request – personal appointment'];
const MISSED_REMARKS: Record<MissedReason, string[]> = {
  business_emergency: ['Customer escalation needed immediate attention', 'Unplanned plant shutdown', 'Urgent quarter-close review', 'Safety incident response at site'],
  personal_emergency: ['Family medical emergency', 'Employee unwell', 'Manager on emergency leave'],
};

const hash = (rng: Rng) => Math.floor(rng() * 1e12).toString(36) + Math.floor(rng() * 1e12).toString(36);

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

/** Random working-day date within [fromDay, toDay] of the month. */
const workdayInMonth = (rng: Rng, key: string, fromDay: number, toDay: number): Date | null => {
  const base = monthKeyToDate(key);
  const days: number[] = [];
  for (let d = fromDay; d <= toDay; d++) {
    const x = new Date(base.getFullYear(), base.getMonth(), d);
    if (!isWeekend(x)) days.push(d);
  }
  if (!days.length) return null;
  const day = pick(rng, days);
  const [h, m] = pick(rng, HOURS);
  return new Date(base.getFullYear(), base.getMonth(), day, h, m);
};

/** Next working day at or after `d` (keeps time). */
const nextWorkday = (d: Date) => {
  let x = new Date(d);
  while (isWeekend(x)) x = addDays(x, 1);
  return x;
};
/** Previous working day at or before `d` (keeps time). */
const prevWorkday = (d: Date) => {
  let x = new Date(d);
  while (isWeekend(x)) x = addDays(x, -1);
  return x;
};

type Outcome = 'completed' | 'missed' | 'scheduled' | 'none';

interface ForcedSession {
  outcome: Outcome;
  /** days from today (negative = past) */
  dayOffset?: number;
  time?: [number, number];
  mode?: SessionMode;
  missedReason?: MissedReason;
  missedRemark?: string;
  rating?: number;
  agenda?: string;
}

/** Hand-authored sessions for the demo personas. Key: employeeId|monthOffset (0 = current month). */
const FORCED: Record<string, ForcedSession> = {
  // Priya Mehta's team — current month mirrors the sample manager dashboard
  'E00123|0': { outcome: 'scheduled', dayOffset: 2, time: [11, 0], mode: 'teams', agenda: 'Career conversation – moving into a lead role' },
  'E00125|0': { outcome: 'scheduled', dayOffset: 2, time: [15, 0], mode: 'teams' },
  // Arjun's hour was yesterday but Priya hasn't marked it yet → "Awaiting update"
  'E00136|0': { outcome: 'scheduled', dayOffset: -1, time: [10, 30], mode: 'in_person', agenda: 'Onboarding check-in – tools & ways of working' },
  'E00127|0': { outcome: 'completed', dayOffset: -9, time: [11, 0], rating: 5 },
  'E00131|0': { outcome: 'completed', dayOffset: -6, time: [15, 0], rating: 4 },
  'E00138|0': { outcome: 'completed', dayOffset: -3, time: [10, 0], rating: 5 },
  'E00133|0': { outcome: 'none' },
  'E00135|0': { outcome: 'none' },
  'E00139|0': { outcome: 'missed', dayOffset: -4, time: [16, 0], missedReason: 'business_emergency', missedRemark: 'Customer escalation needed immediate attention' },
  // Riya's history: 4 of 5 previous months completed
  'E00125|-5': { outcome: 'completed', rating: 4 },
  'E00125|-4': { outcome: 'completed', rating: 5 },
  'E00125|-3': { outcome: 'missed', missedReason: 'personal_emergency', missedRemark: 'Employee unwell' },
  'E00125|-2': { outcome: 'completed', rating: 4 },
  'E00125|-1': { outcome: 'completed', rating: 5 },
  // Aarav — consistent history
  'E00123|-5': { outcome: 'completed', rating: 4 },
  'E00123|-4': { outcome: 'completed', rating: 5 },
  'E00123|-3': { outcome: 'completed', rating: 5 },
  'E00123|-2': { outcome: 'completed', rating: 4 },
  'E00123|-1': { outcome: 'completed', rating: 5 },
  // Priya's own hour with her manager (Vivek) is coming up
  'E00112|0': { outcome: 'scheduled', dayOffset: 6, time: [16, 0], mode: 'teams' },
  // Anjali (mentor persona) already had hers this month
  'E00015|0': { outcome: 'completed', dayOffset: -7, time: [10, 0], rating: 5 },
};

const MANAGER_DISCIPLINE: Record<string, number> = { E00112: 0.93, E00015: 0.95, E00006: 0.9, E00002: 0.88 };

export interface MphSeed {
  sessions: Session[];
  notes: Note[];
  moodChecks: MoodCheck[];
  /** per manager discipline, reused by the survey seed to correlate outcomes */
  discipline: Record<string, number>;
}

export function generateMph(employees: Employee[], now: Date): MphSeed {
  const rng = createRng(20260424);
  const today = startOfDay(now);
  const currentKey = monthKey(today);
  const months = monthRange(addMonthsToKey(currentKey, -5), currentKey);
  const byId = new Map(employees.map((e) => [e.id, e]));

  const managers = new Set(employees.filter((e) => e.managerId).map((e) => e.managerId!));
  const discipline: Record<string, number> = {};
  const quality: Record<string, number> = {};
  managers.forEach((m) => {
    discipline[m] = MANAGER_DISCIPLINE[m] ?? (chance(rng, 0.12) ? 0.42 + rng() * 0.2 : 0.66 + rng() * 0.31);
    quality[m] = 3.3 + rng() * 1.5;
  });

  const sessions: Session[] = [];
  let seq = 1;

  const build = (emp: Employee, managerId: string, key: string, outcome: Exclude<Outcome, 'none'>, start: Date, f?: ForcedSession): Session => {
    const mode: SessionMode = f?.mode ?? (chance(rng, 0.55) ? 'teams' : 'in_person');
    const end = new Date(start.getTime() + 60 * 60000);
    const createdAt = new Date(Math.min(start.getTime() - int(rng, 4, 18) * 86400000, now.getTime() - 3600000));
    const history: SessionEvent[] = [
      { at: createdAt.toISOString(), type: 'created', by: managerId },
      { at: new Date(createdAt.getTime() + 60000).toISOString(), type: 'calendar_synced', by: 'system', note: mode === 'teams' ? 'Outlook invite + Teams meeting created' : 'Outlook invite sent' },
    ];
    if (chance(rng, 0.14)) {
      const at = new Date(createdAt.getTime() + int(rng, 1, 3) * 86400000);
      if (at < start && at < now) history.push({ at: at.toISOString(), type: 'rescheduled', by: managerId, note: pick(rng, RESCHEDULE_NOTES) });
    }
    const s: Session = {
      id: `S${String(seq++).padStart(5, '0')}`,
      managerId,
      employeeId: emp.id,
      month: key,
      status: outcome,
      start: start.toISOString(),
      end: end.toISOString(),
      mode,
      calendarSynced: true,
      outlookEventId: `AAMkAG${hash(rng)}`,
      history,
      createdAt: createdAt.toISOString(),
    };
    if (mode === 'teams') s.teamsLink = `https://teams.microsoft.com/l/meetup-join/19%3ameeting_${hash(rng)}%40thread.v2/0`;
    else s.venue = pick(rng, VENUES);
    if (f?.agenda) s.agenda = f.agenda;
    else if (chance(rng, 0.35)) s.agenda = pick(rng, AGENDAS);

    if (outcome === 'completed') {
      const doneAt = new Date(Math.min(end.getTime() + int(rng, 1, 20) * 3600000, now.getTime() - 60000));
      s.completedAt = doneAt.toISOString();
      history.push({ at: s.completedAt, type: 'completed', by: managerId });
      const q = quality[managerId];
      if (f?.rating) s.employeeRating = f.rating;
      else if (chance(rng, 0.72)) s.employeeRating = Math.max(2, Math.min(5, Math.round(q + (rng() - 0.5) * 1.6)));
    } else if (outcome === 'missed') {
      const reason: MissedReason = f?.missedReason ?? weighted(rng, [['business_emergency', 0.62], ['personal_emergency', 0.38]] as const);
      s.missedReason = reason;
      s.missedRemark = f?.missedRemark ?? pick(rng, MISSED_REMARKS[reason]);
      const at = new Date(Math.min(end.getTime() + 3600000, now.getTime() - 60000));
      history.push({ at: at.toISOString(), type: 'missed', by: managerId, note: s.missedRemark });
    }
    history.sort((a, b) => a.at.localeCompare(b.at));
    return s;
  };

  const pairs = employees.filter((e) => e.managerId && e.status !== 'inactive');
  const lastDay = daysInMonth(today.getFullYear(), today.getMonth());
  const todayDate = today.getDate();

  for (const emp of pairs) {
    const managerId = emp.managerId!;
    const d = discipline[managerId];
    const joined = new Date(emp.dateOfJoining);

    months.forEach((key, idx) => {
      const offset = idx - (months.length - 1); // -5 … 0
      const monthStart = monthKeyToDate(key);
      if (joined > addDays(monthStart, 20)) return;
      const trend = [-0.1, -0.06, -0.03, 0, 0.02, 0.03][idx] ?? 0;
      const p = Math.max(0.2, Math.min(0.99, d + trend + (rng() - 0.5) * 0.08));
      const forced = FORCED[`${emp.id}|${offset}`];

      if (offset < 0) {
        const outcome: Outcome = forced?.outcome ?? (rng() < p ? 'completed' : rng() < 0.55 ? 'missed' : 'none');
        if (outcome === 'none') return;
        const start = workdayInMonth(rng, key, 1, daysInMonth(monthStart.getFullYear(), monthStart.getMonth()));
        if (!start) return;
        sessions.push(build(emp, managerId, key, outcome as Exclude<Outcome, 'none'>, start, forced));
        return;
      }

      // Current month
      let outcome: Outcome;
      let start: Date | null = null;
      if (forced) {
        outcome = forced.outcome;
        if (outcome !== 'none') {
          const [h, m] = forced.time ?? pick(rng, HOURS);
          let day = addDays(today, forced.dayOffset ?? 0);
          day = outcome === 'scheduled' && (forced.dayOffset ?? 0) > 0 ? nextWorkday(day) : prevWorkday(day);
          start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m);
        }
      } else {
        const frac = (todayDate - 1) / lastDay;
        const r = rng();
        if (r < p * frac * 1.05) outcome = 'completed';
        else if (r < p * frac * 1.05 + 0.05 * frac) outcome = 'missed';
        else if (r < p * 0.97) outcome = 'scheduled';
        else outcome = 'none';
        if (outcome === 'completed' || outcome === 'missed') start = workdayInMonth(rng, key, 1, todayDate - 1);
        if (outcome === 'scheduled') start = workdayInMonth(rng, key, todayDate + 1, lastDay);
      }
      if (outcome === 'none' || !start) return;
      // Keep sessions inside the current month; fall back sensibly at month edges.
      if (monthKey(start) !== key) {
        if (outcome !== 'scheduled') return;
        const alt = workdayInMonth(rng, key, todayDate + 1, lastDay);
        if (!alt) return;
        start = alt;
      }
      if (outcome !== 'scheduled' && start >= today) outcome = 'scheduled';
      if (outcome === 'scheduled' && start < now && !forced) return;
      sessions.push(build(emp, managerId, key, outcome as Exclude<Outcome, 'none'>, start, forced));
    });
  }

  sessions.sort((a, b) => a.start.localeCompare(b.start));

  return {
    sessions,
    notes: generateNotes(rng, sessions, byId, now),
    moodChecks: generateMoods(rng, employees, discipline, months, now),
    discipline,
  };
}

// ───────────────────────── Notes ─────────────────────────

const GENERIC_NOTES: { title: string; body: string; tags: NoteTag[]; actions: string[] }[] = [
  {
    title: 'Energy is back after a heavy quarter',
    body: 'Talked about the last few weeks — workload has eased. Wants more ownership of client-facing work. Recognised the turnaround on the monthly report.',
    tags: ['wellbeing', 'recognition'],
    actions: ['Introduce to the key account team', 'Review workload split in two weeks'],
  },
  {
    title: 'Keen on a stretch assignment',
    body: 'Expressed interest in the cross-plant improvement project. Discussed what readiness looks like. Needs exposure to budgeting.',
    tags: ['career', 'development'],
    actions: ['Nominate for the Q3 improvement project', 'Share budgeting basics course'],
  },
  {
    title: 'Blocked on approvals',
    body: 'Main frustration is slow approvals from procurement. Agreed I will raise it in the ops review. Otherwise in good spirits.',
    tags: ['support'],
    actions: ['Raise approval turnaround in ops review'],
  },
  {
    title: 'Working on presentation confidence',
    body: 'We discussed the leadership review. Content is strong; delivery can be crisper. Will do a dry run together before the next one.',
    tags: ['development', 'observation'],
    actions: ['Schedule dry run before next review'],
  },
  {
    title: 'Family commitments this month',
    body: 'Needs some flexibility over the next few weeks. Agreed on adjusted hours. Appreciated the open conversation.',
    tags: ['wellbeing', 'support'],
    actions: ['Confirm flexible schedule with the team'],
  },
  {
    title: 'Strong month — recognised',
    body: 'Delivered the audit documentation ahead of time. Shared specific appreciation. Wants to mentor the new joiner.',
    tags: ['recognition', 'strength'],
    actions: ['Pair with new joiner for onboarding'],
  },
];

const PRIYA_NOTES: Record<string, { title: string; body: string; tags: NoteTag[]; actions: string[] }[]> = {
  E00123: [
    { title: 'Ready for a lead role?', body: 'Aarav wants to lead the demand-forecasting workstream. Strong technically; needs to delegate more. Discussed what “lead” means beyond delivery.', tags: ['career', 'development'], actions: ['Let Aarav run the next sprint review', 'Share the lead-role expectations doc'] },
    { title: 'Mentoring programme', body: 'He has been matched with a mentor from Manufacturing — excited about the exposure to plant operations. Encouraged him to bring a clear agenda.', tags: ['career'], actions: ['Check in on mentoring progress next month'] },
  ],
  E00125: [
    { title: 'Settling in well', body: 'Riya is enjoying the dashboard work. Wants to learn Python beyond SQL. Feels comfortable asking questions now.', tags: ['development', 'wellbeing'], actions: ['Enrol Riya in the Python for Analysts course'] },
    { title: 'Visibility with stakeholders', body: 'She would like to present her own work in the monthly business review instead of me presenting it.', tags: ['career', 'recognition'], actions: ['Give Riya the MBR slot for the sales dashboard'] },
  ],
  E00127: [{ title: 'Client feedback was excellent', body: 'Sanjay’s insights deck was praised by the Exports team. Talked about packaging insights into a repeatable playbook.', tags: ['recognition', 'strength'], actions: ['Draft insights playbook outline'] }],
  E00131: [{ title: 'Workload spike', body: 'Meera is juggling three requests. We agreed to route new requests through me for two weeks.', tags: ['wellbeing', 'support'], actions: ['Route incoming requests via Priya for 2 weeks'] }],
  E00138: [{ title: 'Interested in people management', body: 'Pooja asked about becoming a people manager. Discussed buddying the two new associates as a first step.', tags: ['career'], actions: ['Assign Pooja as buddy for new associates'] }],
  E00139: [{ title: 'Needs clearer priorities', body: 'Karan feels pulled between Sales and Marketing asks. Agreed a weekly priority list.', tags: ['support', 'observation'], actions: ['Send weekly priority list every Monday'] }],
  E00133: [{ title: 'Exploring data engineering', body: 'Vikram is curious about the data platform team. Open to a rotation later in the year.', tags: ['career'], actions: ['Explore rotation with the platform team'] }],
  E00135: [{ title: 'Confidence growing', body: 'Neha handled the regional sales queries independently this month. Recognised her initiative.', tags: ['recognition'], actions: [] }],
  E00136: [{ title: 'Onboarding feedback', body: 'Arjun would like more structured onboarding documentation for tools. Will pair him with Aarav.', tags: ['support'], actions: ['Pair Arjun with Aarav for tool walkthroughs'] }],
};

const PREP_NOTES: Record<string, { title: string; body: string; tags: NoteTag[] }> = {
  E00123: { title: 'Prep: observations for this month', body: '• Handled the forecasting model review really well — call out specifically.\n• Noticed he is working late often — check workload.\n• Ask how the mentoring conversation went.', tags: ['observation', 'wellbeing'] },
  E00125: { title: 'Prep: talking points', body: '• Recognise the sales dashboard she built.\n• Follow up on the Python course.\n• Ask what support she needs before her MBR presentation.', tags: ['observation', 'recognition'] },
};

function generateNotes(rng: Rng, sessions: Session[], byId: Map<string, Employee>, now: Date): Note[] {
  const notes: Note[] = [];
  let seq = 1;
  const id = () => `N${String(seq++).padStart(5, '0')}`;
  const actionItems = (texts: string[], at: Date, done: boolean): ActionItem[] =>
    texts.map((text, i) => ({
      id: `A${String(seq).padStart(5, '0')}${i}`,
      text,
      owner: i % 2 === 0 ? 'manager' : 'employee',
      dueDate: addDays(at, 14 + i * 7).toISOString(),
      done,
      doneAt: done ? addDays(at, 10).toISOString() : undefined,
    }));

  const recentFrom = addMonthsToKey(monthKey(now), -2);
  const priyaCount: Record<string, number> = {};

  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    const isPriya = s.managerId === DEMO.manager;
    const at = new Date(s.completedAt ?? s.end);
    if (isPriya) {
      const pool = PRIYA_NOTES[s.employeeId];
      if (!pool) continue;
      const i = priyaCount[s.employeeId] ?? 0;
      priyaCount[s.employeeId] = i + 1;
      const t = pool[i % pool.length];
      const old = at < addDays(now, -45);
      notes.push({
        id: id(),
        authorId: s.managerId,
        employeeId: s.employeeId,
        sessionId: s.id,
        month: s.month,
        kind: 'session',
        title: i >= pool.length ? `${t.title} (follow-up)` : t.title,
        body: t.body,
        tags: t.tags,
        actions: actionItems(t.actions, at, old),
        createdAt: at.toISOString(),
        updatedAt: at.toISOString(),
        archived: false,
      });
      continue;
    }
    if (s.month < recentFrom || !chance(rng, 0.45)) continue;
    const t = pick(rng, GENERIC_NOTES);
    notes.push({
      id: id(),
      authorId: s.managerId,
      employeeId: s.employeeId,
      sessionId: s.id,
      month: s.month,
      kind: 'session',
      title: t.title,
      body: t.body.replace(/^/, `${byId.get(s.employeeId)?.firstName ?? ''}: `),
      tags: t.tags,
      actions: actionItems(t.actions, at, chance(rng, 0.5)),
      createdAt: at.toISOString(),
      updatedAt: at.toISOString(),
      archived: false,
    });
  }

  // Preparation notes for Priya's upcoming sessions
  for (const s of sessions) {
    if (s.managerId !== DEMO.manager || s.status !== 'scheduled') continue;
    const t = PREP_NOTES[s.employeeId];
    if (!t) continue;
    const at = addDays(now, -1);
    notes.push({
      id: id(),
      authorId: s.managerId,
      employeeId: s.employeeId,
      sessionId: s.id,
      month: s.month,
      kind: 'prep',
      title: t.title,
      body: t.body,
      tags: t.tags,
      actions: [],
      createdAt: at.toISOString(),
      updatedAt: at.toISOString(),
      archived: false,
    });
  }
  return notes;
}

// ───────────────────────── Mood checks ─────────────────────────

function generateMoods(rng: Rng, employees: Employee[], discipline: Record<string, number>, months: string[], now: Date): MoodCheck[] {
  const out: MoodCheck[] = [];
  let seq = 1;
  const recent = months.slice(-3);
  for (const e of employees) {
    if (!e.managerId) continue;
    const d = discipline[e.managerId] ?? 0.75;
    recent.forEach((key, i) => {
      const isCurrent = i === recent.length - 1;
      if (e.id === DEMO.employee && isCurrent) return; // Riya can answer this month's check in the app
      if (!chance(rng, isCurrent ? 0.45 : 0.62)) return;
      const mean = 2.6 + d * 2 + i * 0.1;
      const mood = Math.max(1, Math.min(5, Math.round(mean + (rng() - 0.5) * 2)));
      const base = monthKeyToDate(key);
      const day = isCurrent ? Math.max(1, Math.min(now.getDate() - 1, int(rng, 1, 20))) : int(rng, 3, 25);
      out.push({ id: `M${String(seq++).padStart(5, '0')}`, employeeId: e.id, month: key, mood, at: new Date(base.getFullYear(), base.getMonth(), day, 12).toISOString() });
    });
  }
  return out;
}
