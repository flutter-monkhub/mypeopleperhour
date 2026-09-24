import { useMatches } from 'react-router-dom';

export type TopbarFilter = 'unit' | 'month';

/** Attach to routes in routes.tsx via `handle`. */
export interface RouteHandle {
  /** Page title (breadcrumb + document.title) */
  title: string;
  /** Breadcrumb group, e.g. "MyPeopleHour" */
  group?: string;
  /** Global filters shown in the top bar for this page (default none) */
  filters?: TopbarFilter[];
}

/** Handle of the deepest matched route that has one. */
export function useRouteHandle(): RouteHandle | undefined {
  const matches = useMatches();
  for (let i = matches.length - 1; i >= 0; i--) {
    const h = matches[i].handle as RouteHandle | undefined;
    if (h?.title) return h;
  }
  return undefined;
}
