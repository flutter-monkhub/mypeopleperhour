import { Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ConfirmHost, Toaster } from '@/components/ui';
import { getRouter } from './routes';

function BootFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-canvas">
      <span className="size-8 animate-spin rounded-full border-3 border-line border-t-primary" aria-label="Loading" />
    </div>
  );
}

export default function App() {
  return (
    <>
      <Suspense fallback={<BootFallback />}>
        <RouterProvider router={getRouter()} />
      </Suspense>
      <Toaster />
      <ConfirmHost />
    </>
  );
}
