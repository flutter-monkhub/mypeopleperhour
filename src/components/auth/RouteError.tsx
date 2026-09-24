import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { RotateCcw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui';

/** Router error boundary: unexpected render errors or failed lazy chunks. */
export function RouteError() {
  const error = useRouteError();
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : 'Unknown error';
  const chunk = /dynamically imported module|Importing a module script failed/i.test(message);
  return (
    <div className="grid min-h-screen place-items-center bg-canvas p-6">
      <div className="w-full max-w-lg rounded-card border border-line bg-white p-8 text-center shadow-card">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-danger-soft text-danger">
          <TriangleAlert className="size-7" />
        </span>
        <h1 className="mt-4 text-xl font-bold text-ink">{chunk ? 'A new version is available' : 'Something went wrong'}</h1>
        <p className="mt-2 text-sm text-ink-2">{chunk ? 'Reload the page to continue.' : 'An unexpected error occurred while showing this page.'}</p>
        {!chunk && <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-canvas p-3 text-left text-xs whitespace-pre-wrap text-ink-2">{message}</pre>}
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => (window.location.href = '/dashboard')}>
            Go to dashboard
          </Button>
          <Button icon={RotateCcw} onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    </div>
  );
}
