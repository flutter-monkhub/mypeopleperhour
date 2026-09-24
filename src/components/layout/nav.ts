// Sidebar navigation. Items without the permission are hidden (see Sidebar).
// Active state = longest matching path prefix, so /surveys/pulse highlights "Pulse analysis"
// while /surveys/new highlights "Surveys".

import type { AdminPermission } from '@shared/types';
import {
  Activity,
  Archive,
  CalendarCheck,
  ChartColumn,
  ClipboardList,
  FileText,
  GraduationCap,
  HeartHandshake,
  History,
  LayoutDashboard,
  MessageSquareWarning,
  Network,
  Settings,
  Shuffle,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  perm?: AdminPermission;
  /** Optional counter key (computed in Sidebar) */
  badge?: 'pendingApplications';
}

export interface NavGroup {
  /** Omit for the trailing ungrouped section */
  label?: string;
  items: NavItem[];
}

export const NAV: NavGroup[] = [
  { label: 'Overview', items: [{ label: 'Leadership dashboard', to: '/dashboard', icon: LayoutDashboard, perm: 'dashboard.view' }] },
  {
    label: 'Organisation',
    items: [
      { label: 'Employees', to: '/employees', icon: Users, perm: 'employees.view' },
      { label: 'Organisation', to: '/organisation', icon: Network, perm: 'employees.view' },
    ],
  },
  {
    label: 'MyPeopleHour',
    items: [
      { label: 'Sessions', to: '/sessions', icon: CalendarCheck, perm: 'sessions.view' },
      { label: 'Missed reasons', to: '/sessions/missed-reasons', icon: MessageSquareWarning, perm: 'sessions.view' },
      { label: 'Archive', to: '/sessions/archive', icon: Archive, perm: 'sessions.view' },
    ],
  },
  {
    label: 'Surveys',
    items: [
      { label: 'Surveys', to: '/surveys', icon: ClipboardList, perm: 'surveys.view' },
      { label: 'Pulse analysis', to: '/surveys/pulse', icon: Activity, perm: 'surveys.view' },
    ],
  },
  {
    label: 'Mentoring',
    items: [
      { label: 'Dashboard', to: '/mentoring', icon: HeartHandshake, perm: 'mentoring.view' },
      { label: 'Mentors', to: '/mentoring/mentors', icon: GraduationCap, perm: 'mentoring.view' },
      { label: 'Mentees', to: '/mentoring/mentees', icon: UsersRound, perm: 'mentoring.view' },
      { label: 'Applications', to: '/mentoring/applications', icon: FileText, perm: 'mentoring.view', badge: 'pendingApplications' },
      { label: 'Matching', to: '/mentoring/matching', icon: Shuffle, perm: 'mentoring.view' },
      { label: 'Match history', to: '/mentoring/history', icon: History, perm: 'mentoring.view' },
    ],
  },
  {
    items: [
      { label: 'Reports', to: '/reports', icon: ChartColumn, perm: 'reports.export' },
      { label: 'Settings', to: '/settings', icon: Settings },
    ],
  },
];

const ALL_PATHS = NAV.flatMap((g) => g.items.map((i) => i.to));

/** The nav path that should be highlighted for a location (longest prefix). */
export function activeNavPath(pathname: string): string | undefined {
  return ALL_PATHS.filter((p) => pathname === p || pathname.startsWith(`${p}/`)).sort((a, b) => b.length - a.length)[0];
}
