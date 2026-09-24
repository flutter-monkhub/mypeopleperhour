// All routes (SPEC §6.1/§6.2). Pages are lazy-loaded; the app shell keeps rendering while a
// page chunk loads (Suspense inside AppLayout). Guards: RequireAuth on the shell,
// RequirePermission per route (renders the 403 page inside the shell).
//
// `handle` drives the top bar: breadcrumb (group › title), document.title and which global
// filters (unit / month) are shown for that page.

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import type { AdminPermission } from '@shared/types';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { RouteError } from '@/components/auth/RouteError';
import { AppLayout, type RouteHandle } from '@/components/layout';
import { RequirePermission } from '@/lib/rbac';
import ForbiddenPage from '@/pages/errors/ForbiddenPage';
import NotFoundPage from '@/pages/errors/NotFoundPage';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const LeadershipDashboard = lazy(() => import('@/pages/dashboard/LeadershipDashboard'));
const EmployeesPage = lazy(() => import('@/pages/employees/EmployeesPage'));
const EmployeeDetailPage = lazy(() => import('@/pages/employees/EmployeeDetailPage'));
const OrganisationPage = lazy(() => import('@/pages/employees/OrganisationPage'));
const SessionsPage = lazy(() => import('@/pages/sessions/SessionsPage'));
const MissedReasonsPage = lazy(() => import('@/pages/sessions/MissedReasonsPage'));
const SessionArchivePage = lazy(() => import('@/pages/sessions/SessionArchivePage'));
const SurveysPage = lazy(() => import('@/pages/surveys/SurveysPage'));
const SurveyBuilderPage = lazy(() => import('@/pages/surveys/SurveyBuilderPage'));
const SurveyResponsesPage = lazy(() => import('@/pages/surveys/SurveyResponsesPage'));
const PulseAnalysisPage = lazy(() => import('@/pages/surveys/PulseAnalysisPage'));
const MentoringDashboard = lazy(() => import('@/pages/mentoring/MentoringDashboard'));
const MentorsPage = lazy(() => import('@/pages/mentoring/MentorsPage'));
const MenteesPage = lazy(() => import('@/pages/mentoring/MenteesPage'));
const ApplicationsPage = lazy(() => import('@/pages/mentoring/ApplicationsPage'));
const ApplicationDetailPage = lazy(() => import('@/pages/mentoring/ApplicationDetailPage'));
const MatchingWorkspace = lazy(() => import('@/pages/mentoring/MatchingWorkspace'));
const MatchHistoryPage = lazy(() => import('@/pages/mentoring/MatchHistoryPage'));
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage'));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));

type Page = LazyExoticComponent<ComponentType> | ComponentType;

/** Route helper: path + page + permission + top-bar handle. */
function page(path: string, Component: Page, perm: AdminPermission | AdminPermission[] | null, handle: RouteHandle): RouteObject {
  return {
    path,
    handle,
    element: perm ? (
      <RequirePermission perm={perm}>
        <Component />
      </RequirePermission>
    ) : (
      <Component />
    ),
  };
}

const MPH = 'MyPeopleHour';
const ORG = 'Organisation';
const SURVEYS = 'Surveys';
const MENTORING = 'Mentoring';

export const routes: RouteObject[] = [
  { path: '/login', element: <LoginPage />, errorElement: <RouteError /> },
  { path: '/forgot-password', element: <ForgotPasswordPage />, errorElement: <RouteError /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      page('dashboard', LeadershipDashboard, 'dashboard.view', { title: 'Leadership dashboard', group: 'Overview', filters: ['unit', 'month'] }),

      page('employees', EmployeesPage, 'employees.view', { title: 'Employees', group: ORG, filters: ['unit', 'month'] }),
      page('employees/:id', EmployeeDetailPage, 'employees.view', { title: 'Employee', group: ORG }),
      page('organisation', OrganisationPage, 'employees.view', { title: 'Organisation', group: ORG, filters: ['unit'] }),

      page('sessions', SessionsPage, 'sessions.view', { title: 'Sessions', group: MPH, filters: ['unit', 'month'] }),
      page('sessions/missed-reasons', MissedReasonsPage, 'sessions.view', { title: 'Missed reasons', group: MPH, filters: ['unit', 'month'] }),
      page('sessions/archive', SessionArchivePage, 'sessions.view', { title: 'Archive', group: MPH, filters: ['unit'] }),

      page('surveys', SurveysPage, 'surveys.view', { title: 'Surveys', group: SURVEYS }),
      page('surveys/new', SurveyBuilderPage, 'surveys.edit', { title: 'New survey', group: SURVEYS }),
      page('surveys/pulse', PulseAnalysisPage, 'surveys.view', { title: 'Pulse analysis', group: SURVEYS, filters: ['unit'] }),
      page('surveys/:id', SurveyBuilderPage, 'surveys.view', { title: 'Survey', group: SURVEYS }),
      page('surveys/:id/responses', SurveyResponsesPage, 'surveys.view', { title: 'Responses', group: SURVEYS, filters: ['unit'] }),

      page('mentoring', MentoringDashboard, 'mentoring.view', { title: 'Mentoring dashboard', group: MENTORING }),
      page('mentoring/mentors', MentorsPage, 'mentoring.view', { title: 'Mentors', group: MENTORING }),
      page('mentoring/mentees', MenteesPage, 'mentoring.view', { title: 'Mentees', group: MENTORING }),
      page('mentoring/applications', ApplicationsPage, 'mentoring.view', { title: 'Applications', group: MENTORING }),
      page('mentoring/applications/:id', ApplicationDetailPage, 'mentoring.view', { title: 'Application', group: MENTORING }),
      page('mentoring/matching', MatchingWorkspace, 'mentoring.view', { title: 'Matching workspace', group: MENTORING }),
      page('mentoring/history', MatchHistoryPage, 'mentoring.view', { title: 'Match history', group: MENTORING }),

      page('reports', ReportsPage, 'reports.export', { title: 'Reports', group: 'Insights', filters: ['unit', 'month'] }),
      page('settings', SettingsPage, null, { title: 'Settings', group: 'Admin' }),

      // Dev-only living style guide (stripped from production builds)
      ...(import.meta.env.DEV ? [page('dev/ui-kit', lazy(() => import('@/pages/dev/UiKitPage')), null, { title: 'UI kit', group: 'Developer', filters: ['unit', 'month'] })] : []),

      page('403', ForbiddenPage, null, { title: 'Access restricted' }),
      page('*', NotFoundPage, null, { title: 'Page not found' }),
    ],
  },
];

/** Created once, after bootstrap (so demo-hook params are already stripped from the URL). */
let router: ReturnType<typeof createBrowserRouter> | null = null;
export const getRouter = () => (router ??= createBrowserRouter(routes));
