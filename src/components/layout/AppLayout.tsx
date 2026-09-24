import { Suspense, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { PageSkeleton } from '@/components/ui';
import { IdleGuard } from './IdleGuard';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useRouteHandle } from './routeHandle';

/** Authenticated shell: navy sidebar + sticky top bar + centred content (max 1400px). */
export function AppLayout() {
  const handle = useRouteHandle();
  useEffect(() => {
    document.title = handle?.title ? `${handle.title} · MyPeopleHour Admin` : 'MyPeopleHour Admin · PCBL';
  }, [handle?.title]);

  return (
    <div className="min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex min-h-screen flex-col lg:pl-66">
        <Topbar />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <IdleGuard />
    </div>
  );
}
